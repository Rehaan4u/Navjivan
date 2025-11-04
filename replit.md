# Payment Chronicle by Gajanan

## Overview
Payment Chronicle is an automated newsletter platform that delivers AI-powered summaries of payments industry news directly to users' inboxes. Built for executives and professionals in the payments sector, it provides Finshots-style concise summaries of relevant news from premium sources.

## Recent Changes
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
- `DATABASE_URL`: PostgreSQL connection string (auto-configured)
- `SESSION_SECRET`: Session encryption key (auto-configured)
- `AI_INTEGRATIONS_OPENAI_BASE_URL`: OpenAI API endpoint (auto-configured)
- `AI_INTEGRATIONS_OPENAI_API_KEY`: OpenAI API key (auto-configured)
- `REPL_ID`: Replit project ID (auto-configured)
- `ISSUER_URL`: OIDC issuer URL (auto-configured)

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

## Current Status
- ✅ Database schema defined
- ✅ Authentication system configured
- ✅ Landing page complete
- ✅ Dashboard UI complete
- ⏳ Backend API implementation in progress
- ⏳ Newsletter generation service pending
- ⏳ PDF generation pending
- ⏳ Email delivery pending
- ⏳ Scheduling system pending
