```
███╗   ██╗ █████╗ ██╗   ██╗     ██╗██╗██╗   ██╗ █████╗ ███╗   ██╗
████╗  ██║██╔══██╗██║   ██║     ██║██║██║   ██║██╔══██╗████╗  ██║
██╔██╗ ██║███████║██║   ██║     ██║██║██║   ██║███████║██╔██╗ ██║
██║╚██╗██║██╔══██║╚██╗ ██╔╝██   ██║██║╚██╗ ██╔╝██╔══██║██║╚██╗██║
██║ ╚████║██║  ██║ ╚████╔╝ ╚█████╔╝██║ ╚████╔╝ ██║  ██║██║ ╚████║
╚═╝  ╚═══╝╚═╝  ╚═╝  ╚═══╝   ╚════╝ ╚═╝  ╚═══╝  ╚═╝  ╚═╝╚═╝  ╚═══╝
```
☁️ Daily Cloud Intelligence — Delivered Every Morning

## 🎯 What is Navjivan?

**Navjivan** is an AI-powered cloud industry newsletter platform built **100% on AWS**. Users select cloud companies they want to track (AWS, Google Cloud, Azure), and every morning at 9:00 AM IST, Navjivan automatically:

1. **Fetches** the latest news articles about their selected companies
2. **Summarises** them using AI into crisp, insightful briefings
3. **Delivers** a beautifully designed HTML email via Amazon SES

The website itself runs on **on-demand EC2 instances** — launched only when users visit, and automatically shut down after 15 minutes. This reduces compute costs by **~95%** compared to always-on servers.

> *Named after Mahatma Gandhi's newspaper "Navjivan" (1919) — meaning "New Life" — this project breathes new life into how cloud professionals consume industry news.*

---

## 🏗️ Architecture



<img width="1120" height="479" alt="Screenshot 2026-06-18 at 08 39 19" src="https://github.com/user-attachments/assets/bb093992-1bc3-4c63-a455-7d4a278ee6ec" />


```
┌─────────────────────────────────────────────────────────────────┐
│                        USER JOURNEY                             │
└─────────────────────────────────────────────────────────────────┘

  User hits API Gateway URL
           │
           ▼
  ┌─────────────────┐
  │   API Gateway   │  ← Public HTTPS endpoint
  │   (HTTP API)    │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐     ┌──────────────────────────┐
  │ Lambda Function │────▶│  EC2 Instance (t3.small)  │
  │ lambda-website  │     │  ┌────────────────────┐   │
  │ (Private Subnet)│     │  │  nginx (port 80)   │   │
  └─────────────────┘     │  │       ↓            │   │
           │              │  │  Express.js        │   │
           │              │  │  (port 5001)       │   │
  Elastic IP assigned     │  │       ↓            │   │
  16.112.247.39           │  │  React Frontend    │   │
                          │  └────────────────────┘   │
  EC2 auto-stops          └──────────────────────────┘
  after 15 mins                      │
                                     │ Google OAuth
                                     ▼
                           ┌──────────────────┐
                           │   Neon Postgres   │
                           │  (User sessions,  │
                           │   preferences)    │
                           └──────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     DAILY NEWSLETTER FLOW                        │
└─────────────────────────────────────────────────────────────────┘

  Every day at 9:00 AM IST
           │
           ▼
  ┌─────────────────┐
  │   EventBridge   │  ← Cron: 0 3 30 * * ? (UTC = 9AM IST)
  │   (Scheduler)   │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐     ┌──────────────────┐
  │ Lambda Function │────▶│   RSS Feed /     │
  │ Morning-News    │     │   Web Scraping   │
  │ (Private Subnet)│     └──────────────────┘
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │   Groq / AWS    │  ← AI summarisation
  │   Bedrock API   │     (Claude Haiku 4.5)
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │   Amazon SES    │  ← Sends HTML newsletter email
  └────────┬────────┘
           │
           ▼
     User's Inbox 📧

┌─────────────────────────────────────────────────────────────────┐
│                        VPC ARCHITECTURE                          │
└─────────────────────────────────────────────────────────────────┘

  VPC (ap-south-2 — Hyderabad)
  ├── Public Subnet
  │     └── EC2 Instances (launched on demand)
  │           └── Elastic IP: 16.112.247.39 (fixed)
  │
  └── Private Subnet
        ├── Lambda: Navjivan-Website (EC2 orchestrator)
        ├── Lambda: Morning-Newsletter-Cron
        └── NAT Gateway (outbound internet access)
```

---

## ☁️ AWS Services Used

| Service | Purpose | Why it matters |
|---|---|---|
| **Lambda** | Website orchestration + Newsletter generation | Serverless — zero cost when idle |
| **EC2** | Hosts Express + React website | Custom AMI for instant boot |
| **Amazon SES** | Sends newsletter emails | Professional deliverability |
| **API Gateway** | Public entry point for website Lambda | HTTPS, throttling, DDoS protection |
| **EventBridge** | Triggers newsletter at 9AM IST daily | Cron-based serverless scheduling |
| **VPC** | Network isolation | Public + Private subnet separation |
| **NAT Gateway** | Outbound internet for private subnet Lambdas | Security best practice |
| **IAM** | Roles and policies for every service | Least-privilege access control |
| **CloudWatch** | Logs for both Lambda functions | Debugging and monitoring |
| **AMI** | Custom machine image with pre-configured app | Instant EC2 boot with zero setup |
| **Elastic IP** | Fixed IP for EC2 website | Stable URL for Google OAuth |
| **Bedrock** | Claude Haiku 4.5 for AI summaries | 100% AWS-native AI pipeline |

---

## 💡 Key Engineering Decisions

### 1. On-Demand EC2 via Lambda Orchestration
Instead of running EC2 24/7, Lambda checks if an instance is running before launching one. This pattern reduces compute costs by ~95% — the instance only lives for 15 minutes per user session.

```typescript
// Lambda checks for running/pending instances before launching new ones
const existing = await getRunningInstance(); // checks "running" AND "pending" states
if (existing) return buildRedirectResponse(`http://${ELASTIC_IP}`);
```

### 2. Private Subnet Lambdas with NAT Gateway
Both Lambda functions run in a **private subnet** — they have no public IP and cannot be reached directly from the internet. All outbound traffic (to EC2 API, SES, Bedrock) routes through a NAT Gateway. API Gateway acts as the secure public entry point.

### 3. IAM Roles Over Static Credentials
No AWS credentials are hardcoded or stored in environment variables. Lambda functions and EC2 instances use **IAM roles** — AWS auto-rotates temporary credentials every hour.

### 4. Elastic IP Reassignment
Every new EC2 instance gets the **same Elastic IP** reassigned to it. This means Google OAuth callback URLs never change, and users always hit the same address.

```typescript
await ec2.send(new AssociateAddressCommand({
  InstanceId: instanceId,
  AllocationId: ELASTIC_IP_ALLOCATION_ID,
}));
```

### 5. Custom AMI with PM2 + nginx
The AMI has everything pre-installed: Node.js, PM2 (process manager), nginx (reverse proxy), and the compiled application. EC2 boots and serves traffic in under 60 seconds.

---

## 🛠️ Tech Stack

**Backend**
- Node.js 22 + TypeScript
- Express.js (REST API)
- Drizzle ORM + PostgreSQL (Neon serverless)
- Passport.js + Google OAuth 2.0
- AWS SDK v3 (SES, EC2, Bedrock)

**Frontend**
- React 18 + Vite
- Tailwind CSS
- TanStack Query
- Wouter (routing)

**Infrastructure**
- AWS Lambda (Node.js 24 runtime)
- EC2 t3.small with custom AMI
- PM2 + nginx on EC2
- esbuild for Lambda bundling
- Amazon EventBridge (cron)

**AI**
- Groq API (llama-3.3-70b) for article summarisation
- AWS Bedrock Claude Haiku 4.5 (migration in progress)
- RSS feed parsing + web scraping for news
  
---

## 📁 Project Structure

```
Payment-Chronicle/
├── client/                    # React frontend
│   └── src/
│       ├── components/        # UI components
│       └── pages/             # Route pages
│
├── server/                    # Express backend
│   ├── services/
│   │   ├── email.ts           # AWS SES email sending
│   │   ├── email-template.ts  # HTML newsletter template
│   │   ├── newsletter.ts      # Newsletter generation logic
│   │   ├── scheduler.ts       # Cron job orchestration
│   │   └── feedHealth.ts      # RSS feed health checks
│   ├── lambda.ts              # Morning newsletter Lambda handler
│   ├── lambda-website.ts      # Website EC2 orchestrator Lambda
│   ├── index.ts               # Express server entry point
│   ├── routes.ts              # API routes
│   ├── replitAuth.ts          # Google OAuth setup
│   └── storage.ts             # Database layer
│
├── shared/                    # Shared types
├── ecosystem.config.cjs       # PM2 production config
├── .env.example               # Environment variable template
└── package.json
```

---

## 📦 Lambda Deployment

### Newsletter Lambda (Morning-Newsletter-Cron)
```bash
npm run build:lambda
zip lambda.zip dist/lambda.js
# Upload to Lambda Console
```

### Website Orchestrator Lambda (Navjivan-Website)
```bash
npm run build:lambda-website
zip lambda-website.zip dist/lambda-website.js
# Upload to Lambda Console
```

---

## 🔐 Security Architecture

```
Layer 1: API Gateway          → Throttling (10 req/sec), HTTPS only
Layer 2: Lambda (private)     → No public IP, unreachable directly
Layer 3: IAM roles            → Least-privilege, auto-rotating credentials
Layer 4: VPC security groups  → Port-level access control
Layer 5: nginx rate limiting  → HTTP flood protection
Layer 6: Google OAuth         → Only authenticated users access app
Layer 7: Neon SSL             → Encrypted database connections
```

---

## 💰 Cost Optimisation

| Resource | Traditional | Navjivan |
|---|---|---|
| EC2 (website) | 24/7 = ~$17/month | On-demand = ~$0.05/month |
| Newsletter sending | External service $20+/month | AWS SES = ~$0.10/month |
| AI summaries | OpenAI ~$10/month | Groq free tier / Bedrock pay-per-use |
| **Total estimate** | **~$50/month** | **~$5/month** |

----

## 📖 Project Journey

Navjivan was originally prototyped as a full-stack application. 
The cloud engineering work — migrating to a fully AWS-native 
architecture — was built from scratch:

- ✅ Migrated email delivery from SMTP/nodemailer → Amazon SES (AWS SDK v3)
- ✅ Built serverless Lambda orchestration for on-demand EC2 management  
- ✅ Designed VPC with public/private subnets and NAT Gateway
- ✅ Replaced external AI APIs with AWS Bedrock (Claude Haiku 4.5)
- ✅ Implemented IAM role-based authentication (zero hardcoded credentials)
- ✅ Created custom AMI pipeline for instant EC2 deployment
- ✅ Set up EventBridge cron for automated daily newsletter delivery

The infrastructure design, AWS integration, and deployment architecture are entirely original work.

---

## 🙏 Inspiration

This project is named after **Navjivan** — the Gujarati-language newspaper founded by Mahatma Gandhi in 1919. Gandhi used Navjivan to inform and educate the masses about issues that mattered. A century later, this platform carries that same spirit — delivering intelligence that helps cloud professionals stay informed and grow.

---


**Built with ☁️ on AWS · TypeScript · React**

*If this project helped you learn something, give it a ⭐*
