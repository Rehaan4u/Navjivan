import pLimit from "p-limit";
import pRetry, { AbortError } from "p-retry";

// ============================
// CORE API CALLER
// ============================
async function invokeClause(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 120
): Promise<string> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ============================
// RATE LIMIT HELPERS
// ============================
function isRateLimitError(error: any): boolean {
  const msg = error?.message || String(error);
  return (
    msg.includes("429") ||
    msg.includes("ThrottlingException") ||
    msg.toLowerCase().includes("too many requests") ||
    msg.toLowerCase().includes("rate limit")
  );
}

// ── Parse the "Please try again in Xm Ys" message from Groq ──
// When Groq rate limits you, it tells you exactly how long to wait.
// We extract that number so we can sleep the right amount instead
// of blindly retrying after 1-10 seconds (which always fails again).
function parseRetryAfterMs(errorMessage: string): number {
  // Pattern: "Please try again in 3m40.32s" or "try again in 45.5s"
  const minuteMatch = errorMessage.match(/(\d+)m(\d+(?:\.\d+)?)s/);
  if (minuteMatch) {
    const minutes = parseInt(minuteMatch[1]);
    const seconds = parseFloat(minuteMatch[2]);
    return (minutes * 60 + seconds) * 1000 + 2000; // +2s buffer
  }

  const secondMatch = errorMessage.match(/(\d+(?:\.\d+)?)s/);
  if (secondMatch) {
    return parseFloat(secondMatch[1]) * 1000 + 2000;
  }

  // Groq didn't tell us — wait 60 seconds as a safe default
  return 60_000;
}

// ============================
// GENERATE HEADLINE + SUMMARY
// ============================
export async function generateNewsSummary(
  newsText: string,
  company: string
): Promise<{ headline: string; summary: string }> {

  const systemPrompt = `You are a sharp, witty cloud industry journalist writing for engineers and cloud professionals. You blend deep technical insight with punchy, memorable writing. Your headlines make people stop scrolling. Your summaries make people feel genuinely smarter.`;

  // ✅ Shortened prompt — same output quality, ~220 fewer tokens per call
  // At 6 articles/run = ~1,300 tokens saved per day (~10% of free tier back)
  const userPrompt = `Write a newsletter article about ${company} from this news:

${newsText}

Return ONLY valid JSON, no extra text:
{
  "headline": "<witty question under 12 words e.g. 'Is AWS Finally Killing On-Premise?'>",
  "summary": "<3 paragraphs joined by ||PARA|| no newlines. Para1: emoji + hook + what happened + why it matters. Para2: industry impact, who wins/loses, what changes for engineers. Para3: what a junior cloud engineer should learn or do. 4-5 sentences each.>"
}`;

  try {
    const result = await pRetry(
      async () => {
        try {
          const content = await invokeClause(systemPrompt, userPrompt, 1200);

          // Robust JSON extraction
          const jsonMatch = content
            .replace(/```json\n?/g, "")
            .replace(/```\n?/g, "")
            .trim()
            .match(/\{[\s\S]*\}/);

          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed.headline && parsed.summary) return parsed;
            } catch {
              // fall through to regex
            }
          }

          // Regex fallback
          const headlineMatch = content.match(/"headline"\s*:\s*"([^"]+)"/);
          const summaryMatch = content.match(/"summary"\s*:\s*"([\s\S]+?)"\s*\}/);
          return {
            headline: headlineMatch?.[1] || `What's Next for ${company}?`,
            summary: summaryMatch?.[1] || newsText.slice(0, 300) + "...",
          };

        } catch (error: any) {
          if (isRateLimitError(error)) {
            // ✅ Wait exactly as long as Groq tells us to
            const waitMs = parseRetryAfterMs(error.message);
            console.warn(`[GROQ] Rate limited on summary. Waiting ${Math.round(waitMs / 1000)}s...`);
            await new Promise(resolve => setTimeout(resolve, waitMs));
            throw error; // rethrow so pRetry retries after the wait
          }
          throw new AbortError(error); // non-rate-limit errors → stop retrying
        }
      },
      {
        retries: 5,
        // These timeouts are only used if parseRetryAfterMs fails to parse
        // In practice, the manual sleep above fires first
        minTimeout: 5000,
        maxTimeout: 300_000, // 5 min max
        factor: 2,
      }
    );

    return result;
  } catch (error) {
    console.error("Error generating summary:", error);
    return {
      headline: `What's New at ${company}?`,
      summary: newsText.slice(0, 200) + "...",
    };
  }
}

// ============================
// SCORE ARTICLE RELEVANCE
// ──────────────────────────────────────────────────────────
// BEFORE: sent 800 chars of article text per score request
//         → 56 articles × ~300 tokens = ~16,800 tokens just for scoring
//         → blows through 100k/day free tier before summaries even run
//
// FIX: send only title + first 60 words
//         → ~30 tokens per score request
//         → 56 articles × 30 = ~1,680 tokens for scoring
//         → leaves ~98k tokens for the actual summaries (what matters)
//
// The title + opening sentence is enough to judge relevance.
// We don't need the full article body to know if something is about AWS.
// ============================
export async function scoreArticleRelevance(
  title: string,
  text: string,
  company: string
): Promise<number> {

  // ✅ Only send title + first 60 words — enough to judge relevance
  // 60 words ≈ 80 tokens, vs 800 chars ≈ 200 tokens previously
  const first60Words = text.trim().split(/\s+/).slice(0, 60).join(" ");
  const snippet = first60Words ? `\n\nOpening: ${first60Words}` : "";

  const systemPrompt = `You are a relevance scoring AI. Always respond with valid JSON only. No explanation.`;

  const userPrompt = `Score relevance of this article to "${company}" (0-100).

Rules:
- "${company}" not mentioned anywhere → 0-25
- Mentioned briefly or in passing → 26-50
- Substantially about "${company}" → 51-85
- Primarily about "${company}" with major impact → 86-100

Title: ${title}${snippet}

Return: {"score": <integer>}`;

  try {
    const score = await pRetry(
      async () => {
        try {
          const content = await invokeClause(systemPrompt, userPrompt, 50);
          const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          const parsed = JSON.parse(cleaned);
          return parsed.score ?? 50;
        } catch (error: any) {
          if (isRateLimitError(error)) {
            // ✅ Same fix as summary — wait the actual time Groq specifies
            const waitMs = parseRetryAfterMs(error.message);
            console.warn(`[GROQ] Rate limited on scoring. Waiting ${Math.round(waitMs / 1000)}s...`);
            await new Promise(resolve => setTimeout(resolve, waitMs));
            throw error;
          }
          throw new AbortError(error);
        }
      },
      {
        retries: 3,
        minTimeout: 5000,
        maxTimeout: 300_000,
        factor: 2,
      }
    );

    return Math.max(0, Math.min(100, score));

  } catch (error) {
    // ✅ CHANGED: return 0 instead of 50 on total failure
    // Returning 50 was silently failing everything — articles appeared irrelevant
    // when really Groq just timed out. 0 makes the failure visible in logs
    // and lets you distinguish "truly irrelevant" from "API failed".
    // The keyword filter (Step 3 in newsletter.ts) already pre-filtered these,
    // so a 0 here just means "couldn't confirm relevance" not "definitely irrelevant".
    console.error(`[GROQ] Scoring totally failed for "${title.slice(0, 50)}":`, error);
    return 0;
  }
}

// ============================
// BATCH SUMMARIES
// ============================
export async function batchGenerateSummaries(
  newsItems: Array<{ text: string; company: string }>
): Promise<Array<{ headline: string; summary: string }>> {
  const limit = pLimit(2);
  return Promise.all(
    newsItems.map((item) => limit(() => generateNewsSummary(item.text, item.company)))
  );
}