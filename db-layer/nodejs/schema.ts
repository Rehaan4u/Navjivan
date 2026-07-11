import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
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

// Session storage table
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table
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

// Subscription table
export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  companies: text("companies").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Access codes table
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

export type InsertSubscription = typeof subscriptions.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;

// Newsletter table
export const newsletters = pgTable("newsletters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subscriptionId: varchar("subscription_id").notNull().references(() => subscriptions.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  companies: text("companies").notNull(),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
  sentAt: timestamp("sent_at"),
  pdfPath: varchar("pdf_path"),
  emailSent: boolean("email_sent").notNull().default(false),
  contentHash: varchar("content_hash"),
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

// Article table
export const articles = pgTable("articles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  newsletterId: varchar("newsletter_id").notNull().references(() => newsletters.id, { onDelete: 'cascade' }),
  headline: text("headline").notNull(),
  summary: text("summary").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceName: varchar("source_name").notNull(),
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

// Scheduler runs table
export const schedulerRuns = pgTable("scheduler_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runDate: timestamp("run_date").notNull(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  status: varchar("status").notNull().default("running"),
  successCount: varchar("success_count").default("0"),
  failureCount: varchar("failure_count").default("0"),
  triggerSource: varchar("trigger_source").notNull(),
  errorMessage: text("error_message"),
});

export type SchedulerRun = typeof schedulerRuns.$inferSelect;