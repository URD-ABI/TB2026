# Checklist de répétition générale

## Avant la répétition

- Appliquer toutes les migrations Supabase et charger les données de départ.
- Créer le compte organisateur, l’ajouter à `admin_users`, puis vérifier la connexion sur `/admin`.
- Remplacer les noms, couleurs, emblèmes, participants, photos, défis, thèmes, questions et réponses.
- Exporter une sauvegarde JSON depuis le tableau de bord organisateur.
- Ouvrir l’affichage public sur l’ordinateur de projection et `/admin` sur l’ordinateur de pilotage.

## Parcours à vérifier sur deux ordinateurs

- Ajouter des points et une clé : le classement projeté se met à jour sans rechargement.
- Tester une égalité points/clés, enregistrer le départage, puis vérifier les rangs.
- Révéler deux participants et contrôler leur déplacement dans la bonne équipe.
- Ouvrir `/quiz` sur l’affichage public et `/admin/quiz` sur l’ordinateur de pilotage.
- Activer puis démarrer le quiz ; vérifier que l’ordre correspond au classement figé.
- Choisir un thème depuis l’écran public et vérifier l’ouverture immédiate de sa première question.
- Révéler puis valider successivement les trois réponses ; vérifier le passage automatique aux questions 2 et 3.
- Après la troisième réponse, vérifier le retour à la grille pour l’équipe suivante.
- Vérifier que le thème joué est assombri, coché, libellé « Thème terminé » et impossible à sélectionner.
- Vérifier qu’une bonne réponse ajoute 10 points et qu’une mauvaise réponse n’en ajoute aucun.
- Annuler une opération de score depuis l’historique et vérifier la projection.

## Réinitialisation après répétition

- Saisir exactement `REINITIALISER` dans Sauvegarde et répétition.
- Vérifier que la session, les scores, les clés, les révélations et les thèmes joués sont effacés.
- Vérifier que équipes, participants, affectations, défis, thèmes, les dix-huit questions éditoriales et médias sont conservés.
- Faire un nouvel export JSON daté.

## Affichage

- Projection 1920×1080 : cinq cylindres visibles, rangs dégagés, grains visibles à zéro et au maximum.
- Portable 1366×768 : navigation lisible et aucune action critique masquée.
- Tablette 820×1180 : aucun débordement horizontal et commandes tactiles confortables.
