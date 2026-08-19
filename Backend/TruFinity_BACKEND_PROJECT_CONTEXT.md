# TruFinity Plumbing Heating & Cooling – BI & Dashboard System (Backend)

This is the central knowledge base and single source of truth for the TruFinity backend.
**An AI agent reading this file should be able to fully understand the current architecture and state.**

## Project Overview

The system collects data from the client's existing systems, normalizes it, runs it through a KPI/Rules engine, creates alerts/escalations, feeds Claude AI for a daily executive brief, and serves data to the Frontend Dashboard.

### Eventual Backend Flow
**Client Systems → APIs/OAuth → Data Ingestion → PostgreSQL → Data Normalization → KPI/Rules Engine → Alerts/Escalations → Claude AI → Daily Executive Brief → Backend APIs → Frontend Dashboard**

## Current Scope & Status

Currently, **only the backend foundation is established**. No external integrations or business logic have been implemented yet.

- [x] Node.js + TypeScript foundation
- [x] Strict TypeScript configuration
- [x] PostgreSQL connection/configuration via Docker Compose
- [x] Database migration support (Knex)
- [x] Clean modular project structure
- [x] Environment variable configuration (Zod validation)
- [x] Basic application bootstrap
- [x] Health-check endpoint (`GET /health`)
- [x] Centralized error handling
- [x] Basic request logging (Morgan/Winston)
- [x] Linting and formatting (ESLint/Prettier)
- [x] Testing foundation (Jest/Supertest)
- [x] README and documentation

## Technology Stack

* **Runtime**: Node.js
* **Language**: TypeScript (Strict Mode)
* **Framework**: Express.js
* **Database**: PostgreSQL (via `pg` driver)
* **Query Builder / Migrations**: Knex.js
* **Environment Validation**: Zod
* **Logging**: Morgan (HTTP) & Winston (App)
* **Testing**: Jest & Supertest
* **Linting / Formatting**: ESLint & Prettier

## Architecture & Directory Structure

```text
trufinity-backend/
├── src/
│   ├── config/          # Environment variables and configuration (Zod schema)
│   ├── database/        # Database connection and Knex instance setup
│   ├── modules/         # Business logic modules (e.g. Health module)
│   ├── middleware/      # Centralized error handling, request logging
│   ├── shared/          # Shared utilities, constants, types
│   ├── utils/           # Helper functions (e.g., winston logger)
│   ├── app.ts           # Express app setup and middleware registration
│   └── server.ts        # Entry point, starts the HTTP server
├── migrations/          # Knex database migrations (TypeScript)
├── tests/               # Unit and integration tests
├── .env.example         # Example environment variables
├── docker-compose.yml   # PostgreSQL local development setup
├── knexfile.ts          # Knex migration configuration
├── tsconfig.json        # Strict TypeScript configuration
└── README.md            # Local setup instructions
```

## Running the Application Locally

1. Install dependencies: `npm install`
2. Set up environment: Copy `.env.example` to `.env`
3. Start database: `docker-compose up -d`
4. Run migrations: `npm run migrate:latest`
5. Start development server: `npm run dev`

## Future Features / Integrations (Deferred)

The architecture is prepared for the following integrations, which will be built as independent modules within `src/modules/`:

* ServiceTitan Integration
* QuickBooks Online Integration
* Dialpad Integration
* Google Workspace Integration
* Google Ads Integration
* Google Business Profile Integration
* Lace AI Integration (if API export is available)
* Claude AI Daily Brief Generator
* KPI/Rules Engine
* Dashboard REST APIs

*Note: For every future feature or integration, update this file with its description, architecture, database changes, and dependencies.*
