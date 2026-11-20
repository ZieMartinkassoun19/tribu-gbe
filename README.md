# TRIBU GBÊ — version corrigée pour GitHub Pages + Cloudflare

## Pourquoi l'inscription échouait
L'ancienne version utilisait `const API = "/api"`. Sur GitHub Pages, cette adresse envoyait les requêtes vers GitHub au lieu du Worker Cloudflare. Le navigateur recevait donc une page GitHub au lieu d'une réponse API, d'où le message « connexion serveur invalide ».

Cette version pointe explicitement vers :
`https://tribu-gbe.tribu-gbe.workers.dev/api`

Le Worker fourni a également été corrigé pour répondre aux requêtes CORS provenant d'un site `*.github.io`. **Il faut déployer cette version du Worker dans Cloudflare**, sinon le navigateur bloquera toujours les requêtes cross-origin.

## Fichiers
- `index.html` : interface complète (HTML, CSS et JavaScript intégrés).
- `manifest.webmanifest` : configuration PWA avec chemins relatifs adaptés à GitHub Pages.
- `sw.js` : Service Worker PWA avec cache de base et nettoyage des anciens caches.
- `icon-192.png`, `icon-512.png` : icônes provisoires.
- `worker.js` : Worker Cloudflare corrigé (API + CORS), à déployer dans le Worker existant.
- `worker.template.js` : ancien modèle de source, conservé comme référence ; ne pas le déployer à la place de `worker.js`.

## Déploiement

### 1. GitHub Pages
1. Décompresser l'archive.
2. Ouvrir le dossier `tribu-gbe-github-corrected`.
3. Déposer à la racine du dépôt GitHub les fichiers `index.html`, `manifest.webmanifest`, `sw.js`, `icon-192.png` et `icon-512.png`.
4. Enregistrer/valider les changements.
5. Activer GitHub Pages dans les paramètres du dépôt, si ce n'est pas déjà fait.

### 2. Cloudflare Worker — étape obligatoire
1. Ouvrir Cloudflare > Workers & Pages > `tribu-gbe`.
2. Ouvrir l'éditeur du code du Worker.
3. Remplacer le code existant par le contenu complet de `worker.js` de cette archive.
4. Enregistrer et déployer.
5. Conserver le binding D1 existant nommé `DB` et pointant vers la base `tribu-gbe`. Ne pas supprimer ni recréer la base.

Le Worker corrigé ajoute les en-têtes CORS pour les origines HTTPS `*.github.io`. Aucun secret n'est inclus dans GitHub.

## Tests après déploiement
- Ouvrir l'adresse GitHub Pages.
- Essayer de créer un compte test avec les champs requis et un code d'accès valide.
- Essayer de se déconnecter puis de se reconnecter.
- Vérifier que les profils et les données chargent.
- Vérifier la console du navigateur si une erreur persiste.

## À savoir
- Cette correction règle l'adresse de l'API et la politique CORS. Elle ne garantit pas à elle seule que chaque fonction métier a été testée.
- Les comptes de l'ancienne base Supabase ne sont pas transférés.
- Les inscriptions nécessitent un code d'accès valide et les champs obligatoires.
- Les notifications dans cette version sont des notifications internes à l'application, actualisées automatiquement lorsque l'application est ouverte. Ce n'est pas une notification push lorsque le site est fermé.
- Les secrets et mots de passe doivent rester côté Cloudflare, jamais dans les fichiers publics GitHub.
