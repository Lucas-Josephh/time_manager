# Documentation Swagger

Chaque contrôleur possède un fichier voisin `<ressource>.swagger.ts`.
Ce fichier expose des décorateurs composés avec `applyDecorators` :

- `Api<Ressource>Controller()` regroupe les tags et les réponses communes.
- `Api<Ressource><Action>()` regroupe le résumé, la description, les paramètres explicites, le corps et les réponses d’une route.

Exemple dans un contrôleur :

```ts
@Get('tree')
@ApiOrganizationTree()
tree(@Query() query: QueryOrganizationDto, @Req() request: AuthRequest) {
  return this.organizationService.tree(request.session!.user.id, query);
}
```

Les routes, guards, codes HTTP, messages de réponse et décorateurs de sérialisation restent dans le contrôleur : ils déterminent le comportement de l’API.
Les propriétés des schémas restent documentées dans les DTO avec `ApiProperty` et `ApiPropertyOptional`.

Réutiliser les décorateurs de `api-response.decorator.ts` pour les enveloppes de réponse et les erreurs.
Les longues descriptions peuvent utiliser Markdown dans le fichier Swagger de la ressource.
