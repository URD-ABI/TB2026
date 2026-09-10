# Correction de l’espacement du carrousel des défis

## Constat

Le texte dynamique « Défi X sur 5 » est une annonce `aria-live` destinée aux lecteurs d’écran. Le composant lui applique la classe `visually-hidden`, mais aucune règle CSS ne définit actuellement cette classe. Le paragraphe reste donc visible et devient un élément de la grille du carrousel, ce qui crée un grand espace avant la tuile.

## Design retenu

Ajouter une classe utilitaire globale `visually-hidden` qui réduit l’élément à un pixel, le découpe visuellement et le retire du flux perceptible sans utiliser `display: none` ni `visibility: hidden`. L’annonce restera ainsi disponible pour les technologies d’assistance tout en cessant d’occuper une rangée visible.

Le compteur ne sera pas reproduit visuellement : le numéro du défi figure déjà dans la tuile et les cinq repères numérotés indiquent la position dans le carrousel. Les dimensions, commandes et sept secondes de défilement automatique resteront inchangées.

## Vérification

Un test de navigateur vérifiera que l’annonce conserve son contenu accessible mais que sa boîte visuelle ne dépasse pas un pixel. Les tests existants vérifieront ensuite que le carrousel tient toujours sans défilement aux formats 1366 × 768 et 1920 × 1080, puis la suite unitaire et la compilation seront relancées.

