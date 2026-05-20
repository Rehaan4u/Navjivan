import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import { insertSubscriptionSchema } from "@shared/schema";
import { triggerNewsletterGeneration, triggerNewsletterForUser } from "./services/scheduler";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {

  // Auth route
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // ── GET subscription ──
  app.get("/api/subscriptions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const subscription = await storage.getSubscription(userId);
      if (!subscription) {
        return res.status(404).json({ message: "No subscription found" });
      }
      res.json(subscription);
    } catch (error) {
      console.error("Error fetching subscription:", error);
      res.status(500).json({ message: "Failed to fetch subscription" });
    }
  });

  // ── CREATE subscription ──
  app.post("/api/subscriptions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertSubscriptionSchema.parse(req.body);

      const existing = await storage.getSubscription(userId);

      // If subscription exists but is inactive, reactivate it instead of erroring
      if (existing) {
        if (!existing.isActive) {
          const companies = validatedData.companies
            .split(/[,;]/)
            .map((c: string) => c.trim())
            .filter((c: string) => c.length > 0);

          if (companies.length === 0) {
            return res.status(400).json({ message: "At least one company is required" });
          }
          if (companies.length > 3) {
            return res.status(400).json({ message: "Maximum 3 companies allowed" });
          }

          // Reactivate by updating
          const subscription = await storage.updateSubscription(userId, companies.join(", "));
          // Also reactivate the isActive flag
          await storage.reactivateSubscription(userId);
          return res.status(200).json(subscription);
        }
        return res.status(400).json({ message: "Subscription already exists. Use PUT to update." });
      }

      const companies = validatedData.companies
        .split(/[,;]/)
        .map((c: string) => c.trim())
        .filter((c: string) => c.length > 0);

      if (companies.length === 0) {
        return res.status(400).json({ message: "At least one company is required" });
      }
      if (companies.length > 3) {
        return res.status(400).json({ message: "Maximum 3 companies allowed" });
      }

      const subscription = await storage.createSubscription({
        userId,
        companies: companies.join(", "),
        isActive: true,
      });

      res.status(201).json(subscription);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating subscription:", error);
      res.status(500).json({ message: "Failed to create subscription" });
    }
  });

  // ── UPDATE subscription ──
  app.put("/api/subscriptions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertSubscriptionSchema.parse(req.body);

      const companies = validatedData.companies
        .split(/[,;]/)
        .map((c: string) => c.trim())
        .filter((c: string) => c.length > 0);

      if (companies.length === 0) {
        return res.status(400).json({ message: "At least one company is required" });
      }
      if (companies.length > 3) {
        return res.status(400).json({ message: "Maximum 3 companies allowed" });
      }

      const subscription = await storage.updateSubscription(userId, companies.join(", "));
      if (!subscription) {
        return res.status(404).json({ message: "Subscription not found" });
      }

      res.json(subscription);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error updating subscription:", error);
      res.status(500).json({ message: "Failed to update subscription" });
    }
  });

  // ── DELETE (unsubscribe) ──
  app.delete("/api/subscriptions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const subscription = await storage.getSubscription(userId);

      if (!subscription) {
        return res.status(404).json({ message: "No subscription found" });
      }

      await storage.deactivateSubscription(userId);
      console.log(`✅ User ${userId} unsubscribed`);
      res.json({ message: "Unsubscribed successfully" });
    } catch (error) {
      console.error("Error unsubscribing:", error);
      res.status(500).json({ message: "Failed to unsubscribe" });
    }
  });

  // ── Newsletter routes ──
  app.get("/api/newsletters", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const newsletters = await storage.getUserNewsletters(userId);
      res.json(newsletters);
    } catch (error) {
      console.error("Error fetching newsletters:", error);
      res.status(500).json({ message: "Failed to fetch newsletters" });
    }
  });

  app.get("/api/newsletters/:id/articles", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const newsletter = await storage.getNewsletter(id);
      if (!newsletter || newsletter.userId !== userId) {
        return res.status(404).json({ message: "Newsletter not found" });
      }
      const articles = await storage.getNewsletterArticles(id);
      res.json(articles);
    } catch (error) {
      console.error("Error fetching articles:", error);
      res.status(500).json({ message: "Failed to fetch articles" });
    }
  });

  // ── Manual newsletter trigger ──
  app.post("/api/admin/trigger-newsletters", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      // ✅ Block if not subscribed or unsubscribed
      const subscription = await storage.getSubscription(userId);
      if (!subscription || !subscription.isActive) {
        return res.status(403).json({
          message: "No active subscription",
          code: "NOT_SUBSCRIBED",
        });
      }

      console.log(`Manual newsletter generation triggered by user: ${userId}`);
      res.json({ message: "Newsletter generation started", status: "processing" });

      // Fire for this user only — non-blocking
      triggerNewsletterForUser(userId, "manual").catch((error: Error) => {
        console.error("Background newsletter generation failed:", error);
      });
    } catch (error) {
      console.error("Error triggering newsletter:", error);
      res.status(500).json({ message: "Failed to trigger newsletter" });
    }
  });

  // ── Cron trigger ──
  app.post("/api/cron/trigger-newsletters", async (req, res) => {
    try {
      const cronSecret = process.env.CRON_SECRET;
      const providedSecret = req.headers['x-cron-secret'] || req.query.secret;

      if (!cronSecret) {
        return res.status(503).json({ message: "CRON_SECRET not configured" });
      }
      if (providedSecret !== cronSecret) {
        return res.status(401).json({ message: "Unauthorized - invalid secret" });
      }

      const results = await triggerNewsletterGeneration("external");
      res.json({
        message: "Newsletter generation triggered by cron",
        timestamp: new Date().toISOString(),
        results,
      });
    } catch (error) {
      console.error("Error in cron trigger:", error);
      res.status(500).json({ message: "Failed to trigger newsletter generation" });
    }
  });

  // ── Health check ──
  app.get("/api/health/scheduler", async (_req, res) => {
    try {
      const { getSchedulerStatus } = await import("./services/scheduler");
      const status = getSchedulerStatus();
      res.json({
        status: "ok",
        scheduler: status,
        currentTimeUTC: new Date().toISOString(),
        currentTimeIST: new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get scheduler status" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}