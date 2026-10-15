# Tests générés

Les tests sont regroupés par fonctionnalité, puis par comportement :

- `auth/` : routes natives, sessions, client, limitation des tentatives et Microsoft.
- `team/` : création, modification, validation, unicité, liste, détail, suppression et erreurs.
- `department/` : contrat HTTP et service métier.
- `http/` : configuration HTTP commune (CORS et erreurs de routage).
- `support/` : création de l’application HTTP de test.

Les fichiers `*.spec.ts` contiennent les scénarios. Les fichiers `*.fixture.ts`
centralisent la préparation et le nettoyage propres à une fonctionnalité ; chaque
suite possède sa propre application et ses propres mocks. Les tests de session
créent eux-mêmes les sessions nécessaires, sans dépendre de l’ordre d’exécution.

Pour ajouter un scénario, choisir le fichier correspondant au comportement testé.
Créer un nouveau fichier lorsque le comportement ne correspond pas aux suites
existantes. Les helpers partagés entre fonctionnalités vont dans `support/`.

Depuis la racine : `pnpm --filter backend test:cov`.
