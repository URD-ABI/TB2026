# Réinitialisation dédiée du quiz

## Objectif

Permettre à un administrateur de recommencer le quiz depuis la page **Administration → Quiz** sans réinitialiser le reste de l'événement. La réinitialisation doit retrouver l'état précédant le lancement du quiz, y compris pour les points attribués par les bonnes réponses.

## Interface administrateur

La zone **Pilotage en direct** affiche un bouton de danger intitulé **Réinitialiser le quiz**. Le bouton reste disponible afin de pouvoir nettoyer une session commencée, terminée ou partiellement jouée.

Un clic ouvre une boîte de dialogue modale qui décrit précisément les conséquences de l'action. Elle contient :

- un bouton **Confirmer la réinitialisation** ;
- un bouton **Annuler** ;
- une fermeture au clavier avec `Échap` ;
- une restitution du focus au bouton déclencheur après fermeture.

Pendant l'opération, les commandes sont désactivées afin d'empêcher une double exécution. En cas de succès, le dialogue se ferme et un message confirme la réinitialisation. En cas d'échec, il reste possible de réessayer et un message d'erreur explicite est affiché.

## Données réinitialisées

Une réinitialisation du quiz effectue les opérations suivantes pour l'événement ciblé :

1. soustraire aux équipes les points de tous les événements de score non annulés dont la source réservée est `quiz` ;
2. supprimer tous les événements de score du quiz, y compris ceux déjà annulés, afin que l'historique revienne à l'état précédant le quiz ;
3. supprimer les réponses enregistrées et la session du quiz ;
4. remettre chaque thème à l'état `available` et effacer l'équipe qui l'avait choisi ;
5. désactiver l'accès public au quiz en mettant `quiz_enabled` à `false`.

Les scores provenant des défis ou d'ajustements libres, les clés, les priorités de départage, les participants et la cérémonie d'attribution ne sont pas modifiés. Les thèmes, les questions, leurs réponses configurées, leurs valeurs en points, leurs images et leur ordre sont conservés.

La suppression de la session supprime également l'ordre de passage figé. Au prochain démarrage, cet ordre est recalculé et figé à partir du classement alors en vigueur.

## Architecture et sécurité

Une nouvelle opération `reset_quiz(event_id)` est ajoutée au contrat du dépôt d'événement et implémentée dans les dépôts Supabase et mémoire.

Côté Supabase, une fonction RPC `reset_quiz(uuid)` protégée par `security definer` :

- vérifie que l'appelant est administrateur et que l'événement existe ;
- prend les verrous transactionnels du quiz et des scores de l'événement ;
- applique toutes les modifications dans une transaction unique ;
- n'est pas exécutable par les rôles public et anonyme.

Cette opération atomique garantit qu'une erreur ne peut pas laisser le quiz dans un état partiellement réinitialisé. Les mises à jour temps réel existantes ramènent automatiquement la page publique à l'écran indiquant que le quiz sera lancé par l'organisateur.

## Tests

Les tests de base de données couvrent :

- le refus d'un appel anonyme ;
- l'autorisation d'un administrateur ;
- le retrait exact des points issus du quiz, y compris plusieurs réponses et équipes ;
- la conservation des autres points, des clés et du départage ;
- la suppression de la session, des réponses et des événements de score du quiz ;
- la remise à disposition des thèmes ;
- la conservation de toute la configuration éditoriale ;
- la désactivation de l'accès public.

Les tests applicatifs couvrent le contrat des deux dépôts, l'ouverture et la fermeture accessible du dialogue, la prévention des doubles clics, les messages de succès et d'erreur, ainsi que le raccordement de l'action dans l'espace administrateur.
