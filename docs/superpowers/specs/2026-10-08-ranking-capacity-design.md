# Capacité fixe des réceptacles du classement

## Objectif

Remplacer l’échelle dynamique basée sur le meilleur score par une capacité définie par l’organisateur. Une équipe en tête ne doit plus avoir automatiquement un réceptacle plein.

## Paramètre de l’événement

La configuration de l’événement reçoit un entier `scoreCapacity`, libellé « Capacité d’un réceptacle » dans Administration → Événement.

- La valeur par défaut est `100` points.
- La valeur doit être un entier strictement positif.
- Une valeur vide, décimale, négative ou égale à zéro bloque l’enregistrement et affiche un message de validation.
- Le paramètre est enregistré avec le titre et le sous-titre de l’événement.

## Calcul du remplissage

Chaque réceptacle utilise la même capacité, indépendamment du classement et des scores des autres équipes.

- Un score inférieur ou égal à zéro donne un remplissage de 0 %.
- Un score strictement positif conserve le minimum visuel actuel de 4 % afin que quelques grains restent visibles.
- Entre zéro et la capacité, le remplissage est `arrondi(points / scoreCapacity × 100)` puis borné entre 4 et 100 %.
- Un score égal ou supérieur à la capacité donne un remplissage de 100 %.
- Le nombre réel de points reste affiché sans être limité, y compris lorsque le score dépasse la capacité.
- Le classement, les clés et les règles de départage ne changent pas.

Le texte accessible du niveau indique le pourcentage et la capacité, par exemple « 75 % de la capacité de 100 points ».

## Stockage et synchronisation

`EventConfig` expose `scoreCapacity`. Le dépôt en mémoire conserve cette valeur comme les autres propriétés de l’événement.

Supabase reçoit une migration dédiée qui :

- ajoute `score_capacity integer not null default 100` à `events` ;
- impose une contrainte strictement positive ;
- met à jour la fonction `update_event` pour recevoir et enregistrer la capacité ;
- conserve les droits existants de la fonction.

Le dépôt Supabase mappe `score_capacity` vers `scoreCapacity` en lecture et transmet la valeur à `update_event` en écriture. La synchronisation temps réel existante des paramètres de l’événement propage ensuite la nouvelle capacité à l’écran projeté.

## Interface organisateur

Le nouveau champ numérique est placé dans le formulaire principal de la page Événement, après le sous-titre et avant le bouton d’enregistrement. Il affiche l’unité « points » dans son libellé ou son aide, utilise un pas de 1 et une borne minimale de 1.

Le bouton d’enregistrement et les messages de succès ou d’échec existants sont conservés.

## Vérification

- Vérifier la valeur par défaut de 100 dans les données locales et Supabase.
- Vérifier le refus des capacités vides, décimales, négatives ou nulles.
- Vérifier les remplissages pour `0/100`, `1/100`, `50/100`, `100/100` et `150/100`.
- Vérifier que le meilleur score n’influence plus le remplissage des autres équipes.
- Vérifier le texte accessible du réceptacle.
- Vérifier la lecture et l’écriture Supabase, la migration et les politiques associées.
- Exécuter les tests, la compilation TypeScript et la construction de production.
