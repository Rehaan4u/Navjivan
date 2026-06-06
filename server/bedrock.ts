import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import pLimit from "p-limit";
import pRetry, { AbortError } from "p-retry";

// ── Bedrock Client — uses Lambda/EC2 IAM role automatically ──
const bedrock = new BedrockRuntimeClient({
  region: "ap-south-2",
});

// ── Model IDs ──
// Claude Haiku — fast, cheap, great for summaries
const SUMMARY_MODEL = "ap.anthropic.claude-haiku-4-5-20251001-v1:0";
// Amazon Titan — fast, very cheap, great for scoring
const SCORING_MODEL = "ap.anthropic.claude-haiku-4-5-20251001-v1:0";

// ── Helper: call Bedrock with Claude model ──
async function invokeClause(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 800
): Promise<string> {
  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: userPrompt,
      },
    ],
  });

  const command = new InvokeModelCommand({
    modelId: SUMMARY_MODEL,
    contentType: "application/json",
    accept: "application/json",
    body: Buffer.from(body),
  });

  const response = await bedrock.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.body));
  return result.content[0].text;
}

// ── Helper: check if error is throttling/rate limit ──
function isRateLimitError(error: any): boolean {
  const errorMsg = error?.message || String(error);
  return (
    errorMsg.includes("429") ||
    errorMsg.includes("ThrottlingException") ||
    errorMsg.toLowerCase().includes("too many requests") ||
    errorMsg.toLowerCase().includes("rate limit")
  );
}

// ── Generate headline + summary for a news article ──
export async function generateNewsSummary(
  newsText: string,
  company: string
): Promise<{ headline: string; summary: string }> {

  const systemPrompt = `You are a master financial storyteller — part Bloomberg analyst, part Hemingway. You write payment industry news in a narrative style that draws readers in like a novel. Your writing is precise but never dry, insightful but never verbose. Every summary should feel like a mini-story with a beginning (what happened), a middle (why it matters), and an end (what comes next). Use vivid but professional language. Never use bullet points. Never sound like a press release.`;

  const userPrompt = `Write a deep narrative news brief about ${company} for payments industry professionals based on this article:

${newsText}

You are writing for senior payments executives who want to be fully informed — not just what happened, but WHY it happened, WHAT forces led to it, and WHAT it means for the future.

Rules:
- Write 6-8 sentences as one flowing, immersive paragraph
- Opening: Hook the reader — set the scene, create context, make them feel the significance. Never start with "${company} announced" or "${company} said"
- Middle: Explain WHY this happened — what market forces, competitive pressures, or strategic logic drove this decision. Make the reader feel like an insider
- Industry impact: Weave in naturally what this means for payments professionals, merchants, banks, or consumers
- Closing: A forward-looking insight — what should the reader watch for? What does this signal about where the industry is heading?
- Tone: Authoritative, warm, slightly literary — like a brilliant FT Weekend long-read condensed into one perfect paragraph
- Word count: 150-200 words for the summary — substantial enough to fully inform, tight enough to read in 60 seconds
- Start with one relevant emoji that captures the story's essence
- NO bullet points, NO headers, NO "In conclusion", NO clichés like "game-changer" or "revolutionary"
- Write in a way that makes the reader feel genuinely wiser after reading it

Return ONLY this JSON, nothing else before or after it:
{"headline": "your headline here max 10 words", "summary": "your full narrative paragraph here starting with emoji"}`;

  try {
    const response = await pRetry(
      async () => {
        try {
          const content = await invokeClause(systemPrompt, userPrompt, 800);

          // ── Parse JSON from response ──
          const headlineMatch = content.match(/"headline"\s*:\s*"([^"]+)"/);
          const summaryMatch = content.match(
            /"summary"\s*:\s*"([\s\S]+?)"\s*\n?\s*\}/
          );

          // Fallback if regex fails
          const summaryFallback = content
            .replace(/[\s\S]*"summary"\s*:\s*/, "")
            .replace(/^"/, "")
            .replace(/"?\s*\}?\s*$/, "")
            .trim();

          return {
            headline: headlineMatch?.[1] || "Payments Industry Update",
            summary:
              summaryMatch?.[1] || summaryFallback || content.slice(0, 500),
          };
        } catch (error: any) {
          if (isRateLimitError(error)) {
            throw error; // retry on rate limit
          }
          throw new AbortError(error); // don't retry other errors
        }
      },
      {
        retries: 7,
        minTimeout: 2000,
        maxTimeout: 128000,
        factor: 2,
      }
    );

    return response;
  } catch (error) {
    console.error("Error generating summary:", error);
    return {
      headline: "Update from " + company,
      summary: newsText.slice(0, 200) + "...",
    };
  }
}

// ── Score how relevant an article is to a company (0-100) ──
export async function scoreArticleRelevance(
  title: string,
  text: string,
  company: string
): Promise<number> {
  const maxTextLength = 1000;
  const truncatedText =
    text.length > maxTextLength
      ? text.substring(0, maxTextLength) + "..."
      : text;

  const systemPrompt = `You are an AI analyst. Always respond with valid JSON only.`;

  const userPrompt = `You are an AI analyst for the payments industry. Score this article's relevance to the company "${company}".

Article Title: ${title}
Article Text: ${truncatedText}

Scoring rules — apply ALL of these:
1. If the article does NOT mention "${company}" by name anywhere → score must be 0-25 maximum, no exceptions
2. If the article mentions "${company}" but only briefly or in passing → score 26-50
3. If the article is substantially about "${company}" and payments/fintech → score 51-85
4. If the article is directly and primarily about "${company}" with significant payments impact → score 86-100

The company name check is STRICT — if "${company}" does not appear in the title or text, the score cannot exceed 25 regardless of how relevant the payments content is.

Return ONLY a JSON object with a single "score" field containing an integer from 0-100.`;

  try {
    const response = await pRetry(
      async () => {
        try {
          const content = await invokeClause(systemPrompt, userPrompt, 50);
          const parsed = JSON.parse(content);
          return parsed.score || 50;
        } catch (error: any) {
          if (isRateLimitError(error)) {
            throw error;
          }
          throw new AbortError(error);
        }
      },
      {
        retries: 3,
        minTimeout: 1000,
        maxTimeout: 10000,
        factor: 2,
      }
    );

    return Math.max(0, Math.min(100, response));
  } catch (error) {
    console.error("Error scoring article relevance:", error);
    return 50;
  }
}

// ── Batch process multiple articles with concurrency limit ──
export async function batchGenerateSummaries(
  newsItems: Array<{ text: string; company: string }>
): Promise<Array<{ headline: string; summary: string }>> {
  const limit = pLimit(2); // max 2 concurrent Bedrock calls
  const promises = newsItems.map((item) =>
    limit(() => generateNewsSummary(item.text, item.company))
  );
  return await Promise.all(promises);
}