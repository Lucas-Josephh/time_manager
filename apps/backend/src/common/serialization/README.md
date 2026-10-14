# Sérialisation des réponses

Déclarer `@SerializeResponse(TeamWithRelationsDto)` sur un contrôleur ou une
méthode. La méthode prend priorité sur le contrôleur. L'intercepteur convertit
le résultat avec `plainToInstance` avant de construire l'enveloppe HTTP.
Les objets, les listes et les relations déclarées avec `@Type` sont pris en charge.
Un résultat null ou undefined conserve le comportement `data: {}`.

Chaque DTO de sortie porte `@Exclude()` et expose ses champs avec `@Expose()`.
Les utilisateurs exposent id, firstname, lastname et image ; les départements
exposent id et name. Une relation utilise `@Type(() => RelatedDto)` pour appliquer
les règles de son DTO. Les champs absents ne sont pas ajoutés au JSON.

Pour une nouvelle réponse, déclarer son DTO et l'associer au contrôleur :
aucun registre de modèles ni fonction de sérialisation à ajouter.
Les DTO de sortie restent dans le même fichier que les DTO d'entrée,
mais utilisent des classes distinctes pour séparer validation et exposition.

Pour `{ items, total }`, déclarer un DTO d'enveloppe avec ses propres champs et
`@Type` sur items. Le décorateur décrit le résultat complet du contrôleur.
La conversion ne modifie pas les données du service ni le client Prisma.
Les routes Better Auth ne passent pas par cet intercepteur.
