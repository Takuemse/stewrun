# StewRun

### A Pre-Order Lunch Marketplace for Harare, Zimbabwe

**Making everyday lunch ordering simpler, more affordable and more accessible.**

StewRun is a digital marketplace connecting customers with independent cooks and small catering businesses in Harare, Zimbabwe.

The platform uses a customer-led budgeting model: customers describe the meals they want and propose what they are willing to pay. Cooks can review requests, accept them, reject them with an explanation, or negotiate through a counter-offer where supported.

Rather than focusing on conventional on-demand food delivery, StewRun brings customers and cooks together around scheduled meal preparation and collection at designated pickup hubs.

**Current MVP arrangements:**
- Customers and cooks can register directly. There is no administrator cook-approval workflow.
- Customers currently pay cooks directly in cash when collecting their meals.
- EcoCash-related configuration and code exist, but the online payment integration is currently paused and is not an active payment method.
- Saving a meal request does not place an order or charge the customer. The customer must review a cook's response and proceed through the subsequent order process.

---

## Table of Contents

1. [The Problem](#the-problem)
2. [Our Solution](#our-solution)
3. [How StewRun Works](#how-stewrun-works)
4. [Core Features](#core-features)
5. [Ziva — The Meal Request Assistant](#ziva--the-meal-request-assistant)
6. [Customer-Led Budget Model](#customer-led-budget-model)
7. [Pickup and Payment](#pickup-and-payment)
8. [Technology Stack](#technology-stack)
9. [Project Structure](#project-structure)
10. [Getting Started](#getting-started)
11. [Environment Configuration](#environment-configuration)
12. [Running the Application](#running-the-application)
13. [Testing and Quality Checks](#testing-and-quality-checks)
14. [Database and Supabase](#database-and-supabase)
15. [Git Workflow](#git-workflow)
16. [Security](#security)
17. [Project Status](#project-status)
18. [Future Development](#future-development)
19. [Contributing](#contributing)
20. [Project Ownership and Information](#project-ownership-and-information)

---

## The Problem

Finding affordable lunch during a busy working day can be challenging.

**For customers:**
- Limited access to affordable and convenient lunch options.
- Uncertainty about meal availability and pricing.
- Time lost searching for food during working hours.
- Difficulty discovering independent cooks offering suitable meals.

**For cooks:**
- Limited visibility among potential customers.
- Difficulty understanding customer demand in advance.
- Risk of preparing food without confirmed demand.
- Limited digital tools for managing requests and orders.

## Our Solution

StewRun provides a shared marketplace where customers and cooks can interact through a structured ordering process.

Customers communicate what they want, propose a budget and select a collection location. Cooks review relevant requests and respond according to their availability and ability to fulfil them.

The objective is to make lunch ordering more predictable for customers while helping independent cooks manage demand more effectively.

StewRun is designed around pre-orders and scheduled collection rather than conventional on-demand food delivery.

## How StewRun Works

1. **Discover:** Customers browse available cooks and their published food offerings.
2. **Request:** Customers describe the meals they want, with help from Ziva.
3. **Set a budget:** Customers propose their preferred meal budget.
4. **Respond:** Cooks review requests and accept, reject with a reason, or submit a counter-offer where supported.
5. **Agree:** Customers review cook responses and proceed with a suitable offer.
6. **Prepare:** Cooks prepare confirmed orders.
7. **Collect:** Customers collect their meals at the selected pickup hub and pay the cook in cash.

Saving a meal request is an initial marketplace interaction. It does not automatically confirm an order or trigger a payment.

---

## Core Features

### Customer Experience

- Customer registration and authentication.
- Public discovery of cooks and food offerings.
- AI-assisted meal requests through Ziva.
- English and Shona meal interpretation.
- Customer-proposed meal budgets.
- Pickup hub selection and collection scheduling.
- Request and order tracking.
- Cook acceptance and rejection responses.
- Rejection explanations and supported negotiation.
- In-app notifications.
- Customer profile management.

### Cook Experience

- Direct cook registration and authentication.
- Cook dashboard.
- Food offering creation and management.
- Availability management.
- Access to relevant customer requests.
- Review of customer-proposed budgets.
- Request acceptance or rejection with reasons.
- Supported counter-offer functionality.
- Order and preparation management.
- Collection tracking.
- In-app notifications.

Customers and cooks can register directly. The platform does not require an administrator to approve cook registration.

### Marketplace

- Shared customer and cook marketplace.
- Publicly visible published food offerings.
- Customer-led budget negotiation.
- Scheduled meal preparation.
- Designated pickup hubs.
- Cash-on-collection payments.

### Notifications

The platform includes an in-app notification system intended to keep customers and cooks informed about important marketplace events.

These include request responses, order confirmations, preparation progress, collection and cancellations.

---

## Ziva — The Meal Request Assistant

Ziva is StewRun's AI-powered meal-request assistant.

It helps customers describe what they want to eat using natural language rather than requiring them to complete a complicated ordering form.

Customers can describe meal requirements in English or Shona. Ziva interprets the request and helps structure the information for review before submission.

The customer remains in control of the final meal request, proposed budget, pickup hub and scheduling details.

Ziva assists with interpreting a request; the customer reviews the resulting information before submitting it.

---

## Customer-Led Budget Model

One of StewRun's defining features is its customer-led budgeting approach.

Instead of forcing customers to choose only from fixed-price meals, the platform allows them to propose a budget for their requested meal.

Cooks can then:

- Accept the proposed budget.
- Reject the request and explain why.
- Submit a counter-offer where supported.

This creates a structured negotiation process that gives customers flexibility while allowing cooks to make informed decisions about the work they accept.

A customer's proposed budget is not automatically a confirmed purchase price. Customers review the cook's response before proceeding.

---

## Pickup and Payment

StewRun uses designated pickup locations to simplify meal collection.

The initial pickup hubs are:

- Joina City Mall.
- Eastgate Mall.
- Avondale Shopping Centre.

Customers select their preferred pickup hub when submitting a meal request. The selected location is associated with the request and confirmed order.

StewRun is designed around scheduled pickup rather than conventional on-demand delivery.

### Cash on Collection

The current MVP uses cash payments at the pickup hub.

Customers pay the cook directly when collecting their meals.

The current payment arrangement is not a live online payment integration. EcoCash-related code and configuration are present in the project, but the integration is paused and is not available as an active online payment method.

Online payment integrations, including EcoCash, may be considered for future development.

**Important distinction:** Saving a meal request does not place an order or charge the customer. A customer must review the cook's response and proceed through the subsequent order process. Payment is made directly to the cook in cash at collection under the current MVP arrangement.

---

## Technology Stack

| Technology | Purpose |
|---|---|
| Next.js | Full-stack web application framework |
| React | User interface |
| TypeScript | Type-safe application development |
| Tailwind CSS | Styling and responsive design |
| Supabase | Database, authentication and backend services |
| PostgreSQL | Relational data storage |
| OpenAI | AI-powered meal interpretation through Ziva |
| Vercel | Application deployment |
| Mocha | Automated test execution |
| ESLint | Code quality and linting |

The application prioritizes secure server-side operations, reliable data handling, role-based access and maintainable application architecture.

---

## Project Structure

The repository uses the Next.js App Router architecture.

Important directories and files include:

| Directory or file | Responsibility |
|---|---|
| `app/` | Application pages, layouts and API routes |
| `app/(auth)/` | Authentication pages |
| `app/(customer)/` | Customer-facing route group |
| `app/cook/` | Cook-facing pages |
| `app/api/` | Server-side API endpoints |
| `components/` | Reusable interface components |
| `components/ui/` | Shared UI components |
| `lib/` | Application logic and shared utilities |
| `lib/server/` | Server-side services and operations |
| `supabase/` | Supabase project configuration and database resources |
| `supabase/migrations/` | Database migration files |
| `test/` | Automated tests |
| `public/` | Static assets |

The exact structure may evolve as development continues.

---

## Getting Started

These instructions cover Windows, macOS and Linux.

### Prerequisites

Install the following:

- Git.
- Node.js LTS.
- npm (included with Node.js).
- Visual Studio Code or another code editor.
- Access to the configured Supabase project.
- An OpenAI API key for Ziva functionality.

Check your installations:

```bash
git --version
node --version
npm --version
```

### 1. Clone the Repository

```bash
git clone https://github.com/Takuemse/stewrun.git
cd stewrun
```

The project uses a staging development branch.

```bash
git switch staging
```

If you have just cloned the repository and the local branch does not exist:

```bash
git fetch origin
git switch -c staging origin/staging
```

### 2. Install Dependencies

From the project root:

```bash
npm ci
```

`npm ci` installs dependencies using the committed lockfile.

If you intentionally change dependencies, use:

```bash
npm install
```

Commit the corresponding changes to `package.json` and `package-lock.json` together.

### 3. Configure Environment Variables

Create a local environment file named:

```text
.env.local
```

Add the required configuration values. See [Environment Configuration](#environment-configuration).

Never commit this file or publish its credentials.

### 4. Start the Development Server

```bash
npm run dev
```

Open the application:

```text
http://localhost:3000
```

Stop the development server with `Ctrl + C`.

---

## Environment Configuration

The application uses environment variables to connect to external services.

The following variables are included in the project's environment-variable template.

### Required Application Configuration

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### Additional Configuration

The repository also contains configuration names for administration and legacy payment functionality:

```env
ADMIN_USER_IDS=

ECOCASH_BASE_URL=
ECOCASH_BASIC_AUTH_USERNAME=
ECOCASH_BASIC_AUTH_PASSWORD=
ECOCASH_MERCHANT_CODE=
ECOCASH_MERCHANT_PIN=
ECOCASH_MERCHANT_NUMBER=
ECOCASH_CURRENCY=
ECOCASH_COUNTRY_CODE=
ECOCASH_TERMINAL_ID=
ECOCASH_LOCATION=
ECOCASH_SUPER_MERCHANT_NAME=
ECOCASH_MERCHANT_NAME=
```

These are configuration names, not a statement that every variable is required for the current MVP.

### Environment Variable Guidance

- Use the correct Supabase project URL and public key for your development environment.
- Keep the Supabase service-role key server-side only.
- Never expose the OpenAI API key in browser-side code.
- Never commit passwords, merchant PINs, API keys or other credentials.
- Do not use production credentials in local development.
- The EcoCash variables relate to paused or future payment functionality and are not required for the current cash-on-collection MVP.
- `ADMIN_USER_IDS` relates to administration and security configuration. It does not represent an administrator cook-approval workflow.

The `.env.example` file should contain safe placeholder values only. Actual credentials belong in the local `.env.local` file or the appropriate secure deployment environment.

Do not copy real credentials into documentation, screenshots, GitHub issues or public messages.

---

## Running the Application

### Development

```bash
npm run dev
```

Starts the Next.js development server.

### Production Build

```bash
npm run build
```

Builds the application for production.

### Production Server

```bash
npm run start
```

Starts the production server after a successful build.

### Linting

```bash
npm run lint
```

Runs ESLint.

### Automated Tests

```bash
npm test
```

Runs the automated test suite.

### CI Test Command

```bash
npm run testci
```

Runs the configured CI test command.

---

## Testing and Quality Checks

Before submitting changes, developers should run the relevant checks.

```bash
npm run lint
npm test
npx tsc --noEmit
npm run build
```

These checks help identify:

- TypeScript errors.
- Linting issues.
- Broken application functionality.
- Failing automated tests.
- Production build errors.

A successful local check does not replace staging verification or end-to-end testing.

Test both customer and cook workflows when making changes that affect the marketplace.

Testing should consider the complete interaction between customer requests, cook responses, order progression, pickup arrangements and payment handling.

---

## Database and Supabase

StewRun uses Supabase and PostgreSQL for application data and authentication.

Database changes are maintained through SQL migration files in:

```text
supabase/migrations/
```

The repository also includes Supabase project configuration.

### Database Development Guidelines

- Review existing migrations before creating new ones.
- Use timestamped migration filenames.
- Keep database changes small and understandable.
- Review Row Level Security policies.
- Verify ownership and role-based access.
- Test changes against the intended staging project.
- Never assume the local environment is linked to the correct Supabase project.

### Supabase CLI and Environment Safety

Before using commands such as:

```bash
supabase link
supabase db push
```

Confirm that the Supabase CLI is configured for the intended project.

Verify the project reference and target environment before applying migrations. The presence of local migration files does not establish which remote database a command will affect.

Never apply migrations to production without reviewing the SQL, verifying the target project and obtaining explicit approval.

---

## Git Workflow

StewRun uses separate development and release branches.

| Branch | Purpose |
|---|---|
| `staging` | Active development and integration |
| `main` | Stable release branch |

### Get the Latest Development Changes

```bash
git switch staging
git pull origin staging
```

### Create a Feature Branch

```bash
git switch -c feature/your-feature-name
```

### Review Your Changes

```bash
git status --short
git diff
git diff --check
```

### Stage Specific Files

Stage only the files relevant to your change.

```bash
git add path/to/file
```

Avoid staging unrelated work.

### Commit

```bash
git commit -m "feat: describe your change"
```

### Push Your Feature Branch

```bash
git push -u origin feature/your-feature-name
```

Create a pull request into `staging` for review.

### Release Process

Changes should be reviewed and verified in staging before they are considered for `main`.

Do not merge the entire staging branch into `main` merely to publish an isolated documentation or maintenance change. Use a separate branch and pull request when appropriate.

The release branch should contain reviewed and tested changes suitable for production deployment.

---

## Security

Security is an important part of the StewRun architecture.

The application is designed to use:

- Supabase authentication.
- Role-based access control.
- PostgreSQL Row Level Security (RLS).
- Server-side authorization.
- Validated API requests.
- Protected customer and cook records.
- Secure handling of application credentials.
- Controlled order state transitions.

Users should only access information and perform actions permitted by their roles and ownership of the relevant records.

### Security Practices

Never:

- Commit `.env.local`.
- Expose service-role keys in frontend code.
- Trust client-provided user roles without server-side validation.
- Disable RLS to work around application errors.
- Apply unreviewed database changes to production.
- Publish API keys, passwords, merchant PINs or other credentials.

Administration-related security configuration should be treated separately from customer and cook registration. Both customer and cook registration are supported without an administrator cook-approval workflow.

---

## Project Status

**Active Development — MVP**

StewRun is being developed as a pre-order lunch marketplace for Harare, Zimbabwe.

Development and verification focus on completing and validating the customer and cook experience.

Current development priorities include:

- Shared registration with customer and cook roles.
- Public cook and food discovery.
- Customer meal requests and AI interpretation.
- Customer-led budget negotiation.
- Cook request and order management.
- Cash-on-collection workflows.
- In-app notifications.
- Secure backend integration.
- End-to-end testing and deployment readiness.

The current payment arrangement is cash paid directly to the cook at collection. EcoCash-related functionality is paused and should not be interpreted as an active online payment service.

Features described in this README represent the project's product scope and documented functionality. Their implementation and production readiness should be verified as development and release checks progress.

---

## Future Development

Future improvements may include:

- Online payment integrations, including the possible reactivation of EcoCash.
- Expanded pickup locations.
- Improved cook discovery.
- Customer reviews and ratings.
- Advanced cook analytics.
- Additional notification channels.
- Further AI-powered marketplace assistance.

These enhancements will be introduced progressively without compromising the simplicity of the core marketplace.

---

## Contributing

StewRun is being developed through an iterative product development process.

Development priorities include:

1. Understanding existing architecture before making changes.
2. Preserving working functionality.
3. Maintaining secure backend operations.
4. Testing customer and cook workflows.
5. Keeping the application maintainable and scalable.
6. Avoiding unnecessary complexity.

All proposed changes should be reviewed and tested before integration into the main release.

---

## Project Ownership and Information

### Project Ownership and Development

StewRun was developed by **William** as a software development capstone project.

**Role: Project Developer**

The project involved the design, development, implementation and testing of a pre-order lunch marketplace for Harare, Zimbabwe.

The developer's responsibilities included the technical implementation of the application, including frontend development, backend integration, database development, AI integration, application testing and deployment preparation.

### Project Information

| Detail | Information |
|---|---|
| Project | StewRun |
| Product | Pre-Order Lunch Marketplace |
| Developer | William |
| Project Role | Software Developer |
| Project Type | Software Development Capstone Project |
| Initial Market | Harare, Zimbabwe |
| Platform | Mobile-first Progressive Web Application |
| Repository | [github.com/Takuemse/stewrun](https://github.com/Takuemse/stewrun) |
| Development Branch | `staging` |
| Release Branch | `main` |
| Current Payment Method | Cash paid directly to the cook at collection |
| Online Payment Status | EcoCash integration paused; not an active online payment method |

---

*StewRun — Bringing customers and local cooks together, one meal at a time.*