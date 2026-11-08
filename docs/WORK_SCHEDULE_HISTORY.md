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

Le service, les routes et les permissions d’affectation utilisateur restent à
implémenter séparément. Cette refactorisation ne crée ni ne remplace d’affectation.
Le périmètre à contrôler sera celui des utilisateurs explicitement sélectionnés :
membres de l’équipe gérée, ou équipes des organisations gérées et descendantes.

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

`ScheduleAssignmentPolicyService.assertEffectiveFrom` prépare le contrôle des
futures affectations : instant ISO avec offset obligatoire, rétroactivité réservée
aux administrateurs et confirmation `confirmRetroactive: true` obligatoire.
Ce contrôle doit être appelé depuis le futur service d’affectation, dans la
transaction et après vérification du périmètre des utilisateurs concernés.
Il n’existe encore aucune route d’affectation ni confirmation dans une interface.
Pour une prise d’effet immédiate, le service d’affectation devra produire lui-même
l’instant serveur plutôt qu’envoyer une date client quelques secondes antérieure.

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

Le futur service d’affectation doit vérifier les droits sur toute la sélection,
puis appeler `assertEffectiveFrom` et `assertNoLaterAssignments` avant toute
écriture, dans la même transaction sérialisée que la création des affectations.
Tout conflit doit annuler l’opération complète. Une vérification hors transaction
ne protège pas des changements concurrents. La création d’un planning sans
utilisateurs n’est pas bloquée. Ces contrôles sont préparés mais aucune route
ou écriture d’affectation n’est encore implémentée.
