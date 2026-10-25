# refactor: harmoniser User, les permissions et la pagination du backend

## Description

Après le merge du module User, plusieurs parcours utilisaient des conventions différentes pour les permissions, les DTO, les erreurs et les réponses. Cette PR aligne User, Organization et Team, sécurise les opérations de gestion et fournit une pagination commune.

Un administrateur peut créer un utilisateur avec son équipe initiale dans une seule requête. Le compte, ses identifiants de connexion et son affectation sont enregistrés dans la même transaction ; l’organisation est déduite de l’équipe choisie.

## Modifications

### Utilisateurs et Better Auth

- Réserver les routes `/api/users` aux administrateurs et relire le rôle en base pour autoriser les requêtes.
- Refuser l’accès aux routes protégées tant que le mot de passe temporaire doit être changé ; lever cette obligation après un changement ou une réinitialisation réussis.
- Conserver `firstname` et `lastname` comme propriétés distinctes, avec `name` calculé pour l’affichage. Les DTO User n’autorisent pas l’écriture directe de `name`.
- Accepter `teamId` à la création uniquement. Les changements ultérieurs d’appartenance passent par Team.
- Réserver les champs administratifs Better Auth au provisioning serveur et conserver les inscriptions publiques désactivées.
- Découper la configuration Better Auth et ses hooks en fichiers dédiés. Les routes natives `update-user` et `change-password` conservent leur validation et leur format de réponse natifs, compatibles avec le client Better Auth.
- Sérialiser explicitement les profils retournés, sans exposer les comptes, mots de passe ni sessions ; typer les prénom et nom personnalisés dans le client frontend.

### Permissions et cohérence Organization / Team

- Ajouter les décorateurs `CanManageOrganizations` et `CanManageTeams`, qui composent l’authentification et le contrôle des droits.
- Autoriser la gestion selon le rôle administrateur, le management de l’organisation ou de ses ancêtres et, pour une équipe existante, son responsable actuel.
- Contrôler également les droits sur la destination lors d’un déplacement. La création d’une organisation racine et le détachement en racine restent réservés aux administrateurs.
- Mutualiser les parcours d’ancêtres et de descendants, et éviter les doublons dans les arbres autorisés.
- Refuser le déplacement d’une organisation lorsqu’il rendrait les appartenances aux équipes invalides.
- Revalider les membres et le responsable conservés lorsqu’une équipe change d’organisation. Effectuer les modifications et les affectations de manière atomique.

### Validation, réponses et documentation

- Mutualiser les options de validation, le format des erreurs et le traitement des références ; enregistrer la contrainte d’unicité dans NestJS.
- Nettoyer les champs texte et les filtres d’identifiants avec les décorateurs communs, sans modifier les mots de passe.
- Centraliser la configuration de l’application et supprimer les initialisations redondantes de validation et de Swagger.
- Détailler Swagger pour les routes User : accès, champs, effets, exemples, pagination et erreurs. Aligner les schémas sur la sérialisation effective.

### Pagination commune

- Ajouter `PaginationQueryDto`, `PaginationMetaDto`, la fabrique de DTO paginés et le helper `paginate`, sans dépendance supplémentaire.
- Appliquer la pagination aux `findAll` de User, Team et Organization : `page` vaut 1 par défaut ; `limit` vaut 10 par défaut et ne peut pas dépasser 100.
- Retourner les résultats dans `data.items` et les métadonnées dans `data.meta` : `total`, `page`, `limit`, `totalPages`.
- Appliquer les mêmes filtres aux résultats et au total, lus dans une transaction `RepeatableRead`.
- Garantir un tri stable : date de création décroissante puis identifiant pour User ; nom puis identifiant pour Team et Organization.
- Conserver les arbres d’organisations et la liste des utilisateurs disponibles pour une équipe sans pagination.

## Adaptations des consommateurs

Les listes Team et Organization renvoyaient un tableau directement dans `data`. Elles renvoient désormais un objet paginé : les consommateurs doivent lire `data.items` et demander les pages suivantes avec `page` et `limit`.

```json
{
  "success": true,
  "message": "team_listed",
  "data": {
    "items": [],
    "meta": {
      "total": 0,
      "page": 1,
      "limit": 10,
      "totalPages": 0
    }
  }
}
```

Les filtres User portent sur `email`, `firstname` et `lastname`. Les propriétés d’appartenance, le mot de passe et `mustChangePassword` ne sont pas modifiables via le PATCH User.

## Migration

Appliquer la migration `20261024160000_add_user_display_name` avant de démarrer le backend sur une base existante. Elle ajoute et renseigne `name`, puis installe un trigger PostgreSQL pour maintenir sa valeur à partir de `firstname` et `lastname`, y compris lors d’écritures concurrentes.

La migration n’a pas été exécutée pendant cette intervention et n’a pas été vérifiée sur une instance PostgreSQL temporaire : le socket Docker était inaccessible.

## Validation

- Backend : **46 suites et 404 tests réussis**, dont les contrats HTTP, les permissions, les déplacements, le provisioning, les réponses natives Better Auth, Swagger et la pagination des trois listes.
- Lint backend et build backend réussis.
- Le dernier contrôle frontend réalisé pendant la refactorisation validait les 4 tests et le typage TypeScript.
