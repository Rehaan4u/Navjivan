import { OAuth2Client } from "google-auth-library";
// Comes from the db-layer Lambda Layer, mounted at /opt/nodejs
// (layer root is on NODE_PATH, so "storage" resolves to /opt/nodejs/storage.js)
import { storage } from "storage";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID as string;

// Reused across warm invocations — avoids re-creating the client every call
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

interface AuthorizerResult {
  isAuthorized: boolean;
  context?: {
    userId: string;
  };
}

// HTTP API (payload format 2.0) Lambda authorizer event shape
interface AuthorizerEvent {
  headers?: Record<string, string | undefined>;
  [key: string]: unknown;
}

export const handler = async (
  event: AuthorizerEvent
): Promise<AuthorizerResult> => {
  try {
    // Headers arrive lowercased under HTTP API payload format 2.0
    const authHeader = event.headers?.authorization;
    const accessCode = event.headers?.["x-access-code"];

    // 1 & 2: extract, 3: missing either -> deny immediately
    if (!authHeader || !authHeader.startsWith("Bearer ") || !accessCode) {
      console.warn("Authorizer denied: missing Authorization or x-access-code header");
      return { isAuthorized: false };
    }

    const idToken = authHeader.slice("Bearer ".length).trim();
    if (!idToken) {
      console.warn("Authorizer denied: empty bearer token");
      return { isAuthorized: false };
    }

    // 4: Verify Google JWT — checks signature against Google's public keys,
    // checks expiry, and (via `audience`) checks the token was issued for this app
    let email: string | undefined;
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: GOOGLE_CLIENT_ID,
      });
      email = ticket.getPayload()?.email;
    } catch (err) {
      console.warn("Authorizer denied: Google token verification failed", err);
      return { isAuthorized: false };
    }

    if (!email) {
      console.warn("Authorizer denied: no email claim in token payload");
      return { isAuthorized: false };
    }

    // 5: Check (code, email) pair exists in access_codes table
    const record = await storage.getAccessCode(accessCode, email);
    if (!record) {
      console.warn(`Authorizer denied: no matching access code for ${email}`);
      return { isAuthorized: false };
    }

    // 6: Both checks passed
    return {
      isAuthorized: true,
      context: {
        userId: email,
      },
    };
  } catch (err) {
    // 7: Any unexpected failure -> deny, never throw (fail closed)
    console.error("Authorizer error:", err);
    return { isAuthorized: false };
  }
};