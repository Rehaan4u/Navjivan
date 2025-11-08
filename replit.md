# Payment Chronicle by Gajanan

## Overview
Payment Chronicle is an automated newsletter platform that delivers AI-powered summaries of payments industry news directly to users' inboxes. Built for executives and professionals in the payments sector, it provides Finshots-style concise summaries of relevant news from premium sources.

## Recent Changes
- **Nov 8, 2025**: Production scheduler fixes and reliability improvements
  - Fixed autoscaling issue: Production deployments sleep when inactive
  - Implemented Replit Cron integration for reliable newsletter delivery
  - Added `scheduler_runs` table for persistent run tracking
  - Created `/api/cron/trigger-newsletters` endpoint with CRON_SECRET authentication
  - Enhanced duplicate prevention with email_sent flag checking
  - Improved OpenAI token handling (150 tokens, 1000 char limit)
  - Added production monitoring via `/api/health/scheduler` endpoint
- **Nov 4, 2025**: Initial project setup with full-stack architecture
  - Implemented Replit Auth for user authentication
  - Set up PostgreSQL database with Drizzle ORM
  - Configured OpenAI integration for AI-powered news summarization
  - Built responsive landing page and dashboard interface
  - Implemented subscription management system

## User Preferences
- Professional, minimal design aesthetic following financial industry standards
- Clean typography using Inter (sans-serif) and Lora (serif) fonts
- Emphasis on readability and information hierarchy
- Mobile-first responsive design

## Project Architecture

### Frontend
- **Framework**: React with TypeScript
- **Routing**: Wouter
- **Styling**: Tailwind CSS with Shadcn UI components
- **State Management**: TanStack Query (React Query)
- **Authentication**: Replit Auth (OpenID Connect)

### Backend
- **Runtime**: Node.js with Express
- **Database**: PostgreSQL via Neon (managed by Replit)
- **ORM**: Drizzle ORM
- **Authentication**: Passport.js with OpenID Client
- **AI**: OpenAI GPT-5 via Replit AI Integrations
- **Scheduling**: node-cron for daily newsletter generation
- **PDF Generation**: PDFKit
- **Email**: Nodemailer

### Key Features
1. **User Authentication**: Secure login via Replit Auth (Google, GitHub, Email)
2. **Company Subscriptions**: Users can track up to 3 payments companies
3. **AI Summarization**: OpenAI GPT-5 generates Finshots-style news summaries
4. **Automated Scheduling**: Daily newsletter generation at 9:00 AM IST
5. **PDF Generation**: Professional newsletter formatting
6. **Email Delivery**: Automated email sending to registered users
7. **Newsletter Archive**: View and download past newsletters

### Database Schema

#### Users Table
- Managed by Replit Auth
- Fields: id, email, firstName, lastName, profileImageUrl, createdAt, updatedAt

#### Subscriptions Table
- Stores user newsletter preferences
- Fields: id, userId, companies (comma-separated), isActive, createdAt, updatedAt

#### Newsletters Table
- Stores generated newsletters
- Fields: id, subscriptionId, userId, companies, generatedAt, sentAt, pdfPath, emailSent

#### Articles Table
- Stores individual news summaries in newsletters
- Fields: id, newsletterId, headline, summary, sourceUrl, sourceName, publishedAt, createdAt

#### Scheduler Runs Table
- Tracks newsletter generation runs for production reliability
- Fields: id, runDate, startedAt, completedAt, status, successCount, failureCount, triggerSource, errorMessage
- Enables duplicate prevention and production monitoring

### News Sources
The platform aggregates news from premium industry sources:
- PaymentsJournal
- BlueSnap Payment News
- American Banker (Payments)
- PaymentsDive
- Bloomberg
- CNBC
- Financial Times
- The Economic Times
- The Economist

### Environment Variables

**Auto-Configured (Replit):**
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Session encryption key
- `AI_INTEGRATIONS_OPENAI_BASE_URL`: OpenAI API endpoint
- `AI_INTEGRATIONS_OPENAI_API_KEY`: OpenAI API key
- `REPL_ID`: Replit project ID
- `ISSUER_URL`: OIDC issuer URL

**Optional (Email Configuration):**
- `SMTP_HOST`: SMTP server hostname (e.g., smtp.gmail.com, smtp.sendgrid.net)
- `SMTP_PORT`: SMTP server port (default: 587 for TLS, 465 for SSL)
- `SMTP_USER`: SMTP username/email
- `SMTP_PASS`: SMTP password/API key
- `SMTP_FROM`: Sender email address (default: "Payment Chronicle <noreply@paymentchronicle.com>")

**Required (Production Scheduling):**
- `CRON_SECRET`: Secret token for authenticating external cron triggers (recommended: 32+ char random hex)
  - Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
  - Used by Replit Cron to securely trigger `/api/cron/trigger-newsletters`

**Email Service Modes:**
- Development (default): Emails are logged to console, not sent
- Production: Automatically enabled when SMTP_HOST, SMTP_USER, and SMTP_PASS are configured

### Development Workflow
1. Schema changes: Update `shared/schema.ts`, then run `npm run db:push`
2. Frontend components: Located in `client/src/pages/` and `client/src/components/`
3. Backend routes: Defined in `server/routes.ts`
4. Storage layer: Implements IStorage interface in `server/storage.ts`

### Design System
- **Primary Color**: Blue (#217BF4 - professional trust)
- **Typography**: Inter for UI, Lora for newsletter content
- **Spacing**: Consistent 8px grid system
- **Components**: Shadcn UI primitives with custom styling
- **Interactions**: Subtle hover/active states using elevation utilities

### Project Structure
```
├── client/
│   ├── src/
│   │   ├── components/ui/     # Shadcn UI components
│   │   ├── pages/              # Page components
│   │   ├── hooks/              # React hooks (useAuth, etc.)
│   │   ├── lib/                # Utilities (queryClient, authUtils)
│   │   └── App.tsx             # Main app component
│   └── index.html              # HTML template
├── server/
│   ├── routes.ts               # API endpoints
│   ├── storage.ts              # Data access layer
│   ├── db.ts                   # Database connection
│   └── replitAuth.ts           # Authentication setup
├── shared/
│   └── schema.ts               # Shared types and Drizzle schema
└── design_guidelines.md        # UI/UX design specifications
```

## Production Deployment (IMPORTANT)

### Scheduler Reliability Issue
Replit's autoscaling deployments spin down containers when inactive. This means:
- ❌ node-cron jobs won't run at 9:00 AM IST if the app is asleep
- ❌ Startup catch-up logic requires user traffic to wake the container
- ✅ **Solution**: Use external Replit Cron to trigger newsletter generation

### Setting Up Replit Cron (Required for Production)

1. **Add CRON_SECRET Environment Variable**
   - Go to Replit Secrets (lock icon in Tools)
   - Add new secret: `CRON_SECRET`
   - Value: Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - Example: `912c088a552491a28c745d2010f8afc1d19cae62d81158e6c40faf18d55644cd`

2. **Configure Replit Cron**
   - Open Tools → Replit Cron
   - Create new cron job
   - **Schedule**: `30 3 * * *` (3:30 AM UTC = 9:00 AM IST)
   - **URL**: `https://your-app.replit.app/api/cron/trigger-newsletters`
   - **Method**: POST
   - **Headers**: 
     ```
     x-cron-secret: <your-CRON_SECRET-value>
     ```

3. **Verify Setup**
   - Test the cron endpoint manually:
     ```bash
     curl -X POST https://your-app.replit.app/api/cron/trigger-newsletters \
       -H "x-cron-secret: YOUR_SECRET_HERE"
     ```
   - Check scheduler status:
     ```bash
     curl https://your-app.replit.app/api/health/scheduler
     ```

### Monitoring Production
- Health check endpoint: `GET /api/health/scheduler`
- Returns: scheduler status, last run time, next scheduled run
- Database table: `scheduler_runs` tracks all production runs
- Query recent runs: `SELECT * FROM scheduler_runs ORDER BY started_at DESC LIMIT 10;`

## Current Status
- ✅ Database schema defined
- ✅ Authentication system configured
- ✅ Landing page complete
- ✅ Dashboard UI complete
- ✅ Backend API implementation complete
- ✅ Newsletter generation service complete
- ✅ PDF generation complete
- ✅ Email delivery complete
- ✅ Scheduling system complete with Replit Cron integration
- ✅ Production reliability fixes implemented
