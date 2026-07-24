import { storage } from "storage";
import { sendNewsletterEmail } from "../server/services/email";
import {
  capArticlesPerSource,
  filterAlreadySentArticles,
  computeContentHash,
} from "../server/services/newsletter";
import type { ArticleSummaryCache } from "../db-layer/nodejs/schema";

const MIN_ARTICLES_PER_COMPANY = 2;
const CANDIDATE_POOL_PER_COMPANY = 4;

interface SQSRecord { body: string; }
interface SQSEvent { Records: SQSRecord[]; }
interface SubscriberJobMessage { subscriptionId: string; }

export const handler = async (event: SQSEvent) => {
  for (const record of event.Records) {
    const { subscriptionId }: SubscriberJobMessage = JSON.parse(record.body);

    try {
      const subscription = await storage.getSubscriptionById(subscriptionId);
      if (!subscription || !subscription.isActive) continue;

      const companies = subscription.companies.split(",").map((c) => c.trim()).filter(Boolean);

      let fresh: ArticleSummaryCache[] = [];
      for (const company of companies) {
        const companyPool = await storage.getCachedSummariesForCompany(company);
        const sorted = companyPool.sort((a, b) => Number(b.relevanceScore) - Number(a.relevanceScore));
        const cappedPerSource = capArticlesPerSource(sorted as any, 3);
        const candidates = cappedPerSource.slice(0, CANDIDATE_POOL_PER_COMPANY);

        const survivors = await filterAlreadySentArticles(candidates as any, subscriptionId);
        const finalForCompany = survivors.slice(0, MIN_ARTICLES_PER_COMPANY);

        if (finalForCompany.length < MIN_ARTICLES_PER_COMPANY) {
          console.warn(
            `[subscriber-assembly] ⚠️ ${company}: only ${finalForCompany.length}/${MIN_ARTICLES_PER_COMPANY} for sub ${subscriptionId} ` +
            `(cache had ${companyPool.length}, ${candidates.length} candidates, ${survivors.length} survived filter)`
          );
        }
        fresh.push(...(finalForCompany as any));
      }

      if (fresh.length === 0) continue;

      const contentHash = computeContentHash(fresh.map((a) => a.sourceUrl));
      const newsletter = await storage.createNewsletter({
        subscriptionId: subscription.id, userId: subscription.userId,
        companies: subscription.companies, contentHash,
      });

      for (const article of fresh) {
        await storage.createArticle({
          newsletterId: newsletter.id, headline: article.headline, summary: article.summary,
          sourceUrl: article.sourceUrl, sourceName: article.sourceName,
          publishedAt: article.publishedAt ?? undefined,
        });
      }

      const user = await storage.getUser(subscription.userId);
      if (!user?.email) continue;

      await sendNewsletterEmail(newsletter.id, user.email);
    } catch (err) {
      console.error(`[subscriber-assembly] failed for ${subscriptionId}:`, err);
      throw err; // let SQS retry → DLQ after maxReceiveCount
    }
  }
};