# Historique des plannings

`WorkSchedule` identifie un planning. Les affectations utilisateur, équipe et
organisation référencent ce planning via `workScheduleId`, et non une version.
Chaque affectation conserve sa période `[effectiveFrom, effectiveTo[` : elle
indique quand l’entité suit ce planning. Une fin nulle signifie indéterminée.

`WorkScheduleVersion` contient un numéro de version, une période de validité
`[effectiveFrom, effectiveTo[`, un fuseau IANA (par exemple `Europe/Paris`),
ses jours et ses créneaux. Les dates de validité sont des instants avec fuseau
en base ; les heures des créneaux sont locales au fuseau de la version.
Les périodes des versions d’un même planning ne doivent pas se chevaucher.

## Corriger une période

Modifier les jours ou créneaux d’une version existante corrige les horaires
applicables à toute sa période, y compris passée. Les résultats historiques
recalculés changent donc ; les pointages réels restent inchangés. Les résultats
mis en cache ou persistés doivent être invalidés ou recalculés par l’application.
`updatedAt` indique la dernière modification ; ce champ ne remplace pas un journal
d’audit détaillé, à ajouter si nécessaire.

## Faire évoluer à partir d’une date

Pour passer de 35 h à 39 h le 1er novembre :

1. Fermer la version précédente au 1er novembre à minuit local.
2. Créer une nouvelle version avec cette date de début, ses jours et créneaux.
3. Effectuer ces opérations dans une transaction.

Toutes les entités rattachées au planning suivent automatiquement cette évolution,
sans nouvelle affectation. Les périodes antérieures gardent leurs anciens horaires.
Un changement futur déjà programmé nécessite de découper les périodes concernées
sans créer de chevauchement ni écraser une autre évolution.

## Résolution et historique individuel

À la date concernée, retrouver l’affectation utilisateur applicable, puis la version
du planning dont la période contient cette date. `WorkSession` conserve uniquement
les pointages réels ; aucune version n’y est figée. Les heures attendues sont aussi
calculées pour les jours sans pointage. Un calcul couvrant plusieurs affectations
ou versions doit être découpé à leurs bornes.

Pour l’héritage, la priorité proposée est : choix individuel, équipe, organisation,
puis organisation parente. L’application doit matérialiser le planning hérité dans
une affectation utilisateur datée, afin de ne pas dépendre de l’équipe ou de
l’organisation actuelle pour les calculs passés. Lors d’un changement d’équipe,
d’organisation ou de planning collectif, fermer et créer les affectations
individuelles concernées à la date d’effet. La résolution et la propagation dans
les services doivent être adaptées à ce modèle.

## Garanties à ajouter dans la couche métier ou une migration SQL

Prisma valide les relations et l’unicité, mais ce schéma seul ne garantit pas :

- l’absence de chevauchement des versions d’un même planning ;
- l’absence de chevauchement des affectations d’un même propriétaire ;
- `effectiveTo > effectiveFrom`, lorsque la fin existe, pour versions et affectations ;
- la présence d’une version applicable pendant les périodes d’affectation ;
- un numéro de version positif, un jour entre 1 et 7 et un fuseau IANA valide ;
- le format des heures, leur ordre et l’absence de chevauchement des créneaux.

Les contrôles de concurrence doivent être assurés en base (contraintes d’exclusion
PostgreSQL pour les périodes, par exemple) ou par des transactions sérialisées
avec reprise sur conflit. Les relations `Restrict` protègent contre les suppressions
en cascade, mais permettent les corrections de contenu.

Cette modification porte sur le schéma uniquement. Avant son déploiement, adapter
les services, créer et relire une migration et reprendre les données existantes.
Les anciennes affectations de version doivent référencer leur planning ; les
périodes de validité des versions doivent être établies à partir des données métier.
Si une même version était utilisée à des périodes différentes selon les entités,
la conversion nécessite une décision métier : ces périodes ne définissent pas
forcément une validité globale unique. Ne pas inventer de date historique inconnue.
