# TRIBU GBÊ — paquet corrigé

## Contenu
- `index.html` : interface web corrigée.
- `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png` : installation PWA.
- `worker.js` : source complète du Worker Cloudflare, avec API, CORS, inscription, connexion et récupération de compte.
- `worker.template.js` : ancien modèle conservé à titre de référence ; ne pas le déployer.

## État Cloudflare
Le Worker `tribu-gbe` a été mis à jour directement dans Cloudflare. La version active est la version 9. Elle conserve le binding D1 `DB` vers la base existante `tribu-gbe`. Les routes de demande, validation et finalisation de récupération du mot de passe ont été ajoutées. La base n'a pas été supprimée ni recréée.

## Mise à jour du site GitHub Pages
1. Décompresser l'archive.
2. Copier à la racine du dépôt GitHub les fichiers `index.html`, `manifest.webmanifest`, `sw.js`, `icon-192.png` et `icon-512.png`.
3. Valider les changements et attendre la publication GitHub Pages.
4. Ouvrir le site publié et actualiser la page. Le cache PWA a été versionné pour éviter de conserver l'ancienne interface.

## Worker Cloudflare (sauvegarde)
Le Worker actif a déjà été mis à jour. Ne le redéploie pas sans nécessité. Si un redéploiement devient nécessaire :
1. Ouvrir Cloudflare → Workers & Pages → `tribu-gbe`.
2. Remplacer le code par `worker.js`.
3. Vérifier que le binding `DB` pointe toujours vers la base `tribu-gbe` (ID `e48df3c1-08e5-4848-a1d1-04536615fb5b`).
4. Conserver les variables `VAPID_PUBLIC` et `VAPID_SUBJECT` existantes. Ne jamais publier de secret dans GitHub.

## Parcours à tester sur le site publié
- Inscription avec le code d'accès qui t'a été remis.
- Déconnexion puis reconnexion.
- Demande de récupération, traitement par un responsable, puis changement du mot de passe avec le code temporaire.
- Chargement des profils, villages, annonces, publications et réponses aux annonces.

## Contrôles réalisés
- Syntaxe JavaScript du Worker et du script intégré à `index.html` : vérifiée avec Node.js.
- JSON du manifeste : valide.
- Icônes PNG : valides.
- Les actualisations automatiques périodiques qui pouvaient effacer les formulaires ont été retirées.

**Limite de vérification :** l'environnement de préparation n'a pas pu joindre directement l'URL publique du Worker (résolution réseau indisponible). Le déploiement Cloudflare et le binding D1 sont confirmés par l'API Cloudflare, mais les parcours d'inscription et de connexion doivent encore être exécutés depuis le navigateur du site publié avec un code d'accès réel.
