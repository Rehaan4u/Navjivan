import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import { uniqueIndex } from "drizzle-orm/pg-core";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
  boolean,
  primaryKey
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table - required for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table - required for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Subscription table - stores user newsletter preferences
export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  companies: text("companies").notNull(), // Comma-separated company names (max 3)
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Access codes table - tied to a specific email, used alongside Google auth
export const accessCodes = pgTable("access_codes", {
  code: varchar("code").notNull(),
  email: varchar("email").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.code, table.email] }),
]);

export type AccessCode = typeof accessCodes.$inferSelect;

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
  newsletters: many(newsletters),
}));

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  userId: true, // userId comes from authenticated session, not request body
  createdAt: true,
  updatedAt: true,
}).extend({
  companies: z.string().min(1, "At least one company is required"),
});

export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;

// Newsletter table - stores generated newsletters
export const newsletters = pgTable("newsletters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subscriptionId: varchar("subscription_id").notNull().references(() => subscriptions.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  companies: text("companies").notNull(), // Companies covered in this newsletter
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
  sentAt: timestamp("sent_at"),
  pdfPath: varchar("pdf_path"), // Path to generated PDF file
  emailSent: boolean("email_sent").notNull().default(false),
  contentHash: varchar("content_hash"), // Hash of fetched article URLs for dedup caching
});

export const newslettersRelations = relations(newsletters, ({ one, many }) => ({
  subscription: one(subscriptions, {
    fields: [newsletters.subscriptionId],
    references: [subscriptions.id],
  }),
  user: one(users, {
    fields: [newsletters.userId],
    references: [users.id],
  }),
  articles: many(articles),
}));

export type Newsletter = typeof newsletters.$inferSelect;

// Article table - stores individual news summaries in newsletters
export const articles = pgTable("articles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  newsletterId: varchar("newsletter_id").notNull().references(() => newsletters.id, { onDelete: 'cascade' }),
  headline: text("headline").notNull(),
  summary: text("summary").notNull(), // AI-generated Finshots-style summary
  sourceUrl: text("source_url").notNull(),
  sourceName: varchar("source_name").notNull(), // e.g., "Bloomberg", "PaymentsJournal"
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const articlesRelations = relations(articles, ({ one }) => ({
  newsletter: one(newsletters, {
    fields: [articles.newsletterId],
    references: [newsletters.id],
  }),
}));

export type Article = typeof articles.$inferSelect;

// Scheduler runs table - tracks newsletter generation runs for reliability
export const schedulerRuns = pgTable("scheduler_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runDate: timestamp("run_date").notNull(), // Date of the run (normalized to start of day)
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  status: varchar("status").notNull().default("running"), // running, completed, failed
  successCount: varchar("success_count").default("0"),
  failureCount: varchar("failure_count").default("0"),
  triggerSource: varchar("trigger_source").notNull(), // cron, manual, startup, external
  errorMessage: text("error_message"),
});

export type SchedulerRun = typeof schedulerRuns.$inferSelect;

export const articleSummaryCache = pgTable(
  "article_summary_cache",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    company: varchar("company").notNull(),
    sourceUrl: text("source_url").notNull(),
    headline: text("headline").notNull(),
    summary: text("summary").notNull(),
    sourceName: varchar("source_name").notNull(),
    relevanceScore: varchar("relevance_score"),
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_cache_company_url").on(table.company, table.sourceUrl),
  ],
);

export type ArticleSummaryCache = typeof articleSummaryCache.$inferSelect;
