# Documentation technique – Pipeline CI/CD Orion CRM

| | |
|---|---|
| **Titre du document** | Documentation technique – Industrialisation CI/CD de l'application Orion CRM |
| **Auteur** | Charles Bardin |
| **Option choisie** | Option B (Scénario Orion) |
| **Date** | Juin 2026 |

---

## Sommaire

1. [Introduction](#1-introduction)
2. [Étapes de mise en œuvre du pipeline CI/CD](#2-étapes-de-mise-en-œuvre-du-pipeline-cicd)
3. [Plan de conteneurisation et de déploiement](#3-plan-de-conteneurisation-et-de-déploiement)
4. [Plan de testing périodique](#4-plan-de-testing-périodique)
5. [Plan de sécurité](#5-plan-de-sécurité)
6. [Monitoring, métriques & KPI](#6-monitoring-métriques--kpi)
7. [Plan de sauvegarde des données](#7-plan-de-sauvegarde-des-données)
8. [Plan de mise à jour](#8-plan-de-mise-à-jour)
9. [Conclusion](#9-conclusion)
- [Annexes](#annexes)

---

## 1. Introduction

### 1.1 Contexte du projet

Orion est une entreprise spécialisée dans les solutions technologiques
innovantes. Ses équipes technique et commerciale s'appuient sur une application
interne de type **CRM (Customer Relationship Management)**, permettant de gérer
des **organisations** et leurs **contacts**.

Cette application est bâtie sur une architecture **full-stack JavaScript** :
une API back-end **Node.js / Express** et une interface front-end **React**.
Jusqu'à présent, les déploiements étaient réalisés **manuellement**, ce qui
provoquait des retards et des erreurs, et fragilisait la fiabilité des
livraisons.

Pour fiabiliser et accélérer les mises en production, la direction technique
souhaite **industrialiser la chaîne CI/CD** de l'application et intégrer des
**contrôles de qualité et de sécurité du code** à chaque étape.

### 1.2 Objectifs de l'industrialisation

- **Automatiser** la construction (build), les tests et le déploiement de
  l'application front-end et back-end.
- **Garantir la qualité et la sécurité** du code via une analyse statique
  continue (SonarCloud) et le respect des bonnes pratiques OWASP.
- **Standardiser l'environnement d'exécution** grâce à la conteneurisation
  (Docker) et à l'orchestration locale (Docker Compose).
- **Réduire la dette technique** et **améliorer la stabilité** du système.
- **Mesurer la performance** du pipeline et de l'application (métriques DORA,
  KPI, monitoring ELK).

### 1.3 Technologies principales

| Domaine | Technologies |
|---|---|
| Front-end | React 19, TypeScript, Vite 6, Tailwind CSS, TanStack Query, Axios |
| Back-end | Node.js 22, Express 5, TypeScript, Prisma (ORM), SQLite, Zod |
| Tests | Vitest, couverture `@vitest/coverage-v8` |
| CI/CD | GitHub Actions |
| Conteneurisation | Docker, Docker Compose, image de base Alpine, Nginx (front) |
| Qualité & sécurité | SonarCloud, OWASP Top 10 |
| Registre d'images | GitHub Container Registry (GHCR) |
| Monitoring (Partie 2) | Stack ELK (Elasticsearch, Logstash, Kibana), métriques DORA |

### 1.4 Présentation rapide du pipeline CI/CD

Le pipeline mis en place repose sur **GitHub Actions** et suit un flux par
*pull request*. Il s'articule autour de trois temps :

1. **Intégration continue (CI)** — déclenchée sur les **pull requests** vers
   `main` et sur les **push sur `main`** (après merge) : installation des
   dépendances, lint, build du front et du back, exécution des tests automatisés
   avec couverture, puis analyse de qualité et de sécurité via **SonarCloud**
   (décoration de la pull request, et analyse de la branche `main` après merge
   pour établir la référence du Quality Gate).
2. **Tests périodiques (nightly)** — exécution planifiée chaque nuit : suite de
   tests complète de non-régression et audit de sécurité des dépendances
   (`npm audit`), complétés par un scan de vulnérabilités des images Docker.
3. **Déploiement continu (CD)** — déclenché sur la création d'un **tag de
   version** (`vX.Y.Z`) : construction des images Docker du front et du back,
   **smoke test** vérifiant que l'application démarre correctement à partir des
   artefacts, puis **publication sur GHCR**.

L'application est entièrement conteneurisée et peut être lancée localement via
une seule commande `docker compose up`.

Le **monitoring** de l'application (stack ELK) constitue une couche
d'observabilité complémentaire, volontairement maintenue **en dehors du
pipeline CI/CD** ; il est décrit en [section 6](#6-monitoring-métriques--kpi).

---

## 2. Étapes de mise en œuvre du pipeline CI/CD

### 2.1 Structure du pipeline

#### Analyse de l'existant

Avant toute automatisation, le dépôt a été étudié pour comprendre son
organisation, ses commandes et ses contraintes techniques.

**Organisation (monorepo)**

```
.
├── client/        # Application front-end React (Vite)
├── server/        # API back-end Express (Prisma + SQLite)
└── README.md
```

**Commandes disponibles**

| Action | Back-end (`server/`) | Front-end (`client/`) |
|---|---|---|
| Démarrage dev | `npm run dev` (tsx watch) | `npm run dev` (Vite) |
| Build | `npm run build` (`tsc` → `dist/`) | `npm run build` (Vite → `dist/`) |
| Tests | `npm test` (Vitest) | `npm test` (Vitest) |
| Couverture | `npm run test:coverage` | `npm run test:coverage` |
| Lint | `npm run lint` (ESLint) | `npm run lint` (ESLint) |
| Base de données | `npm run prisma:generate` / `prisma:migrate` | — |

**Lancement local**

- Back-end : build TypeScript via `tsc` (sortie `dist/`), démarrage `node
  dist/index.js`, API exposée sur le port **8080** (`/api/health` pour le
  contrôle d'état).
- Front-end : build Vite (sortie `dist/`), application servie sur le port
  **4200**, avec un proxy `/api` vers le back-end.

**Contraintes techniques identifiées pour la CI/CD**

- Les tests fournis étaient des **squelettes** ne vérifiant aucun comportement
  réel : de vrais tests unitaires et d'intégration ont été ajoutés.
- La couverture (`test:coverage`) nécessitait l'ajout de la dépendance
  `@vitest/coverage-v8` et d'un rapport `lcov` exploitable par SonarCloud.
- Les **migrations Prisma** doivent être versionnées pour garantir un build
  Docker / CI reproductible (la base SQLite d'un conteneur étant éphémère).
- Les **Dockerfiles** initiaux étaient volontairement basiques et destinés à
  être optimisés (multi-stage, image Alpine, exécution sans privilèges).

#### Étapes principales et ordre d'exécution

_À compléter en phase C (CI) : build back-end, build front-end, tests, analyse
SonarQube, déploiement._

#### Justification du choix des actions GitHub

_À compléter en phase C._

### 2.2 Scripts d'automatisation

_À compléter : scripts utilisés, leur rôle dans le pipeline, comment les exécuter
ou les adapter._

### 2.3 Reproductibilité

_À compléter : comment relancer le pipeline, gestion des secrets (sans jamais les
afficher)._

---

## 3. Plan de conteneurisation et de déploiement

L'application est **entièrement conteneurisée** : le back-end et le front-end ont
chacun leur image Docker, et l'ensemble est orchestré par **Docker Compose**. Les
objectifs poursuivis sont la **reproductibilité**, des **images minimales et
sécurisées**, et un **démarrage en une seule commande**.

Principes communs aux deux Dockerfiles :

- **Builds multi-stage** : séparer l'environnement de construction (lourd) de
  l'image finale (légère), qui ne contient que le strict nécessaire à l'exécution.
- **Images de base officielles et minimales** (Alpine), endossées par des
  communautés influentes.
- **Exécution sans privilèges** (utilisateur non-root).
- **Dépendances de production uniquement** et fichiers `.dockerignore` (exclusion
  de `node_modules`, `dist`, `.env`, `*.db`…).
- **Aucune donnée sensible** dans les images.

### 3.1 Dockerfiles

#### Back-end (`server/Dockerfile`)

Deux étapes :

| Étape | Base | Rôle |
|---|---|---|
| `builder` | `node:22-alpine` | `npm ci` (toutes deps), `prisma generate`, `tsc` (TS → `dist/`) |
| `runner` | `node:22-alpine` | `npm ci --omit=dev` (prod), `prisma generate`, copie du `dist/`, exécution **non-root** (`node`) |

Choix techniques et justifications :

- **`node:22-alpine`** : image officielle, minimale, alignée sur la version de
  Node du projet (22 LTS).
- **Migrations appliquées au démarrage** : un script d'entrée
  (`docker-entrypoint.sh`) exécute `prisma migrate deploy` **avant** de lancer
  l'API. La commande `migrate deploy` n'applique que les migrations déjà
  versionnées (ni invite, ni génération), ce qui rend le démarrage **idempotent**
  et le conteneur **autonome** (il sait se migrer seul).
- **Base de données** : la base SQLite est stockée dans `/app/data` (répertoire
  inscriptible appartenant à l'utilisateur `node`), monté sur un **volume** pour
  la persistance. `DATABASE_URL` est fournie par l'environnement.
- **Port** exposé : `8080`.

**Arbitrage assumé — taille de l'image.** Comme les migrations s'exécutent au
démarrage, l'image embarque la **CLI Prisma** (et son moteur de migration), ce qui
porte l'image à **≈ 574 Mo** — déjà un gain net face à l'image initiale
mono-stage `node:22` (Debian, ≈ 1,1 Go), grâce à Alpine, au multi-stage, aux
dépendances de production et au non-root. Une alternative de production
permettrait de descendre à ≈ 250–300 Mo en sortant les migrations de l'image
applicative (service de migration dédié exécuté une fois) ; elle n'a pas été
retenue ici par souci de simplicité (cf. [§8](#8-plan-de-mise-à-jour) et le plan
de déploiement).

#### Front-end (`client/Dockerfile`)

Deux étapes :

| Étape | Base | Rôle |
|---|---|---|
| `builder` | `node:22-alpine` | `npm ci`, `npm run build` (Vite → `dist/`) |
| `runner` | `nginxinc/nginx-unprivileged:1.27-alpine` | sert les fichiers statiques + reverse-proxy `/api` |

Choix techniques et justifications :

- **Service via Nginx** : le front est une application statique (build Vite) ;
  Nginx la sert efficacement, bien plus léger qu'un serveur Node de prévisualisation.
- **`nginxinc/nginx-unprivileged`** : image officielle de l'équipe Nginx,
  **non-root nativement** (écoute sur le port `8080`).
- **Base d'API relative** : le build est réalisé avec `VITE_API_URL=/api`
  (argument de build explicite). L'application appelle donc l'API en **relatif**,
  et c'est **Nginx qui proxifie `/api`** vers le conteneur back-end. Le front est
  ainsi **autonome** et indépendant de l'hôte.
- **`nginx.conf`** : (1) **fallback SPA** (`try_files … /index.html`) pour confier
  le routage au navigateur ; (2) **reverse-proxy `/api`** vers le service
  `server`, avec une **résolution DNS effectuée à la requête** (via le resolver
  Docker) afin que Nginx démarre même si le back-end n'est pas encore prêt et
  suive ses éventuels redémarrages.
- Image résultante : **≈ 78,7 Mo**.

#### Synthèse des optimisations

| Image | Avant (mono-stage `node:22`) | Après |
|---|---|---|
| Back-end | ≈ 1,1 Go, root | **≈ 574 Mo**, multi-stage Alpine, non-root |
| Front-end | ≈ 1 Go+ (`vite preview`) | **≈ 78,7 Mo**, Nginx Alpine, non-root |

Bonnes pratiques de sécurité appliquées : images **officielles** et **minimales**
(Alpine), **exécution non-root**, **dépendances de production** uniquement,
**aucun secret** ni base de données dans les images (`.dockerignore` exclut
`.env` et `*.db`).

### 3.2 docker-compose.yml

Le fichier `docker-compose.yml` (racine) orchestre les deux services sur le réseau
par défaut de Compose (réseau *user-defined* → résolution des noms de services par
le DNS Docker).

| Service | Image | Port (hôte → conteneur) | Points clés |
|---|---|---|---|
| `server` | `orion-crm-server` | `8080 → 8080` | volume `db-data` (SQLite persistant), healthcheck, `restart: unless-stopped` |
| `client` | `orion-crm-client` | `4200 → 8080` | `depends_on: server (service_healthy)`, healthcheck, reverse-proxy `/api` |

- **Volume `db-data`** : monté sur `/app/data` du back-end, il **persiste** la base
  SQLite entre les redémarrages (vérifié : une donnée créée survit au redémarrage
  du conteneur).
- **Healthchecks** : le back-end est sondé sur `/api/health` (via `node`) ; le
  front sur `/` en vérifiant que le **shell applicatif** est bien servi (et non un
  simple code 200). Le `client` ne démarre qu'une fois le `server` **`healthy`**
  (`depends_on: condition: service_healthy`), garantissant un back-end **prêt**
  (migrations terminées) et pas seulement *lancé*.

**Lancement local**

```bash
docker compose up --build
```

On obtient alors :

- Front-end (Nginx) → <http://localhost:4200>
- Back-end (API) → <http://localhost:8080/api/health>

L'ensemble a été validé de bout en bout : démarrage des deux services jusqu'à
l'état `healthy`, accès direct à l'API, **proxy `/api` du front vers le back**, et
parcours complet (création puis lecture d'une organisation via le front →
persistance en base).

---

## 4. Plan de testing périodique

### 4.1 Types de tests automatisés

_À compléter en phase C : tests unitaires, d'intégration, de sécurité (SonarQube)._

### 4.2 Fréquence d'exécution

_À compléter : sur push, sur pull request, exécution périodique, avant release._

### 4.3 Objectifs des tests

_À compléter : qualité, non-régression, vérification avant déploiement._

---

## 5. Plan de sécurité

### 5.1 Résultats SonarQube

_À compléter en phases C puis I : vulnérabilités, code smells critiques, zones de
complexité, couverture des tests._

### 5.2 Analyse des risques

#### Gestion des vulnérabilités : deux niveaux selon la maîtrise

Le pipeline distingue deux catégories de vulnérabilités, traitées différemment
selon notre capacité à agir dessus :

| Source | Maîtrise | Politique | Outil |
|---|---|---|---|
| Dépendances applicatives (npm) | Nous | **Gate bloquant** | `npm audit` (nightly) |
| Paquets OS de l'image de base | Amont (Alpine / Node) | **Monitoring** (report-only) + rebuild périodique | Trivy (nightly) |

**Dépendances npm.** Le job `audit` du workflow *nightly* échoue si une dépendance
**de production** présente une vulnérabilité *high/critical*
(`npm audit --omit=dev --audit-level=high`). À ce jour, les dépendances de
production ont **0 vulnérabilité**. Les alertes existantes (2 critiques, 4
modérées) concernent uniquement des **devDependencies** (outils de build/test, non
livrés) : elles sont remontées de façon **informative**, sans bloquer.

**Image de base.** Trivy scanne les images Docker (HIGH/CRITICAL corrigeables). Les
CVE détectées portent sur des **paquets OS de l'image de base** (openssl, libpng,
libxml2, zlib…), **hors de notre contrôle** (rythme de publication des correctifs
par Alpine / Node) et souvent non exploitables par l'application (bibliothèques non
sollicitées par l'API). Pour éviter la **fatigue d'alerte**, ce scan est
**en report-only** (il n'échoue pas le *nightly*) : les résultats sont publiés dans
l'onglet **Security** de GitHub (format SARIF) pour la visibilité, et la
remédiation passe par un **rebuild périodique** des images — le *nightly*
reconstruit les images et récupère ainsi les paquets patchés au fil des mises à
jour amont.

**Risques liés au pipeline.** Les secrets (`SONAR_TOKEN`, `GITHUB_TOKEN`) sont gérés
via les **secrets GitHub** (jamais en clair, jamais affichés). Aucune donnée
sensible n'est embarquée dans les images : les `.dockerignore` excluent `.env` et
`*.db`.

### 5.3 Plan d'action / Remédiation

_À compléter en phase I : actions immédiates, court terme, long terme._

---

## 6. Monitoring, métriques & KPI

### 6.1 Métriques DORA

_À compléter en phase H : Lead Time, Deployment Frequency, MTTR, Change Failure
Rate (méthode de calcul + valeurs observées)._

### 6.2 KPI personnalisés

_À compléter : temps de build, temps des tests, taux d'erreurs dans les logs,
autres KPI pertinents._

### 6.3 Analyse synthétique du monitoring

_À compléter : tendances, points forts, points à améliorer, dashboards, alertes._

---

## 7. Plan de sauvegarde des données

### 7.1 Ce qui doit être sauvegardé

_À compléter en phase I : données, fichiers de configuration, artefacts de build._

### 7.2 Procédure de sauvegarde

_À compléter : format, fréquence, outils utilisés._

### 7.3 Procédure de restauration

_À compléter : scénario d'incident, étapes de retour à une version stable,
limitations._

---

## 8. Plan de mise à jour

### 8.1 Mise à jour de l'application

_À compléter en phase I : dépendances npm, mises à jour React / Node.js, images
Docker._

### 8.2 Mise à jour du pipeline CI/CD

_À compléter : versions des actions GitHub, des scripts, maintenance du workflow._

### 8.3 Fréquence & bonnes pratiques

_À compléter : conseils pour maintenir la solution dans le temps._

---

## 9. Conclusion

_À compléter en phase J : résumé des améliorations, gains observés (fiabilité,
rapidité, qualité), recommandations pour les itérations suivantes._

---

## Annexes

_À compléter : captures SonarQube, captures de logs / dashboards ELK, extraits de
workflows, commandes utiles._
