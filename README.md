# QRShield

Application mobile qui analyse le contenu d'un QR code avant de l'ouvrir.

Je suis étudiant en 4e année du cycle ingénieur IRC (Informatique et Réseaux de Communication) à CPE Lyon. Je voulais un projet personnel orienté cybersécurité qui réponde à un problème concret. Les QR codes sont aujourd'hui partout : menus de restaurant, horodateurs, affiches, terminaux de paiement. On les scanne par réflexe, sans vérifier où ils mènent. Il suffit pourtant de coller un faux QR code sur celui d'un horodateur pour rediriger les gens vers une page de paiement frauduleuse. Cette technique, appelée *quishing*, a déjà fait plusieurs victimes en France.

QRShield scanne le QR code, suit le lien jusqu'à sa destination réelle et indique s'il paraît sûr, suspect ou dangereux, en expliquant pourquoi. L'utilisateur décide ensuite lui-même d'ouvrir le lien ou non.

> Le projet est en cours de développement. L'état d'avancement est détaillé plus bas.

## Fonctionnalités prévues

- **Analyse de sécurité** : URL finale après les redirections, réputation du domaine (Google Safe Browsing, VirusTotal, PhishTank), détection du typosquatting (`paypa1.com`, `amaz0n-secure.fr`...), repérage des liens qui téléchargent directement un `.apk` ou un `.exe`, et score final sûr / suspect / dangereux.
- **Historique et statistiques** : chaque scan est enregistré et un tableau de bord présente les habitudes de l'utilisateur (scans par semaine, part de QR codes suspects, types de liens, lieux de scan).
- **Volet communautaire** : les QR codes jugés dangereux sont remontés de façon anonymisée et affichés sur une carte, sur le principe de Waze. Ces signalements servent aussi à affiner le score.
- **Alertes** : notification si un QR code déjà scanné est reclassé comme dangereux, ou si de nombreux signalements apparaissent à proximité.

## Choix techniques

| Partie | Technologies | Pourquoi |
|---|---|---|
| Backend | Python, FastAPI, SQLAlchemy, Alembic | Python est le langage le plus utilisé en cybersécurité et dispose de nombreuses bibliothèques pour analyser des URLs. FastAPI est léger et génère automatiquement la documentation Swagger. |
| Base de données | PostgreSQL et PostGIS | J'utilise déjà PostgreSQL en cours et en alternance. PostGIS permet de faire les requêtes géographiques nécessaires à la carte. |
| Mobile | React Native (Expo) et TypeScript | Une seule base de code pour Android et iOS. Venant de Java et d'Android natif, c'était aussi l'occasion d'apprendre React. |
| Tableau de bord web | React, TypeScript, Recharts, Leaflet | Même écosystème que l'application mobile. |
| Infrastructure | Docker Compose | Lancer la base de données et l'API avec une seule commande. |

## Installation

### Backend et base de données (Docker)

```bash
cp .env.example .env
docker compose up --build
```

Avant le premier lancement, il faut modifier dans `.env` le mot de passe de la base et renseigner `JWT_SECRET_KEY` (la commande pour générer une clé est indiquée dans le fichier).

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

Le type de contenu (lien, Wi-Fi, e-mail, téléphone, contact...) est détecté par le serveur. L'analyse de sécurité des liens fera l'objet de la phase suivante ; en attendant, le verdict renvoyé est `unknown`.

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
dashboard/         tableau de bord web React (à venir)
```

## Avancement

- [x] Mise en place du projet (Docker Compose, structure, configuration, route `/health`)
- [x] Modèle de données, migrations, comptes utilisateurs et historique des scans
- [x] Écran de scan sur mobile et affichage du contenu
- [ ] Analyse de sécurité (Safe Browsing, VirusTotal, redirections, typosquatting)
- [ ] Algorithme de scoring
- [ ] Historique et statistiques
- [ ] Carte communautaire
- [ ] Notifications
