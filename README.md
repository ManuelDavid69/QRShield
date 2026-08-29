# QRShield

[Version française](README.fr.md)

Mobile application that analyzes the content of a QR code before opening it.

**[See the demo page](https://manueldavid69.github.io/QRShield/)** (map and statistics, with fictional data)

I am a fourth-year engineering student in Computer Science and Networks (IRC) at CPE Lyon. I wanted a personal project focused on cybersecurity that addressed a concrete problem. QR codes are everywhere today: restaurant menus, parking meters, posters, payment terminals. People scan them by reflex, without checking where they lead. Yet all it takes is placing a fake QR code over the one on a parking meter to redirect people to a fraudulent payment page. This technique, called *quishing*, has already claimed several victims in France.

QRShield scans the QR code, follows the link to its real destination, and indicates whether it looks safe, suspicious, or dangerous, explaining why. The user then decides whether to open the link or not.

> The whole project runs locally, from the app to the server. Only the demo page is online for now. The current status is detailed below.

## Features

- **Security analysis**: final URL after redirects, domain reputation (Google Safe Browsing, VirusTotal), typosquatting detection (`paypa1.com`, `amaz0n-secure.fr`...), flagging links that directly download an `.apk` or `.exe`, and a final safe / suspicious / dangerous score.
- **History and statistics**: each scan is saved, and an app screen shows the user's habits (scans per week, share of suspicious QR codes, link types, scan locations).
- **Community features**: QR codes judged dangerous are reported anonymously and shown on a map, a bit like Waze. These reports also help refine the score. The map is available in the app and on a public web page, along with global statistics.
- **Alerts**: notification if a QR code already scanned is reclassified as dangerous, or if many reports appear nearby.

## Technical choices

| Part | Technologies | Why |
|---|---|---|
| Backend | Python, FastAPI, SQLAlchemy, Alembic | Python is the most widely used language in cybersecurity and has many libraries for analyzing URLs. FastAPI is lightweight and automatically generates the Swagger documentation. |
| Database | PostgreSQL and PostGIS | I already use PostgreSQL in my coursework. PostGIS allows me to run the geographic queries needed for the map. |
| Mobile | React Native (Expo) and TypeScript | A single codebase for Android and iOS. Coming from Java and native Android, it was also an opportunity to learn React. |
| Public web page | React, TypeScript, Recharts, Leaflet | Same ecosystem as the mobile app. |
| Infrastructure | Docker Compose | Start the database and the API with a single command. |

For the mobile side, I also considered Kotlin Multiplatform, which would have built on my native Android experience. However, I develop on Windows, and compiling and then testing the iOS version of a KMP app requires a Mac. With Expo, I can test the app on Android and iPhone, and I keep the same language as the web page.

All user-facing features (scan, history, statistics, map) are grouped in the mobile app. The web part is limited to a public page, with no account, that shows the community map and global anonymized statistics. It lets people see what the project produces without having to install the app.

## Installation

### Backend and database (Docker)

```bash
cp .env.example .env
docker compose up --build
```

Before the first launch, you need to change the database password in `.env` and set `JWT_SECRET_KEY` and `COMMUNITY_SECRET` (the command to generate a key is in the file). The `GOOGLE_SAFE_BROWSING_API_KEY` and `VIRUSTOTAL_API_KEY` keys are optional: without them, the analysis still works but is limited to redirects, URL clues, and domain age.

The public web page is then available at http://localhost:8080 and the API at http://localhost:8000. The Swagger documentation is at http://localhost:8000/docs and the `GET /health` route indicates whether the database responds. Alembic migrations are applied automatically when the container starts.

I do not use Docker Desktop, which takes up a lot of space, but Docker installed directly in WSL. In that case, you need to start the daemon (`sudo service docker start`) and then run the commands from WSL, in `/mnt/d/...`. The `WATCHFILES_FORCE_POLLING` variable in the compose file keeps the API auto-reload working, because changes made on a Windows disk are not detected otherwise.

To create a migration after changing a model:

```bash
docker compose run --rm backend alembic revision --autogenerate -m "description"
```

### Backend outside Docker

A PostgreSQL database must still be running; the simplest way is `docker compose up db`.

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # on Linux or macOS: source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

### Mobile app

```bash
cd mobile
npm install
npx expo start
```

Then simply scan the QR code displayed in the terminal with the **Expo Go** app (Android or iOS). The phone and the computer must be on the same Wi-Fi network.

The app needs to reach the API. With Docker in WSL2, the API responds on Windows `localhost` but not on its network address, because WSL2 has its own virtual network. A small Node relay therefore makes the API reachable from the phone during development. It starts in a second terminal:

```bash
cd mobile
npm run api-proxy
```

The app infers the PC address from the Expo server address and contacts the API on port 8001. To target another address, simply set `EXPO_PUBLIC_API_URL`.

### Deployment

Everything runs on free plans. The demo page is on GitHub Pages, the database on Neon (it supports PostGIS and has no time limit), and the API on Render, described in `render.yaml`. Render's free plan has no background workers, so a scheduled GitHub Actions job (`reclassify.yml`) runs `python -m app.worker --once` every six hours instead.

The free API goes to sleep after 15 minutes without traffic and takes about a minute to wake up, so the demo page keeps reading a static file and stays instant. Behind a proxy, the address seen by the API is the proxy's, so rate limiting reads `X-Forwarded-For` from the right, using `TRUSTED_PROXY_HOPS`: the left part of that header is written by the client and could be forged.

## Tests

```bash
cd backend
pytest
```

The tests in the `tests/integration/` folder run against a real PostGIS database: a `qrshield_test` database is created alongside the main database. They therefore require `docker compose up db` to be running, and are skipped otherwise.

```bash
cd mobile
npm test            # unit tests (Jest)
npm run typecheck   # TypeScript check
```

On every push to GitHub, continuous integration runs the backend tests against a PostGIS database, checks that migrations match the models, then checks the mobile app (TypeScript, ESLint, Jest) and the web page build.

### End-to-end tests

The `e2e/` folder contains 29 Playwright tests that run against the real stack: API, PostGIS database, and reputation services. They cover the API, the web page, and the full app flow, from sign-up to deleting a scan. They verify, for example, that the Wi-Fi password never appears in the request sent to the server, or that a canceled report does not change the public figures.

```bash
docker compose up -d
cd e2e
npm install
npm test
```

The tests use Microsoft Edge, already present on Windows. The app runs in the browser at phone size, thanks to a few `.web` files: confirmations, token storage, and map display. These files are not used on a phone. The script assumes Docker is running in WSL.

These tests do not replace a test on a real device. They do not cover camera scanning, the flashlight, the Keystore, or the Android WebView: the two bugs described below would only have been seen on a phone.

## API

Full documentation is available at `/docs`. Current routes:

| Method | Route | Role |
|---|---|---|
| POST | `/auth/register` | Create an account |
| POST | `/auth/login` | Get a JWT token |
| POST | `/auth/refresh` | Renew the session |
| POST | `/auth/logout` | Revoke the session |
| GET | `/auth/me` | Information about the logged-in account |
| POST | `/scans` | Save a scanned QR code, with an optional GPS position |
| GET | `/scans` | Paginated history, with an optional filter on the verdict |
| GET / DELETE | `/scans/{id}` | View or delete a scan |
| POST | `/scans/{id}/report` | Report a link to the community |
| GET | `/stats/me` | Personal statistics |
| GET | `/community/zones` | Reported zones, without an account |
| GET | `/community/stats` | Global anonymized statistics, without an account |
| GET | `/notifications` | Reclassification alerts for the account |
| POST | `/notifications/{id}/read` | Mark an alert as read |

The content type (link, Wi-Fi, email, phone, contact...) is detected by the server. For a link, the response from `POST /scans` also contains the result of the security analysis: verdict, score, final URL, redirect chain, and list of reasons.

## Security analysis

When a link is scanned, the server analyzes it in four steps.

**1. Following redirects.** The server follows the link to its final destination, without ever downloading page content: only HTTP headers are read. This is what makes it possible to see where a shortened link (`bit.ly`, `qrco.de`...) or a redirect chain really leads.

**2. Clues in the URL.** Several scam techniques are visible directly in the URL:

| Technique | Example | What is detected |
|---|---|---|
| Deliberate typo | `netfIix.com`, `chronoposte.fr` | edit distance from a brand name |
| Letters replaced by numbers | `paypa1.com`, `amaz0n-livraison.fr` | comparison after replacing lookalike characters |
| Brand name in another domain | `paypal-securite-compte.com`, `impots-gouv-remboursement.fr` | presence of a brand name outside its official domains |
| Brand placed in a subdomain | `paypal.com.verification-client.ru` | the real domain is `verification-client.ru` |
| Homograph | `аpple.com` with a Cyrillic "а" | punycode decoding and conversion of letters from other alphabets |
| `@` trick | `https://www.paypal.com@evil.com` | the browser ignores everything before the `@` |
| Direct download | `.apk`, `.exe`, `.msi`... | file extension and MIME type returned by the server |
| IP address, suspicious TLD, no HTTPS | `http://45.13.22.8/`, `.top`, `.xyz` | weaker clues |

The list of monitored brands focuses on those most often imitated in France: banks, French government services (Ameli, impots.gouv), delivery companies, and parking apps, since fake QR codes pasted on parking meters are the most common example of *quishing*.

**3. External services.** Google Safe Browsing and VirusTotal indicate whether the link is already known as malicious. Domain age is obtained through the RDAP protocol (the successor to WHOIS): a scam site is often only a few days old, because it is shut down quickly. These three checks are launched in parallel. I never submit a URL to VirusTotal, I only look up existing results: a submitted URL becomes public, and the URL in a QR code may contain personal information.

**4. Score.** Each clue has a severity, and therefore a weight: low (10), medium (25), high (45), critical (80). Weights add up, up to a maximum of 100. Below 30, the link is considered safe; from 30 to 59, suspicious; from 60, dangerous. A single high clue therefore makes a link suspicious, two make it dangerous, and a match in Safe Browsing, or detection by at least three antivirus engines, is enough to classify it as dangerous. Each clue comes with an explanation sentence shown to the user.

The result of an analysis is shared among all users and reused for 24 hours. The same URL scanned by many people is therefore analyzed only once per day, which also saves the VirusTotal quota (4 requests per minute in the free version).

### Server protection (SSRF)

Following links chosen by anyone poses a risk to the server itself. A QR code containing `http://169.254.169.254/` or `http://localhost:5432` could make the API query its own internal services: this is an SSRF attack (*Server-Side Request Forgery*). To avoid this, at each redirect step:

- I resolve the domain name myself and reject any address that is not public (local network, loopback, reserved addresses, multicast, private IPv6, or IPv4 encapsulated in IPv6);
- I then connect directly to the verified IP address, not to the domain name. Otherwise, a malicious DNS server could return a public address during verification, then an internal address during connection (*DNS rebinding*). The TLS certificate is still verified for the real domain name thanks to SNI;
- any credentials present in the URL are never transmitted, and the number of redirects and total duration are limited.

### Known limitations

- Heuristics can produce false positives: `amazonia-voyages.fr` is considered suspicious because it contains "amazon". For brand names that are also common words (Orange, Free, Apple...), only an exact match is taken into account, with reduced severity.
- Only HTTP redirects are followed. A page that redirects in JavaScript or with a `<meta refresh>` tag is not analyzed yet.
- With the Safe Browsing Lookup API, the full URL is sent to Google. The Update API, which sends only a hash prefix of the URL, would preserve privacy better; this is an improvement I plan to make.

## Data model

- `users`: user accounts.
- `scans`: each user's history. The location is stored in a PostGIS column of type `geography(Point)`.
- `url_analyses`: one row per URL, **shared** among all users.

A scan does not store its own verdict: it points to the analysis of its URL. This way, if a URL is reclassified as dangerous later, all concerned scans take it into account immediately, and it is easy to find the users to warn.

## Statistics

Statistics are calculated directly by PostgreSQL: number of scans per week, share of risky QR codes, distribution of verdicts, most scanned sites and usual locations. Each scan also receives a category (website, menu, payment, Wi-Fi or other), inferred from keywords in the address. The comparison uses whole words, so `paysage-lyon.fr` is not mistaken for a payment or `menuiserie-dupont.fr` for a restaurant menu.

Locations are grouped with `ST_ClusterDBSCAN`, a PostGIS function that gathers nearby points without setting the number of groups in advance. Several scans in the same neighborhood thus form a single location, which simple coordinate rounding would not allow: two neighboring points on either side of a rounding boundary would be separated.

Location is optional and only requested on the first scan. The app rounds it to about 100 meters before sending it, because a precise location adds nothing to these statistics and would reveal the user's address. Place names are resolved on the phone: the server only needs the rounded coordinates.

## Community features

Every link judged suspicious or dangerous feeds a shared database, and the user can also report a link they find fraudulent. These reports are displayed on a map, in the app and on a public web page, and they influence the score.

### Anonymization

A public map of this kind easily reveals where people go. I therefore designed the `community_reports` table so that anonymity does not depend on the server's goodwill:

- It contains no user identifier and no link to the original scan.
- The location is snapped to the center of a grid cell about one kilometer wide.
- The date is kept to the day. A precise time would make it possible to find the corresponding scan.
- Only the domain is published, because a full URL can contain personal data.
- An area or a domain is only shown publicly once it has at least two reports: an area with a single report would point to a single person passing through.

Still, the same person must not be counted more than once. Each report therefore carries an HMAC fingerprint computed from the user, the URL and a secret key. It is identical for the same person and the same URL, which blocks duplicates, but it changes from one URL to another: it is impossible to link two reports together, and impossible to check whether a given user reported a link without knowing the key. Deleting a scan also removes the associated reports.

### Contribution to the score

The difficulty is avoiding a score that feeds itself. If automatic reports for a URL counted for that same URL, every suspicious link would eventually become dangerous without any new information. So only two inputs are taken into account:

- Reports made by people: starting at 3, a medium signal; starting at 10, a high signal.
- The presence of other links classified as dangerous on the same domain, which is genuinely independent information.

The community contribution is capped at the "high" level. A series of fake accounts can therefore make a site suspicious, but not dangerous, and the official domains of monitored brands cannot be targeted. Public routes, login, signup and reports are rate-limited. This limit is not enough against an attacker with many IP addresses and many accounts; email address verification would reduce this risk.

### Web page

The public page, with no account, is in `web/`. It shows the map, the evolution of reports, threat types, and the most affected cities and domains. Since the project does not yet have users, it currently relies on fictional data, which a banner clearly indicates. The demo script uses only the reserved `.example` extension, to avoid implicating any real site:

```bash
cd backend
python -m scripts.seed_demo            # adds the fictional data
python -m scripts.seed_demo --clear    # removes them
```

A static version of this page is published on GitHub Pages. It does not depend on any server: `web/scripts/export-demo.mjs` copies the API data into `web/public/demo-data.json`, and refuses to do so if a domain is not fictional, since this file is public. The page then reads this file when it is built with `VITE_STATIC_DEMO=true`. Deployment is automatic on every change to `web/`.

## Alerts

A link can become dangerous after it has been scanned: a phishing page is often put online first and reported later. The `worker` container therefore regularly reanalyzes links that have already been scanned, in small batches to stay within the VirusTotal quota. When a link goes from safe or suspicious to dangerous, everyone who scanned it receives an alert, only once per link.

The zone alert works differently, for privacy reasons. The server never receives the user's current location: the app downloads the public zones from the last seven days and calculates on its own whether there are at least five reports within a five-kilometer radius. This alert is not repeated for a week.

Remote notifications have been removed from Expo Go on Android since SDK 53: they require a compiled version of the app and a Firebase project. For now, the app therefore fetches alerts when it is open and then displays them as local notifications. They do not arrive while it is closed. In Expo Go, the app does receive the tap on a notification, with the correct scan, but Expo Go does not bring it back to the foreground: this behavior still needs to be checked on a compiled build. Alerts in the Account tab lead directly to the scan. Switching to real remote notifications would only require sending the already created alerts from the server.

## Mobile app

The app has five tabs: scanner, history (filterable by verdict), community map, statistics, and account. The map uses Leaflet in a WebView, like the website: this avoids having to manage a Google Maps key. The library is loaded with an integrity hash, and no link can open in this WebView.

After login, the app opens directly on the camera. Once the QR code is read, it is sent to the server, and the result screen displays the verdict with a color code, the score, plain-language reasons, and the redirect chain. The destination domain appears **in large type**, because it is the most useful information for spotting a scam, and it is not always easy to read in the raw URL:

- `https://www.paypal.com@evil.com/login` actually leads to `evil.com`: everything before the `@` is ignored by the browser.
- `https://аpple.com`, written with a Cyrillic "а", displays as `xn--pple-43d.com`, which makes the imitation visible.

The link is never opened automatically. The button appears only after the analysis is finished, and a confirmation is requested. If the link is suspicious or dangerous, this button becomes secondary and turns into « Ouvrir quand même » (Open anyway): the decision is still up to the user, but the default choice is not to open it. The app opens the final URL, meaning the one that was analyzed, because the original link could redirect somewhere else on a second visit. Only `http` and `https` links can be opened, which rules out schemes such as `javascript:` or `intent:`.

For a Wi-Fi QR code, the app displays the network name and security type, but never the password. The password is removed before sending to the server: it does not leave the phone.

On Android, `expo-camera` returns a reformatted version of the content in the `data` field: for a Wi-Fi QR code, this is the network name followed by the password, without the `WIFI:` prefix. The type was therefore no longer recognized and the password was displayed in plain text. I discovered this problem while testing on a real phone, because the unit tests used the raw content directly. The app now reads the `raw` field, and a test reproduces this case.

Tests on a phone revealed a second problem: on Android, `expo-camera` ignores the `active` property. The camera and flashlight therefore stayed on when the user switched tabs, and QR codes could be read without the user's knowledge. The camera component is now removed from the screen as soon as the tab is no longer displayed, which actually closes the camera.

## Security

- Secrets (passwords, API keys, JWT key) are only in `.env`, which is not versioned. The `.env.example` file serves as a template.
- The API container does not run as root and PostgreSQL is exposed only on `127.0.0.1`.
- On a database error, the API never returns the raw error message, which could reveal information about the infrastructure.
- Passwords are hashed with Argon2id and rehashed on login if the recommended parameters change.
- The access token lasts only 15 minutes, because a JWT cannot be revoked. The session is renewed with a refresh token valid for 30 days, single-use, and stored in the database as a hash. If an already used token is presented, it must have been copied: the whole session is cut off, and the user must log in again.
- JWT tokens are signed with HS256 using a key of at least 32 characters. The accepted algorithm is enforced by the server: a token forged with `alg: none` is therefore rejected (a test checks this).
- On login, the password is checked even when the email does not exist, by comparing it to a dummy hash. Without this precaution, the response would be faster for an unknown email, and it would be possible to guess which accounts exist by measuring the response time.
- Wi-Fi QR codes contain the network password in plain text (`WIFI:S:MaBox;P:motdepasse;;`). It is masked before saving and is never stored in the database.
- Requesting another user's scan returns a 404 error, not a 403, so as not to confirm that the identifier exists.
- On the phone, the JWT token is kept with `expo-secure-store`, which relies on the Android Keystore and iOS Keychain. AsyncStorage would have stored it in plain text.
- Login attempts are limited by IP address and by account, which slows down password guessing.
- The web page is served by nginx without root privileges, with a Content Security Policy (CSP).

Rate limiting is kept in memory, which is enough for a single process; with multiple API instances, a shared counter such as Redis would be needed. In development, the app communicates with the API over HTTP on the local network; a real deployment will need to use HTTPS.

## Code organization

```
backend/
  app/
    main.py        FastAPI entry point
    config.py      configuration read from environment variables
    database.py    SQLAlchemy connection
    routers/       API routes
    models/        SQLAlchemy tables
    schemas/       input and output validation (Pydantic)
    services/      URL analysis, scoring, community features
    security/      password hashing, JWT tokens
  alembic/         migrations
  tests/
mobile/
  src/
    app/           screens (expo-router: one file = one route)
    components/    reusable components
    hooks/         login, scan submission and analysis
    services/      API calls, secure token storage, location
    utils/         QR code content parsing, labels
web/
  src/
    components/    Leaflet map, charts, table
    services/      public API calls
    utils/         nearest city to a zone
```

## Progress

- [x] Project setup (Docker Compose, structure, configuration, `/health` route)
- [x] Data model, migrations, user accounts, and scan history
- [x] Mobile scan screen and content display
- [x] Server-side security analysis (redirects, typosquatting, Safe Browsing, VirusTotal, domain age)
- [x] Scoring algorithm
- [x] User accounts and display of the analysis result in the app
- [x] Personal history and statistics in the app
- [x] Community map (app and public web page)
- [x] Automatic reclassification and alerts (local notifications)
- [ ] Remote notifications (compiled version and Firebase)
- [x] Long sessions with refresh tokens
- [x] Static demo page on GitHub Pages
- [ ] API deployment
