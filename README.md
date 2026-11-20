# TRIBU GBÊ — édition Cloudflare

## Contenu
- `index.html` : interface sans client Supabase.
- `worker.js` : Worker Cloudflare (API, page, manifeste et service worker).
- `worker.template.js` : source du Worker avant intégration de l'interface.
- `manifest.webmanifest` : manifeste PWA.
- `sw.js` : service worker avec cache et gestion des notifications Push.
- `icon-192.png` : icône PWA.

## Infrastructure
Cloudflare Workers héberge l'application et l'API. Cloudflare D1 stocke les comptes, profils, villages, annonces, RSVP, publications, codes d'invitation et abonnements Push. Les comptes de l'ancienne base Supabase ne sont pas transférés.

## Comptes et sécurité
Aucune confirmation par e-mail n'est envoyée. L'identifiant peut être un e-mail ou un nom d'utilisateur. Les mots de passe exigent au moins 8 caractères et sont hachés côté serveur avec PBKDF2. Les données de contact et les renseignements détaillés des membres sont limités au membre concerné et aux responsables autorisés. Le code d'activation du premier compte Fondateur est communiqué séparément et ne doit pas être publié.

## Notifications
Le manifeste et le service worker PWA sont inclus. La livraison Push distante est préparée mais reste en attente de l’ajout du secret serveur `VAPID_PRIVATE_JWK` dans les secrets du Worker. Les notifications locales et l’installation PWA sont distinctes de la livraison Push à distance.

## Stockage
Les photos de profil sont actuellement enregistrées dans D1. R2 n'est pas activé sur le compte Cloudflare.

## Récupération des comptes
- Un membre peut déposer une demande avec son identifiant ou son téléphone.
- Les responsables voient uniquement les demandes de leur périmètre.
- Après vérification de l’identité, un responsable génère un code à usage unique, valable 30 minutes.
- Le membre saisit ce code et choisit un nouveau mot de passe. Toutes les sessions précédentes sont révoquées.

## À tester avant diffusion
Tester les inscriptions, connexions, rôles, permissions, annonces, RSVP, publications, profils, gestion des membres et notifications avec des comptes de test.
