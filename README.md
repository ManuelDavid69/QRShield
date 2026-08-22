# QRShield

Application mobile qui analyse le contenu d'un QR code avant de l'ouvrir.

Je suis étudiant en 4e année du cycle ingénieur IRC (Informatique et Réseaux de Communication) à CPE Lyon. Je voulais un projet personnel orienté cybersécurité qui réponde à un problème concret. Les QR codes sont aujourd'hui partout : menus de restaurant, horodateurs, affiches, terminaux de paiement. On les scanne par réflexe, sans vérifier où ils mènent. Il suffit pourtant de coller un faux QR code sur celui d'un horodateur pour rediriger les gens vers une page de paiement frauduleuse. Cette technique, appelée *quishing*, a déjà fait plusieurs victimes en France.

QRShield scanne le QR code, suit le lien jusqu'à sa destination réelle et indique s'il paraît sûr, suspect ou dangereux, en expliquant pourquoi. L'utilisateur décide ensuite lui-même d'ouvrir le lien ou non.

> Le projet est en cours de développement. L'état d'avancement est détaillé plus bas.

## Fonctionnalités prévues

- **Analyse de sécurité** : URL finale après les redirections, réputation du domaine (Google Safe Browsing, VirusTotal, PhishTank), détection du typosquatting (`paypa1.com`, `amaz0n-secure.fr`...), repérage des liens qui téléchargent directement un `.apk` ou un `.exe`, et score final sûr / suspect / dangereux.
- **Historique et statistiques** : chaque scan est enregistré, et un écran de l'application présente les habitudes de l'utilisateur (scans par semaine, part de QR codes suspects, types de liens, lieux de scan).
- **Volet communautaire** : les QR codes jugés dangereux sont remontés de façon anonymisée et affichés sur une carte, sur le principe de Waze. Ces signalements servent aussi à affiner le score. La carte est disponible dans l'application et sur une page web publique, accompagnée de statistiques globales.
- **Alertes** : notification si un QR code déjà scanné est reclassé comme dangereux, ou si de nombreux signalements apparaissent à proximité.

## Choix techniques

| Partie | Technologies | Pourquoi |
|---|---|---|
| Backend | Python, FastAPI, SQLAlchemy, Alembic | Python est le langage le plus utilisé en cybersécurité et dispose de nombreuses bibliothèques pour analyser des URLs. FastAPI est léger et génère automatiquement la documentation Swagger. |
| Base de données | PostgreSQL et PostGIS | J'utilise déjà PostgreSQL en cours et en alternance. PostGIS permet de faire les requêtes géographiques nécessaires à la carte. |
| Mobile | React Native (Expo) et TypeScript | Une seule base de code pour Android et iOS. Venant de Java et d'Android natif, c'était aussi l'occasion d'apprendre React. |
| Page web publique | React, TypeScript, Recharts, Leaflet | Même écosystème que l'application mobile. |
| Infrastructure | Docker Compose | Lancer la base de données et l'API avec une seule commande. |

J'ai hésité pour la partie mobile avec Kotlin Multiplatform, qui aurait prolongé mon expérience d'Android natif. Je développe cependant sous Windows, et compiler puis tester la version iOS d'une application KMP nécessite un Mac. Avec Expo, je peux tester l'application sur Android comme sur iPhone, et je garde le même langage que pour la page web.

Toutes les fonctionnalités destinées à l'utilisateur (scan, historique, statistiques, carte) sont regroupées dans l'application mobile. La partie web se limite à une page publique, sans compte, qui présente la carte communautaire et des statistiques globales anonymisées. Elle permet de voir ce que produit le projet sans avoir à installer l'application.

## Installation

### Backend et base de données (Docker)

```bash
cp .env.example .env
docker compose up --build
```

Avant le premier lancement, il faut modifier dans `.env` le mot de passe de la base et renseigner `JWT_SECRET_KEY` (la commande pour générer une clé est indiquée dans le fichier). Les clés `GOOGLE_SAFE_BROWSING_API_KEY` et `VIRUSTOTAL_API_KEY` sont facultatives : sans elles, l'analyse fonctionne mais se limite aux redirections, aux indices dans l'adresse et à l'âge du domaine.

La page web publique est alors disponible sur http://localhost:8080 et l'API sur http://localhost:8000. La documentation Swagger se trouve sur http://localhost:8000/docs et la route `GET /health` indique si la base de données répond. Les migrations Alembic sont appliquées automatiquement au démarrage du conteneur.

Je n'utilise pas Docker Desktop, qui prend beaucoup de place, mais Docker installé directement dans WSL. Dans ce cas, il faut démarrer le démon (`sudo service docker start`) puis lancer les commandes depuis WSL, dans `/mnt/d/...`. La variable `WATCHFILES_FORCE_POLLING` du fichier compose sert à garder le rechargement automatique de l'API, car les modifications faites sur un disque Windows ne sont pas détectées autrement.

Pour créer une migration après avoir modifié un modèle :

```bash
docker compose run --rm backend alembic revision --autogenerate -m "description"
```

### Backend hors Docker

Une base PostgreSQL doit tout de même tourner ; le plus simple est `docker compose up db`.

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # sous Linux ou macOS : source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

### Application mobile

```bash
cd mobile
npm install
npx expo start
```

Il suffit ensuite de scanner le QR code affiché dans le terminal avec l'application **Expo Go** (Android ou iOS). Le téléphone et l'ordinateur doivent être sur le même réseau Wi-Fi.

L'application a besoin de joindre l'API. Avec Docker dans WSL2, l'API répond sur le `localhost` de Windows mais pas sur son adresse réseau, car WSL2 possède son propre réseau virtuel. Un petit relais Node rend donc l'API accessible au téléphone pendant le développement. Il se lance dans un second terminal :

```bash
cd mobile
npm run api-proxy
```

L'application déduit l'adresse du PC de celle du serveur Expo et contacte l'API sur le port 8001. Pour viser une autre adresse, il suffit de définir `EXPO_PUBLIC_API_URL`.

## Tests

```bash
cd backend
pytest
```

Les tests du dossier `tests/integration/` s'exécutent sur une vraie base PostGIS : une base `qrshield_test` est créée à côté de la base principale. Ils nécessitent donc que `docker compose up db` soit lancé, et sont ignorés dans le cas contraire.

```bash
cd mobile
npm test            # tests unitaires (Jest)
npm run typecheck   # vérification TypeScript
```

À chaque envoi sur GitHub, l'intégration continue exécute les tests du backend sur une base PostGIS, vérifie que les migrations correspondent aux modèles, puis contrôle l'application mobile (TypeScript, ESLint, Jest) et la compilation de la page web.

### Tests de bout en bout

Le dossier `e2e/` contient 26 tests Playwright qui s'exécutent sur la vraie pile : API, base PostGIS et services de réputation. Ils couvrent l'API, la page web et le parcours complet de l'application, de l'inscription à la suppression d'un scan. Ils vérifient par exemple que le mot de passe Wi-Fi ne figure jamais dans la requête envoyée au serveur, ou qu'un signalement annulé ne change rien aux chiffres publics.

```bash
docker compose up -d
cd e2e
npm install
npm test
```

Les tests utilisent Microsoft Edge, déjà présent sous Windows. L'application tourne dans le navigateur au format d'un téléphone, grâce à quelques fichiers `.web` : confirmations, stockage du token et affichage de la carte. Ces fichiers ne sont pas utilisés sur téléphone. Le script suppose que Docker tourne dans WSL.

Ces tests ne remplacent pas un essai sur un vrai appareil. Ils ne couvrent ni la lecture par la caméra, ni la lampe, ni le Keystore, ni la WebView Android : les deux bugs décrits plus bas n'auraient été vus que sur un téléphone.

## API

La documentation complète est disponible sur `/docs`. Routes actuelles :

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/auth/register` | Créer un compte |
| POST | `/auth/login` | Obtenir un token JWT |
| GET | `/auth/me` | Informations du compte connecté |
| POST | `/scans` | Enregistrer un QR code scanné, avec une position GPS facultative |
| GET | `/scans` | Historique paginé, avec un filtre facultatif sur le verdict |
| GET / DELETE | `/scans/{id}` | Consulter ou supprimer un scan |
| POST | `/scans/{id}/report` | Signaler un lien à la communauté |
| GET | `/stats/me` | Statistiques personnelles |
| GET | `/community/zones` | Zones signalées, sans compte |
| GET | `/community/stats` | Statistiques globales anonymisées, sans compte |
| GET | `/notifications` | Alertes de reclassement du compte |
| POST | `/notifications/{id}/read` | Marquer une alerte comme lue |

Le type de contenu (lien, Wi-Fi, e-mail, téléphone, contact...) est détecté par le serveur. Pour un lien, la réponse de `POST /scans` contient aussi le résultat de l'analyse de sécurité : verdict, score, URL finale, chaîne de redirections et liste des raisons.

## Analyse de sécurité

Lorsqu'un lien est scanné, le serveur l'analyse en quatre étapes.

**1. Suivi des redirections.** Le serveur suit le lien jusqu'à sa destination finale, sans jamais télécharger le contenu des pages : seuls les en-têtes HTTP sont lus. C'est ce qui permet de voir où mène réellement un lien raccourci (`bit.ly`, `qrco.de`...) ou une chaîne de redirections.

**2. Indices dans l'adresse.** Plusieurs techniques d'arnaque se voient directement dans l'URL :

| Technique | Exemple | Ce qui est détecté |
|---|---|---|
| Faute de frappe volontaire | `netfIix.com`, `chronoposte.fr` | distance d'édition avec le nom d'une marque |
| Lettres remplacées par des chiffres | `paypa1.com`, `amaz0n-livraison.fr` | comparaison après remplacement des caractères ressemblants |
| Nom de marque dans un autre domaine | `paypal-securite-compte.com`, `impots-gouv-remboursement.fr` | présence du nom d'une marque hors de ses domaines officiels |
| Marque placée en sous-domaine | `paypal.com.verification-client.ru` | le vrai domaine est `verification-client.ru` |
| Homographe | `аpple.com` avec un « а » cyrillique | décodage du punycode et conversion des lettres d'autres alphabets |
| Astuce du `@` | `https://www.paypal.com@evil.com` | le navigateur ignore tout ce qui précède le `@` |
| Téléchargement direct | `.apk`, `.exe`, `.msi`... | extension du fichier et type MIME renvoyé par le serveur |
| Adresse IP, extension douteuse, pas de HTTPS | `http://45.13.22.8/`, `.top`, `.xyz` | indices plus faibles |

La liste des marques surveillées se concentre sur celles qui sont le plus souvent imitées en France : banques, administrations (Ameli, impots.gouv), transporteurs, et applications de stationnement, puisque les faux QR codes collés sur les horodateurs sont l'exemple le plus courant de *quishing*.

**3. Services externes.** Google Safe Browsing et VirusTotal indiquent si le lien est déjà connu comme malveillant. L'âge du domaine est obtenu par le protocole RDAP (le successeur de WHOIS) : un site d'arnaque a souvent quelques jours seulement, car il est fermé rapidement. Ces trois vérifications sont lancées en parallèle. Je ne soumets jamais une URL à VirusTotal, je me contente de consulter ses résultats : une URL soumise devient publique, et celle d'un QR code peut contenir des informations personnelles.

**4. Score.** Chaque indice a une gravité, et donc un poids : faible (10), moyen (25), élevé (45), critique (80). Les poids s'additionnent, dans la limite de 100. En dessous de 30, le lien est considéré comme sûr ; de 30 à 59, il est suspect ; à partir de 60, il est dangereux. Un seul indice élevé rend donc un lien suspect, deux le rendent dangereux, et un signalement par Safe Browsing ou par au moins trois antivirus suffit à le classer dangereux. Chaque indice est accompagné d'une phrase d'explication affichée à l'utilisateur.

Le résultat d'une analyse est partagé entre tous les utilisateurs et réutilisé pendant 24 heures. Une même URL scannée par beaucoup de monde n'est donc analysée qu'une fois par jour, ce qui ménage aussi le quota de VirusTotal (4 requêtes par minute en version gratuite).

### Protection du serveur (SSRF)

Suivre des liens choisis par n'importe qui présente un risque pour le serveur lui-même. Un QR code contenant `http://169.254.169.254/` ou `http://localhost:5432` pourrait amener l'API à interroger ses propres services internes : c'est une attaque SSRF (*Server-Side Request Forgery*). Pour l'éviter, à chaque étape de redirection :

- je résous moi-même le nom de domaine et je refuse toute adresse qui n'est pas publique (réseau local, boucle locale, adresses réservées, multicast, IPv6 privée ou IPv4 encapsulée dans de l'IPv6) ;
- je me connecte ensuite directement à l'adresse IP vérifiée, et non au nom de domaine. Sinon, un serveur DNS malveillant pourrait répondre une adresse publique lors de la vérification, puis une adresse interne lors de la connexion (*DNS rebinding*). Le certificat TLS reste vérifié pour le vrai nom de domaine grâce au SNI ;
- les identifiants éventuellement présents dans l'URL ne sont jamais transmis, et le nombre de redirections comme la durée totale sont limités.

### Limites connues

- Les heuristiques peuvent produire des faux positifs : `amazonia-voyages.fr` est jugé suspect parce qu'il contient « amazon ». Pour les noms de marque qui sont aussi des mots courants (Orange, Free, Apple...), seule une correspondance exacte est prise en compte, avec une gravité réduite.
- Seules les redirections HTTP sont suivies. Une page qui redirige en JavaScript ou avec une balise `<meta refresh>` n'est pas encore analysée.
- Avec l'API Lookup de Safe Browsing, l'URL complète est envoyée à Google. L'API Update, qui ne transmet qu'un préfixe du hash de l'URL, préserverait mieux la vie privée ; c'est une amélioration que je prévois.

## Modèle de données

- `users` : les comptes utilisateurs.
- `scans` : l'historique de chaque utilisateur. La position est stockée dans une colonne PostGIS de type `geography(Point)`.
- `url_analyses` : une ligne par URL, **partagée** entre tous les utilisateurs.

Un scan ne stocke pas son propre verdict : il pointe vers l'analyse de son URL. Ainsi, si une URL est reclassée comme dangereuse plus tard, tous les scans concernés en tiennent compte immédiatement et il est facile de retrouver les utilisateurs à prévenir.

## Statistiques

Les statistiques sont calculées directement par PostgreSQL : nombre de scans par semaine, part de QR codes à risque, répartition des verdicts, sites les plus scannés et lieux habituels. Chaque scan reçoit aussi une catégorie (site web, menu, paiement, Wi-Fi ou autre), déduite de mots-clés dans l'adresse. La comparaison se fait sur des mots entiers, pour que `paysage-lyon.fr` ne soit pas pris pour un paiement ni `menuiserie-dupont.fr` pour un menu de restaurant.

Les lieux sont regroupés avec `ST_ClusterDBSCAN`, une fonction de PostGIS qui rassemble les points proches sans fixer à l'avance le nombre de groupes. Plusieurs scans dans le même quartier forment ainsi un seul lieu, ce que ne permettrait pas un simple arrondi des coordonnées : deux points voisins situés de part et d'autre d'une limite d'arrondi seraient séparés.

La position est facultative et n'est demandée qu'au premier scan. L'application l'arrondit à environ 100 mètres avant de l'envoyer, car une position précise n'apporte rien à ces statistiques et révélerait l'adresse de l'utilisateur. Le nom des lieux est résolu sur le téléphone : le serveur n'a besoin que des coordonnées arrondies.

## Volet communautaire

Chaque lien jugé suspect ou dangereux alimente une base commune, et l'utilisateur peut aussi signaler lui-même un lien qui lui paraît frauduleux. Ces signalements sont affichés sur une carte, dans l'application et sur une page web publique, et ils influencent le score.

### Anonymisation

Une carte publique de ce type révèle facilement où passent les gens. J'ai donc conçu la table `community_reports` pour que l'anonymat ne dépende pas de la bonne volonté du serveur :

- Elle ne contient ni identifiant d'utilisateur, ni lien vers le scan d'origine.
- La position est ramenée au centre d'une maille d'environ un kilomètre.
- La date est conservée au jour près. Une heure précise permettrait de retrouver le scan correspondant.
- Seul le domaine est publié, car une URL complète peut contenir des données personnelles.
- Une zone ou un domaine n'apparaît publiquement qu'à partir de deux signalements : une zone avec un seul signalement désignerait le passage d'une seule personne.

Il faut tout de même éviter qu'une même personne compte plusieurs fois. Chaque signalement porte donc une empreinte HMAC calculée à partir de l'utilisateur, de l'URL et d'une clé secrète. Elle est identique pour une même personne et une même URL, ce qui bloque les doublons, mais elle change d'une URL à l'autre : il est impossible de relier deux signalements entre eux, et impossible de vérifier si un utilisateur donné a signalé un lien sans connaître la clé. Supprimer un scan retire aussi les signalements associés.

### Apport au score

La difficulté est d'éviter un score qui s'alimente lui-même. Si les signalements automatiques d'une URL comptaient pour cette même URL, chaque lien suspect finirait par devenir dangereux sans aucune nouvelle information. Seules deux données sont donc prises en compte :

- Les signalements faits par des personnes : à partir de 3, un indice moyen ; à partir de 10, un indice élevé.
- La présence d'autres liens classés dangereux sur le même domaine, ce qui constitue une information réellement indépendante.

L'apport de la communauté est plafonné au niveau « élevé ». Une série de faux comptes peut donc rendre un site suspect, mais pas dangereux, et les domaines officiels des marques surveillées ne peuvent pas être visés. Les routes publiques, la connexion, l'inscription et les signalements sont limités en débit. Cette limite ne suffit pas contre un attaquant qui dispose de nombreuses adresses IP et de nombreux comptes ; une vérification des adresses e-mail réduirait ce risque.

### Page web

La page publique, sans compte, est dans `web/`. Elle présente la carte, l'évolution des signalements, les types de menaces, les villes et les domaines les plus touchés. Comme le projet n'a pas encore d'utilisateurs, elle s'appuie pour l'instant sur des données fictives, ce qu'un bandeau indique clairement. Le script de démonstration n'utilise que l'extension réservée `.example`, afin de ne mettre en cause aucun vrai site :

```bash
cd backend
python -m scripts.seed_demo            # ajoute les données fictives
python -m scripts.seed_demo --clear    # les retire
```

## Alertes

Un lien peut devenir dangereux après avoir été scanné : une page de phishing est souvent mise en ligne d'abord, puis signalée plus tard. Le conteneur `worker` réanalyse donc régulièrement les liens déjà scannés, par petits lots pour respecter le quota de VirusTotal. Lorsqu'un lien passe de sûr ou suspect à dangereux, chaque personne qui l'a scanné reçoit une alerte, une seule fois par lien.

L'alerte de zone fonctionne différemment, pour des raisons de vie privée. Le serveur ne reçoit jamais la position actuelle de l'utilisateur : l'application télécharge les zones publiques des sept derniers jours et calcule elle-même s'il y a au moins cinq signalements dans un rayon de cinq kilomètres. Cette alerte n'est pas répétée pendant une semaine.

Les notifications à distance ont été retirées d'Expo Go sur Android depuis le SDK 53 : elles demandent une version compilée de l'application et un projet Firebase. Pour l'instant, l'application récupère donc les alertes lorsqu'elle est ouverte, puis les affiche sous forme de notifications locales. Elles n'arrivent pas tant qu'elle est fermée. Le passage à de vraies notifications à distance ne demanderait que d'envoyer depuis le serveur les alertes déjà créées.

## Application mobile

L'application comporte cinq onglets : le scanner, l'historique, filtrable par verdict, la carte communautaire, les statistiques et le compte. La carte utilise Leaflet dans une WebView, comme le site : cela évite d'avoir à gérer une clé Google Maps. La bibliothèque est chargée avec une empreinte d'intégrité, et aucun lien ne peut s'ouvrir dans cette WebView. Après la connexion, elle s'ouvre directement sur la caméra. Une fois le QR code lu, il est envoyé au serveur et l'écran de résultat affiche le verdict avec un code couleur, le score, les raisons en clair et la chaîne de redirections. Le domaine de destination apparaît **en gros caractères**, car c'est l'information la plus utile pour repérer une arnaque et elle n'est pas toujours évidente à lire dans l'URL brute :

- `https://www.paypal.com@evil.com/login` mène en réalité vers `evil.com` : tout ce qui précède le `@` est ignoré par le navigateur.
- `https://аpple.com`, écrit avec un « а » cyrillique, s'affiche `xn--pple-43d.com`, ce qui rend l'imitation visible.

Le lien n'est jamais ouvert automatiquement. Le bouton n'apparaît qu'une fois l'analyse terminée, et une confirmation est demandée. Si le lien est suspect ou dangereux, ce bouton passe au second plan et devient « Ouvrir quand même » : la décision reste à l'utilisateur, mais le choix par défaut est de ne pas ouvrir. C'est l'URL finale qui est ouverte, c'est-à-dire celle qui a été analysée, car le lien de départ pourrait rediriger ailleurs au second passage. Seuls les liens `http` et `https` peuvent être ouverts, ce qui exclut des schémas comme `javascript:` ou `intent:`.

Pour un QR code Wi-Fi, l'application affiche le nom du réseau et le type de sécurité, mais jamais le mot de passe. Celui-ci est retiré avant l'envoi au serveur : il ne quitte pas le téléphone.

Sur Android, `expo-camera` renvoie dans le champ `data` une version reformatée du contenu : pour un QR code Wi-Fi, il s'agit du nom du réseau suivi du mot de passe, sans le préfixe `WIFI:`. Le type n'était donc plus reconnu et le mot de passe s'affichait en clair. J'ai découvert ce problème en testant sur un vrai téléphone, car les tests unitaires utilisaient directement le contenu brut. L'application lit désormais le champ `raw`, et un test reproduit ce cas.

Les tests sur téléphone ont révélé un second problème : sur Android, `expo-camera` ignore la propriété `active`. La caméra et la lampe restaient donc allumées quand l'utilisateur changeait d'onglet, et des QR codes pouvaient être lus à son insu. Le composant caméra est maintenant retiré de l'écran dès que l'onglet n'est plus affiché, ce qui ferme réellement la caméra.

## Sécurité

- Les secrets (mots de passe, clés d'API, clé JWT) se trouvent uniquement dans `.env`, qui n'est pas versionné. Le fichier `.env.example` sert de modèle.
- Le conteneur de l'API ne tourne pas en root et PostgreSQL n'est exposé que sur `127.0.0.1`.
- En cas d'erreur de base de données, l'API ne renvoie jamais le message d'erreur brut, qui pourrait donner des informations sur l'infrastructure.
- Les mots de passe sont hachés avec Argon2id, et hachés de nouveau à la connexion si les paramètres recommandés évoluent.
- Les tokens JWT sont signés en HS256 avec une clé d'au moins 32 caractères. L'algorithme accepté est imposé par le serveur : un token forgé avec `alg: none` est donc refusé (un test le vérifie).
- À la connexion, le mot de passe est vérifié même lorsque l'e-mail n'existe pas, en le comparant à un hash factice. Sans cette précaution, la réponse serait plus rapide pour un e-mail inconnu et il serait possible de deviner quels comptes existent en mesurant le temps de réponse.
- Les QR codes Wi-Fi contiennent le mot de passe du réseau en clair (`WIFI:S:MaBox;P:motdepasse;;`). Il est masqué avant l'enregistrement et n'est jamais stocké en base.
- Demander le scan d'un autre utilisateur renvoie une erreur 404 et non 403, afin de ne pas confirmer que l'identifiant existe.

- Sur le téléphone, le token JWT est conservé avec `expo-secure-store`, qui s'appuie sur le Keystore Android et le Keychain iOS. AsyncStorage l'aurait stocké en clair.

- Le nombre de tentatives de connexion est limité par adresse IP et par compte, ce qui freine le test de mots de passe.
- La page web est servie par nginx sans droits root, avec une politique de sécurité du contenu (CSP).

Il reste à ajouter les refresh tokens : pour l'instant, il faut se reconnecter au bout d'une heure. La limitation de débit est conservée en mémoire, ce qui suffit pour un seul processus ; avec plusieurs instances de l'API, il faudrait un compteur partagé comme Redis. En développement, l'application communique avec l'API en HTTP sur le réseau local ; un déploiement réel devra passer en HTTPS.

## Organisation du code

```
backend/
  app/
    main.py        point d'entrée FastAPI
    config.py      configuration lue depuis les variables d'environnement
    database.py    connexion SQLAlchemy
    routers/       routes de l'API
    models/        tables SQLAlchemy
    schemas/       validation des entrées et sorties (Pydantic)
    services/      analyse des URLs, scoring, volet communautaire
    security/      hachage des mots de passe, tokens JWT
  alembic/         migrations
  tests/
mobile/
  src/
    app/           écrans (expo-router : un fichier = une route)
    components/    composants réutilisables
    hooks/         connexion, envoi et analyse d'un scan
    services/      appels à l'API, stockage sécurisé du token, position
    utils/         lecture du contenu des QR codes, libellés
web/
  src/
    components/    carte Leaflet, graphiques, tableau
    services/      appels à l'API publique
    utils/         ville la plus proche d'une zone
```

## Avancement

- [x] Mise en place du projet (Docker Compose, structure, configuration, route `/health`)
- [x] Modèle de données, migrations, comptes utilisateurs et historique des scans
- [x] Écran de scan sur mobile et affichage du contenu
- [x] Analyse de sécurité côté serveur (redirections, typosquatting, Safe Browsing, VirusTotal, âge du domaine)
- [x] Algorithme de scoring
- [x] Comptes utilisateurs et affichage du résultat de l'analyse dans l'application
- [x] Historique et statistiques personnelles dans l'application
- [x] Carte communautaire (application et page web publique)
- [x] Reclassement automatique et alertes (notifications locales)
- [ ] Notifications à distance (version compilée et Firebase)
- [ ] Refresh tokens
- [ ] Déploiement de l'API et de la page web
