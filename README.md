# QRShield

Scanner de QR codes qui analyse le lien **avant** de l'ouvrir.

Je suis en 4ème année IRC à CPE Lyon et je voulais un projet perso orienté cybersécurité qui serve vraiment au quotidien. Les QR codes sont partout (menus de resto, parkings, affiches, paiements) et on les scanne sans réfléchir, alors que c'est un moyen assez simple de faire du phishing : il suffit de coller un autocollant par dessus le vrai QR code d'un horodateur. C'est ce qu'on appelle le "quishing" et il y a eu pas mal de cas en France ces dernières années.

L'idée de QRShield c'est donc de scanner le QR code, de suivre le lien jusqu'à sa vraie destination et de dire à l'utilisateur si ça a l'air sûr, suspect ou dangereux, avec une explication. C'est lui qui décide ensuite s'il ouvre le lien ou pas.

> Projet en cours de développement, voir l'avancement plus bas.

## Ce que l'appli doit faire

- **Analyse de sécurité** : URL finale après redirections, réputation du domaine (Google Safe Browsing, VirusTotal, PhishTank), détection de typosquatting (`paypa1.com`, `amaz0n-secure.fr`...), liens directs vers des `.apk` / `.exe`, score safe / suspect / dangereux.
- **Historique et stats** : chaque scan est enregistré, avec un dashboard pour voir ses habitudes (scans par semaine, % de QR suspects, types de liens, lieux).
- **Partie communautaire** : les QR codes dangereux sont remontés de façon anonymisée et affichés sur une carte, un peu comme Waze mais pour les QR codes piégés. Les signalements servent aussi à améliorer le score.
- **Alertes** : notification si un QR déjà scanné est reclassé dangereux plus tard, ou si beaucoup de signalements apparaissent dans le coin.

## Stack

| Partie | Techno | Pourquoi |
|---|---|---|
| Backend | Python, FastAPI, SQLAlchemy, Alembic | Python c'est le langage de base en sécu et il y a plein de libs pour analyser des URLs. FastAPI est léger et génère la doc Swagger tout seul. |
| Base de données | PostgreSQL + PostGIS | Je connais déjà bien Postgres (projets d'école et d'alternance), et PostGIS gère les requêtes géographiques pour la carte. |
| Mobile | React Native (Expo) + TypeScript | Une seule base de code pour Android et iOS. Je viens du Java et de l'Android natif, c'est l'occasion d'apprendre React. |
| Dashboard web | React + TypeScript, Recharts, Leaflet | Même écosystème que l'appli mobile. |
| Infra | Docker Compose | Pour lancer la base et l'API en une commande. |

## Lancer le projet

Pour l'instant seuls le backend et la base existent.

### Avec Docker

```bash
cp .env.example .env    # puis changer le mot de passe
docker compose up --build
```

L'API tourne sur http://localhost:8000, la doc Swagger est sur http://localhost:8000/docs et `GET /health` indique si la base répond.

### Backend sans Docker (pour développer)

Il faut quand même une base Postgres qui tourne, le plus simple c'est `docker compose up db`.

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows, sinon source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

### Tests

```bash
cd backend
pytest
```

## Organisation du code

```
backend/
  app/
    main.py        point d'entrée FastAPI
    config.py      config lue depuis les variables d'environnement
    database.py    connexion SQLAlchemy
    routers/       routes de l'API
    models/        tables SQLAlchemy
    schemas/       validation des entrées/sorties (Pydantic)
    services/      analyse des URLs, scoring, partie communautaire
    security/      auth, chiffrement
  tests/
mobile/            appli React Native (à venir)
dashboard/         dashboard web React (à venir)
```

## Avancement

- [x] Setup du projet (Docker Compose, structure, config, route `/health`)
- [ ] Modèles de données et migrations
- [ ] Écran de scan sur mobile
- [ ] Analyse de sécurité (Safe Browsing, VirusTotal, redirections, typosquatting)
- [ ] Algorithme de scoring
- [ ] Historique et statistiques
- [ ] Carte communautaire
- [ ] Notifications

## Quelques choix côté sécurité

- Les secrets (mots de passe, clés d'API) sont uniquement dans `.env`, qui n'est pas versionné. `.env.example` sert de modèle.
- Le conteneur de l'API ne tourne pas en root.
- Postgres n'est exposé que sur `127.0.0.1`, pas sur tout le réseau.
- En cas d'erreur de base de données, l'API ne renvoie jamais le message d'erreur brut au client (ça peut donner des infos sur l'infra).
