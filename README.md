# Orion CRM

A simplified Customer Relationship Management (CRM) application — a modern
full-stack TypeScript app (React + Express + Prisma) — used here as the basis for
an **industrialized CI/CD pipeline** (GitHub Actions, Docker, SonarCloud).

![CI](https://github.com/Charles-BARDIN/DFSJS-Mettez-en-uvre-l-int-gration-et-le-d-ploiement-continu-d-une-application-full-stack-JavaScript/actions/workflows/ci.yml/badge.svg)

> **Full technical documentation** (CI/CD, containerization, testing & security
> plans) is available in [`DOCUMENTATION.md`](./DOCUMENTATION.md).

## Architecture

The project is a **monorepo** with two independent applications:

- **Frontend** (`client/`) — React 19, TypeScript, Vite 6, Tailwind CSS
- **Backend** (`server/`) — Node.js 22, Express 5, TypeScript, Prisma, SQLite

## Quick start (Docker)

The fastest way to run the whole stack is Docker Compose:

```bash
docker compose up --build
```

- Frontend (Nginx) → <http://localhost:4200>
- Backend (API) → <http://localhost:8080/api/health>

The back-end applies its database migrations automatically at startup, so no manual
database step is required.

## Local development (without Docker)

**Prerequisites:** Node.js ≥ 22 and npm ≥ 10.

```bash
# Back-end
cd server
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev --name init
npm run dev            # API on http://localhost:8080

# Front-end (in another terminal)
cd client
npm install
cp .env.example .env
npm run dev            # App on http://localhost:4200
```

## Available scripts

| Script | Back-end (`server/`) | Front-end (`client/`) |
|---|---|---|
| `npm run dev` | dev server (hot reload) | dev server (Vite) |
| `npm run build` | `tsc` → `dist/` | `vite build` → `dist/` |
| `npm test` | run tests (Vitest) | run tests (Vitest) |
| `npm run test:coverage` | tests + coverage report | tests + coverage report |
| `npm run lint` | ESLint | ESLint |
| `npm run typecheck` | — | `tsc --noEmit` |
| `npm run prisma:generate` / `prisma:migrate` / `prisma:studio` | Prisma tooling | — |

## CI/CD pipeline

The pipeline runs on **GitHub Actions** and is made of three workflows:

| Workflow | Trigger | Role |
|---|---|---|
| **CI** (`ci.yml`) | pull request + push to `main` | lint, build, tests with coverage, SonarCloud analysis |
| **Nightly** (`nightly.yml`) | schedule (03:00 UTC) + manual | full non-regression suite, dependency audit, image scan |
| **CD** (`cd.yml`) | version tag (`vX.Y.Z`) | build, smoke test, publish images to GHCR |

A release is triggered by pushing a **SemVer tag** (a deliberate human action), for
example:

```bash
git tag v0.1.0 && git push origin v0.1.0
```

The CD workflow re-runs the tests, builds the images, validates them with an
end-to-end smoke test, and only then publishes them. See
[`DOCUMENTATION.md`](./DOCUMENTATION.md) for the full pipeline description.

## Containerization & deployment

Both services ship as **multi-stage, Alpine-based, non-root** Docker images:

- the **back-end** runs the Express API and applies Prisma migrations on startup;
- the **front-end** is served by Nginx, which also reverse-proxies `/api` to the
  back-end (the app calls the API on a relative path).

On a version tag, the images are published to **GitHub Container Registry**:

- `ghcr.io/<owner>/orion-crm-server`
- `ghcr.io/<owner>/orion-crm-client`

A production deployment pulls these images instead of building from source (see the
deployment plan in [`DOCUMENTATION.md`](./DOCUMENTATION.md)).

## Technical choices (highlights)

- **Quality & security as code** — every change is linted, type-checked, tested
  (with coverage) and analyzed by SonarCloud before merge; a nightly job audits
  dependencies (`npm audit`) and scans images (Trivy).
- **Reproducible builds** — `npm ci` against committed lockfiles, versioned Prisma
  migrations, and GitHub Actions pinned to explicit versions.
- **Minimal, hardened images** — official Alpine bases, multi-stage builds,
  production dependencies only, non-root execution, no secret baked in.
- **Targeted tests** — focused on business logic (services) and input validation
  (Zod), enough to prove the pipeline's test stage rather than chase exhaustive
  coverage.

The rationale behind these choices is detailed in
[`DOCUMENTATION.md`](./DOCUMENTATION.md).

## Project structure

```
.
├── client/                 # Front-end (React + Vite)
│   ├── src/                # components, pages, hooks, services, types
│   ├── Dockerfile
│   └── nginx.conf
├── server/                 # Back-end (Express + Prisma)
│   ├── src/                # controllers, services, repositories, models, routes
│   ├── prisma/             # schema + versioned migrations
│   ├── Dockerfile
│   └── docker-entrypoint.sh
├── .github/workflows/      # ci.yml, nightly.yml, cd.yml
├── docker-compose.yml
├── sonar-project.properties
└── DOCUMENTATION.md        # full technical documentation
```

## API endpoints

### Health

- `GET /api/health` — service health check (returns `{ "status": "OK" }`)

### Organizations

- `GET /api/organizations` — list all
- `GET /api/organizations/:id` — get by ID
- `POST /api/organizations` — create
- `PUT /api/organizations/:id` — update
- `DELETE /api/organizations/:id` — delete
- `GET /api/organizations/stats` — statistics

### Contacts

- `GET /api/contacts` — list all
- `GET /api/contacts/:id` — get by ID
- `POST /api/contacts` — create
- `PUT /api/contacts/:id` — update
- `DELETE /api/contacts/:id` — delete
- `GET /api/contacts/stats` — statistics

## License

MIT
