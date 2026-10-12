# Affichage public des noms d’équipe — conception

## Objectif

Afficher uniquement le nom définitif de chaque équipe sur les pages publiques. Les libellés techniques d’emblème (`mountain`, `constellation`, `wind`, `lightning` et `flame`) ne doivent plus apparaître à côté des noms.

## Présentation

Le nom de chaque équipe reprend sa couleur configurée :

- Gryffinzyme : `#D1495B` ;
- Slythermers : `#1F7A4D` ;
- Hufflespin : `#EDAE49` ;
- Ravenflow : `#30638E` ;
- Order of the Phenol : `#7A3B69`.

Cette présentation s’applique au classement, à la roue d’attribution, au résultat de l’attribution et aux blocs récapitulatifs des équipes.

## Données et administration

La propriété `emblem` reste stockée et modifiable dans l’interface organisateur afin de préserver la compatibilité du modèle de données. Elle cesse uniquement d’être rendue sur les pages publiques. Les noms, couleurs, scores, clés, participants et affectations ne sont pas modifiés par cette correction.

## Vérification

Les tests des composants publics vérifieront que les noms sont affichés, que leur style utilise `--team-color` et que les libellés d’emblème ne sont pas présents. La suite complète et la compilation seront ensuite exécutées, puis le résultat sera contrôlé dans le navigateur local.
