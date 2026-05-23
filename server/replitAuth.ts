

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
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
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
// old way 
  // passport.serializeUser((user: any, done) => {
  //   done(null, user);
  // });
  //New Way 
  passport.serializeUser((user: any, done) => {
  done(null, {
    claims: {
      sub: user.id,
    },
    email: user.email,
    firstName: user.firstName,
  });
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