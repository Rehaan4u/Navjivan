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
  await setupAuth(app);

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

  // Manual trigger endpoint (for testing)
  app.post("/api/admin/trigger-newsletters", isAuthenticated, async (req: any, res) => {
    try {
      console.log("Manual newsletter generation triggered");
      const results = await triggerNewsletterGeneration();
      res.json({
        message: "Newsletter generation triggered",
        results,
      });
    } catch (error) {
      console.error("Error triggering newsletters:", error);
      res.status(500).json({ message: "Failed to trigger newsletter generation" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
