# Portrait du participant pendant l’attribution

## Objectif

Conserver le visuel actuel de la page d’attribution tout en limitant la photo du participant à la case centrale de la cérémonie. Une fois le participant attribué, sa photo ne doit pas apparaître dans la liste de son équipe.

## Comportement attendu

- En l’absence de participant à révéler, la case centrale conserve le message actuel indiquant que tous les participants ont été attribués.
- Lorsqu’un participant attend son passage, la case centrale affiche sa photo au-dessus de son nom.
- Si aucune photo n’a été enregistrée, le composant affiche les initiales du participant à la place du portrait afin que la mise en page reste complète.
- La photo reste visible pendant l’animation et dans le résultat de révélation, puisque ces deux états concernent encore le participant en cours.
- Après validation du résultat, le participant rejoint la zone de son équipe avec ses initiales et son nom uniquement.
- Aucun changement n’est apporté aux couleurs, aux dimensions générales, aux animations ou à la navigation de la page.

## Architecture et flux de données

La propriété `photoUrl` du participant continue d’être alimentée depuis l’interface organisateur et transmise à la page d’attribution. Le composant de portrait existant reste utilisé dans la case centrale et dans le résultat de révélation.

Le composant qui représente un membre dans une équipe ne doit plus consulter `photoUrl`. Il rend systématiquement les initiales, conserve le nom accessible et garde l’animation d’arrivée actuelle.

## Cas limites

- Un participant sans photo est affiché avec ses initiales dans la case centrale.
- Un nom ne produisant qu’une seule initiale reste accepté.
- Une URL de photo absente ne modifie pas l’ordre de passage ni l’équipe prédéfinie.
- Le rechargement de la page conserve les états révélés existants ; il ne réintroduit aucune photo dans les équipes.

## Vérification

- Vérifier qu’un participant avec photo affiche cette photo dans la case centrale avant le tirage.
- Vérifier que le même participant est représenté par ses initiales, et non par une image, dans son équipe après le tirage.
- Vérifier qu’un participant sans photo affiche ses initiales avant et après le tirage.
- Vérifier que le nom accessible et l’animation d’arrivée sont conservés.
- Exécuter les tests ciblés de la page d’attribution, puis les contrôles TypeScript et la construction de production.
