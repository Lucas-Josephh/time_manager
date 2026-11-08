# Historique des plannings

Un `WorkSchedule` porte directement ses jours et créneaux. Ses horaires sont
conservés : le service ne les modifie jamais en place. `WorkScheduleVersion`
est supprimé.

`POST /api/schedule` crée un planning. `PATCH /api/schedule/:id` crée un nouveau
planning indépendant, dont `sourceWorkScheduleId` référence la source. Les champs
omis sont copiés ; les jours et créneaux ont de nouveaux identifiants. Même un
changement de nom crée un successeur. Le client doit utiliser l’identifiant retourné.
Une source peut avoir plusieurs descendants ; aucune propagation n’est implicite.

`GET /api/schedule` liste tous les plannings avec pagination.
`GET /api/schedule/tree` retourne les racines et leurs descendants dans `children`.
`GET /api/schedule/:id/tree` retourne un tableau contenant le planning demandé
et ses descendants (404 si absent). Les arbres ne sont pas paginés ; chaque
feuille contient `children: []`. Les lectures utilisent un instantané cohérent.

Les réponses exposent `weeklySchedule`, indexé de `1` à `7`, comme le POST. La filiation
n’accorde aucun droit sur les utilisateurs du planning source. Les administrateurs
et responsables d’équipe ou d’organisation peuvent créer ou dériver des plannings.
Les lectures restent accessibles à toute session autorisée par AuthGuard.

`UserWorkScheduleAssignment` conserve les affectations individuelles avec
`effectiveFrom`. Pour une date donnée, l’affectation applicable est la dernière
entrée en vigueur. L’unicité `(userId, effectiveFrom)` interdit deux débuts identiques.
Les affectations d’équipe et d’organisation sont supprimées : aucun héritage de
planning n’intervient dans les calculs. Les pointages référencent directement le
planning via `WorkSession.workScheduleId`.

## Affectations utilisateur

`POST /api/schedule/:id/assignments` accepte `userIds` (1 à 500 identifiants
uniques), `effectiveFrom` facultatif et `confirmRetroactive` facultatif.
Sans date, l’instant serveur est utilisé pour toute la sélection. Une date fournie
doit être un instant ISO avec offset (ex. `2026-12-01T00:00:00+01:00`).
Les créneaux restent exprimés dans le fuseau du planning ; la date d’affectation
est un instant absolu.

Un administrateur peut affecter tous les utilisateurs. Un responsable peut
sélectionner les membres de son équipe, les utilisateurs de son organisation ou
de ses descendants, ainsi que les membres des équipes de ces organisations.
Toutes les vérifications et la création groupée sont dans une transaction
sérialisée : aucun utilisateur n’est affecté si un contrôle échoue.
Une modification concurrente retourne `409 concurrent_modification` ; relire
avant de réessayer. Deux affectations au même instant pour un utilisateur sont
refusées par la contrainte unique (`409 already_exists`).

L’affectation référence exactement le planning sélectionné : créer ensuite un
descendant ne change ni les affectations ni les pointages existants.

`GET /api/schedule/users/:userId/assignments?page=1&limit=10` retourne l’historique
paginé dans `data.items` et `data.meta`, futures affectations incluses, par date
de prise d’effet décroissante. Chaque entrée expose `workSchedule`, avec son
`weeklySchedule`, et les identifiants de l’affectation, de l’utilisateur et du planning.

`GET /api/schedule/users/:userId?at=2026-12-01T00:00:00Z` retourne la dernière
affectation entrée en vigueur à cet instant (maintenant si `at` est omis),
dans `data.assignment`. Sans affectation applicable : `data.assignment: null`.
Ces deux lectures sont accessibles à l’utilisateur concerné, aux administrateurs
et aux responsables de son périmètre. Elles utilisent un instantané cohérent.
Une référence utilisateur ou planning inexistante retourne 404 ; des droits
insuffisants retournent 403. Aucun endpoint d’annulation n’est encore fourni.


Les contrôles métier d’affectation utilisent `data.errors`, un objet indexé
par nom d’input, comme les DTO. Les utilisateurs refusés ou manquants sont
signalés sous `userIds[index]` à l’écriture et `userId` à la lecture. Les index
proviennent de la requête initiale, indépendamment de l’ordre des résultats SQL.
Tous les refus de la sélection sont collectés avant l’exception ; les références
manquantes sont prioritaires. Aucun refus ne crée d’affectation.

- 403 `schedule_assignment_forbidden` : `outside_management_scope` pour chaque case refusée.
- 404 `not_found` : `reference_not_found` pour chaque case manquante.
- 409 `later_schedule_assignment_exists` : une erreur par case en conflit,
  avec les détails conservés dans `data.conflictingAssignments`.
- Dates invalides : erreur sur `effectiveFrom` ou `at` selon la route.
- Rétroactivité refusée : erreur sur `effectiveFrom` ; confirmation absente :
  erreur sur `confirmRetroactive`.

Exemple : `data.errors["userIds[2]"].messages` identifie les erreurs de la
troisième case de la sélection. Une erreur DTO globale sur le tableau conserve
la clé `userIds`. Les erreurs ne renvoient ni valeur reçue ni données personnelles.

## Migration

La migration transforme chaque ancienne version en planning distinct, conserve
les jours/créneaux et réaffecte les références des pointages. La première version
conserve l’identifiant du planning original ; les suivantes forment une filiation.
Les affectations utilisateur d’un planning à une seule version restent inchangées.

La migration refuse de continuer si des affectations collectives existent, ou si
une affectation utilisateur référence un planning possédant plusieurs versions :
les versions n’ayant pas de dates de validité, cette conversion nécessite une
reprise métier explicite. Aucune date historique n’est inventée. Le refus annule
la transaction ; résoudre ces cas avant de relancer.

La migration n’est pas appliquée automatiquement. Tester sur une copie des données
avant déploiement. La conservation des horaires est assurée par le service ;
les écritures SQL ou Prisma directes restent sous la responsabilité de l’appelant.

## Fuseau, créneaux et rétroactivité

Chaque planning porte un fuseau IANA `timezone`, `Europe/Paris` par défaut.
Une copie reprend le fuseau source sauf remplacement explicite. Les heures sont
locales à ce fuseau ; elles ne sont pas des heures UTC. Lors des futurs calculs,
utiliser une conversion avec les règles de changement d’heure, jamais un décalage
UTC fixe. L’affectation conserve un instant `TIMESTAMPTZ(3)`.

Chaque créneau reste sur une seule journée : sa fin est strictement après son
début. Un créneau passant minuit (22:00 → 06:00) est refusé. Les chevauchements
sont contrôlés séparément pour chaque jour ; les créneaux adjacents sont acceptés.
Le champ `endsNextDay` est supprimé.

`ScheduleAssignmentPolicyService.assertEffectiveFrom` contrôle les
affectations : instant ISO avec offset obligatoire, rétroactivité réservée
aux administrateurs et confirmation `confirmRetroactive: true` obligatoire.
Ce contrôle est appelé dans la transaction après vérification du périmètre.
Le client doit fournir cette confirmation dans le corps de la requête.
Pour une prise d’effet immédiate, omettre `effectiveFrom` : le service produit
l’instant serveur.

La migration ajoute les champs sans modifier les horaires et interprète les
anciens instants Prisma comme UTC. Les anciennes données sont considérées comme
des horaires Europe/Paris : adapter cette hypothèse avant toute reprise si besoin.

## Refuser un changement avant une affectation déjà programmée

`ScheduleAssignmentPolicyService.assertNoLaterAssignments` refuse une affectation
si au moins un utilisateur sélectionné a déjà une affectation strictement
postérieure à la date demandée. Une affectation antérieure ne bloque pas le
changement ; une date identique reste protégée par la contrainte d’unicité.

Le refus utilise HTTP 409, le code `later_schedule_assignment_exists`, et
`data.conflictingAssignments` fournit les utilisateurs, plannings et dates qui
bloquent l’opération. Aucun changement futur n’est annulé automatiquement.

Texte à afficher pour expliquer le refus :
« Affectation impossible : un changement de planning est déjà prévu après la date
choisie pour certains utilisateurs sélectionnés. Pour éviter que le nouveau
planning soit remplacé par ce changement, annulez d’abord les affectations
programmées concernées ou retirez ces utilisateurs de la sélection. Aucune
nouvelle affectation n’a été enregistrée. »

Le service d’affectation vérifie les droits sur toute la sélection, puis appelle
`assertEffectiveFrom` et `assertNoLaterAssignments` avant toute écriture, dans la
même transaction sérialisée que la création des affectations.
Tout conflit doit annuler l’opération complète. Une vérification hors transaction
ne protège pas des changements concurrents. La création d’un planning sans
utilisateurs n’est pas bloquée. Ces contrôles sont appliqués à toutes les affectations.
