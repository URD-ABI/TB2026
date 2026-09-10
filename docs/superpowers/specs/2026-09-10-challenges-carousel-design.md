# Carrousel des défis — conception

## Objectif

Remplacer la mosaïque verticale des cinq défis par un carrousel plein écran adapté à un écran ou vidéoprojecteur 16:9. La page doit présenter tout son contenu principal sans défilement sur un affichage de bureau, tout en conservant la lisibilité du montage photo, du titre et de la description.

## Présentation

Un seul défi est visible à la fois dans une grande tuile occupant l’espace disponible sous l’en-tête de page. La photo reste en arrière-plan avec un voile garantissant le contraste. Le numéro, le type, le titre et la description restent superposés à l’image.

Le carrousel conserve l’ordre `displayOrder` défini dans l’interface organisateur. Une transition discrète accompagne le changement de défi sans déplacer le reste de la page.

## Navigation et automatisme

- passage automatique au défi suivant toutes les 7 secondes ;
- boucle du dernier défi vers le premier ;
- boutons précédent et suivant ;
- un indicateur cliquable par défi ;
- bouton pause/lecture ;
- touches fléchées gauche et droite ;
- suspension temporaire de l’automatisme lorsque le pointeur survole le carrousel ou qu’un de ses contrôles possède le focus.

Une navigation manuelle réinitialise le délai de 7 secondes afin d’éviter un changement automatique immédiat.

## Accessibilité et cas particuliers

Le défi actif est annoncé avec sa position dans la série. Les contrôles possèdent des libellés accessibles et le focus reste visible. Lorsque la préférence système de réduction des animations est active, le carrousel démarre en pause et les transitions sont supprimées.

Avec un seul défi, les commandes sont masquées. Sans défi, la page affiche un message explicite à la place du carrousel.

## Comportement adaptatif

Sur un écran de bureau ou de projection, la hauteur de la tuile est calculée à partir de la hauteur disponible afin d’éviter le défilement de la page. Sur les écrans étroits ou très bas, la mise en page privilégie la lisibilité et peut conserver le défilement naturel.

## Vérification

Les tests automatisés couvriront l’ordre initial, la rotation après 7 secondes, la boucle, les commandes, la pause, le clavier, la réduction des animations et les états avec zéro ou un défi. La suite complète et la compilation seront exécutées, puis la page sera contrôlée dans le navigateur local à un format 16:9.
