# StewRun
## A Pre-Order Lunch Marketplace for Harare, Zimbabwe

StewRun is a mobile-first marketplace connecting customers with independent cooks and small catering businesses in Harare. It is built around planned lunch requests, customer-proposed budgets, cook offers and scheduled collection at approved pickup hubs—not conventional on-demand food delivery.

## Product principles

- Customers describe the meals they want, set a per-plate budget, and choose a pickup hub and schedule.
- Cooks review requests and decide what they can fulfil, submitting itemised offers with prices.
- Customers review offers and order details before choosing whether to proceed.
- Orders are prepared for scheduled collection at the selected hub.
- A live map is optional; hub selection must remain usable as a searchable/list-based choice on slower connections.
- Customer and Cook are the supported account roles. There is no public Admin role or admin approval workflow in the current product model.

## How it works

1. A customer registers or signs in using the Customer role.
2. The customer describes a meal in natural language. Ziva helps interpret the request in English or Shona.
3. The customer reviews the interpreted meal details, enters a per-plate budget, and selects a pickup hub, date and time.
4. The request is saved. Saving a request does not itself place an order or charge the customer.
5. Cooks sign in using the Cook role, review requests and submit itemised offers with quantities and prices. Supported responses include acceptance, rejection with a reason and counter-offers.
6. The customer reviews available offers and chooses whether to proceed.
7. The order follows the application's reservation, confirmation, preparation and collection workflow.
8. The customer collects the meal at the selected hub. The MVP collection/payment flow is cash at collection; online payment is future work.

## Core capabilities

### Customer
- Customer registration and authentication.
- Public discovery of cooks and published food offerings.
- Ziva-assisted meal interpretation in English and Shona.
- Review of interpreted meal details before submission.
- Customer-proposed per-plate budget.
- Pickup hub, date and time selection.
- Request and cook-offer review.
- Order tracking, profile management and in-app notifications.

### Cook
- Cook registration and authentication.
- Cook dashboard, profile and availability management.
- Food offering creation and management.
- Review of relevant customer requests.
- Itemised offers with meal names, quantities and prices.
- Supported acceptance, rejection with reasons and counter-offer responses.
- Order preparation and collection workflow.
- In-app notifications.

## Ziva — meal request assistant

Ziva is StewRun's AI-powered meal-request assistant. Customers describe what they want in everyday language. Ziva interprets English or Shona descriptions into structured meal information for the customer to review. Ziva assists with interpretation; the customer remains responsible for the final request, budget, pickup hub and schedule.

## Customer budgets and cook offers

Customers propose what they are willing to pay per plate. Cooks review the requested meals and quantities and respond with their own itemised offer prices. Customers compare the offers before deciding whether to proceed. A saved request or submitted cook offer is not, by itself, a confirmed order.

## Pickup hubs and collection

Initial pickup hubs:
- **Joina City Mall** — Harare CBD.
- **Eastgate Mall** — Harare.
- **Avondale Shopping Centre** — Avondale, Harare.

The customer-selected hub is associated with the request and carried through the order workflow. A map may help users understand locations, but it is not compulsory. Cooks' private home addresses must not be exposed as customer pickup locations.

StewRun is a scheduled-pickup marketplace, not a courier or on-demand delivery service.

## Payment model

The current MVP collection flow is cash at the selected pickup hub. EcoCash and other online payment integrations are future work and must not be described as active payment methods unless separately implemented, configured and verified. Never include payment credentials, merchant PINs or secrets in source control or documentation.

## Technology

| Technology | Responsibility |
|---|---|
| Next.js App Router | Full-stack application and routing |
| React | User interface |
| TypeScript | Type-safe development |
| Tailwind CSS | Responsive styling |
| Supabase | Authentication, database access and backend services |
| PostgreSQL | Relational data and database functions |
| OpenAI | Natural-language interpretation for Ziva |
| Vercel | Hosting and deployment |
| Mocha + tsx | Automated tests |
| ESLint | Code quality checks |

## Repository layout

| Path | Purpose |
|---|---|
| `app/` | Next.js routes, layouts and pages |
| `app/api/` | Server-side API route handlers |
| `components/` | Reusable interface components |
| `components/ui/` | Shared UI primitives |
| `lib/` | Shared application logic and services |
| `lib/server/` | Server-only functionality |
| `supabase/config.toml` | Local Supabase CLI configuration |
| `supabase/migrations/` | Versioned database migrations |
| `test/` | Automated tests |
| `docs/` | Developer and local testing documentation |
| `public/` | Static assets |

## Getting started

Prerequisites: Git, Node.js compatible with the project's Next.js version, npm, a code editor, access to the intended Supabase environment, and an OpenAI API key for Ziva.

```bash
git clone https://github.com/Takuemse/stewrun.git
cd stewrun
git switch staging
npm ci
```

If the local staging branch does not exist:
```bash
git fetch origin
git switch --track origin/staging
```

Create a local `.env.local` file in the repository root:
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Use credentials for the environment you intend to run. Keep the service-role key and OpenAI key server-side only. Never commit `.env.local`, API keys, passwords, merchant PINs or payment secrets. Do not use production credentials in local development.

Start the application:
```bash
npm run dev
```
Open http://localhost:3000 and stop the server with Ctrl+C.

## Local Supabase

The repository includes `supabase/config.toml` for the local Supabase CLI stack. Use local Supabase for isolated development and test accounts, rather than creating test records in staging or production.

Follow [docs/local-testing.md](docs/local-testing.md). The basic commands are:
```bash
supabase start
supabase status
npm run dev
```

Use the local API URL and local anon/publishable key shown by `supabase status` in your local `.env.local`. The local project ID is a development identifier, not the staging or production project reference.

Before linking a remote project or running a remote database command, independently verify the project reference. Review migrations before applying them. Do not run production migrations or database pushes without explicit release approval.

## Useful commands

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve a production build locally |
| `npm run lint` | ESLint |
| `npm test` | Mocha test suite |
| `npm run testci` | Configured CI test command |
| `npx tsc --noEmit` | TypeScript check |
| `git diff --check` | Whitespace/error check |
| `supabase start` | Start local Supabase |
| `supabase stop` | Stop local Supabase |

## Testing and quality checks

Before proposing a change, run checks relevant to the files changed:
```bash
npx tsc --noEmit
npm test
npm run lint
git diff --check
```
For release candidates, also run `npm run build`. Passing unit tests do not replace end-to-end testing. Verify affected Customer and Cook flows in the intended environment and check responsive layouts.

The audited staging change set recorded 393 passing automated tests, with TypeScript, ESLint and whitespace checks passing. Test counts can change; rerun the suite to verify the current state.

## Database and security

StewRun uses Supabase and PostgreSQL. Database changes are maintained as timestamped SQL migrations in `supabase/migrations/`.

- Inspect existing schema, migrations, functions and triggers before changing database behaviour.
- Review Row Level Security (RLS), ownership checks and role-based authorization.
- Keep privileged operations server-side.
- Validate API input and enforce authorization on the server.
- Do not trust a role or user ID supplied only by the browser.
- Never disable RLS to work around an application error.
- Verify the linked Supabase project before remote commands.
- Production database changes require review, rollback planning and explicit approval.

## Git and release workflow

| Branch | Purpose |
|---|---|
| `staging` | Development integration and staging verification |
| `main` | Intended production release branch |

Start work:
```bash
git switch staging
git pull origin staging
git switch -c feature/short-description
```

Review before staging:
```bash
git status --short
git diff
git diff --check
```

Stage only relevant files; do not use `git add .` when unrelated or scratch files may be present:
```bash
git add path/to/file
git commit -m "type: describe the change"
git push -u origin feature/short-description
```

Use a pull request into `staging`. Verify the integrated staging build before considering release to `main`. A successful staging deployment does not mean production has been deployed.

## Deployment environments

StewRun is hosted on Vercel. The staging branch is used for development verification; `main` is the intended production branch.

- Local development uses the local Supabase stack or an explicitly selected development project.
- Vercel Preview/Staging uses staging environment variables and the staging Supabase project.
- Vercel Production must use the designated production Supabase project and production credentials.

Changing Vercel's production branch does not merge source code, migrate a database or copy environment variables. Verify deployed commit, deployment status and environment configuration separately.

## Current release status

**Staging release candidate; production release audit remains in progress.**

The staging codebase includes the Customer and Cook experiences, Ziva-assisted meal requests, customer budgets and cook offers, pickup scheduling and the cash-at-collection workflow. The user has reported that the principal Customer/Cook flows and responsive screen checks have been completed.

Staging commit `b519605` — `refactor: modularize cook offer API and strengthen test coverage` — includes the cook-offer handler extraction, related automated tests, local testing documentation and local Supabase configuration. The user confirmed the staging deployment.

The recorded test run reported 393 passing tests. TypeScript, ESLint and `git diff --check` also passed for the audited change set.

This README does not declare production released. Production database parity, production environment variables and final production deployment verification remain to be completed before claiming production readiness.

## Future development

Possible future work, subject to product decisions and verification:
- Online payment integrations such as EcoCash.
- Expanded pickup coverage.
- Further cook discovery and marketplace improvements.
- Customer ratings and review improvements.
- Additional notification channels.
- Further Ziva improvements and language coverage.
- Operational reporting and cook analytics.

These are future possibilities, not claims that the features are currently available.

## Project information

| Detail | Value |
|---|---|
| Product | StewRun |
| Description | Pre-Order Lunch Marketplace |
| Initial market | Harare, Zimbabwe |
| Platform | Mobile-first web application / PWA |
| Repository | https://github.com/Takuemse/stewrun |
| Development branch | `staging` |
| Production branch | `main` |
| Staging release commit | `b519605` |

---
*StewRun — Bringing customers and local cooks together, one meal at a time.*
