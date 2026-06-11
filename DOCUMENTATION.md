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

Orion est une entreprise spécialisée dans les solutions technologiques innovantes.
Ses équipes technique et commerciale s'appuient sur une application interne de type
**CRM (Customer Relationship Management)**, qui permet de gérer des **organisations**
et leurs **contacts**. Cette application repose sur une architecture **full-stack
JavaScript** : une API back-end **Node.js / Express** et une interface front-end
**React**.

Jusqu'à présent, les déploiements étaient réalisés manuellement, ce qui provoquait
des retards et des erreurs et fragilisait la fiabilité des livraisons. Pour
fiabiliser et accélérer les mises en production, la direction technique souhaite
**industrialiser la chaîne CI/CD** de l'application et y intégrer, à chaque étape,
des **contrôles de qualité et de sécurité du code**.

### 1.2 Objectifs de l'industrialisation

L'industrialisation poursuit cinq objectifs :

- **automatiser** la construction (*build*), les tests et la **livraison** (publication
  des images) du front-end et du back-end ;
- **garantir la qualité et la sécurité** du code par une analyse statique continue
  (SonarCloud) et par la réduction des risques de sécurité de la **chaîne de
  livraison** (en référence au standard OWASP) ;
- **standardiser l'environnement d'exécution** grâce à la conteneurisation (Docker)
  et à l'orchestration locale (Docker Compose) ;
- **réduire la dette technique** et **améliorer la stabilité** du système ;
- **mesurer la performance** du pipeline et de l'application (métriques DORA, KPI,
  monitoring ELK).

### 1.3 Technologies principales

| Domaine | Technologies |
|---|---|
| Front-end | React 19, TypeScript, Vite 6, Tailwind CSS, TanStack Query, Axios |
| Back-end | Node.js 22, Express 5, TypeScript, Prisma (ORM), SQLite, Zod |
| Tests | Vitest, couverture `@vitest/coverage-v8` |
| CI/CD | GitHub Actions |
| Conteneurisation | Docker, Docker Compose, image de base Alpine, Nginx (front) |
| Qualité & sécurité | SonarCloud, `npm audit`, Trivy |
| Registre d'images | GitHub Container Registry (GHCR) |
| Monitoring | Stack ELK (Elasticsearch, Logstash, Kibana), métriques DORA |

### 1.4 Présentation rapide du pipeline CI/CD

Le pipeline mis en place repose sur **GitHub Actions** et suit un flux par *pull
request*. Il s'articule autour de trois temps : l'**intégration continue (CI)**, qui
valide chaque pull request vers `main` puis l'état de `main` après merge (lint,
build, tests avec couverture, analyse SonarCloud) ; des **tests périodiques
(*nightly*)**, exécutés chaque nuit pour la non-régression et la sécurité ; et le
**déploiement continu (CD)**, déclenché par un tag de version, qui construit les
images, les vérifie par un *smoke test* puis les publie sur GHCR.

L'application est entièrement conteneurisée et peut être lancée localement par une
seule commande, `docker compose up`. Le **monitoring** applicatif (stack ELK)
constitue une couche d'observabilité complémentaire, volontairement maintenue **en
dehors du pipeline CI/CD** ; il est décrit en [section 6](#6-monitoring-métriques--kpi).

### 1.5 Analyse de l'existant

Avant toute automatisation, le dépôt fourni a été étudié afin d'en comprendre
l'organisation, les commandes et les contraintes techniques.

Le projet suit une organisation **monorepo**, avec un front-end et un back-end
indépendants :

```
.
├── client/        # Application front-end React (Vite)
├── server/        # API back-end Express (Prisma + SQLite)
└── README.md
```

Les deux applications exposent un jeu de commandes npm comparable :

| Action | Back-end (`server/`) | Front-end (`client/`) |
|---|---|---|
| Démarrage dev | `npm run dev` (tsx watch) | `npm run dev` (Vite) |
| Build | `npm run build` (`tsc` → `dist/`) | `npm run build` (Vite → `dist/`) |
| Tests | `npm test` (Vitest) | `npm test` (Vitest) |
| Couverture | `npm run test:coverage` | `npm run test:coverage` |
| Lint | `npm run lint` (ESLint) | `npm run lint` (ESLint) |
| Base de données | `npm run prisma:generate` / `prisma:migrate` | — |

En local, le back-end se construit via `tsc` (sortie `dist/`) et démarre avec
`node dist/index.js`, exposant l'API sur le port **8080** (la route `/api/health`
servant de contrôle d'état) ; le front-end se construit via Vite (sortie `dist/`)
et est servi sur le port **4200**, avec un proxy `/api` vers le back-end.

Cette analyse a mis en évidence plusieurs contraintes à lever pour industrialiser
la chaîne :

- les tests fournis n'étaient que des squelettes ne vérifiant aucun comportement
  réel ; de véritables tests unitaires et de composant ont été ajoutés ;
- la couverture (`test:coverage`) nécessitait l'ajout de la dépendance
  `@vitest/coverage-v8` et la production d'un rapport `lcov` exploitable par
  SonarCloud ;
- les migrations Prisma devaient être **versionnées** pour permettre de (re)créer
  le schéma de façon reproductible dans tout environnement neuf (CI, premier
  démarrage d'un conteneur sur un volume vide, nouveau déploiement) et servir de
  source de vérité à son évolution ;
- les Dockerfiles initiaux, volontairement basiques, étaient destinés à être
  optimisés (multi-stage, image Alpine, exécution sans privilèges).

---

## 2. Étapes de mise en œuvre du pipeline CI/CD

### 2.1 Structure du pipeline

Le pipeline repose sur **GitHub Actions** et se compose de **trois workflows**
complémentaires, chacun déclenché à un moment différent du cycle de développement :

| Workflow | Fichier | Déclencheur | Rôle |
|---|---|---|---|
| Intégration continue (CI) | `ci.yml` | pull request + push sur `main` | lint, build, tests avec couverture, analyse SonarCloud |
| Tests périodiques (*nightly*) | `nightly.yml` | planification (03:00 UTC) + manuel | non-régression complète, audit des dépendances, scan des images |
| Déploiement continu (CD) | `cd.yml` | tag de version (`vX.Y.Z`) | build, *smoke test*, publication des images sur GHCR |
| Release | `release.yml` | après un **CD réussi** (lui-même sur tag) | release GitHub versionnée + artefacts de build |

Les quatre workflows sont décrits ci-dessous. Le *nightly* et le déploiement font en
outre l'objet de sections dédiées : le volet *testing* du *nightly* dans le
[plan de testing périodique](#4-plan-de-testing-périodique) (§4), son volet *sécurité*
(audit des dépendances, scan des images) dans l'[analyse des risques](#52-analyse-des-risques)
(§5.2), et la stratégie de déploiement dans le [plan de déploiement](#33-plan-de-déploiement-cd)
(§3.3).

#### Intégration continue (CI)

Le workflow `ci.yml` s'exécute sur **chaque pull request vers `main`** ainsi que
sur **chaque `push` sur `main`** (après merge). Il se compose de trois jobs :

| Job | Étapes (dans l'ordre) | Rôle |
|---|---|---|
| `backend` | `npm ci` → `prisma generate` → `lint` → `build` (tsc) → `test:coverage` | valide le back-end |
| `frontend` | `npm ci` → `lint` → `typecheck` → `test:coverage` → `build` (Vite) | valide le front-end |
| `sonarqube` | récupère les couvertures → **analyse SonarCloud** | qualité & sécurité |

Les jobs `backend` et `frontend` s'exécutent en parallèle ; le job `sonarqube` en
dépend (`needs`), car il consomme leurs rapports de couverture.

L'ordre des étapes répond à une logique de validation. Côté back-end, le `build`
(`tsc`) effectue aussi la vérification de types ; il précède donc les tests, car
exécuter des tests sur un code qui ne compile pas n'aurait pas de sens. Côté
front-end, le `build` (Vite/esbuild) ne vérifie **pas** les types : une étape
`typecheck` (`tsc --noEmit`) lui est dédiée, et le `build` est placé en dernier —
il est inutile de produire le *bundle* si les types ou les tests échouent. Enfin,
le mécanisme `concurrency` (`cancel-in-progress`) annule un run devenu obsolète dès
qu'un nouveau commit arrive sur la même référence, ce qui évite les exécutions en
double.

Les actions GitHub retenues sont toutes officielles et maintenues. `actions/checkout`
récupère le code source — le job SonarCloud l'emploie avec `fetch-depth: 0` pour une
détection fiable du « nouveau code ». `actions/setup-node` installe Node 22 et active
le cache npm, qui accélère `npm ci` d'un run à l'autre. Les rapports de couverture du
back-end et du front-end sont transmis au job Sonar via `actions/upload-artifact` et
`actions/download-artifact`. Enfin, `SonarSource/sonarqube-scan-action`, épinglée par
empreinte de commit (SHA) pour des raisons de sécurité, lance l'analyse. Toutes ces
actions sont figées sur des versions s'exécutant sur le runtime **Node 24**.

#### Déploiement continu (CD)

Le déploiement continu est assuré par le workflow `cd.yml`, déclenché par la création
d'un **tag de version** (`vX.Y.Z`) : la publication relève donc d'une **action
humaine**, et non de chaque merge sur `main`. Il enchaîne deux jobs. Un premier job
de *gate* rejoue les tests du back-end et du front-end, de sorte qu'aucun artefact
non testé ne soit publié et que le pipeline de déploiement reste autonome. Un second
job de *release* construit les images, exécute un **smoke test** de bout en bout, puis
**publie les images sur GHCR** uniquement si ce smoke test réussit. L'analyse
SonarCloud n'est pas rejouée au tag, le code ayant déjà été inspecté en amont (sur la
pull request, puis sur `main`). La stratégie de déploiement — ce qui est publié et
comment l'exécuter — est détaillée en [§3.3](#33-plan-de-déploiement-cd).

#### Tests périodiques (*nightly*)

Le workflow `nightly.yml` s'exécute chaque nuit (03:00 UTC) et peut aussi être
déclenché manuellement (`workflow_dispatch`). Il est volontairement maintenu **hors
du pipeline CI** : il rejoue la suite de tests complète en non-régression, audite les
vulnérabilités des dépendances (`npm audit`) et scanne les images Docker (Trivy).
Cette périodicité vise à détecter ce que le *temps* introduit — de nouvelles
vulnérabilités dans les dépendances ou les images de base — indépendamment de toute
modification du code. Son contenu est détaillé dans le plan de testing périodique
([§4](#4-plan-de-testing-périodique)) et le plan de sécurité
([§5.2](#52-analyse-des-risques)).

#### Releases et politique de versioning

Le workflow `release.yml` s'exécute **après la publication réussie des images** : il est
chaîné au workflow CD (déclencheur `workflow_run`), de sorte que la release n'est créée
**que pour une version ayant passé l'intégralité du pipeline** — tests, *smoke test* et
publication des images sur GHCR. On ne crée donc jamais de release pour une version dont
l'un de ces contrôles aurait échoué. Il automatise la
**création de la release GitHub** : il construit les artefacts de l'application (builds
`server` et `client`), génère les notes de version à partir des commits depuis le tag
précédent, et publie une release versionnée avec ces artefacts attachés. Les images
Docker, elles, sont publiées sur GHCR par le CD (cf. [§3.3](#33-plan-de-déploiement-cd)).

La politique de versioning suit **SemVer** (`MAJOR.MINOR.PATCH`) :

- une **release est déclenchée par la création d'un tag** — une **action humaine**
  délibérée, sans release candidate automatique à chaque commit ;
- l'incrément de version est **décidé par le développeur** (correctif → *patch*,
  fonctionnalité → *minor*, rupture → *major*), et non dérivé automatiquement des
  messages de commit (le projet n'utilise donc pas un outil comme *semantic-release*,
  afin de garder un contrôle explicite sur les versions) ;
- l'application est versionnée comme **un seul produit** : un tag publie l'ensemble
  back-end + front-end, qui correspond à la combinaison testée ensemble — il n'y a
  donc **pas de branche dédiée par release**, le tag sur `main` suffit.

La **source de vérité de la version est le tag git** : c'est lui que le pipeline
utilise (tags d'images, nom de la release, artefacts). Le champ `version` des
`package.json` n'est lu par aucune étape (l'application n'est pas publiée sur npm) ;
il est donc neutralisé à **`0.0.0-development`** (convention indiquant une version
gérée en dehors du fichier) pour signaler explicitement qu'il **ne porte pas** la
version, plutôt que d'y maintenir une valeur trompeuse.

### 2.2 Scripts d'automatisation

La logique d'automatisation est centralisée dans les **scripts npm** de chaque
projet, réutilisés à l'identique en local et en CI : aucune logique n'est dupliquée
dans les fichiers YAML, ce qui garantit que les contrôles exécutés par le pipeline
sont exactement ceux qu'un développeur peut lancer sur son poste.

| Script | Back-end | Front-end |
|---|---|---|
| `lint` | `eslint src --ext .ts` | `eslint src --ext .ts,.tsx` |
| `build` | `tsc` | `vite build` |
| `test` | `vitest run` | `vitest run` |
| `test:coverage` | `vitest run --coverage` | `vitest run --coverage` |
| `typecheck` | — | `tsc --noEmit` |
| `prisma:generate` / `prisma:migrate` | Prisma | — |

Le script `test` invoque `vitest run` (exécution unique, déterministe) plutôt que
`vitest` seul, qui démarrerait en mode *watch* — un processus qui ne se termine
jamais et bloquerait la CI. Un script `test:watch` distinct est réservé au
développement local.

### 2.3 Reproductibilité

Le pipeline est conçu pour être **reproductible et relançable**. La CI se relance en
ouvrant ou en mettant à jour une pull request, ou en poussant sur `main` ; le
*nightly* se déclenche par planification ou manuellement via `workflow_dispatch`.

Les installations sont **déterministes** : la CI utilise `npm ci`, qui respecte
strictement les *lockfiles*, et les migrations Prisma sont versionnées — les
dépendances comme le schéma de base sont donc reproduits à l'identique. Les actions
GitHub sont référencées par des versions explicites (tag majeur, ou empreinte de
commit pour l'action tierce SonarCloud), ce qui garantit un comportement stable dans
le temps.

Enfin, les secrets sont gérés exclusivement via les **secrets GitHub** :
`SONAR_TOKEN` pour l'analyse SonarCloud et le `GITHUB_TOKEN` intégré pour la
publication des images. Ils ne sont jamais écrits en clair ni affichés dans les
logs, et aucune donnée sensible n'est embarquée dans le code ou les images.

---

## 3. Plan de conteneurisation et de déploiement

L'application est **entièrement conteneurisée** : le back-end et le front-end
disposent chacun de leur image Docker, et l'ensemble est orchestré par **Docker
Compose**. La démarche poursuit trois objectifs — la reproductibilité, des images
minimales et sécurisées, et un démarrage en une seule commande — et applique aux
deux Dockerfiles les mêmes principes : un **build multi-stage** (qui sépare
l'environnement de construction, lourd, de l'image finale, réduite au strict
nécessaire à l'exécution), des **images de base officielles et minimales** (Alpine),
une **exécution sans privilèges** (utilisateur non-root), des **dépendances de
production uniquement** accompagnées de fichiers `.dockerignore`, et l'absence de
toute donnée sensible dans les images.

### 3.1 Dockerfiles

#### Back-end (`server/Dockerfile`)

Le Dockerfile back-end est organisé en deux étapes :

| Étape | Base | Rôle |
|---|---|---|
| `builder` | `node:22-alpine` | `npm ci` (toutes deps), `prisma generate`, `tsc` (TS → `dist/`) |
| `runner` | `node:22-alpine` | `npm ci --omit=dev`, `prisma generate`, copie du `dist/`, exécution **non-root** (`node`) |

L'image de base retenue, `node:22-alpine`, est une distribution officielle, minimale
et alignée sur la version de Node du projet (22 LTS). Les migrations de schéma sont
appliquées **au démarrage du conteneur** : un script d'entrée (`docker-entrypoint.sh`)
exécute `prisma migrate deploy` avant de lancer l'API. Comme cette commande applique
uniquement les migrations déjà versionnées, sans invite interactive ni génération de
code, le démarrage est **idempotent** et le conteneur **autonome** — il sait se mettre
à niveau seul. La base SQLite est stockée dans `/app/data`, un répertoire inscriptible
appartenant à l'utilisateur non privilégié `node` et monté sur un volume pour la
persistance ; la variable `DATABASE_URL` est fournie par l'environnement. Le conteneur
expose le port **8080**.

**Arbitrage assumé sur la taille de l'image.** Parce que les migrations s'exécutent au
démarrage, l'image embarque la **CLI Prisma** (et son moteur de migration), ce qui la
porte à **≈ 574 Mo**. C'est déjà un gain net par rapport à l'image initiale mono-stage
`node:22` (Debian, ≈ 1,1 Go), obtenu grâce à Alpine, au multi-stage, aux dépendances de
production et à l'exécution non-root. Une alternative de production permettrait de
descendre à ≈ 250–300 Mo en sortant les migrations de l'image applicative (un service
de migration dédié, exécuté une seule fois) ; elle n'a pas été retenue ici par souci de
simplicité, mais elle est identifiée comme piste d'amélioration.

#### Front-end (`client/Dockerfile`)

Le Dockerfile front-end suit la même logique en deux étapes :

| Étape | Base | Rôle |
|---|---|---|
| `builder` | `node:22-alpine` | `npm ci`, `npm run build` (Vite → `dist/`) |
| `runner` | `nginxinc/nginx-unprivileged:1.27-alpine` | sert les fichiers statiques + reverse-proxy `/api` |

Le front-end étant une application statique (build Vite), il est servi par **Nginx**,
bien plus léger qu'un serveur Node de prévisualisation. L'image retenue,
`nginxinc/nginx-unprivileged`, est maintenue par l'équipe Nginx et s'exécute
**nativement sans privilèges** (écoute sur le port 8080). Le build est réalisé avec
`VITE_API_URL=/api` : l'application appelle ainsi l'API en **relatif**, et c'est
**Nginx qui assure le reverse-proxy de `/api`** vers le conteneur back-end, ce qui rend
le front autonome et indépendant de l'hôte. La configuration `nginx.conf` remplit deux
rôles : un *fallback* SPA (`try_files … /index.html`) qui confie le routage au
navigateur, et le reverse-proxy `/api` vers le service `server`. Ce dernier résout le
nom du back-end **à chaque requête** (via le resolver DNS de Docker), de sorte que
Nginx démarre même si le back-end n'est pas encore prêt et suive ses éventuels
redémarrages. L'image résultante pèse **≈ 78,7 Mo**.

#### Synthèse des optimisations

| Image | Avant (mono-stage `node:22`) | Après |
|---|---|---|
| Back-end | ≈ 1,1 Go, root | **≈ 574 Mo**, multi-stage Alpine, non-root |
| Front-end | ≈ 1 Go+ (`vite preview`) | **≈ 78,7 Mo**, Nginx Alpine, non-root |

Les bonnes pratiques de sécurité appliquées se résument ainsi : des images
**officielles** et **minimales** (Alpine), une **exécution non-root**, des
**dépendances de production** uniquement, et **aucun secret ni fichier de base de
données** embarqué dans les images — les fichiers `.dockerignore` excluant notamment
`.env` et `*.db`. La base SQLite n'est jamais incluse dans l'image : elle réside sur
un volume, **créée au premier démarrage** (application des migrations) puis
**conservée et réutilisée** aux démarrages suivants (cf. [§3.2](#32-docker-composeyml)).

### 3.2 docker-compose.yml

Le fichier `docker-compose.yml`, à la racine du projet, orchestre les deux services
sur le réseau par défaut de Compose. Ce réseau étant *user-defined*, la résolution des
noms de services y est assurée par le DNS interne de Docker, ce dont dépend le
reverse-proxy `/api` du front.

| Service | Image | Port (hôte → conteneur) | Points clés |
|---|---|---|---|
| `server` | `orion-crm-server` | `8080 → 8080` | volume `db-data` (SQLite persistant), healthcheck, `restart: unless-stopped` |
| `client` | `orion-crm-client` | `4200 → 8080` | `depends_on: server (service_healthy)`, healthcheck, reverse-proxy `/api` |

La persistance des données repose sur le volume nommé **`db-data`**, monté sur
`/app/data` du back-end : la base SQLite y survit aux redémarrages du conteneur (un
comportement vérifié en pratique). Chaque service expose par ailleurs un
**healthcheck** : le back-end est sondé sur `/api/health`, et le front sur `/` en
vérifiant que le **shell applicatif** est réellement servi (et non un simple code 200).
Grâce à la dépendance `depends_on: condition: service_healthy`, le `client` ne démarre
qu'une fois le `server` *healthy* — c'est-à-dire **prêt** (migrations terminées) et pas
seulement lancé.

L'application se lance localement par une seule commande :

```bash
docker compose up --build
```

Le front-end (Nginx) est alors accessible sur <http://localhost:4200> et l'API sur
<http://localhost:8080/api/health>. L'ensemble a été validé de bout en bout :
démarrage des deux services jusqu'à l'état *healthy*, accès direct à l'API, proxy
`/api` du front vers le back, et parcours complet (création puis lecture d'une
organisation via le front, avec persistance en base).

### 3.3 Plan de déploiement (CD)

Le déploiement consiste à **publier les images Docker** du back-end et du front-end
sur **GitHub Container Registry (GHCR)**, d'où l'application peut être exécutée dans
tout environnement disposant de Docker. Le fonctionnement du workflow de publication
(gate de tests, construction, *smoke test*) est décrit en
[§2.1](#déploiement-continu-cd) ; la présente section précise la **stratégie** et
l'**exploitation** des images.

**Une publication par tag.** La publication est déclenchée par un tag de version
(`vX.Y.Z`), c'est-à-dire par une action humaine explicite, plutôt qu'à chaque merge sur
`main`. Ce choix évite de publier un état non intentionnel et matérialise clairement
les versions livrées. Le *smoke test* qui précède la publication garantit que
l'artefact **démarre réellement** à partir des images — un contrôle que les tests
unitaires, qui portent sur le code source, ne couvrent pas.

**Images publiées.** Chaque service est poussé sous deux étiquettes, la version
(`vX.Y.Z`) et `latest` :

- `ghcr.io/charles-bardin/orion-crm-server`
- `ghcr.io/charles-bardin/orion-crm-client`

La publication s'appuie sur le `GITHUB_TOKEN` intégré (permission `packages: write`),
sans aucun secret supplémentaire à gérer.

**Exploitation des images.** Le `docker-compose.yml` de la racine sert au
développement local : il **construit** les images depuis les sources (`build: ./server`
et `./client`). En production, on ne construit pas — on tire les images publiées sur
GHCR depuis un fichier d'orchestration dédié qui les **référence** :

```yaml
# docker-compose.prod.yml
services:
  server:                                    # le nom du service est aussi son nom DNS
    image: ghcr.io/charles-bardin/orion-crm-server:vX.Y.Z
    environment:
      DATABASE_URL: file:/app/data/prod.db
    volumes:
      - db-data:/app/data
  client:
    image: ghcr.io/charles-bardin/orion-crm-client:vX.Y.Z
    depends_on:
      server:
        condition: service_healthy
    ports:
      - "80:8080"                            # le front (Nginx) est exposé sur le port 80
volumes:
  db-data:
```

Le déploiement se résume alors à trois commandes sur le serveur cible :

```bash
docker login ghcr.io                          # si les images sont privées
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

**Le nom de service `server` est un contrat.** Le reverse-proxy `/api` du front ne
contient aucune adresse IP en dur : il route vers `http://server:8080` et résout ce
nom **à la requête**, via le DNS du réseau (cf. [§3.2](#32-docker-composeyml)). Le
back-end doit donc rester déclaré comme un **service nommé `server`** sur le même
réseau — sinon il faut adapter `nginx.conf`. C'est le seul point de couplage entre le
front et le back, et il est portable : le mécanisme de résolution par nom est
identique en local et en production.

Le back-end appliquant ses migrations au premier démarrage
(cf. [§3.1](#back-end-serverdockerfile)), la base de données est prête sans aucune
étape manuelle.

---

## 4. Plan de testing périodique

### 4.1 Types de tests automatisés

| Type | Outil | Portée |
|---|---|---|
| Tests unitaires (back) | Vitest | services (logique métier, *repository* mocké) + validation Zod (modèles) |
| Tests de composants (front) | Vitest + Testing Library | rendu d'un composant présentational (`Card`) |
| Qualité & sécurité statique | SonarCloud | vulnérabilités, *code smells*, complexité, couverture |
| Audit des dépendances | `npm audit` (*nightly*) | vulnérabilités des paquets npm |
| Scan des images | Trivy (*nightly*) | CVE des images Docker |

La stratégie de tests est **ciblée plutôt qu'exhaustive**. Dans ce projet
d'industrialisation CI/CD, les tests ont pour but de prouver que l'étape de test du
pipeline fonctionne et vérifie un comportement réel de l'application, et non d'atteindre
une couverture maximale. La couverture se concentre donc sur la **logique métier** (les
services) et la **validation des entrées** (les schémas Zod) — là où se prennent les
véritables décisions de l'application —, tandis que la « tuyauterie » fine (contrôleurs,
routes) est laissée de côté, conformément au principe de ne pas introduire de complexité
inutile. Dans le même esprit, les **tests end-to-end UI** (navigateur) sont hors
périmètre et identifiés comme amélioration future (cf. [§9](#9-conclusion)).

### 4.2 Fréquence d'exécution

| Déclencheur | Tests exécutés |
|---|---|
| **Pull request** vers `main` | CI complète : lint, build, tests avec couverture, analyse SonarCloud (décoration de la PR) |
| **Push sur `main`** (après merge) | CI complète + analyse SonarCloud de la **branche `main`** (référence du *Quality Gate*) |
| **Périodique — *nightly*** (03:00 UTC, ou `workflow_dispatch`) | suite de tests **complète** de non-régression, `npm audit` et scan Trivy. Volontairement **hors CI** (trop lourd pour chaque PR) |
| **Avant release** (tag `vX.Y.Z`) | le pipeline de déploiement **rejoue les tests** et exécute un **smoke test** des images (cf. [§3.3](#33-plan-de-déploiement-cd)) |

### 4.3 Objectifs des tests

Les tests servent quatre objectifs complémentaires. La **validation fonctionnelle**
vérifie que l'application a le comportement attendu (erreur « ressource introuvable »,
garde avant suppression, rejet d'une entrée invalide…). La **non-régression** est
assurée par la réexécution de la suite à chaque pull request, à chaque merge et chaque
nuit, ce qui détecte toute régression, y compris une dérive d'environnement. La
**qualité et la sécurité** sont surveillées en continu par SonarCloud et par les audits
(dette technique, vulnérabilités, duplication). Enfin, l'ensemble vise à **garantir un
`main` toujours déployable**, la CI jouant le rôle de garde-fou avant tout merge.

En matière de **critères d'alerte**, un test en échec **bloque la pull request** ; le
*Quality Gate* SonarCloud signale tout dépassement des seuils de qualité ou de sécurité ;
le *gate* `npm audit` (sur les dépendances de production) bloque le *nightly* ; le scan
Trivy, lui, est en *report-only* (cf. [§5.2](#52-analyse-des-risques)).

---

## 5. Plan de sécurité

### 5.1 Résultats SonarQube

SonarCloud assure l'**inspection continue** de la qualité et de la sécurité du code.
Il est intégré au pipeline CI via le job `sonarqube` (`ci.yml`), qui lit la
configuration `sonar-project.properties` (sources back-end et front-end, exclusions,
chemins des rapports de couverture), consomme les **rapports de couverture** (`lcov`)
produits par les tests, et effectue une **décoration de la pull request** sur les PR
ainsi qu'une **analyse de la branche `main`** après merge — cette dernière fixant la
référence du *Quality Gate* et de la période de « nouveau code ».

L'analyse surveille les **vulnérabilités** et *security hotspots* (sécurité), les
**code smells** et la **complexité** (maintenabilité), la **duplication** de code et la
**couverture** des tests. Le *Quality Gate* synthétise ces critères en un verdict
*passed / failed*, évalué en priorité sur le nouveau code de chaque pull request.

> Les **résultats mesurés** (vulnérabilités, *code smells* critiques, zones de
> complexité, taux de couverture) et leur analyse détaillée sont présentés dans la
> partie finale de la documentation (cf. [§5.3](#53-plan-daction--remédiation) et
> l'analyse des métriques), une fois plusieurs analyses accumulées.

### 5.2 Analyse des risques

Le pipeline distingue deux catégories de vulnérabilités, traitées différemment selon
notre capacité à agir dessus :

| Source | Maîtrise | Politique | Outil |
|---|---|---|---|
| Dépendances applicatives (npm) | Nous | **Gate bloquant** | `npm audit` (*nightly*) |
| Paquets OS de l'image de base | Amont (Alpine / Node) | **Monitoring** (report-only) + rebuild périodique | Trivy (*nightly*) |

**Dépendances npm.** Le job `audit` du *nightly* échoue si une dépendance **de
production** présente une vulnérabilité *high* ou *critical*
(`npm audit --omit=dev --audit-level=high`). À ce jour, les dépendances de production
ne présentent **aucune vulnérabilité** ; les alertes existantes (deux critiques, quatre
modérées) concernent exclusivement des *devDependencies* (outils de build et de test,
non livrés) et sont donc remontées à titre informatif, sans bloquer.

**Image de base.** Trivy scanne les images Docker à la recherche de CVE *high* et
*critical* corrigeables. Les vulnérabilités détectées portent sur des paquets OS de
l'image de base (openssl, libpng, libxml2, zlib…) : elles sont **hors de notre contrôle**
(elles dépendent du rythme de publication des correctifs par Alpine et Node) et souvent
non exploitables par l'application, dont l'API ne sollicite pas ces bibliothèques. Pour
éviter la **fatigue d'alerte**, ce scan est exécuté en *report-only* (il ne fait pas
échouer le *nightly*) : les résultats sont publiés dans l'onglet **Security** de GitHub
(au format SARIF) pour la visibilité, et la remédiation passe par un **rebuild
périodique** des images — le *nightly* reconstruit les images et récupère ainsi les
paquets corrigés au fil des mises à jour amont.

**Risques liés au pipeline.** Les secrets (`SONAR_TOKEN`, `GITHUB_TOKEN`) sont gérés
via les secrets GitHub, jamais écrits en clair ni affichés. Aucune donnée sensible
n'est embarquée dans les images, les fichiers `.dockerignore` excluant `.env` et `*.db`.

**Couverture OWASP.** En référence au **OWASP Top 10**, le pipeline réduit les risques
de sécurité **propres à la chaîne de livraison** : *A06 – Vulnerable and Outdated
Components* (via `npm audit` et le scan Trivy), *A05 – Security Misconfiguration*
(conteneurs non-root, images minimales, aucun secret embarqué), *A08 – Software and
Data Integrity Failures* (actions épinglées par empreinte de commit, `npm ci` sur
*lockfiles*, images de base figées), *A03 – Injection* (requêtes paramétrées via
Prisma, validation des entrées par Zod, règles SonarCloud) et *A09 – Security Logging
and Monitoring Failures* (centralisation des logs via la stack ELK). Les autres
catégories — contrôle d'accès, authentification, chiffrement, conception — relèvent de
la **sécurité applicative** et sortent du périmètre de cette industrialisation CI/CD.

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

_Résumé des améliorations et gains observés (fiabilité, rapidité, qualité) : à
compléter en phase finale._

### Recommandations pour les itérations suivantes

- **Tests end-to-end (UI).** Le périmètre s'est concentré sur des tests unitaires et de
  composant (qui alimentent la couverture) ainsi que sur une validation de bout en bout
  au niveau HTTP (le *smoke test* de la stack lors du déploiement, cf.
  [§3.3](#33-plan-de-déploiement-cd)). Une étape pertinente serait d'ajouter un **test
  end-to-end navigateur** (par exemple avec Playwright) pilotant des parcours
  utilisateurs complets (interface → API → base de données) ; le dossier
  `client/tests/e2e/` est d'ailleurs déjà prévu à cet effet. Ce type de test a été
  volontairement écarté du périmètre initial — le projet visant l'industrialisation
  CI/CD et l'observabilité, et aucun *runner* end-to-end n'étant fourni par le dépôt
  d'origine — afin de ne pas introduire d'outillage lourd (navigateurs en CI, gestion de
  l'instabilité des tests) au-delà du nécessaire. Il s'intégrerait naturellement comme
  job *nightly* : montée de la stack via Docker Compose, exécution des scénarios, puis
  publication du rapport en artefacts.

---

## Annexes

_À compléter : captures SonarQube, captures de logs / dashboards ELK, extraits de
workflows, commandes utiles._
