# Navjivan — Serverless Architecture Decisions

> This document explains every key technical decision made in the serverless
> rewrite of Navjivan, including the reasoning behind each choice and how to
> explain them in interviews.

---

## Project Overview

Navjivan is a fully serverless AWS platform delivering AI-curated cloud
industry newsletters to subscribers daily. It replaced an EC2-based monolith
with a Lambda-first architecture using SQS fan-out, EventBridge scheduling,
and stateless JWT authentication.

**Region**: ap-south-1 (Mumbai)  
**Runtime**: Node.js 20.x  
**Database**: Neon Serverless Postgres (Drizzle ORM)  
**Frontend**: React + Vite + Tailwind, hosted on S3 + CloudFront  

---

## System Architecture

```
Browser (React SPA)
  │
  ├── Static files served from S3 via CloudFront (HTTPS)
  │
  └── API calls → API Gateway HTTP API
                    │
                    ├── token-authorizer Lambda (runs first, every request)
                    │     ├── Verifies Google JWT
                    │     └── Checks invite code against access_codes table
                    │
                    └── api-server Lambda (runs after auth passes)
                          └── Route dispatch via event.routeKey switch

EventBridge Scheduler (daily 9 AM IST)
  └── newsletter-trigger Lambda
        └── Pushes one SQS message per active subscription
              │
              └── SQS: newsletter-jobs-queue (MaxConcurrency: 2)
                    └── newsletter-generator Lambda (per user, 10min timeout)
                          ├── RSS fetch + scrape + dedup + relevance scoring
                          └── Invokes ai-summarizer Lambda (direct invoke)
                                └── Groq/Bedrock → headline + summary
                          └── On success → SQS: email-jobs-queue
                                └── email-sender Lambda
                                      ├── Fetches + embeds images as base64
                                      └── Sends via AWS SES
```

---

## Lambda Functions

| Lambda | Trigger | Timeout | Purpose |
|--------|---------|---------|---------|
| token-authorizer | API Gateway (every request) | 10s | JWT + invite code verification |
| api-server | API Gateway routes | 30s | Subscription/newsletter CRUD |
| newsletter-trigger | EventBridge + API Gateway | 60s | Fan-out to SQS |
| newsletter-generator | SQS (newsletter-jobs-queue) | 10min | RSS/scrape/score pipeline |
| ai-summarizer | Direct invoke from generator | 2min | Groq/Bedrock summarization |
| email-sender | SQS (email-jobs-queue) | 2min | Image embed + SES delivery |

**Shared**: db-layer Lambda Layer (storage.ts + db.ts + schema.ts compiled to JS)  
**Layer ARN**: `arn:aws:lambda:ap-south-1:<account-id>:layer:db-layer:1`

---

## Key Technical Decisions

---

### 1. HTTP API vs REST API on API Gateway

**Decision**: HTTP API (not REST API)

**Why**:
- REST API authorizers return a full IAM policy document — JSON defining
  allow/deny per resource ARN. Complex to write, complex to debug.
- HTTP API authorizers return a simple `{ isAuthorized: true/false }`.
  That's sufficient when the question is binary: "is this person allowed in?"
- HTTP API is ~70% cheaper than REST API and has lower latency.
- HTTP API gives `event.routeKey` as a single `"METHOD /path"` string,
  making route dispatch via switch statement clean and readable.

**Tradeoff**: Less granular per-route permission control. Acceptable here
because all authenticated users have the same access level.

**Interview answer**:
> "I chose HTTP API over REST API because my authorization model is binary —
> a user either has access or they don't. HTTP API's Lambda authorizer returns
> a simple boolean rather than a full IAM policy document. It's also
> significantly cheaper and lower latency. The tradeoff is less granular
> per-route permission control, which wasn't needed here."

---

### 2. Stateless JWT Auth — No Sessions, No Express, No Passport

**Decision**: Stateless JWT verification on every request, no server-side sessions

**How stateful sessions work (the old way)**:
```
Login → server creates session row in DB → sends sessionId cookie to browser
Every request → browser sends cookie → server looks up sessionId in DB → finds userId
```
Server holds state. Every request costs a DB lookup just for auth.

**How stateless JWT works**:
```
Login → Google gives JWT directly to browser
Every request → browser sends JWT in Authorization header
Server verifies JWT signature using Google's public keys (pure computation)
No DB lookup. No session table. Token proves everything itself.
```

A JWT has three parts: `header.payload.signature`
- Header: algorithm metadata
- Payload: `{ email, sub, exp, aud }` — the actual claims
- Signature: Google's RSA signature over header+payload

Verifying means: recompute the signature using Google's public key
(from `https://www.googleapis.com/oauth2/v3/certs`) and confirm it matches.
If it does, the payload is genuine — nobody tampered with it.

**Why this matters for Lambda**:
Lambda functions are ephemeral — no persistent process between requests.
Stateful sessions would require a DB lookup on every single invocation just
to check auth. JWT verification is pure computation — no external calls,
no latency added, no DB cost.

**Why no Express/Passport**:
Express solves routing + session middleware. Routing is handled by API Gateway
(`routeKey`). Sessions are eliminated by JWT. There's nothing left for Express
to do. Raw Lambda event handling is simpler, faster, and teaches the actual
AWS model.

**Interview answer**:
> "Lambda functions are ephemeral — there's no persistent process to maintain
> session state between invocations. JWT is self-contained: Google signs the
> token with their private key, I verify with their public key. Pure
> cryptographic operation, no DB lookup for auth. Each Lambda invocation is
> truly independent. The tradeoff is tokens can't be immediately invalidated
> server-side — logout is client-side only."

---

### 3. Google Identity Services — Client-Side Sign-In

**Decision**: Client-side Google sign-in (JWT delivered to browser directly)

**Old redirect flow (replaced)**:
```
Browser → GET /api/auth/google
Server redirects to Google
Google → GET /api/auth/google/callback (server)
Server exchanges code for tokens → creates session → sets cookie
```
Server is in the middle of everything. Needs stable callback URL.
Needs session management. Multiple round trips.

**New client-side flow**:
```
Browser loads Google's JS library
User clicks button → Google's UI handles everything
Google returns JWT directly to browser JavaScript
Browser sends JWT on every API call
Server only verifies — never participates in token production
```

**Benefits**:
- No callback URL to maintain in Google Cloud Console
- No `/auth/callback` route on the server
- No token exchange logic on the server
- Authorizer has one job: verify what it receives

**What the JWT payload contains**:
```json
{
  "sub": "1234567",
  "email": "rehaan@opus.com",
  "name": "Rehaan Makhija",
  "exp": 1720725600,
  "aud": "your-google-client-id",
  "iss": "https://accounts.google.com"
}
```
`aud` must match your Google Client ID — prevents tokens from other apps
working on your API.

**Interview answer**:
> "Google Identity Services handles the entire OAuth flow client-side and
> delivers a signed JWT directly to the browser. The server never participates
> in token production — it only verifies. This eliminates server-side callback
> URLs, token exchange logic, and session management entirely."

---

### 4. Per-Person Invite Codes Tied to Specific Google Emails

**Decision**: Each invite code is paired with a specific email in the DB

**Schema**:
```sql
CREATE TABLE access_codes (
  code    VARCHAR NOT NULL,
  email   VARCHAR NOT NULL,
  PRIMARY KEY (code, email)   -- composite primary key, enforces uniqueness
);
```

**Why not a shared secret**:
One password for everyone → one person leaks it → everyone affected →
must rotate and re-distribute to all users. Doesn't scale past one person.

**The paired model**:
```
code "a1b2c3" + email "rehaan@opus.com"    → valid ✓
code "a1b2c3" + email "attacker@gmail.com" → invalid ✗
code "wrongcode" + email "rehaan@opus.com" → invalid ✗
```

A leaked code is useless without the matching Google account.
A valid Google account is useless without the matching code.
Revoking access = delete one DB row. Nobody else affected.

**Why composite primary key (not just index)**:
A unique index speeds up lookups but doesn't prevent duplicates at the
DB level if application code has a bug. A primary key makes Postgres itself
reject duplicate `(code, email)` pairs — enforcement at the database level,
not application level.

**Two-factor nature**:
- Factor 1: Something you have — invite code (shared out-of-band)
- Factor 2: Something you are — verified Google identity (cryptographic proof)

**Interview answer**:
> "Each invite code is tied to a specific email using a composite primary key
> on (code, email). The authorizer verifies both the Google JWT and the code
> simultaneously — neither alone is sufficient. A leaked code is useless
> without the matching Google account. Revoking access means deleting one row
> without affecting other users. The composite primary key enforces uniqueness
> at the database level, not just application level."

---

### 5. userId Passed as Context to Downstream Lambdas

**Decision**: Authorizer injects verified userId into event context

**How it works mechanically**:

Authorizer returns:
```json
{
  "isAuthorized": true,
  "context": { "userId": "rehaan@opus.com" }
}
```

API Gateway injects this into the route Lambda's event:
```json
{
  "requestContext": {
    "authorizer": {
      "lambda": { "userId": "rehaan@opus.com" }
    }
  }
}
```

Route Lambda reads:
```typescript
const userId = event.requestContext.authorizer.lambda.userId;
// Already verified. Just use it.
```

**Why this is architecturally correct**:
```
Authorizer Lambda  →  "who is this, are they allowed?"
Route Lambda       →  "what does this person want to do?"
```
Route Lambda has zero auth code. Clean separation of concerns.

**Security model**:
Route Lambda is never directly accessible — always behind API Gateway which
always runs the authorizer first. The context is injected by API Gateway
itself, not by the client. Can't be faked.

**Interview answer**:
> "The authorizer passes verified identity as context via API Gateway's
> context injection. Route Lambdas read userId from
> event.requestContext.authorizer.lambda.userId without re-performing auth.
> The authorizer owns authentication, route Lambdas own business logic.
> Clean separation of concerns enforced by infrastructure, not convention."

---

## The Connecting Thread

These five decisions form one coherent philosophy, not five independent choices:

```
Stateless JWT          → no server-side state needed
Client-side Google     → no server-side OAuth complexity
HTTP API               → simple auth model matching stateless JWT
Per-person codes       → access control without sessions
Context injection      → clean separation, no auth logic in routes
```

The common thread: **push complexity to the right place.**
- Google handles identity
- Database handles access control
- Authorizer handles verification
- API Gateway handles routing
- Route Lambdas handle business logic

Nothing does more than one job.
This is the single responsibility principle applied at infrastructure level.

---

## Build Order (Phases)

| Phase | What | Status |
|-------|------|--------|
| 1 | S3 + CloudFront frontend deployment | ✅ Done |
| 2 | access_codes table + storage functions | ✅ Done |
| 3 | db-layer Lambda Layer | ✅ Done |
| 4 | token-authorizer Lambda | 🔄 Next |
| 5 | api-server Lambda (no Express, routeKey dispatch) | ⏳ Pending |
| 6 | API Gateway HTTP API wiring | ⏳ Pending |
| 7 | Frontend login flow (Google + invite code) | ⏳ Pending |
| 8 | Newsletter pipeline (SQS + generator + summarizer + email) | ⏳ Pending |

---

## Environment Variables Reference

| Lambda | Variable | Value |
|--------|----------|-------|
| token-authorizer | DATABASE_URL | Neon connection string |
| token-authorizer | GOOGLE_CLIENT_ID | From Google Cloud Console |
| api-server | DATABASE_URL | Neon connection string |
| newsletter-trigger | NEWSLETTER_QUEUE_URL | SQS queue URL |
| newsletter-generator | AI_SUMMARIZER_ARN | ai-summarizer Lambda ARN |
| newsletter-generator | EMAIL_QUEUE_URL | SQS email queue URL |
| ai-summarizer | GROQ_API_KEY | Groq API key |
| email-sender | SES_FROM_ADDRESS | Verified SES sender email |
| email-sender | UNSPLASH_ACCESS_KEY | Unsplash API key |

---

## SQS Configuration

| Queue | Purpose | DLQ | MaxConcurrency on consumer |
|-------|---------|-----|---------------------------|
| newsletter-jobs-queue | One message per subscription per day | Yes, after 3 retries | 2 |
| email-jobs-queue | One message per completed newsletter | Yes, after 3 retries | 5 |

---

*Last updated: Phase 3 complete — db-layer published to ap-south-1*
