import { OAuth2Client } from "google-auth-library";
// Resolved at runtime from the db-layer Lambda Layer (/opt/nodejs/node_modules/storage.js)
import { storage } from "storage";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID as string;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

interface ApiEvent {
  routeKey?: string;
  body?: string;
  requestContext?: {
    authorizer?: {
      lambda?: {
        userId?: string; // this is the email, per token-authorizer's context shape
      };
    };
  };
  [key: string]: unknown;
}

interface ApiResponse {
  statusCode: number;
  body: string;
  headers?: Record<string, string>;
}

function json(statusCode: number, data: unknown): ApiResponse {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

// Every route except /auth/verify sits behind token-authorizer, so the caller's
// verified email arrives here already, via requestContext.authorizer.lambda.userId
function getCallerEmail(event: ApiEvent): string | undefined {
  return event.requestContext?.authorizer?.lambda?.userId;
}

// Subscriptions/newsletters key off a real users.id (UUID), not the email itself —
// so every protected route resolves (and creates, if first login) that user row first.
async function resolveUserId(email: string): Promise<string> {
  const existing = await storage.getUserByEmail(email);
  if (existing) return existing.id;

  const created = await storage.upsertUser({ email });
  return created.id;
}

export const handler = async (event: ApiEvent): Promise<ApiResponse> => {
  try {
    switch (event.routeKey) {
      // ---- Public route: no authorizer in front of this one ----
      case "POST /auth/verify": {
        const body = JSON.parse(event.body || "{}");
        const { googleToken, accessCode } = body;

        if (!googleToken || !accessCode) {
          return json(400, { message: "Missing googleToken or accessCode" });
        }

        let email: string | undefined;
        try {
          const ticket = await client.verifyIdToken({
            idToken: googleToken,
            audience: GOOGLE_CLIENT_ID,
          });
          email = ticket.getPayload()?.email;
        } catch (err) {
          console.warn("auth/verify: Google token verification failed", err);
          return json(401, { message: "Invalid Google token" });
        }

        if (!email) {
          return json(401, { message: "Invalid Google token" });
        }

        const record = await storage.getAccessCode(accessCode, email);
        if (!record) {
          return json(401, { message: "Invalid access code for this account" });
        }

        // Ensure a users row exists for this email on first successful login
        await resolveUserId(email);

        return json(200, { message: "OK", email });
      }

      // ---- Protected routes below: authorizer already ran, email is verified ----
      case "GET /subscriptions": {
        const email = getCallerEmail(event);
        if (!email) return json(401, { message: "Unauthorized" });

        const userId = await resolveUserId(email);
        const subscription = await storage.getSubscription(userId);
        return json(200, { subscription: subscription || null });
      }

      case "PUT /subscriptions": {
        const email = getCallerEmail(event);
        if (!email) return json(401, { message: "Unauthorized" });

        const body = JSON.parse(event.body || "{}");
        const { companies } = body;
        if (!companies) return json(400, { message: "Missing companies" });

        const userId = await resolveUserId(email);
        const existing = await storage.getSubscription(userId);

        const subscription = existing
          ? await storage.updateSubscription(userId, companies)
          : await storage.createSubscription({ userId, companies });

        return json(200, { subscription });
      }

      case "POST /subscriptions/deactivate": {
        const email = getCallerEmail(event);
        if (!email) return json(401, { message: "Unauthorized" });

        const userId = await resolveUserId(email);
        await storage.deactivateSubscription(userId);
        return json(200, { message: "Deactivated" });
      }

      case "GET /newsletters": {
        const email = getCallerEmail(event);
        if (!email) return json(401, { message: "Unauthorized" });

        const userId = await resolveUserId(email);
        const newsletters = await storage.getUserNewsletters(userId);
        return json(200, { newsletters });
      }

      case "POST /newsletters/trigger": {
        const email = getCallerEmail(event);
        if (!email) return json(401, { message: "Unauthorized" });

        // Phase 8 wires this to the newsletter-trigger Lambda / SQS pipeline.
        // Left as a stub for now so the route exists and returns cleanly.
        return json(202, { message: "Newsletter generation triggered" });
      }

      default:
        return json(404, { message: "Not found" });
    }
  } catch (err) {
    console.error("api-server error:", err);
    return json(500, { message: "Internal server error" });
  }
};