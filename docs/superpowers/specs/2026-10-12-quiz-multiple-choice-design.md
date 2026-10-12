# Quiz à choix multiples — conception

## Objectif

Transformer chaque question du quiz en question à quatre choix. L’équipe répond depuis l’écran public projeté, peut modifier son choix jusqu’au verrouillage par l’organisateur, puis voit la correction. Le score est attribué automatiquement et une seule fois.

## Expérience publique

Chaque question affiche quatre grandes réponses dans une grille 2 × 2, dans l’ordre A, B, C, D défini par l’administrateur.

États visuels :

- avant sélection : cases neutres ;
- sélection modifiable : contour et halo dorés ;
- sélection verrouillée : même réponse mise en évidence avec la mention « Choix verrouillé » ;
- bonne réponse choisie : case verte après révélation ;
- mauvaise réponse choisie : case rouge et bonne réponse verte après révélation.

Une réponse publique contient un identifiant, un libellé et une position. Elle ne contient jamais l’indication de correction.

## Édition administrateur

Chaque formulaire de question contient exactement quatre champs A, B, C et D et un bouton radio permettant de désigner une seule bonne réponse. L’ordre saisi est l’ordre affiché au public.

Une question n’est valide que si :

- les quatre libellés sont non vides ;
- les quatre libellés sont distincts après normalisation ;
- une seule réponse est correcte ;
- le texte de la question et son nombre de points respectent les règles existantes.

Le démarrage du quiz est bloqué si une question est incomplète ou invalide. L’interface indique les questions à corriger.

## Déroulement d’une question

1. L’équipe sélectionne une réponse sur l’écran public.
2. La sélection est enregistrée et synchronisée avec l’interface administrateur.
3. L’équipe peut remplacer sa sélection tant qu’elle n’est pas verrouillée.
4. L’administrateur voit la sélection courante. « Verrouiller le choix » reste désactivé sans sélection.
5. L’administrateur verrouille le choix. Toute nouvelle sélection publique est alors refusée.
6. L’administrateur révèle la réponse. La base compare le choix verrouillé avec la réponse correcte, enregistre le résultat et attribue automatiquement les points si le choix est correct.
7. L’administrateur clique sur « Question suivante ».
8. Après la dernière question du thème, le thème devient joué et l’équipe suivante choisit son thème.

Le verrouillage, la révélation avec score et l’avancement sont trois commandes distinctes. Chaque commande est atomique et vérifie que la question, l’équipe et l’état de session sont toujours ceux attendus.

## Modèle de données

Une table dédiée stocke les choix de réponse. Chaque ligne appartient à une question et contient :

- un identifiant stable ;
- le texte du choix ;
- une position de 0 à 3 ;
- l’indication protégée de bonne réponse.

La base impose quatre positions uniques par question et une seule bonne réponse pour toute question jouable. L’accès public passe par une vue ou une fonction qui exclut le marqueur de correction.

La session de quiz conserve, pour la question active :

- l’identifiant du choix sélectionné, nullable avant sélection ;
- l’état verrouillé ;
- l’état révélé déjà existant.

Le résultat enregistré conserve le choix sélectionné et le verdict. La révélation crée l’événement de score avec une clé d’idempotence dérivée de la session et de la question, afin qu’un double clic ne puisse pas doubler les points.

## Migration des questions existantes

La réponse actuelle devient le choix A et reste marquée correcte. Les choix B, C et D sont créés vides. L’administrateur doit les compléter avant de pouvoir démarrer le quiz. Aucun distracteur n’est inventé automatiquement.

Les données de démonstration peuvent être mises à jour avec quatre choix complets afin de conserver un parcours local immédiatement testable.

## Contrats et commandes

Le dépôt applicatif expose des opérations distinctes pour :

- créer et modifier une question avec ses quatre choix ;
- sélectionner ou remplacer un choix depuis l’écran public ;
- verrouiller le choix depuis l’administration ;
- révéler et noter automatiquement ;
- avancer vers la question suivante ;
- réinitialiser le quiz, y compris sélections et verrouillages.

Les données temps réel de la session et des choix publics mettent à jour les deux écrans sans rechargement.

## Gestion des erreurs

Une sélection publique n’est affichée comme confirmée qu’après succès du serveur. En cas d’échec, la case peut rester visuellement sélectionnée avec un message de synchronisation en attente, mais le verrouillage administrateur demeure impossible.

Une commande administrateur en erreur ne fait pas avancer la session et n’attribue aucun point. Elle affiche un message relançable. Les boutons sont désactivés pendant une commande pour empêcher les doubles soumissions.

Une révélation sans choix verrouillé, une sélection après verrouillage ou un avancement avant révélation sont refusés côté base, même si l’interface est contournée.

## Réinitialisation

La réinitialisation dédiée du quiz supprime les réponses enregistrées, les sélections courantes, les verrouillages, l’ordre figé et les points provenant du quiz. Elle conserve les thèmes, les questions, les quatre choix, les défis, les clés et les autres scores.

## Accessibilité et projection

Les quatre cases sont de vrais boutons avec un libellé accessible incluant la lettre et le texte. Les états sélectionné, verrouillé, correct et incorrect sont indiqués par la couleur, une icône ou un texte et des attributs accessibles ; la couleur seule ne porte jamais l’information.

La grille reste 2 × 2 sur l’affichage de référence vidéoprojecteur. Elle peut passer en une colonne sur petit écran afin de préserver la lisibilité des textes longs.

## Vérification

Les tests unitaires et d’intégration couvrent :

- la validation des quatre choix et de l’unique bonne réponse ;
- le blocage du démarrage quand une question est incomplète ;
- l’absence du marqueur de correction dans les données publiques ;
- la modification du choix avant verrouillage et son refus après verrouillage ;
- le refus de verrouiller sans sélection et de révéler sans verrouillage ;
- les états visuels sélectionné, correct et incorrect ;
- l’attribution automatique et idempotente des points ;
- l’avancement explicite et le changement d’équipe après la dernière question ;
- la synchronisation entre écran public et administration ;
- la réinitialisation des nouveaux états sans perte du contenu éditorial.

Les tests de base vérifient également les droits anonymes et administrateur, les contraintes de cohérence et les commandes concurrentes.
