import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import { v4 as uuidv4 } from "uuid";

import { analyzeCode, getEmbedding, refactorCodeChat, detectLanguage } from "./services/gemini.js";
import { initChroma, saveReview, saveSessionReview, querySimilarReviews, searchReviews, getStatus } from "./services/chroma.js";

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "5mb" })); // support large code files
app.use(morgan("dev"));

// Initialize Chroma DB Connection
initChroma().catch(err => {
  console.error("Critical error during ChromaDB initialization:", err);
});

// Endpoint: Check API Status
app.get("/api/status", (req, res) => {
  const geminiConfigured = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "YOUR_GEMINI_API_KEY";
  res.json({
    gemini: {
      configured: geminiConfigured,
      status: geminiConfigured ? "Online" : "Missing API Key"
    },
    chroma: getStatus()
  });
});

// Endpoint: Review Code
app.post("/api/review", async (req, res) => {
  try {
    const { code, language } = req.body;
    if (!code) {
      return res.status(400).json({ error: "Code content is required." });
    }
    const lang = language || "javascript";

    console.log(`[Review] Starting analysis for ${lang} (${code.length} chars)...`);

    // 1. Generate embedding for the code snippet
    let embedding = null;
    let contextReviews = [];
    
    try {
      embedding = await getEmbedding(code);
      // 2. Query similar past reviews for context (RAG)
      contextReviews = await querySimilarReviews(embedding, 2);
      console.log(`[Review] Retrieved ${contextReviews.length} similar snippets from memory.`);
    } catch (embedError) {
      console.warn("⚠️ Failed to generate embedding or query similarity. Continuing without RAG context:", embedError.message);
    }

    // 3. Analyze code using Gemini (passing similarities as context)
    const analysis = await analyzeCode(code, lang, contextReviews);

    // Generate unique ID for this review
    const reviewId = uuidv4();

    // 4. Always save to session store; index in Chroma when embedding exists
    try {
      await saveReview(reviewId, code, lang, analysis, embedding);
      console.log(`[Review] Saved review ${reviewId} (embedding: ${embedding ? "yes" : "no"}).`);
    } catch (saveError) {
      console.error("⚠️ Failed to save review:", saveError.message);
      saveSessionReview(reviewId, code, lang, analysis);
    }

    res.json({
      id: reviewId,
      code,
      language: lang,
      analysis,
      ragContext: contextReviews.map((ctx, i) => ({
        index: i + 1,
        preview: ctx.code?.slice(0, 120) + (ctx.code?.length > 120 ? "..." : ""),
        suggestionCount: ctx.suggestions?.length || 0
      })),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Error in /api/review:", error);
    const msg = error.message || "Failed to analyze code.";
    const status = msg.includes("busy") || msg.includes("high demand") ? 503 : 500;
    res.status(status).json({ error: msg });
  }
});

// Endpoint: Auto-detect programming language
app.post("/api/detect-language", async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: "Code content is required." });
    }
    const result = await detectLanguage(code);
    res.json(result);
  } catch (error) {
    console.error("Error in /api/detect-language:", error);
    res.status(500).json({ error: error.message || "Failed to detect language." });
  }
});

// Endpoint: AI Refactoring Chat
app.post("/api/chat", async (req, res) => {
  try {
    const { code, language, messages } = req.body;
    if (!code) {
      return res.status(400).json({ error: "Code content is required." });
    }
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Chat messages are required." });
    }

    const lang = language || "javascript";
    console.log(`[Chat] Processing refactoring request for ${lang}...`);

    const result = await refactorCodeChat(code, lang, messages);
    res.json(result);

  } catch (error) {
    console.error("Error in /api/chat:", error);
    res.status(500).json({ error: error.message || "Failed to process chat refactoring." });
  }
});

// Endpoint: Get History (Search & List)
app.get("/api/history", async (req, res) => {
  try {
    const { query, mode } = req.query;
    console.log(`[History] Fetching history (Query: "${query || ''}", Mode: "${mode || 'default'}")`);

    let reviews = [];
    if (query && mode === "semantic") {
      try {
        const queryEmbedding = await getEmbedding(query);
        reviews = await searchReviews(queryEmbedding, query);
      } catch (embedError) {
        console.error("Failed to generate embedding for semantic search, falling back to keyword search:", embedError);
        reviews = await searchReviews(null, query);
      }
    } else {
      reviews = await searchReviews(null, query || "");
    }

    res.json({ reviews });
  } catch (error) {
    console.error("Error in /api/history:", error);
    res.status(500).json({ error: error.message || "Failed to fetch review history." });
  }
});

// Endpoint: Get Insights Dashboard Data
app.get("/api/insights", async (req, res) => {
  try {
    const reviews = await searchReviews(null, "");
    
    if (reviews.length === 0) {
      return res.json({
        empty: true,
        averageScore: 0,
        averageMetrics: { security: 0, performance: 0, readability: 0, maintainability: 0 },
        recentScores: [],
        vulnerabilitiesByType: [],
        activityData: []
      });
    }

    // Calculate averages
    let totalScore = 0;
    let metricsSum = { security: 0, performance: 0, readability: 0, maintainability: 0 };
    let typeCounts = { security: 0, performance: 0, style: 0, bug: 0 };
    
    // Group activity by date
    const dateCounts = {};

    reviews.forEach(r => {
      const score = r.analysis?.score || 0;
      totalScore += score;
      
      const m = r.analysis?.metrics || { security: 0, performance: 0, readability: 0, maintainability: 0 };
      metricsSum.security += m.security;
      metricsSum.performance += m.performance;
      metricsSum.readability += m.readability;
      metricsSum.maintainability += m.maintainability;

      if (r.analysis?.suggestions) {
        r.analysis.suggestions.forEach(s => {
          const type = s.type || "style";
          typeCounts[type] = (typeCounts[type] || 0) + 1;
        });
      }

      const dateStr = new Date(r.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;
    });

    const count = reviews.length;
    const averageScore = Math.round(totalScore / count);
    const averageMetrics = {
      security: Math.round(metricsSum.security / count),
      performance: Math.round(metricsSum.performance / count),
      readability: Math.round(metricsSum.readability / count),
      maintainability: Math.round(metricsSum.maintainability / count)
    };

    // Prepping formatting for Recharts
    const vulnerabilitiesByType = Object.keys(typeCounts).map(key => ({
      name: key.toUpperCase(),
      value: typeCounts[key]
    }));

    // Historical scores (taking up to last 10 reviews)
    const recentScores = reviews
      .slice(0, 10)
      .reverse()
      .map((r, i) => ({
        index: i + 1,
        name: r.language + " - " + new Date(r.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        score: r.analysis.score
      }));

    // Activity timeline
    const activityData = Object.keys(dateCounts).map(date => ({
      date,
      count: dateCounts[date]
    })).reverse(); // order chronological if keys are inserted in order, but we can sort if needed.

    res.json({
      empty: false,
      totalReviews: count,
      averageScore,
      averageMetrics,
      recentScores,
      vulnerabilitiesByType,
      activityData
    });

  } catch (error) {
    console.error("Error in /api/insights:", error);
    res.status(500).json({ error: error.message || "Failed to load insights." });
  }
});

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Code Reviewer Backend running on http://localhost:${PORT}`);
  });
}

export default app;
