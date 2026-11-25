# StewRun

## A Pre-Order Lunch Marketplace for Harare, Zimbabwe

**Making everyday lunch ordering simpler, more affordable and more accessible.**

StewRun is a mobile-first, customer-led pre-order lunch marketplace connecting office workers in Harare with independent home cooks and small catering businesses.

Customers describe the meals they want, propose a budget and select a scheduled collection hub. Cooks review incoming requests and submit offers with their prices. Customers can compare the available offers and decide whether to proceed with an order.

StewRun takes inspiration from the customer-led pricing philosophy of platforms such as inDrive. Its longer-term vision is to support a more flexible negotiation process between customers and cooks. **Customer-proposed budgets and cook offers are part of the current product; cook-to-customer counter-offers are a future enhancement and are not implemented in the current MVP.**

Rather than operating as a conventional on-demand food-delivery service, StewRun focuses on planned meal requests, advance preparation and collection at designated pickup hubs.

### Current MVP Arrangements

- Customers and cooks can register directly. There is no administrator cook-approval workflow.
- Customers propose a budget for their requested meals, and cooks can respond with offers.
- Customers review a cook's response and proceed through the order process if they wish. Saving a meal request does not itself confirm an order or charge the customer.
- Meals are collected at the selected pickup hub.
- Customers currently pay cooks directly in cash when collecting their meals.
- EcoCash-related code and configuration exist, but online payment integration is paused and is not an active payment method.
- A pickup-code verification process helps the customer and cook confirm the correct order at collection.

---

## Table of Contents

1. [The Problem](#the-problem)
2. [Our Solution](#our-solution)
3. [How StewRun Works](#how-stewrun-works)
4. [Who Benefits](#who-benefits)
5. [Core Features](#core-features)
6. [Ziva — The Meal Request Assistant](#ziva--the-meal-request-assistant)
7. [Customer-Led Budget Model and inDrive Inspiration](#customer-led-budget-model-and-indrive-inspiration)
8. [Pickup Hubs and Pickup-Code Verification](#pickup-hubs-and-pickup-code-verification)
9. [Payment Model](#payment-model)
10. [Technology Stack](#technology-stack)
11. [Project Structure](#project-structure)
12. [Getting Started](#getting-started)
13. [Environment Configuration](#environment-configuration)
14. [Running the Application](#running-the-application)
15. [Testing and Quality Checks](#testing-and-quality-checks)
16. [Database and Supabase](#database-and-supabase)
17. [Git Workflow and Deployment](#git-workflow-and-deployment)
18. [Security](#security)
19. [Current Project Status](#current-project-status)
20. [Future Development Roadmap](#future-development-roadmap)
21. [Business Model and Sustainability](#business-model-and-sustainability)
22. [Contributing](#contributing)
23. [Project Information](#project-information)

---

## The Problem

Finding an affordable, dependable lunch during a busy working day can be difficult for office workers in Harare.

Formal restaurants and fast-food outlets can be expensive for everyday lunches. At the same time, independent home cooks and small caterers prepare familiar meals such as sadza, stews, rice dishes and lunch boxes, but may have limited visibility beyond word of mouth and social messaging groups.

This creates challenges on both sides of the local food market.

### For Customers

- Affordable home-cooked lunch options can be difficult to discover.
- Customers may spend part of a short lunch break walking, searching or waiting in queues.
- A preferred meal may sell out before the customer arrives.
- Customers may have a specific budget but limited ways to communicate it to independent cooks.
- Customers need a dependable way to reserve a meal and know where and when to collect it.

### For Cooks and Small Caterers

- Reaching office workers can be difficult without a storefront or strong online presence.
- Demand may be unpredictable, making it hard to estimate how many meals to prepare.
- Preparing too much food can lead to waste, while preparing too little can mean lost sales.
- Informal ordering through calls and messages can make requests, quantities and collection arrangements difficult to track.
- Cooks need a practical way to receive requests in advance and decide which orders they can fulfil.

The problem affects both sides of the local food economy. Customers need convenient access to affordable meals, while cooks need better visibility and more predictable demand.

## Our Solution

StewRun provides a shared digital marketplace where customers can request meals within their budgets and cooks can respond with offers.

Customers describe what they want, review the interpreted request, propose a budget and select a pickup hub and collection schedule. Cooks review relevant requests and submit offers based on the meals, quantities and prices they can provide. Customers can compare the responses before deciding whether to proceed.

This pre-order approach is intended to give cooks clearer information about demand before preparation begins. It also gives customers a way to plan lunch in advance instead of relying entirely on walk-in availability.

StewRun is designed around scheduled preparation and hub collection, not conventional on-demand delivery. Its initial collection locations are Joina City Mall, Eastgate Mall and Avondale Shopping Centre.

## How StewRun Works

1. **Register:** A customer or cook creates an account using the appropriate account role.
2. **Discover:** Customers can explore cooks and their published food offerings.
3. **Request:** A customer describes the meal they want, with help from Ziva if needed.
4. **Review:** The customer checks the interpreted meal details, quantities and other request information.
5. **Set a budget:** The customer proposes a budget for the requested meal.
6. **Choose collection:** The customer selects an available pickup hub and a date and time.
7. **Submit:** The meal request is saved and made available for cook responses. Saving the request does not automatically create a confirmed order or charge the customer.
8. **Receive offers:** Cooks review relevant requests and submit offers with their prices.
9. **Decide:** The customer reviews the cook's response and chooses whether to proceed through the order process.
10. **Prepare:** The cook prepares the confirmed order according to the agreed details.
11. **Collect:** The customer visits the selected hub and uses the order's pickup code as part of the collection-verification process.
12. **Pay:** Under the current MVP arrangement, the customer pays the cook directly in cash at collection.

The current application includes customer requests and cook offers. A full counter-offer negotiation flow is part of the future product vision, not a currently implemented capability.

## Who Benefits

### Customers

StewRun is intended to help customers:

- Discover independent cooks and small caterers.
- Request meals that suit their preferences and budget.
- Review cook offers before deciding whether to proceed.
- Plan lunch before the working-day rush.
- Select a convenient designated collection hub.
- Reduce time spent searching for food or waiting in queues.
- Use pickup-code verification to help confirm the correct order at collection.

### Cooks and Small Caterers

StewRun is intended to help cooks:

- Improve their visibility among office workers and other nearby customers.
- Publish food offerings and manage their availability.
- Receive meal requests before preparing food.
- Review customer budgets and decide which requests they can fulfil.
- Submit priced offers to customers.
- Plan preparation using clearer information about requested meals and quantities.
- Reduce uncertainty, avoid unnecessary over-preparation and identify potential demand earlier.
- Build a digital presence without needing a conventional restaurant storefront.

Cooks remain responsible for preparing food safely and complying with applicable food-safety, hygiene and licensing requirements.

## Core Features

The following describes the current product scope. Features explicitly identified as future enhancements are not presented as implemented functionality.

### Customer Experience

- Customer registration and authentication.
- Discovery of cooks and published food offerings.
- Ziva-assisted meal requests.
- English and Shona meal-request interpretation.
- Review of interpreted request details before submission.
- Customer-proposed meal budgets.
- Pickup hub, date and time selection.
- Meal-request submission and tracking.
- Review of cook responses and offers.
- Order progression and collection information.
- Customer profile management.
- In-app notifications.

### Cook Experience

- Direct cook registration and authentication.
- Cook dashboard and profile.
- Food offering creation and management.
- Availability management.
- Access to relevant customer requests.
- Review of customer-proposed budgets.
- Submission of priced offers.
- Request and order management.
- Preparation and collection workflow.
- In-app notifications.

Customers and cooks can register directly. The current product does not include an administrator cook-approval workflow.

### Marketplace and Collection

- Shared customer-and-cook marketplace.
- Customer-led meal requests and budgets.
- Cook-submitted offers.
- Scheduled meal preparation.
- Designated pickup hubs.
- Order pickup-code verification.
- Cash payment directly to the cook at collection.

### Notifications

The application includes an in-app notification system to communicate important marketplace events. The specific notification events available may evolve as the product develops.

## Ziva — The Meal Request Assistant

Ziva is StewRun's AI-powered meal request assistant. It helps customers describe what they want for lunch in natural language, including English and Shona.

Instead of requiring customers to complete a complicated food-ordering form, Ziva helps interpret their meal description and extract relevant request details.

Ziva is designed to help identify:

- The requested meal or food items.
- Quantities and relevant preparation details.
- A per-plate budget when the customer explicitly provides one.
- Additional instructions supplied by the customer.

Customers review the interpreted request before saving it. They remain responsible for checking the details, choosing a pickup hub and confirming the request information.

**Important:** Ziva does not automatically choose a pickup hub. Customers select their preferred approved hub separately.

Ziva supports the request process; it does not independently place orders, guarantee cook availability or make payments.

## Customer-Led Budget Model and inDrive Inspiration

StewRun takes inspiration from the customer-led pricing approach used by platforms such as inDrive.

Customers can propose a budget per plate when submitting a meal request. Cooks can review the request and submit their own offers for the customer to consider.

The customer can then compare the available offers and decide whether to proceed.

This approach is intended to:

- Give customers greater control over their lunch spending.
- Help cooks understand the customer's expected price range.
- Allow cooks to decide whether a request is suitable for their business.
- Give customers a chance to compare offers before committing to an order.

The current implementation supports customer budgets and cook-submitted offers.

**Counter-offers are a future enhancement, not an implemented feature.** The current application should not be described as supporting an in-app negotiation or counter-offer exchange.

Submitting a meal request does not automatically create a confirmed order or charge the customer.

## Pickup Hubs and Pickup-Code Verification

StewRun uses scheduled collection at designated pickup hubs rather than relying on compulsory door-to-door delivery.

The initial approved pickup locations are:

| Pickup Hub | Collection Location |
|---|---|
| Eastgate | Eastgate Mall |
| Joina City | Joina City Mall |
| Avondale | Avondale Shopping Centre |

Customers select their preferred hub when creating a meal request. The selected hub is associated with the request and subsequent order process.

The hub-based model is intended to make lunch collection more predictable for office workers and participating cooks.

### Pickup-Code Verification

StewRun includes a pickup-code verification feature to help confirm that an order has been collected by the correct customer.

A pickup code is made available as part of the order collection process after the required order steps have been completed. The cook can use the code to verify collection.

The code is intended to reduce collection mistakes and provide a clearer record of handover.

Customers should keep their pickup codes private and share them only when collecting the corresponding order.

The initial version focuses on fixed pickup hubs. A compulsory live map or delivery-tracking system is not required for the MVP.

## Payment Model

The current StewRun MVP does not provide a live online payment integration.

The current collection arrangement is cash payment directly to the cook at pickup. Customers should review the order details and the applicable amount before proceeding.

The application distinguishes between submitting a meal request and confirming an order. Saving a request does not mean that an order has been confirmed or that a payment has been taken.

EcoCash integration has been paused and should not be presented as an active payment method. Future payment options may include EcoCash, Paynow, InnBucks and card payments, subject to implementation and testing.

## Technology Stack

StewRun uses a modern web application stack designed to support a responsive, mobile-first experience.

| Technology | Purpose |
|---|---|
| Next.js | Application framework and routing |
| React | User interface development |
| TypeScript | Type-safe application code |
| Tailwind CSS | Styling and responsive layouts |
| Supabase | Authentication, PostgreSQL database and backend services |
| OpenAI API | Ziva meal-request interpretation |
| Node.js | JavaScript runtime |
| npm | Dependency and package management |
| Git and GitHub | Version control and source-code hosting |
| Vercel | Application hosting and deployment |

The application is designed as a Progressive Web App (PWA), with a mobile-first interface intended to work across supported browsers and screen sizes.

Technology versions and dependencies are maintained in `package.json` and `package-lock.json`.

## Project Structure

The repository is organised around the Next.js application, reusable interface components, backend utilities, database configuration and automated tests.

The main areas include:

| Directory or File | Responsibility |
|---|---|
| `app/` | Application routes, pages and route handlers |
| `components/` | Reusable interface components |
| `lib/` | Shared application logic and utilities |
| `public/` | Static assets such as images and icons |
| `supabase/` | Supabase configuration and database migrations |
| `test/` | Automated application tests |
| `.env.example` | Example environment-variable configuration |
| `package.json` | Project scripts and dependencies |
| `package-lock.json` | Locked npm dependency versions |
| `tsconfig.json` | TypeScript compiler configuration |

The exact contents of individual directories may change as the application develops. The repository itself remains the source of truth for the current implementation.

## Getting Started

These instructions cover Windows, macOS and Linux.

### Prerequisites

Install the following:

- Git.
- Node.js 22 (the version used during project verification).
- npm (included with Node.js).
- Visual Studio Code or another code editor.
- Access to a configured Supabase project.
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

Copy the example configuration.

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

On macOS or Linux:

```bash
cp .env.example .env.local
```

Open `.env.local` and provide the required configuration values. See the Environment Configuration section below.

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

## Environment Configuration

The application uses environment variables to connect to external services.

The repository includes `.env.example` as a template. Create `.env.local` for your local credentials.

### Required Application Configuration

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### Additional Configuration

The repository also contains configuration names for administration and paused payment functionality:

```env
ADMIN_USER_IDS=
CRON_SECRET=

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
- EcoCash variables relate to paused payment functionality and are not required for the current cash-on-collection arrangement.
- `ADMIN_USER_IDS` relates to administration and security configuration. It does not represent an administrator cook-approval workflow.
- `CRON_SECRET` is used for protecting scheduled reconciliation functionality where configured.

The `.env.example` file should contain safe placeholder values only. Actual credentials belong in `.env.local` or the appropriate secure deployment environment.

Do not copy real credentials into documentation, screenshots, GitHub issues or public messages.

## Running the Application

The following npm scripts are defined in `package.json`.

| Command | Purpose |
|---|---|
| `npm run dev` | Starts the Next.js development server |
| `npm run build` | Creates a production build |
| `npm run start` | Starts the production server |
| `npm run lint` | Runs ESLint |
| `npm test` | Runs the automated test suite |
| `npm run testci` | Runs the configured CI test command |

### Development

```bash
npm run dev
```

Starts the Next.js development server at `http://localhost:3000`.

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

Runs ESLint to identify code-quality and consistency issues.

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

## Testing and Quality Checks

Testing is important for verifying that StewRun behaves as expected and that changes do not introduce regressions.

Before submitting changes, developers should run the relevant checks:

```bash
npm run lint
npm test
npx tsc --noEmit
npm run build
git diff --check
```

These checks help identify:

- TypeScript errors.
- Linting issues.
- Broken application functionality.
- Failing automated tests.
- Production build errors.
- Common whitespace problems in Git changes.

A successful local check does not replace staging verification or end-to-end testing.

Test both customer and cook workflows when making changes that affect the marketplace.

Testing should consider the complete interaction between customer requests, cook responses, order progression, pickup arrangements, pickup-code verification and payment handling.

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
- Review Row Level Security (RLS) policies.
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

Never apply migrations to production without reviewing the SQL, verifying the target project and obtaining the necessary approval.

## Git Workflow and Deployment

StewRun uses Git and GitHub for source-code management and collaboration.

The main branches are:

| Branch | Purpose |
|---|---|
| `staging` | Development and integration |
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

Review the changes before staging them.

### Stage Specific Files

Stage only the files relevant to your change:

```bash
git add path/to/file
```

Avoid staging unrelated work or using broad staging commands when unrelated files are present.

### Commit Changes

```bash
git commit -m "feat: describe your change"
```

### Push a Feature Branch

```bash
git push -u origin feature/your-feature-name
```

Create a pull request into `staging` for review.

### Release Process

Changes should be reviewed and verified in staging before being considered for `main`.

The release branch should contain reviewed and tested changes suitable for production deployment.

Production deployment should follow the project's release process, with the target branch, deployment status and environment configuration verified before publication.

## Security

Security is an important part of the StewRun architecture.

The application uses security measures and practices that include:

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

## Current Project Status

**MVP — production deployment available**

StewRun is developed as a pre-order lunch marketplace for Harare, Zimbabwe.

The MVP focuses on connecting customers and independent cooks through meal requests, customer-proposed budgets, cook offers and scheduled collection.

The implemented product scope includes:

- Customer and cook registration and authentication.
- Cook and food discovery.
- Customer meal requests supported by Ziva.
- English and Shona meal interpretation.
- Customer-proposed meal budgets.
- Cook-submitted offers.
- Customer review of cook responses.
- Request and order management.
- Designated pickup hubs.
- Cash-on-collection payment arrangements.
- Pickup-code verification.
- In-app notifications.
- Backend authentication and data protection.

The current payment arrangement is cash paid directly to the cook at collection. EcoCash-related functionality is paused and should not be interpreted as an active online payment service.

**Counter-offers are not implemented in the current application.** They remain a possible future enhancement.

Features described as future proposals should not be interpreted as completed functionality. Implementation and production readiness should be verified against the current application and release checks.

## Future Development Roadmap

The following ideas are proposed enhancements for future versions of StewRun. They are not all implemented features of the current MVP.

### Marketplace Improvements

- Customer-to-cook counter-offers and structured price negotiation.
- Automatic cook offers based on request details and availability.
- Expanded pickup hubs across Harare.
- Last Call discounts for meals approaching their collection window.
- Customer reviews and ratings.
- Improved cook discovery and marketplace analytics.

### Payment and Collection Improvements

- Online payment integrations such as Paynow, EcoCash, InnBucks and card payments.
- Office Group Carts for coordinated workplace lunch orders.
- Delivery batching and partnerships with local delivery runners.
- WhatsApp sharing and order communication.

### AI and Operational Improvements

- AI-assisted meal requests using voice notes and photographs.
- Improved demand forecasting to help cooks plan preparation quantities.
- Kitchen Check, a proposed computer-vision-assisted hygiene review.
- Bronze, Silver and Gold cook verification levels.
- Improved business analytics and reporting.

### Business and Organisation Features

- Employer and office accounts.
- Prepaid workplace lunch credits.
- Expanded business partnerships and additional collection locations.

These improvements would be considered progressively based on customer needs, technical feasibility, operational requirements and available resources.

## Business Model and Sustainability

StewRun's proposed business model focuses on supporting independent cooks while keeping the marketplace accessible to customers.

The following revenue streams were considered during product planning. They are proposals rather than confirmed current charges or active revenue sources.

| Proposed Revenue Stream | Description |
|---|---|
| Platform service fee | A proposed $0.10 fee per plate |
| Featured Cook | A proposed $5 per week for additional marketplace visibility |
| Branded packaging | Potential margin from branded food packaging |
| Delivery partnerships | Potential revenue share from future delivery services |
| Office accounts | Potential employer partnerships and prepaid workplace lunch arrangements |

These ideas would require further validation, cost analysis and customer research before implementation.

### Expected Value for Customers

- Access to independent cooks and small catering businesses.
- Greater visibility into available meal options.
- Ability to propose a meal budget.
- Opportunity to compare cook offers.
- Scheduled collection at designated hubs.
- Less time spent searching for lunch during working hours.

### Expected Value for Cooks

- Greater visibility among potential customers.
- Access to additional customers.
- Better visibility into customer demand.
- Opportunity to review requests before committing to preparation.
- More predictable meal quantities.
- Potential reduction in food waste and unsold meals.

### Initial Pilot Concept

The original product proposal considered a small pilot involving approximately 3–5 cooks and 10–20 office workers, with affordable lunches in the $2–$3 range as an initial target.

These figures are proposed pilot targets, not verified current user numbers, active cooks or confirmed transaction volumes.

The long-term objective is to build a sustainable local marketplace that creates value for both customers and independent food businesses.

## Contributing

StewRun is being developed through an iterative product development process.

Development priorities include:

1. Understanding the existing architecture before making changes.
2. Preserving working functionality.
3. Maintaining secure backend operations.
4. Testing customer and cook workflows.
5. Keeping the application maintainable and scalable.
6. Avoiding unnecessary complexity.
7. Documenting important product and technical decisions.

All proposed changes should be reviewed and tested before integration into the main release.

## Project Information

### Project Ownership and Development

StewRun was developed as a software development capstone project.

The project involves the design, development, implementation and testing of a pre-order lunch marketplace for Harare, Zimbabwe.

The development work covers:

- Product design and user experience.
- Frontend application development.
- Backend and database integration.
- AI integration through Ziva.
- Authentication and application security.
- Automated testing and quality assurance.
- Deployment preparation.

### Project Details

| Detail | Information |
|---|---|
| Project | StewRun |
| Product | Pre-Order Lunch Marketplace |
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