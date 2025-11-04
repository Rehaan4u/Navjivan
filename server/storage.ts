// From javascript_log_in_with_replit and javascript_database integrations
import {
  users,
  subscriptions,
  newsletters,
  articles,
  type User,
  type UpsertUser,
  type Subscription,
  type InsertSubscription,
  type Newsletter,
  type Article,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Subscription operations
  getSubscription(userId: string): Promise<Subscription | undefined>;
  createSubscription(subscription: InsertSubscription & { userId: string }): Promise<Subscription>;
  updateSubscription(userId: string, companies: string): Promise<Subscription>;
  getAllActiveSubscriptions(): Promise<Subscription[]>;

  // Newsletter operations
  createNewsletter(data: {
    subscriptionId: string;
    userId: string;
    companies: string;
  }): Promise<Newsletter>;
  updateNewsletterPdf(id: string, pdfPath: string): Promise<void>;
  markNewsletterSent(id: string): Promise<void>;
  getUserNewsletters(userId: string): Promise<Newsletter[]>;
  getNewsletter(id: string): Promise<Newsletter | undefined>;

  // Article operations
  createArticle(article: {
    newsletterId: string;
    headline: string;
    summary: string;
    sourceUrl: string;
    sourceName: string;
    publishedAt?: Date;
  }): Promise<Article>;
  getNewsletterArticles(newsletterId: string): Promise<Article[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Subscription operations
  async getSubscription(userId: string): Promise<Subscription | undefined> {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.isActive, true)
      ))
      .limit(1);
    return subscription;
  }

  async createSubscription(data: InsertSubscription & { userId: string }): Promise<Subscription> {
    const [subscription] = await db
      .insert(subscriptions)
      .values(data)
      .returning();
    return subscription;
  }

  async updateSubscription(userId: string, companies: string): Promise<Subscription> {
    const [subscription] = await db
      .update(subscriptions)
      .set({ companies, updatedAt: new Date() })
      .where(and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.isActive, true)
      ))
      .returning();
    return subscription;
  }

  async getAllActiveSubscriptions(): Promise<Subscription[]> {
    return await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.isActive, true));
  }

  // Newsletter operations
  async createNewsletter(data: {
    subscriptionId: string;
    userId: string;
    companies: string;
  }): Promise<Newsletter> {
    const [newsletter] = await db
      .insert(newsletters)
      .values(data)
      .returning();
    return newsletter;
  }

  async updateNewsletterPdf(id: string, pdfPath: string): Promise<void> {
    await db
      .update(newsletters)
      .set({ pdfPath })
      .where(eq(newsletters.id, id));
  }

  async markNewsletterSent(id: string): Promise<void> {
    await db
      .update(newsletters)
      .set({ emailSent: true, sentAt: new Date() })
      .where(eq(newsletters.id, id));
  }

  async getUserNewsletters(userId: string): Promise<Newsletter[]> {
    return await db
      .select()
      .from(newsletters)
      .where(eq(newsletters.userId, userId))
      .orderBy(desc(newsletters.generatedAt))
      .limit(50); // Limit to last 50 newsletters
  }

  async getNewsletter(id: string): Promise<Newsletter | undefined> {
    const [newsletter] = await db
      .select()
      .from(newsletters)
      .where(eq(newsletters.id, id))
      .limit(1);
    return newsletter;
  }

  // Article operations
  async createArticle(article: {
    newsletterId: string;
    headline: string;
    summary: string;
    sourceUrl: string;
    sourceName: string;
    publishedAt?: Date;
  }): Promise<Article> {
    const [createdArticle] = await db
      .insert(articles)
      .values(article)
      .returning();
    return createdArticle;
  }

  async getNewsletterArticles(newsletterId: string): Promise<Article[]> {
    return await db
      .select()
      .from(articles)
      .where(eq(articles.newsletterId, newsletterId))
      .orderBy(desc(articles.publishedAt));
  }
}

export const storage = new DatabaseStorage();
