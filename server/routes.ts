// From javascript_log_in_with_replit integration
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertSubscriptionSchema } from "@shared/schema";
import { triggerNewsletterGeneration } from "./services/scheduler";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  //Temporarily stopped the authentication
  //await setupAuth(app);

  // Auth routes
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

  // Subscription routes
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

  app.post("/api/subscriptions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      // Validate request body
      const validatedData = insertSubscriptionSchema.parse(req.body);

      // Check if subscription already exists
      const existing = await storage.getSubscription(userId);
      if (existing) {
        return res.status(400).json({ message: "Subscription already exists. Use PUT to update." });
      }

      // Validate company count
      const companies = validatedData.companies
        .split(/[,;]/)
        .map(c => c.trim())
        .filter(c => c.length > 0);

      if (companies.length === 0) {
        return res.status(400).json({ message: "At least one company is required" });
      }

      if (companies.length > 3) {
        return res.status(400).json({ message: "Maximum 3 companies allowed" });
      }

      // Create subscription
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

  app.put("/api/subscriptions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      // Validate request body
      const validatedData = insertSubscriptionSchema.parse(req.body);

      // Validate company count
      const companies = validatedData.companies
        .split(/[,;]/)
        .map(c => c.trim())
        .filter(c => c.length > 0);

      if (companies.length === 0) {
        return res.status(400).json({ message: "At least one company is required" });
      }

      if (companies.length > 3) {
        return res.status(400).json({ message: "Maximum 3 companies allowed" });
      }

      // Update subscription
      const subscription = await storage.updateSubscription(
        userId,
        companies.join(", ")
      );

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

  // Newsletter routes
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

      // Verify the newsletter belongs to this user
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

  // Manual trigger endpoint (authenticated - for dashboard use)
  app.post("/api/admin/trigger-newsletters", isAuthenticated, async (req: any, res) => {
    console.log("Manual newsletter generation triggered by user");
    // Return immediately — do not await
    res.json({ message: "Newsletter generation started", status: "processing" });
    // Run in background
    triggerNewsletterGeneration("manual").catch(error => {
      console.error("Background newsletter generation failed:", error);
    });
  });

  // Cron trigger endpoint (for external cron services like Replit Cron)
  // This endpoint uses a secret token instead of user authentication
  app.post("/api/cron/trigger-newsletters", async (req, res) => {
    try {
      // Verify cron secret token
      const cronSecret = process.env.CRON_SECRET;
      const providedSecret = req.headers['x-cron-secret'] || req.query.secret;
      
      if (!cronSecret) {
        console.error("❌ CRON_SECRET not configured");
        return res.status(503).json({ 
          message: "Cron endpoint not configured",
          error: "CRON_SECRET environment variable is required" 
        });
      }
      
      if (providedSecret !== cronSecret) {
        console.error("❌ Invalid cron secret provided");
        return res.status(401).json({ message: "Unauthorized - invalid secret" });
      }
      
      console.log("✅ Cron trigger authenticated - starting newsletter generation");
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

  // Health check endpoint for scheduler status
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
      console.error("Error getting scheduler status:", error);
      res.status(500).json({ message: "Failed to get scheduler status" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
