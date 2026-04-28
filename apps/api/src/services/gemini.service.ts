import { GoogleGenAI, Type } from "@google/genai";
import { logger } from "../lib/logger.js";

const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiModel = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

const ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

const SNIPPET_MAX_CHARS = 420;
const TOP_RESULTS_PER_RUN = 5;
const QUERY_SIMILARITY_THRESHOLD = 0.6;

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "have",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "was",
  "were",
  "with",
  "this",
  "these",
  "those",
  "what",
  "when",
  "where",
  "which",
  "who",
  "how",
  "why",
  "about",
  "into",
  "over",
  "under",
  "vs",
  "versus",
  "latest",
  "new",
  "best",
  "top",
  "current",
  "state",
  "success",
  "stories",
  "tools"
]);

const GENERIC_REFINEMENT_PHRASES = [
  "current state",
  "success stories",
  "case studies",
  "new tools",
  "emerging tools",
  "latest tools",
  "market overview",
  "industry overview",
  "platforms",
  "tools"
];

export interface GeminiResearchPlanItem {
  order: number;
  query: string;
}

export interface FinalReportRunInput {
  order: number;
  query: string;
  resultCount: number;
  results: Array<{
    title: string;
    url: string;
    snippet: string;
    source: string;
    rank: number;
  }>;
}

export interface GeminiWeakSection {
  order: number;
  query: string;
  reason: string;
  refinedQuery: string;
}

export interface GeminiEvaluationResult {
  needsRefinement: boolean;
  weakSections: GeminiWeakSection[];
}

const truncateSnippet = (snippet: string): string => {
  const normalized = snippet.trim().replace(/\s+/g, " ");

  if (normalized.length <= SNIPPET_MAX_CHARS) {
    return normalized;
  }

  return `${normalized.slice(0, SNIPPET_MAX_CHARS - 1).trimEnd()}…`;
};

const tokenizeQuery = (query: string): Set<string> => {
  const tokens = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));

  return new Set(tokens);
};

const jaccardSimilarity = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 || b.size === 0) {
    return 0;
  }

  let intersectionSize = 0;
  for (const token of a) {
    if (b.has(token)) {
      intersectionSize += 1;
    }
  }

  const unionSize = a.size + b.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
};

const dedupeQueries = (queries: string[]): string[] => {
  const kept: Array<{ query: string; tokens: Set<string> }> = [];

  for (const query of queries) {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      continue;
    }

    const tokens = tokenizeQuery(normalizedQuery);

    if (tokens.size === 0) {
      continue;
    }

    const isDuplicate = kept.some(
      (existing) => jaccardSimilarity(tokens, existing.tokens) >= QUERY_SIMILARITY_THRESHOLD
    );

    if (!isDuplicate) {
      kept.push({ query: normalizedQuery, tokens });
    } else {
      logger.info({ dropped: normalizedQuery }, "Dropped near-duplicate query");
    }
  }

  return kept.map((item) => item.query);
};

const isGenericRefinement = (query: string): boolean => {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  if (GENERIC_REFINEMENT_PHRASES.some((phrase) => normalized.includes(phrase))) {
    return true;
  }

  const tokens = tokenizeQuery(normalized);
  return tokens.size < 3;
};

const buildGenericFallbackQueries = (task: string): GeminiResearchPlanItem[] => {
  const normalizedTask = task.trim();

  return [
    { order: 1, query: `${normalizedTask} current state` },
    { order: 2, query: `${normalizedTask} 2026 developments` },
    { order: 3, query: `${normalizedTask} competitors alternatives` },
    { order: 4, query: `${normalizedTask} adoption case studies` }
  ];
};

const buildFallbackRefinedQuery = (query: string, reason: string): string => {
  const normalizedReason = reason.toLowerCase();

  if (normalizedReason.includes("thin") || normalizedReason.includes("shallow")) {
    return `${query} enterprise deployment`;
  }

  if (normalizedReason.includes("repetitive") || normalizedReason.includes("overlap")) {
    return `${query} compliance architecture`;
  }

  if (normalizedReason.includes("off-topic")) {
    return `${query} enterprise software teams`;
  }

  return `${query} deployment architecture`;
};

const buildFallbackEvaluation = (
  runs: FinalReportRunInput[]
): GeminiEvaluationResult => {
  const weakSections = runs
    .filter((run) => run.resultCount < 3 || run.results.length === 0)
    .slice(0, 2)
    .map((run) => ({
      order: run.order,
      query: run.query,
      reason:
        run.results.length === 0
          ? "No usable search results returned."
          : "Coverage is thin and does not support a strong section.",
      refinedQuery: buildFallbackRefinedQuery(
        run.query,
        run.results.length === 0
          ? "No usable search results returned."
          : "Coverage is thin and does not support a strong section."
      )
    }));

  return {
    needsRefinement: weakSections.length > 0,
    weakSections
  };
};

const buildFallbackFinalReport = (
  task: string,
  runs: FinalReportRunInput[]
): string => {
  const usableRuns = runs
    .map((run) => ({ run, top: run.results[0] }))
    .filter((entry): entry is { run: FinalReportRunInput; top: FinalReportRunInput["results"][number] } =>
      entry.top !== undefined
    );

  const topSignals = usableRuns
    .slice(0, 4)
    .map(
      ({ run, top }) =>
        `On ${run.query.toLowerCase()}, the clearest signal comes from ${top.source}: ${truncateSnippet(top.snippet)}`
    );

  const opening = usableRuns.length
    ? `The picture on ${task.toLowerCase()} is partial, but a few things are clear enough to act on. The search threads that returned usable material point in a consistent direction, even if the underlying evidence is thinner than it should be for a confident call.`
    : `The available material on ${task.toLowerCase()} is too thin for a confident reading. What follows is a preliminary sketch.`;

  const body = topSignals.length
    ? topSignals.join(" ")
    : "None of the search threads returned enough to build a real argument on. Treat the surrounding context as provisional.";

  const close = usableRuns.length
    ? "The honest read is that this brief is running on partial evidence. Tighten the weakest threads before making any decision that depends on them."
    : "Better to rerun this with stronger queries than to act on what is here.";

  return humanizeReport(
    [
      "# Working Sketch On Partial Evidence",
      "",
      opening,
      "",
      body,
      "",
      close
    ].join("\n")
  );
};

// Deterministic post-processing pass. Flash is smart enough to think but
// reaches for thesaurus words and stock transitions under pressure. This
// strips the tells before the brief is returned to the user.
//
// Rules are scoped carefully: word-boundary matches only, sentence-start
// matches use a lookbehind for period+space or line-start, and we never
// touch anything inside fenced code blocks.
const humanizeReport = (text: string): string => {
  if (!text) {
    return text;
  }

  // Protect any fenced code blocks from substitution, restore at the end.
  const codeBlocks: string[] = [];
  let working = text.replace(/```[\s\S]*?```/g, (match) => {
    const placeholder = `\u0000CODEBLOCK${codeBlocks.length}\u0000`;
    codeBlocks.push(match);
    return placeholder;
  });

  // 1. Phrases to delete outright. Includes trailing comma+space where natural.
  const deletePhrases: RegExp[] = [
    /\bit is worth noting that\s+/gi,
    /\bit is important to note that\s+/gi,
    /\bit is important to\s+/gi,
    /\bit should be noted that\s+/gi,
    /\bit goes without saying that\s+/gi,
    /\bneedless to say,?\s+/gi,
    /\bin today's (?:landscape|world|market|environment),?\s+/gi,
    /\bin the rapidly evolving (?:landscape|world|market|space),?\s+/gi,
    /\bin an ever-changing (?:landscape|world|market),?\s+/gi,
    /\bin conclusion,?\s+/gi,
    /\bin summary,?\s+/gi,
    /\bto summarize,?\s+/gi,
    /\bat the end of the day,?\s+/gi,
    /\bwhen all is said and done,?\s+/gi,
    // Sentence-opener fillers
    /(?:^|(?<=\.\s))(?:Certainly|Indeed|Notably|Interestingly|Importantly|Crucially|Ultimately),?\s+/g,
    /(?:^|(?<=\.\s))Of course,?\s+/g,
    /(?:^|(?<=\.\s))Furthermore,?\s+/g,
    /(?:^|(?<=\.\s))Moreover,?\s+/g,
    /(?:^|(?<=\.\s))Additionally,?\s+/g
  ];

  for (const pattern of deletePhrases) {
    working = working.replace(pattern, "");
  }

  // 2. Word and phrase replacements. Case-insensitive, word-boundaried.
  type Replacer = string | ((match: string, ...groups: string[]) => string);
  const replacements: Array<[RegExp, Replacer]> = [
    [/\bnascent\b/gi, "new"],
    [/\bsprawling\b/gi, "broad"],
    [/\bprofoundly\b/gi, "deeply"],
    [/\brecalibrating\b/gi, "shifting"],
    [/\bmyriad\b/gi, "many"],
    [/\bplethora of\b/gi, "many"],
    [/\btapestry\b/gi, "mix"],
    [/\brealm\b/gi, "area"],
    [/\bcrucible\b/gi, "test"],
    [/\bparamount\b/gi, "critical"],
    [/\bleverage\b/gi, "use"],
    [/\bleveraging\b/gi, "using"],
    [/\bleveraged\b/gi, "used"],
    [/\bdelve into\b/gi, "examine"],
    [/\bdelves into\b/gi, "examines"],
    [/\bdelving into\b/gi, "examining"],
    [/\bnavigate the\b/gi, "handle the"],
    [/\bnavigating the\b/gi, "handling the"],
    [/\brobust\b/gi, "solid"],
    [/\bseamless\b/gi, "smooth"],
    [/\bseamlessly\b/gi, "smoothly"],
    [/\bcutting-edge\b/gi, "new"],
    [/\bstate-of-the-art\b/gi, "new"],
    [/\btransformative\b/gi, "major"],
    [/\brevolutionize\b/gi, "change"],
    [/\brevolutionizes\b/gi, "changes"],
    [/\brevolutionizing\b/gi, "changing"],
    [/\bunlock(s|ed|ing)?\b/gi, (_match: string, suffix?: string) => `enable${suffix ?? "s"}`],
    [/\bempower(s|ed|ing)?\b/gi, (_match: string, suffix?: string) => {
      if (suffix === "ed") return "helped";
      if (suffix === "ing") return "helping";
      if (suffix === "s") return "helps";
      return "help";
    }],
    [/\bplays? a crucial role in\b/gi, "matters for"],
    [/\bplays? a pivotal role in\b/gi, "matters for"],
    [/\bat the forefront of\b/gi, "leading"],
    [/\bgame-changer\b/gi, "shift"],
    [/\bgame-changing\b/gi, "major"],
    [/\bparadigm shift\b/gi, "shift"],
    [/\ba testament to\b/gi, "evidence of"],
    // Intensifier cleanup
    [/\bvery\s+/gi, ""],
    [/\bhighly\s+/gi, ""],
    [/\bsignificantly\s+/gi, ""],
    [/\brapidly\s+/gi, ""],
    [/\bquite\s+/gi, ""],
    // The landscape metaphor, as a last-line defense
    [/\bthe (enterprise|market|competitive|technology|industry|current|evolving|broader|entire) landscape\b/gi, "the $1 picture"],
    [/\bthe landscape of\b/gi, "the shape of"]
  ];

  for (const [pattern, replacement] of replacements) {
    if (typeof replacement === "string") {
      working = working.replace(pattern, replacement);
    } else {
      working = working.replace(pattern, replacement);
    }
  }

  // 3. Strip markdown italic-for-emphasis *word* patterns Flash loves.
  // Only single asterisks around 1-2 words, preserving bold (**word**) and
  // longer italic spans that might be legitimate.
  working = working.replace(/(?<!\*)\*([A-Za-z][A-Za-z -]{1,20}[A-Za-z])\*(?!\*)/g, "$1");

  // 4. Fix spacing artifacts from deletions.
  working = working.replace(/ {2,}/g, " ");
  working = working.replace(/\s+([,.;:!?])/g, "$1");
  working = working.replace(/\(\s+/g, "(");
  working = working.replace(/\s+\)/g, ")");

  // 5. Capitalize first letter of any sentence we may have lowercased by
  // deleting its opener. Also handles start of the document.
  working = working.replace(
    /(^|[.!?]\s+)([a-z])/g,
    (_, boundary: string, letter: string) => `${boundary}${letter.toUpperCase()}`
  );

  // 6. Collapse any blank-line runs we may have introduced.
  working = working.replace(/\n{3,}/g, "\n\n");

  // Restore code blocks.
  working = working.replace(/\u0000CODEBLOCK(\d+)\u0000/g, (_, idxStr: string) => {
    const idx = Number(idxStr);
    return codeBlocks[idx] ?? "";
  });

  return working.trim();
};

const formatRunsForPrompt = (runs: FinalReportRunInput[]) =>
  runs.map((run) => ({
    order: run.order,
    query: run.query,
    resultCount: run.resultCount,
    topResults: run.results.slice(0, TOP_RESULTS_PER_RUN).map((result) => ({
      title: result.title,
      url: result.url,
      snippet: truncateSnippet(result.snippet),
      source: result.source,
      rank: result.rank
    }))
  }));

export const generateResearchPlanWithGemini = async (
  task: string
): Promise<GeminiResearchPlanItem[]> => {
  const normalizedTask = task.trim();

  if (!normalizedTask) {
    throw new Error("Task is required to generate a research plan");
  }

  if (!ai) {
    logger.warn("GEMINI_API_KEY missing, using fallback research plan");
    return buildGenericFallbackQueries(normalizedTask);
  }

  logger.info({ model: geminiModel, task: normalizedTask }, "Generating research plan with Gemini");

  const today = new Date().toISOString().split("T")[0];

  try {
    const response = await ai.models.generateContent({
      model: geminiModel,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: [
                `Today's date: ${today}`,
                "",
                "You generate web search queries for a research agent whose output will be read by a sophisticated audience. Output exactly 4 queries.",
                "",
                "Query rules:",
                "- 2 to 7 words each",
                "- Specific nouns: company names, product names, protocols, standards, technical terms, numeric identifiers",
                "- No question marks, no filler verbs, no 'overview of', 'guide to', 'what is'",
                "- Each query must attack a distinct angle; minimal token overlap across the four",
                "",
                "Coverage strategy — pick four angles that together would let an analyst write a real brief:",
                "- The current structural state of the space (who matters, what the shape of the market is)",
                "- Recent concrete developments (launches, funding, papers, regulatory moves) — include the year if time-sensitive",
                "- Competitive pressure, alternatives, or substitutes",
                "- Real adoption signals: deployments, customers, usage data, production case studies",
                "",
                "If the task is narrow, go deep on named entities. If the task is broad, distribute across the highest-value sub-areas and still name things.",
                "",
                "Task:",
                normalizedTask
              ].join("\n")
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            queries: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING
              }
            }
          },
          required: ["queries"]
        }
      }
    });

    const raw = response.text?.trim() ?? "{}";
    const parsed = JSON.parse(raw) as { queries?: string[] };

    const rawQueries = (parsed.queries ?? [])
      .map((query) => query.trim())
      .filter(Boolean);

    let queries = dedupeQueries(rawQueries).slice(0, 4);

    if (queries.length === 0) {
      logger.warn("Gemini returned no usable queries, using fallback research plan");
      return buildGenericFallbackQueries(normalizedTask);
    }

    if (queries.length < 4) {
      const fallbackPool = buildGenericFallbackQueries(normalizedTask).map((item) => item.query);
      queries = dedupeQueries([...queries, ...fallbackPool]).slice(0, 4);
    }

    const planItems = queries.slice(0, 4).map((query, index) => ({
      order: index + 1,
      query
    }));

    logger.info({ queries: planItems }, "Generated research plan");

    return planItems;
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        task: normalizedTask
      },
      "Gemini research plan generation failed, using fallback research plan"
    );

    return buildGenericFallbackQueries(normalizedTask);
  }
};

export const evaluateSearchResultsWithGemini = async (input: {
  task: string;
  runs: FinalReportRunInput[];
}): Promise<GeminiEvaluationResult> => {
  const normalizedTask = input.task.trim();

  if (!normalizedTask) {
    throw new Error("Task is required to evaluate search results");
  }

  if (!ai) {
    logger.warn("GEMINI_API_KEY missing, using fallback evaluation");
    return buildFallbackEvaluation(input.runs);
  }

  const formattedRuns = formatRunsForPrompt(input.runs);

  try {
    const response = await ai.models.generateContent({
      model: geminiModel,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: [
                "You are an editor reviewing whether a research agent has enough material to write a serious analytical brief.",
                "",
                `Research question: ${normalizedTask}`,
                "",
                "Your job:",
                "- Read each search thread as if you had to write a paragraph from it",
                "- Flag at most 2 threads that would produce a weak paragraph — thin evidence, repetition across sources, off-topic drift, or shallow promotional material",
                "- For each weak thread, write one refined query that would actually fix the problem",
                "",
                "Refined query rules:",
                "- 3 to 8 words",
                "- Concrete and specific to the weakness you identified",
                "- Bring in named vendors, product names, protocol names, deployment terms, compliance terms, or architecture terms when they sharpen the query",
                "- Do not repeat the original query verbatim and do not just append a generic word to it",
                "- Banned phrasing unless genuinely unavoidable: 'current state', 'success stories', 'case studies', 'new tools', 'latest tools', 'market overview', 'industry overview'",
                "- The refined query should reduce overlap with the other threads and increase precision on the gap",
                "",
                "Decision rule:",
                "- Set needsRefinement=true only if a second search pass would materially change what the final brief can argue.",
                "- If the existing coverage is already enough to write a defensible brief, return needsRefinement=false and an empty weakSections array. Do not invent weakness.",
                "",
                "Collected research:",
                JSON.stringify(formattedRuns, null, 2)
              ].join("\n")
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            needsRefinement: { type: Type.BOOLEAN },
            weakSections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  order: { type: Type.INTEGER },
                  query: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  refinedQuery: { type: Type.STRING }
                },
                required: ["order", "query", "reason", "refinedQuery"]
              }
            }
          },
          required: ["needsRefinement", "weakSections"]
        }
      }
    });

    const raw = response.text?.trim() ?? "{}";
    const parsed = JSON.parse(raw) as GeminiEvaluationResult;

    const weakSections = (parsed.weakSections ?? [])
      .map((item) => {
        const order = Number(item.order);
        const query = String(item.query ?? "").trim();
        const reason = String(item.reason ?? "").trim();
        let refinedQuery = String(item.refinedQuery ?? "").trim();

        const originalTokens = tokenizeQuery(query);
        const refinedTokens = tokenizeQuery(refinedQuery);
        const tooSimilar =
          originalTokens.size > 0 &&
          refinedTokens.size > 0 &&
          jaccardSimilarity(originalTokens, refinedTokens) >= 0.8;

        if (!refinedQuery || isGenericRefinement(refinedQuery) || tooSimilar) {
          refinedQuery = buildFallbackRefinedQuery(query, reason);
        }

        return {
          order,
          query,
          reason,
          refinedQuery
        };
      })
      .filter(
        (item) =>
          Number.isFinite(item.order) &&
          item.order > 0 &&
          item.query &&
          item.reason &&
          item.refinedQuery
      )
      .slice(0, 2);

    return {
      needsRefinement: Boolean(parsed.needsRefinement) && weakSections.length > 0,
      weakSections
    };
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        task: normalizedTask
      },
      "Gemini evaluation failed, using fallback evaluation"
    );

    return buildFallbackEvaluation(input.runs);
  }
};

export const generateFinalReportWithGemini = async (input: {
  task: string;
  runs: FinalReportRunInput[];
}): Promise<string> => {
  const normalizedTask = input.task.trim();

  if (!normalizedTask) {
    throw new Error("Task is required to generate a final report");
  }

  if (!ai) {
    logger.warn("GEMINI_API_KEY missing, using fallback final report");
    return buildFallbackFinalReport(normalizedTask, input.runs);
  }

  logger.info({ model: geminiModel, task: normalizedTask }, "Generating final report with Gemini");

  const formattedRuns = formatRunsForPrompt(input.runs);

  try {
    const response = await ai.models.generateContent({
      model: geminiModel,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: [
                "You are an analyst writing a briefing for a sophisticated reader — someone who reads the FT, The Economist, and academic working papers, and who will lose interest the moment the writing sounds like an AI summary.",
                "",
                `Research question: ${normalizedTask}`,
                "",
                "What you are writing:",
                "A tight analytical brief in the register of a think-tank working paper or a Stratechery-style column. Prose-first. Arguments, not bullet dumps. The reader should finish it feeling they understood something, not that they were handed a list.",
                "",
                "Length: 380 to 480 words. Do not exceed 480. Lean is the entire point — a tight 400 beats a padded 500 every single time. If you are running long, delete, do not compress.",
                "",
                "Structure:",
                "",
                "# [Title: a real title, not a label. Think 'The Quiet Consolidation of the Agent Stack', not 'Agent Market Overview'. Six words or fewer. No colons. No 'A Guide to'. No 'Understanding'. No possessives straining for cleverness.]",
                "",
                "[Opening paragraph, 2 to 3 sentences. Do not call it a summary. Open on the single most interesting thing in the material, framed as an observation about the world. The reader should want to keep reading.]",
                "",
                "[Two to three body paragraphs of continuous prose. No headers between them. No bullet points. Each paragraph advances one real argument and connects to the next. Weave specific names, numbers, dates, and products into sentences naturally. When sources disagree, say so and take a position.]",
                "",
                "[Closing paragraph, 2 to 3 sentences. Land a judgment. What is actually going on, and what should a serious operator take from it? Do not label this paragraph. End with force.]",
                "",
                "Voice — this matters more than anything else:",
                "- Write like a human analyst who has a point of view and is slightly bored of their own topic in a good way. Dry, confident, occasionally wry.",
                "- Vary sentence length aggressively. Short sentence. Then a longer one that develops the thought with a subordinate clause or two. Then something medium. Monotone rhythm is the giveaway of machine prose.",
                "- Concrete nouns and strong verbs. Cut adverbs. Cut intensifiers like 'very', 'highly', 'significantly', 'rapidly'.",
                "- Prefer the specific to the general at every opportunity. 'A vendor shipped X in March' beats 'leading companies have been releasing new capabilities'.",
                "- Semicolons, parentheticals, and the occasional dash are fine for rhythm. One or two em dashes in the whole piece is the ceiling.",
                "- Hedging should sound like a thoughtful person hedging ('the evidence points in one direction but is not yet decisive'), not like a disclaimer ('it is important to note that').",
                "- Plain words beat fancy ones every time. 'The hard part' beats 'the crucible'. 'Matters' beats 'is paramount'. 'Where it breaks' beats 'the practical juncture'. If a word feels like you reached for a thesaurus, delete it and write what you actually meant.",
                "",
                "Evidence discipline:",
                "- Results are ranked; lower rank number means higher relevance. Weight them that way but do not mention rank in the prose.",
                "- Prefer claims supported by more than one source. When only one source supports a claim, phrase it so the reader understands the tentativeness without you announcing it.",
                "- When sources conflict, name the conflict and adjudicate it.",
                "- Never invent a fact, a name, a date, or a number. If you are not sure, write around it.",
                "- Promotional or vendor-sourced material is acceptable only for narrow factual claims — a launch date, a price, a feature — not for judgments about the market.",
                "- If coverage of some angle is genuinely thin, fold that into your judgment rather than flagging it in a disclaimer.",
                "",
                "One final test before you output: read the piece back and ask whether a sharp editor at a serious publication would let it run. If any sentence sounds generic, rewrite it.",
                "",
                "Last thing before you write: do not use these exact words and phrases, and do not use anything that rhymes with them in tone:",
                "'in today's landscape', 'in the rapidly evolving', 'it is worth noting', 'it is important to', 'in conclusion', 'in summary', 'delve', 'navigate', 'leverage' as a verb, 'landscape' as a metaphor (this means no 'the landscape of X', no 'enterprise landscape', no 'market landscape' — pick a concrete noun instead), 'unlock', 'empower', 'robust', 'seamless', 'cutting-edge', 'game-changer', 'at the forefront', 'plays a crucial role', 'the research shows', 'the results indicate', 'this report', 'this brief', 'this analysis', 'crucible', 'paramount', 'myriad', 'plethora', 'tapestry', 'realm', 'paradigm shift', 'transformative', 'revolutionize', 'redefine' (as a verb in a title or opener). Do not refer to your own document at all. If you catch yourself writing any of these while drafting, stop and rewrite the sentence from scratch in plainer words.",
                "",
                "Collected research:",
                JSON.stringify(formattedRuns, null, 2)
              ].join("\n")
            }
          ]
        }
      ],
      config: {
        temperature: 0.85,
        topP: 0.95
      }
    });

    const finalText = (response.text?.trim() || "").trim();

    if (!finalText) {
      logger.warn("Gemini returned an empty final report, using fallback final report");
      return buildFallbackFinalReport(normalizedTask, input.runs);
    }

    const humanized = humanizeReport(finalText);

    logger.info(
      {
        originalLength: finalText.length,
        humanizedLength: humanized.length,
        charsDelta: humanized.length - finalText.length
      },
      "Humanized final report"
    );

    return humanized;
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        task: normalizedTask
      },
      "Gemini final report generation failed, using fallback final report"
    );

    return buildFallbackFinalReport(normalizedTask, input.runs);
  }
};
