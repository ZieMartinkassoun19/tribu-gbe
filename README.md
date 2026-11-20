# TRIBU GBÊ — version remise à niveau

## Fichiers du paquet
- `index.html` : interface complète de l’application.
- `worker.js` : API Cloudflare Worker et version HTML embarquée identique à l’interface.
- `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png` : installation PWA et icônes.
- `CONTROLE.txt` : contrôles et limites de vérification.

## Inscription avec clé d’accès
L’interface comporte un seul formulaire et un seul champ « Clé d’accès ». Le navigateur transmet `access_key` au Worker. Le Worker accepte aussi temporairement l’ancien champ `invite_code` pour compatibilité. La base vérifie d’abord la clé d’inscription spéciale déjà stockée dans `setup_codes` : si elle est valide, inutilisée et qu’aucun fondateur n’existe, le compte reçoit automatiquement le rôle `founder`. Sinon, le Worker recherche une clé ordinaire dans `invite_codes` et attribue le rôle prévu par cette clé. Chaque clé n’est consommée qu’après création du compte.

Les noms internes historiques des tables sont conservés pour éviter toute perte de données ; l’utilisateur ne voit que l’appellation « Clé d’accès ».

## Base de données
Le Worker utilise le binding D1 `DB` déjà associé à la base `tribu-gbe` (ID `e48df3c1-08e5-4848-a1d1-04536615fb5b`). Ne supprimez pas cette base et ne la recréez pas. Aucune migration destructive n’est incluse.

## Publication du site GitHub Pages
1. Décompressez l’archive.
2. Copiez à la racine du dépôt GitHub Pages : `index.html`, `manifest.webmanifest`, `sw.js`, `icon-192.png` et `icon-512.png`.
3. Publiez les changements depuis GitHub et attendez la fin de la publication Pages.
4. Ouvrez le site publié et actualisez-le. Le cache PWA est passé en version `tribu-gbe-v3`.

## Cloudflare et base de données
Le Worker Cloudflare actuellement relié à la base D1 répond déjà à l’ancien nom technique `invite_code`. Pour cette raison, le formulaire envoie les deux propriétés (`access_key` et `invite_code`) : l’utilisateur ne voit que « Clé d’accès », tandis que la compatibilité avec le Worker actif est conservée. Le fichier `worker.js` inclus est la source complète mise à jour ; si tu le déploies, conserve impérativement le binding D1 `DB` vers la base existante et les variables déjà configurées. Ne supprime pas la base et ne colle jamais de secret dans GitHub.

## Notifications Push
La configuration actuelle expose la clé publique et le sujet VAPID, mais le Worker ne dispose pas de la clé privée VAPID nécessaire à l’envoi des notifications Push. Cette fonction doit donc être configurée séparément avant de pouvoir être annoncée comme opérationnelle.

## Contrôles effectués sur cette archive
- Syntaxe JavaScript du Worker : contrôlée avec `node --check`.
- Syntaxe des scripts intégrés à `index.html` : contrôlée avec `node --check`.
- JSON du manifeste : contrôlé.
- PNG : contrôlés.
- Champ unique « Clé d’accès » : présent.
- Transmission du champ `access_key` : présente côté interface et prise en charge côté Worker.
- Clé initiale D1 : vérifiée présente et inutilisée au moment du contrôle.
- Aucun compte utilisateur ou fondateur n’existait au moment du contrôle.

## Limite importante
Les vérifications statiques et les lectures D1 ne remplacent pas un test réel depuis un navigateur. L’inscription du premier compte, la connexion, la création d’une clé ordinaire et l’inscription d’un second compte doivent être testées après publication. Le paquet ne prétend pas que ces parcours ont déjà été exécutés de bout en bout.
