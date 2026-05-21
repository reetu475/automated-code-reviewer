import { CloudClient } from "chromadb";
import dotenv from "dotenv";

dotenv.config();

let client = null;
let collection = null;
let isMock = false;
let mockDb = []; // Fallback in-memory database if ChromaDB is not configured or fails
/** Always populated on each review — powers History/Insights even if Chroma save fails */
const sessionReviews = [];

const COLLECTION_NAME = "code_reviews";

function formatReviewRecord(id, code, language, analysisResult, timestamp) {
  return {
    id,
    code,
    language,
    analysis: analysisResult,
    timestamp: timestamp || new Date().toISOString(),
    metadata: {
      id,
      language,
      score: analysisResult.score,
      summary: analysisResult.summary,
      timestamp: timestamp || new Date().toISOString(),
    },
  };
}

/**
 * Saves to in-memory session store (always). Used for History & Insights.
 */
export function saveSessionReview(id, code, language, analysisResult) {
  const timestamp = new Date().toISOString();
  const record = formatReviewRecord(id, code, language, analysisResult, timestamp);
  const idx = sessionReviews.findIndex((r) => r.id === id);
  if (idx >= 0) sessionReviews[idx] = record;
  else sessionReviews.unshift(record);
  if (sessionReviews.length > 200) sessionReviews.pop();
  return record;
}

function mergeReviewsById(...lists) {
  const byId = new Map();
  for (const list of lists) {
    for (const item of list) {
      if (item?.id) byId.set(item.id, item);
    }
  }
  return [...byId.values()].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );
}

export async function initChroma() {
  const host = process.env.CHROMA_HOST || "api.trychroma.com";
  const apiKey = process.env.CHROMA_API_KEY;
  const tenant = process.env.CHROMA_TENANT || "0d59f2f2-3122-4407-b10f-076b2471c986";
  const database = process.env.CHROMA_DATABASE || "aii";

  if (!apiKey || apiKey === "YOUR_API_KEY" || apiKey === "YOUR_CHROMA_API_KEY" || apiKey.trim() === "") {
    console.warn("⚠️ ChromaDB API key is missing or placeholder. Running in Mock In-Memory Mode.");
    isMock = true;
    return false;
  }

  try {
    console.log(`Connecting to ChromaDB Cloud at ${host} (Tenant: ${tenant}, DB: ${database})...`);
    client = new CloudClient({
      apiKey: apiKey,
      tenant: tenant,
      database: database,
    });

    // Verify connection and get or create collection
    // Note: in chromadb client v3, we can call getOrCreateCollection
    // We supply Gemini embeddings on add/query — no Chroma default embedder needed
    collection = await client.getOrCreateCollection({
      name: COLLECTION_NAME,
      embeddingFunction: null,
    });

    console.log(`✅ Successfully connected to ChromaDB Cloud. Collection '${COLLECTION_NAME}' is ready.`);
    isMock = false;
    return true;
  } catch (error) {
    console.error("❌ Failed to connect to ChromaDB Cloud:", error.message);
    console.warn("⚠️ Falling back to Mock In-Memory Mode.");
    isMock = true;
    return false;
  }
}

/**
 * Saves a code review to ChromaDB (or Mock DB)
 * @param {string} id Unique identifier
 * @param {string} code Source code snippet
 * @param {string} language Programming language
 * @param {object} analysisResult JSON result of the review
 * @param {number[]} embedding Vector embedding of the code snippet
 */
export async function saveReview(id, code, language, analysisResult, embedding) {
  const timestamp = new Date().toISOString();
  saveSessionReview(id, code, language, analysisResult);

  const metadata = {
    id: String(id),
    language: String(language),
    score: Number(analysisResult.score) || 0,
    securityScore: Number(analysisResult.metrics?.security) || 0,
    performanceScore: Number(analysisResult.metrics?.performance) || 0,
    readabilityScore: Number(analysisResult.metrics?.readability) || 0,
    maintainabilityScore: Number(analysisResult.metrics?.maintainability) || 0,
    summary: String(analysisResult.summary || "").slice(0, 2000),
    timestamp: String(timestamp),
  };

  const documentContent = JSON.stringify({
    code,
    suggestions: analysisResult.suggestions || [],
  });

  const memoryRecord = {
    id,
    code,
    language,
    analysis: analysisResult,
    embedding,
    metadata,
    timestamp,
  };

  if (isMock) {
    mockDb.unshift(memoryRecord);
    return true;
  }

  if (!embedding?.length) {
    console.warn("[Chroma] Skipping cloud index — no embedding vector.");
    mockDb.unshift(memoryRecord);
    return true;
  }

  try {
    await collection.add({
      ids: [id],
      embeddings: [embedding],
      metadatas: [metadata],
      documents: [documentContent],
    });
    return true;
  } catch (error) {
    console.error("Error saving review to ChromaDB:", error.message);
    mockDb.unshift(memoryRecord);
    return true;
  }
}

/**
 * Queries past code reviews that are semantically similar to the provided code's embedding
 * @param {number[]} embedding Vector embedding
 * @param {number} limit Number of results
 * @returns {Array<{code: string, suggestions: Array}>}
 */
export async function querySimilarReviews(embedding, limit = 2) {
  if (isMock) {
    // Simple cosine similarity or mock query return
    // Return up to 'limit' items from memory
    return mockDb
      .slice(-limit)
      .map(item => ({
        code: item.code,
        suggestions: item.analysis.suggestions
      }));
  }

  try {
    const results = await collection.query({
      queryEmbeddings: [embedding],
      nResults: limit
    });

    if (!results || !results.documents || results.documents.length === 0 || results.documents[0].length === 0) {
      return [];
    }

    return results.documents[0].map(docStr => {
      try {
        return JSON.parse(docStr);
      } catch {
        return null;
      }
    }).filter(Boolean);
  } catch (error) {
    console.error("Error querying ChromaDB:", error);
    return [];
  }
}

/**
 * Semantic search or keyword search for reviews history
 * @param {number[]} [queryEmbedding] Embedding of the search string (if semantic)
 * @param {string} [keyword] String query (for fallback or simple matching)
 * @returns {Array<object>} List of reviews
 */
function filterByKeyword(items, keyword) {
  if (!keyword) return items;
  const lower = keyword.toLowerCase();
  return items.filter(
    (item) =>
      item.code?.toLowerCase().includes(lower) ||
      item.analysis?.summary?.toLowerCase().includes(lower) ||
      item.language?.toLowerCase().includes(lower)
  );
}

function mapMemoryItem(item) {
  return {
    id: item.id,
    code: item.code,
    language: item.language,
    analysis: item.analysis,
    timestamp: item.timestamp || item.metadata?.timestamp,
    metadata: item.metadata,
  };
}

export async function searchReviews(queryEmbedding, keyword = "") {
  const memoryItems = [...sessionReviews, ...mockDb].map(mapMemoryItem);

  if (isMock) {
    return filterByKeyword(mergeReviewsById(memoryItems), keyword);
  }

  try {
    let ids = [];
    let metadatas = [];
    let documents = [];

    if (queryEmbedding) {
      // Semantic Search
      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: 15
      });
      if (results && results.ids && results.ids[0]) {
        ids = results.ids[0];
        metadatas = results.metadatas[0];
        documents = results.documents[0];
      }
    } else {
      const results = await collection.get({ limit: 100 });
      if (results?.ids?.length) {
        ids = results.ids;
        metadatas = results.metadatas || [];
        documents = results.documents || [];
      }
    }

    if (!ids?.length) {
      return filterByKeyword(mergeReviewsById(memoryItems), keyword);
    }

    const items = ids.map((id, index) => {
      let docObj = { code: "", suggestions: [] };
      try {
        docObj = JSON.parse(documents[index]);
      } catch (e) {
        // Fallback if not JSON
        docObj = { code: documents[index], suggestions: [] };
      }

      const meta = metadatas[index];
      return {
        id: id,
        code: docObj.code,
        language: meta.language,
        analysis: {
          score: meta.score,
          summary: meta.summary,
          metrics: {
            security: meta.securityScore,
            performance: meta.performanceScore,
            readability: meta.readabilityScore,
            maintainability: meta.maintainabilityScore
          },
          suggestions: docObj.suggestions
        },
        timestamp: meta.timestamp || new Date().toISOString(),
        metadata: meta
      };
    });

    const merged = mergeReviewsById(memoryItems, items);
    if (keyword && queryEmbedding) {
      return filterByKeyword(merged, keyword);
    }
    return filterByKeyword(merged, keyword);
  } catch (error) {
    console.error("Error searching/retrieving ChromaDB items:", error);
    return filterByKeyword(mergeReviewsById(memoryItems), keyword);
  }
}

export function getSessionReviewCount() {
  return mergeReviewsById(sessionReviews, mockDb).length;
}

/**
 * Returns connection and operational statuses
 */
export function getStatus() {
  return {
    chromaConnected: client !== null && !isMock,
    isMock: isMock,
    database: isMock ? "Memory (Fallback)" : process.env.CHROMA_DATABASE || "aii",
    tenant: isMock ? "N/A" : process.env.CHROMA_TENANT || "0d59f2f2-3122-4407-b10f-076b2471c986",
    host: isMock ? "N/A" : process.env.CHROMA_HOST || "api.trychroma.com"
  };
}
