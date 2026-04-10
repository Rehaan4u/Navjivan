// services/feedHealth.ts

interface FeedHealthRecord {
  sourceName: string;
  articleCount: number;
  status: "ok" | "empty" | "error";
  lastChecked: Date;
  errorMessage?: string;
}

// In-memory store (replace with DB later if you want a dashboard)
const feedHealthMap = new Map<string, FeedHealthRecord>();

export function recordFeedHealth(
  sourceName: string,
  articleCount: number,
  errorMessage?: string
) {
  const status = errorMessage ? "error" : articleCount === 0 ? "empty" : "ok";

  feedHealthMap.set(sourceName, {
    sourceName,
    articleCount,
    status,
    lastChecked: new Date(),
    errorMessage,
  });

  // Log immediately so you can see it in console
  const icon = status === "ok" ? "✅" : status === "empty" ? "⚠️" : "❌";
  console.log(
    `[RSS HEALTH] ${icon} ${sourceName}: ${articleCount} articles ${errorMessage ? `| Error: ${errorMessage}` : ""}`
  );
}

export function printFeedHealthSummary() {
  console.log("\n========== RSS FEED HEALTH SUMMARY ==========");

  const all = Array.from(feedHealthMap.values());
  const ok = all.filter((f) => f.status === "ok");
  const empty = all.filter((f) => f.status === "empty");
  const error = all.filter((f) => f.status === "error");

  console.log(`✅ Working feeds (${ok.length}):`);
  ok.forEach((f) => console.log(`   - ${f.sourceName}: ${f.articleCount} articles`));

  console.log(`⚠️  Empty feeds (${empty.length}):`);
  empty.forEach((f) => console.log(`   - ${f.sourceName}: 0 articles`));

  console.log(`❌ Error feeds (${error.length}):`);
  error.forEach((f) => console.log(`   - ${f.sourceName}: ${f.errorMessage}`));

  console.log(`=============================================\n`);
}

export function getFeedHealth(): FeedHealthRecord[] {
  return Array.from(feedHealthMap.values());
}