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

L'API est ensuite disponible sur http://localhost:8000. La documentation Swagger se trouve sur http://localhost:8000/docs et la route `GET /health` indique si la base de données répond. Les migrations Alembic sont appliquées automatiquement au démarrage du conteneur.

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

## API

La documentation complète est disponible sur `/docs`. Routes actuelles :

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/auth/register` | Créer un compte |
| POST | `/auth/login` | Obtenir un token JWT |
| GET | `/auth/me` | Informations du compte connecté |
| POST | `/scans` | Enregistrer un QR code scanné, avec une position GPS facultative |
| GET | `/scans` | Historique paginé |
| GET / DELETE | `/scans/{id}` | Consulter ou supprimer un scan |

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

## Application mobile

L'application s'ouvre directement sur la caméra. Une fois le QR code lu, l'écran de résultat affiche le type de contenu et, pour un lien, **le nom de domaine réel en gros caractères**. C'est l'information la plus utile pour repérer une arnaque, et elle n'est pas toujours évidente à lire dans l'URL brute :

- `https://www.paypal.com@evil.com/login` mène en réalité vers `evil.com` : tout ce qui précède le `@` est ignoré par le navigateur.
- `https://аpple.com`, écrit avec un « а » cyrillique, s'affiche `xn--pple-43d.com`, ce qui rend l'imitation visible.

Le lien n'est jamais ouvert automatiquement : il faut appuyer sur « Ouvrir le lien » puis confirmer. Seuls les liens `http` et `https` peuvent être ouverts, ce qui exclut des schémas comme `javascript:` ou `intent:`. Pour un QR code Wi-Fi, l'application affiche le nom du réseau et le type de sécurité, mais jamais le mot de passe.

## Sécurité

- Les secrets (mots de passe, clés d'API, clé JWT) se trouvent uniquement dans `.env`, qui n'est pas versionné. Le fichier `.env.example` sert de modèle.
- Le conteneur de l'API ne tourne pas en root et PostgreSQL n'est exposé que sur `127.0.0.1`.
- En cas d'erreur de base de données, l'API ne renvoie jamais le message d'erreur brut, qui pourrait donner des informations sur l'infrastructure.
- Les mots de passe sont hachés avec Argon2id, et hachés de nouveau à la connexion si les paramètres recommandés évoluent.
- Les tokens JWT sont signés en HS256 avec une clé d'au moins 32 caractères. L'algorithme accepté est imposé par le serveur : un token forgé avec `alg: none` est donc refusé (un test le vérifie).
- À la connexion, le mot de passe est vérifié même lorsque l'e-mail n'existe pas, en le comparant à un hash factice. Sans cette précaution, la réponse serait plus rapide pour un e-mail inconnu et il serait possible de deviner quels comptes existent en mesurant le temps de réponse.
- Les QR codes Wi-Fi contiennent le mot de passe du réseau en clair (`WIFI:S:MaBox;P:motdepasse;;`). Il est masqué avant l'enregistrement et n'est jamais stocké en base.
- Demander le scan d'un autre utilisateur renvoie une erreur 404 et non 403, afin de ne pas confirmer que l'identifiant existe.

Il reste à ajouter les refresh tokens et une limitation du nombre de tentatives de connexion.

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
    utils/         lecture du contenu des QR codes
web/               page web publique React (à venir)
```

## Avancement

- [x] Mise en place du projet (Docker Compose, structure, configuration, route `/health`)
- [x] Modèle de données, migrations, comptes utilisateurs et historique des scans
- [x] Écran de scan sur mobile et affichage du contenu
- [x] Analyse de sécurité côté serveur (redirections, typosquatting, Safe Browsing, VirusTotal, âge du domaine)
- [x] Algorithme de scoring
- [ ] Affichage du résultat de l'analyse dans l'application (connexion au backend)
- [ ] Historique et statistiques personnelles dans l'application
- [ ] Carte communautaire (application et page web publique)
- [ ] Notifications
