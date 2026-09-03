# Conception du site Team Building 2026

## 1. Objectif

Créer un site événementiel servant de support à un Team Building de fin d’année menant à un Secret Santa. L’expérience mêle école de magie, forteresse d’aventure et ambiance de Noël, sans reprendre les marques, logos ou personnages d’œuvres existantes.

Le site doit fonctionner sur un écran projeté et être administré depuis un autre ordinateur. Les modifications de scores et de contenu sont synchronisées en temps réel. Le site public est hébergé sur GitHub Pages ; Supabase fournit l’authentification, la base de données, le stockage des images et la synchronisation.

## 2. Utilisateurs et appareils

- **Participants et public** : consultent l’écran projeté et utilisent ponctuellement le bouton d’attribution des équipes.
- **Organisateur** : se connecte à une interface séparée et protégée afin de préparer et piloter l’événement.
- **Ordinateur de projection** : utilise une navigation directe entre les pages publiques.
- **Ordinateur organisateur** : modifie les scores et l’état de l’événement sans piloter la navigation du projecteur.

## 3. Identité visuelle

La direction retenue est « magie nocturne » : fond sombre violet, or ancien, verre, halos lumineux et détails festifs discrets. L’interface évoque un tournoi magique organisé dans une forteresse au moment de Noël.

Principes visuels :

- typographie de titre élégante et évocatrice, associée à une police de lecture très lisible ;
- palette sombre avec accents or, violet et couleurs propres aux cinq équipes ;
- contrastes adaptés à la projection ;
- animations théâtrales mais courtes, sans empêcher l’utilisation ;
- arrière-plan unique importé par l’organisateur, recouvert automatiquement d’un voile assurant la lisibilité ;
- titre du tournoi, mention d’événement, noms, couleurs et emblèmes des équipes modifiables.

La mention initiale affichée sous le titre est « Team Building 2026 ».

## 4. Navigation publique

Le site public comporte une navigation discrète entre quatre pages :

1. **Classement**, affiché par défaut ;
2. **Attribution des équipes** ;
3. **Défis** ;
4. **Quiz**, absent de la navigation jusqu’à son activation par l’organisateur.

La navigation est effectuée directement sur l’ordinateur relié au projecteur. L’application doit fonctionner correctement sur un écran 16:9, un ordinateur portable et une tablette.

## 5. Page Classement

La page affiche cinq cylindres transparents, un par équipe. Chaque équipe conserve toujours la même position à l’écran afin de faciliter son suivi visuel.

Pour chaque équipe, la page affiche :

- le numéro de classement au-dessus du cylindre ;
- un style or, argent ou bronze pour les trois premières places ;
- le niveau de remplissage composé de petites billes lumineuses donnant un effet de sable magique ;
- le total de points ;
- le nombre de clés ;
- le nom, la couleur et l’emblème de l’équipe sous le cylindre.

Le remplissage et le numéro évoluent avec une animation légère après une modification. Le classement est recalculé selon cet ordre :

1. total de points décroissant ;
2. nombre de clés décroissant ;
3. priorité de départage saisie par l’organisateur après une épreuve réalisée hors du site.

En cas d’égalité parfaite sur les points et les clés, l’interface organisateur signale qu’un départage est requis. Le résultat du départage n’ajoute ni point ni clé.
Toute modification ultérieure des points ou des clés efface la priorité de départage concernée ; un nouveau départage sera demandé uniquement si l’égalité parfaite réapparaît.

## 6. Page Attribution des équipes

Les affectations sont préparées à l’avance mais présentées comme un tirage aléatoire.

Déroulement :

1. la photo et le nom du participant courant apparaissent ;
2. le participant clique sur « Lancer l’attribution » ;
3. les emblèmes des cinq équipes défilent avec le texte « Pique-nique-douille, c’est toi l’andouille » ;
4. l’animation ralentit et s’arrête sur l’équipe prédéfinie ;
5. l’équipe est révélée en plein écran ;
6. la photo rejoint automatiquement la composition correspondante en bas de page ;
7. le participant suivant apparaît.

Un participant ne peut être révélé qu’une fois au cours d’une session. L’organisateur peut modifier l’ordre de passage et réinitialiser l’état de la cérémonie sans supprimer les participants ni leurs affectations.

## 7. Page Défis

La page contient exactement cinq tuiles. La première est mise en avant dans une grande tuile ; les quatre suivantes restent visibles autour d’elle.

Chaque défi contient :

- un montage photo importé ;
- un numéro et un type d’épreuve ;
- un titre ;
- une courte description affichée sur un voile sombre.

Les images, textes et l’ordre des défis sont modifiables dans l’interface organisateur. La page est consultative et ne gère pas l’exécution des défis.

## 8. Page Quiz

La page présente six thèmes sous forme de tuiles évocatrices. Une tuile peut être verrouillée, disponible ou déjà jouée. Les titres, visuels, questions, réponses et barèmes sont configurables.

Fonctionnement :

1. l’organisateur active le quiz ;
2. au lancement de la première manche, l’ordre des cinq équipes est figé selon le classement courant ;
3. la première équipe choisit un thème, puis les autres jouent dans cet ordre ;
4. chaque équipe choisit exactement un thème et un thème reste inutilisé ;
5. les questions du thème sont affichées successivement en plein écran ;
6. l’organisateur révèle la réponse puis indique si la réponse de l’équipe est correcte ou incorrecte ;
7. le barème fixe enregistré avec la question est ajouté automatiquement en cas de bonne réponse ;
8. le thème passe à l’état joué et l’équipe suivante prend la main.

Une validation ne peut pas être appliquée deux fois. Les points de quiz utilisent le même historique que les autres opérations de score.
Le lancement est bloqué si une égalité parfaite exige encore un départage, afin que l’ordre figé soit sans ambiguïté.

## 9. Interface organisateur

L’interface est accessible par la route séparée `/admin` et nécessite une connexion par adresse électronique et mot de passe.

Elle comprend cinq espaces :

### Événement

- titre du tournoi ;
- mention d’événement ;
- import ou remplacement de l’arrière-plan ;
- activation et désactivation du quiz ;
- réinitialisation contrôlée de la session ;
- export de sauvegarde.

### Équipes et scores

- cinq équipes fixes ;
- nom, couleur et emblème ;
- ajout ou retrait de points ;
- ajout ou retrait de clés ;
- saisie du résultat d’un départage ;
- historique horodaté avec annulation de la dernière opération admissible.

### Participants

- nom et photo ;
- équipe prédéfinie ;
- ordre de passage ;
- état révélé ou non révélé.

### Défis

- cinq défis ;
- ordre d’affichage ;
- titre, type, description et montage photo.

### Quiz

- six thèmes ;
- questions ordonnées, réponses et barèmes fixes ;
- activation du quiz ;
- lancement et affichage de l’ordre de passage figé ;
- affichage de la question, révélation de la réponse et validation ;
- suivi des équipes et thèmes déjà joués.

Chaque modification affiche un état explicite : enregistrement en cours, enregistré ou échec.

## 10. Architecture technique

Le frontal est une application monopage React et TypeScript construite avec Vite, exportée comme fichiers statiques pour GitHub Pages. Le routage doit être compatible avec le sous-chemin éventuel du dépôt GitHub.

Supabase fournit :

- **Auth** pour le compte organisateur ;
- **PostgreSQL** pour les équipes, participants, défis, thèmes, questions et opérations de score ;
- **Realtime** pour actualiser l’écran projeté ;
- **Storage** pour les photos des participants, montages de défis et arrière-plan.

Le client public utilise une clé publiable et ne contient aucun secret d’administration. Les politiques de sécurité autorisent la lecture publique des données nécessaires à l’événement et réservent les écritures aux utilisateurs administrateurs autorisés.

## 11. Modèle de données conceptuel

- `events` : identité visuelle, état du quiz et état courant de la session ;
- `teams` : cinq équipes, présentation, points, clés et priorité de départage ;
- `score_events` : opérations de points et de clés, source, horodatage et annulation ;
- `participants` : identité, photo, équipe, ordre et état de révélation ;
- `challenges` : cinq défis ordonnés et leurs contenus ;
- `quiz_categories` : six thèmes et leur état ;
- `quiz_questions` : questions, réponses, barèmes et ordre ;
- `quiz_session` : ordre figé, équipe courante et progression ;
- `quiz_answers` : validations empêchant les doubles attributions.

Les données sont rattachées à un événement afin de permettre une réutilisation future sans ajouter, dans la première version, une interface complexe de gestion multi-événements.

## 12. Synchronisation et gestion des erreurs

- L’écran public charge un instantané initial puis écoute les changements en temps réel.
- En cas de coupure, il conserve les dernières données reçues et affiche discrètement une tentative de reconnexion.
- Une opération organisateur n’est jamais présentée comme enregistrée avant confirmation de Supabase.
- Les opérations de score sont atomiques et historisées afin d’éviter les doubles ajouts et de permettre une annulation contrôlée.
- Les images sont validées, redimensionnées et compressées avant envoi.
- Si une image manque, un visuel de remplacement sobre conserve la mise en page.
- L’export de sauvegarde contient les données structurées de l’événement et les références de ses médias.

## 13. Accessibilité et ergonomie

- contraste élevé adapté à la projection ;
- commandes principales accessibles au clavier ;
- zones cliquables adaptées au tactile ;
- alternative textuelle pour les images utiles ;
- respect de la préférence de réduction des animations ;
- navigation et états compréhensibles sans dépendre uniquement des couleurs.

## 14. Vérification

Les tests automatisés et manuels couvrent :

- tri par points, puis clés, puis départage ;
- stabilité de la position visuelle des cinq équipes ;
- mise à jour en temps réel entre deux navigateurs ;
- affichage hors connexion temporaire et reconnexion ;
- attribution toujours conforme à l’équipe prédéfinie ;
- impossibilité de révéler deux fois un participant sans réinitialisation ;
- ordre du quiz figé au lancement ;
- un seul thème par équipe et un seul passage par thème ;
- barème fixe et prévention des doubles attributions ;
- sécurité en lecture publique et écriture administrateur ;
- affichage 16:9, ordinateur portable et tablette ;
- parcours au clavier de l’interface organisateur.

Une répétition générale utilise les fonctions de réinitialisation de session et conserve toute la configuration éditoriale.

## 15. Hors périmètre de la première version

- réponses au quiz depuis les téléphones des équipes ;
- pilotage à distance de la navigation du projecteur ;
- création libre d’un nombre différent de cinq équipes, cinq défis ou six thèmes ;
- gestion avancée de plusieurs événements depuis l’interface ;
- génération automatique des montages photo ;
- diffusion vidéo ou audio en direct.

## 16. Livraison

La livraison comprend le code source, la configuration GitHub Pages, le schéma et les politiques Supabase, un jeu de données de démonstration, des instructions de configuration et une checklist de répétition générale. La publication finale nécessite un dépôt GitHub et un projet Supabase appartenant à l’utilisateur.
