// // From javascript_log_in_with_replit integration
// import * as client from "openid-client";
// import { Strategy, type VerifyFunction } from "openid-client/passport";

// import passport from "passport";
// import session from "express-session";
// import type { Express, RequestHandler } from "express";
// import memoize from "memoizee";
// import connectPg from "connect-pg-simple";
// import { storage } from "./storage";

// const getOidcConfig = memoize(
//   async () => {
//     return await client.discovery(
//       new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
//       process.env.REPL_ID!
//     );
//   },
//   { maxAge: 3600 * 1000 }
// );

// export function getSession() {
//   const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
//   const pgStore = connectPg(session);
//   const sessionStore = new pgStore({
//     conString: process.env.DATABASE_URL,
//     createTableIfMissing: false,
//     ttl: sessionTtl,
//     tableName: "sessions",
//   });
  
//   // Use secure cookies only in production (HTTPS)
//   const isProduction = process.env.NODE_ENV === "production";
  
//   return session({
//     secret: process.env.SESSION_SECRET!,
//     store: sessionStore,
//     resave: false,
//     saveUninitialized: false,
//     cookie: {
//       httpOnly: true,
//       secure: isProduction, // Only require HTTPS in production
//       maxAge: sessionTtl,
//     },
//   });
// }

// function updateUserSession(
//   user: any,
//   tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
// ) {
//   user.claims = tokens.claims();
//   user.access_token = tokens.access_token;
//   user.refresh_token = tokens.refresh_token;
//   user.expires_at = user.claims?.exp;
// }

// async function upsertUser(
//   claims: any,
// ) {
//   await storage.upsertUser({
//     id: claims["sub"],
//     email: claims["email"],
//     firstName: claims["first_name"],
//     lastName: claims["last_name"],
//     profileImageUrl: claims["profile_image_url"],
//   });
// }

// export async function setupAuth(app: Express) {
//   app.set("trust proxy", 1);
//   app.use(getSession());
//   app.use(passport.initialize());
//   app.use(passport.session());

//   const config = await getOidcConfig();

//   const verify: VerifyFunction = async (
//     tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
//     verified: passport.AuthenticateCallback
//   ) => {
//     const user = {};
//     updateUserSession(user, tokens);
//     await upsertUser(tokens.claims());
//     verified(null, user);
//   };

//   // Keep track of registered strategies
//   const registeredStrategies = new Set<string>();

//   // Helper function to ensure strategy exists for a domain
//   const ensureStrategy = (domain: string) => {
//     const strategyName = `replitauth:${domain}`;
//     if (!registeredStrategies.has(strategyName)) {
//       const strategy = new Strategy(
//         {
//           name: strategyName,
//           config,
//           scope: "openid email profile offline_access",
//           callbackURL: `https://${domain}/api/callback`,
//         },
//         verify,
//       );
//       passport.use(strategy);
//       registeredStrategies.add(strategyName);
//     }
//   };

//   passport.serializeUser((user: Express.User, cb) => cb(null, user));
//   passport.deserializeUser((user: Express.User, cb) => cb(null, user));

//   app.get("/api/login", (req, res, next) => {
//     ensureStrategy(req.hostname);
//     passport.authenticate(`replitauth:${req.hostname}`, {
//       prompt: "login consent",
//       scope: ["openid", "email", "profile", "offline_access"],
//     })(req, res, next);
//   });

//   app.get("/api/callback", (req, res, next) => {
//     ensureStrategy(req.hostname);
//     passport.authenticate(`replitauth:${req.hostname}`, {
//       successReturnToOrRedirect: "/",
//       failureRedirect: "/api/login",
//     })(req, res, next);
//   });

//   app.get("/api/logout", (req, res) => {
//     req.logout(() => {
//       res.redirect(
//         client.buildEndSessionUrl(config, {
//           client_id: process.env.REPL_ID!,
//           post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
//         }).href
//       );
//     });
//   });
// }

// export const isAuthenticated: RequestHandler = async (req, res, next) => {
//   const user = req.user as any;

//   if (!req.isAuthenticated() || !user.expires_at) {
//     return res.status(401).json({ message: "Unauthorized" });
//   }

//   const now = Math.floor(Date.now() / 1000);
//   if (now <= user.expires_at) {
//     return next();
//   }

//   const refreshToken = user.refresh_token;
//   if (!refreshToken) {
//     res.status(401).json({ message: "Unauthorized" });
//     return;
//   }

//   try {
//     const config = await getOidcConfig();
//     const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
//     updateUserSession(user, tokenResponse);
//     return next();
//   } catch (error) {
//     res.status(401).json({ message: "Unauthorized" });
//     return;
//   }
// };

// import * as client from "openid-client";
// import { Strategy, type VerifyFunction } from "openid-client/passport";

// import passport from "passport";
// import session from "express-session";
// import type { Express, RequestHandler } from "express";
// import memoize from "memoizee";
// import connectPg from "connect-pg-simple";
// import { storage } from "./storage";

// const getOidcConfig = memoize(
//   async () => {
//     return await client.discovery(
//       new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
//       process.env.REPL_ID!
//     );
//   },
//   { maxAge: 3600 * 1000 }
// );

// export function getSession() {
//   const sessionTtl = 7 * 24 * 60 * 60 * 1000;
//   const pgStore = connectPg(session);
//   const sessionStore = new pgStore({
//     conString: process.env.DATABASE_URL,
//     createTableIfMissing: false,
//     ttl: sessionTtl,
//     tableName: "sessions",
//   });

//   const isProduction = process.env.NODE_ENV === "production";

//   return session({
//     secret: process.env.SESSION_SECRET!,
//     store: sessionStore,
//     resave: false,
//     saveUninitialized: false,
//     cookie: {
//       httpOnly: true,
//       secure: isProduction,
//       maxAge: sessionTtl,
//     },
//   });
// }

// function updateUserSession(
//   user: any,
//   tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
// ) {
//   user.claims = tokens.claims();
//   user.access_token = tokens.access_token;
//   user.refresh_token = tokens.refresh_token;
//   user.expires_at = user.claims?.exp;
// }

// async function upsertUser(claims: any) {
//   await storage.upsertUser({
//     id: claims["sub"],
//     email: claims["email"],
//     firstName: claims["first_name"],
//     lastName: claims["last_name"],
//     profileImageUrl: claims["profile_image_url"],
//   });
// }

// export async function setupAuth(app: Express) {
//   app.set("trust proxy", 1);
//   app.use(getSession());
//   app.use(passport.initialize());
//   app.use(passport.session());

//   const config = await getOidcConfig();

//   const verify: VerifyFunction = async (
//     tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
//     verified: passport.AuthenticateCallback
//   ) => {
//     const user = {};
//     updateUserSession(user, tokens);
//     await upsertUser(tokens.claims());
//     verified(null, user);
//   };

//   const registeredStrategies = new Set<string>();

//   const ensureStrategy = (domain: string) => {
//     const strategyName = `replitauth:${domain}`;
//     if (!registeredStrategies.has(strategyName)) {
//       const strategy = new Strategy(
//         {
//           name: strategyName,
//           config,
//           scope: "openid email profile offline_access",
//           callbackURL: `https://${domain}/api/callback`,
//         },
//         verify,
//       );
//       passport.use(strategy);
//       registeredStrategies.add(strategyName);
//     }
//   };

//   passport.serializeUser((user: Express.User, cb) => cb(null, user));
//   passport.deserializeUser((user: Express.User, cb) => cb(null, user));

//   app.get("/api/login", (req, res, next) => {
//     ensureStrategy(req.hostname);
//     passport.authenticate(`replitauth:${req.hostname}`, {
//       prompt: "login consent",
//       scope: ["openid", "email", "profile", "offline_access"],
//     })(req, res, next);
//   });

//   app.get("/api/callback", (req, res, next) => {
//     ensureStrategy(req.hostname);
//     passport.authenticate(`replitauth:${req.hostname}`, {
//       successReturnToOrRedirect: "/",
//       failureRedirect: "/api/login",
//     })(req, res, next);
//   });

//   app.get("/api/logout", (req, res) => {
//     res.redirect("/");
//   });
// }

// // ── LOCAL DEV BYPASS — replaces Replit Auth middleware ──
// export const isAuthenticated: RequestHandler = (req, res, next) => {
//   req.user = {
//     id: "1",
//     email: "rehaan@test.com",
//     firstName: "Rehaan",
//     lastName: "",
//     profileImageUrl: "",
//     expires_at: Math.floor(Date.now() / 1000) + 3600,
//   } as any;
//   next();
// };

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { storage } from "./storage";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);

  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  const isProduction = process.env.NODE_ENV === "production";

  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      maxAge: sessionTtl,
    },
  });
}

async function upsertUser(profile: any) {
  const email = profile.emails?.[0]?.value;

  if (!email) throw new Error("No email found from Google");

  // 🔥 FIX: check user by email first (prevents duplicate error)
  let existingUser = await storage.getUserByEmail(email);

  if (existingUser) {
    return existingUser;
  }

  return await storage.upsertUser({
    id: `google_${profile.id}`,
    email: email,
    firstName: profile.name?.givenName || "",
    lastName: profile.name?.familyName || "",
    profileImageUrl: profile.photos?.[0]?.value || "",
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: "http://localhost:5001/api/auth/google/callback",
      },
      async (accessToken: string, refreshToken: string , profile: any, done: any ) => {
        try {
          const user = await upsertUser(profile);
          return done(null, user);
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => {
    done(null, user);
  });

  passport.deserializeUser((user: any, done) => {
    done(null, user);
  });

  // 🔥 LOGIN ROUTE
  app.get(
    "/api/auth/google",
    passport.authenticate("google", {
      scope: ["profile", "email"],
      prompt: "select_account", // 🔥 forces account selection every time
    })
  );

  // 🔥 CALLBACK ROUTE
  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", {
      successRedirect: "/",
      failureRedirect: "/login",
    })
  );

  // 🔥 LOGOUT
  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.redirect("/");
      });
    });
  });
}

// 🔥 REAL AUTH CHECK
export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};