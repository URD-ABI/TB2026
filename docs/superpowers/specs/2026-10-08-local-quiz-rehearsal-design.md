# Parcours local complet du quiz

## Objectif

Permettre de tester localement le quiz dans les mêmes conditions que le jour de l’événement : un organisateur authentifié pilote la session depuis `/admin/quiz`, tandis que l’écran public `/quiz` reflète instantanément le choix des thèmes, les questions, les réponses et la progression des équipes.

Le projet ne doit pas ajouter de mode de démonstration parallèle, contourner l’authentification ni enregistrer d’identifiants dans Git.

## Configuration du compte organisateur

Le compte local est créé manuellement dans Supabase Studio avec une adresse électronique et un mot de passe choisis par l’utilisateur. Son UUID est ensuite ajouté à `public.admin_users`. Le mot de passe n’est ni communiqué à l’application ni conservé dans le dépôt.

Cette configuration utilise l’authentification et les politiques d’accès déjà prévues pour la version finale. Elle reste strictement liée à l’instance Supabase locale.

## Données de démonstration

Les six thèmes présents dans `supabase/seed.sql` conservent leurs titres : Culture générale, Cinéma, Musique, Sport, Sciences et Surprises.

Chaque thème reçoit trois questions d’exemple, soit dix-huit questions au total. Chaque question possède :

- un intitulé public ;
- une réponse protégée visible uniquement après révélation par l’organisateur ;
- un ordre stable de 0 à 2 dans son thème ;
- un barème initial de 10 points, modifiable ultérieurement dans l’interface organisateur.

Les exemples sont déterministes afin qu’une réinitialisation locale reconstruise toujours le même jeu de test.

## Déroulement de la session

Avant le lancement, l’organisateur active l’accès au quiz et règle tout départage nécessaire entre des équipes ayant les mêmes points et le même nombre de clés. Le démarrage fige l’ordre selon les points, les clés puis la priorité de départage.

L’écran public affiche ensuite les six thèmes et le nom de l’équipe courante. L’équipe choisit directement un thème disponible. La première question apparaît immédiatement.

Pour chaque question :

1. l’écran public montre l’équipe, le thème, la question et son barème ;
2. l’organisateur révèle la réponse ;
3. l’écran public affiche la réponse révélée ;
4. l’organisateur valide une bonne ou une mauvaise réponse ;
5. une bonne réponse ajoute le barème fixe à l’équipe, une mauvaise réponse n’ajoute aucun point ;
6. la question suivante du même thème apparaît automatiquement.

Après la troisième question, le thème passe à l’état `played`, la session avance vers l’équipe suivante et la grille des thèmes réapparaît. Chaque équipe ne choisit qu’un thème. Lorsque toutes les équipes ont joué, l’écran public affiche l’état de fin du quiz.

## Apparence des thèmes terminés

Un thème terminé reste visible dans la grille pour conserver la compréhension de la progression, mais il est désactivé et ne peut plus être choisi.

La variante visuelle validée est :

- image et couleurs assombries et désaturées ;
- coche dorée clairement visible ;
- libellé « Thème terminé » ;
- état `disabled` natif sur le bouton.

Un thème indisponible parce qu’une sélection est momentanément en cours reste distinct de l’état définitivement terminé.

## Réinitialisation et erreurs

La réinitialisation de répétition reste une commande séparée de l’interface organisateur. Elle efface la session, les réponses enregistrées, les choix de thèmes et les points de répétition, puis ramène l’écran public à l’attente du lancement.

Les erreurs de démarrage, de choix, de révélation ou de validation restent signalées dans l’interface concernée sans avancer artificiellement la session. Une action déjà validée ne peut pas attribuer deux fois les mêmes points.

## Architecture

Le parcours conserve l’architecture existante :

- `QuizControlPanel` pilote les fonctions du dépôt depuis l’administration ;
- `QuizPage`, `CategoryGrid` et `QuestionStage` rendent l’état public ;
- `SupabaseEventRepository` appelle les fonctions SQL atomiques existantes ;
- les abonnements Realtime rechargent l’instantané public après chaque mutation ;
- `supabase/seed.sql` fournit les dix-huit questions et réponses de démonstration.

Le support de plusieurs questions par thème existe déjà dans le modèle et les fonctions SQL. L’implémentation complète principalement les données d’exemple, renforce la représentation des thèmes terminés et ajoute les vérifications manquantes.

## Vérification

Les tests doivent couvrir :

- la présence de trois questions ordonnées dans chacun des six thèmes du seed ;
- la progression automatique entre les questions d’un même thème ;
- l’attribution de points uniquement pour une bonne réponse ;
- le passage à l’équipe suivante après la dernière question ;
- l’impossibilité de choisir un thème terminé ;
- le rendu assombri, coché, libellé et désactivé d’un thème terminé ;
- le parcours public/organisateur sur la pile Supabase locale.

La compilation de production et les tests existants des pages publiques restent obligatoires avant validation finale.
