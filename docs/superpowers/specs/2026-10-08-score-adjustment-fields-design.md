# Ajustement de la largeur des champs de score

## Objectif

Empêcher les champs numériques « Points » et « Clés » de la zone « Ajustement libre » de dépasser la carte de leur équipe, sans modifier les autres formulaires de l’interface organisateur.

## Diagnostic

La zone utilise une grille à deux colonnes flexibles. Les éléments `input[type="number"]` conservent cependant leur largeur intrinsèque avec `min-width: auto`. Dans une carte mesurée à environ 294 px, chaque colonne utile fait environ 122 px alors que chaque champ conserve une largeur proche de 238 px. Le second champ dépasse donc largement du cadre.

## Conception retenue

- Conserver les champs Points et Clés côte à côte sur les écrans suffisamment larges.
- Limiter les libellés et les champs numériques à leur colonne avec `min-width: 0`.
- Donner aux champs `width: 100%` afin qu’ils occupent la colonne sans la dépasser.
- Placer le bouton « Appliquer » sur toute la largeur de la ligne suivante avec `grid-column: 1 / -1`.
- Conserver la disposition existante en une colonne sous le seuil mobile de 40 rem.
- Limiter ces règles à `.score-controls__custom` pour ne pas affecter les autres champs de l’administration.

## Vérification

- Ajouter un test de contrat CSS ciblé qui exige les contraintes de largeur et la ligne complète du bouton.
- Exécuter les tests de l’éditeur d’équipes et la compilation TypeScript.
- Reconstruire l’aperçu local puis mesurer dans le navigateur que les deux champs restent intégralement à l’intérieur du cadre sur une carte d’équipe.
