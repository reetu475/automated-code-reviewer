import { generateWithFallback, embedWithRetry } from "./geminiClient.js";

/**
 * Analyzes code using Gemini with structured JSON output.
 * If ChromaDB similarity context is provided, it incorporates it into the prompt.
 */
export async function analyzeCode(code, language, contextReviews = []) {
  let prompt = `Analyze the following ${language} code and provide code review suggestions.
Include overall ratings, quality metrics, and line-by-line recommendations for improvements (bugs, styling, performance, and security issues).

CODE TO REVIEW:
\`\`\`${language}
${code}
\`\`\``;

  if (contextReviews && contextReviews.length > 0) {
    prompt += `\n\nCONTEXT FROM PAST SIMILAR REVIEWS:
Here are some relevant findings from similar code analyzed in the past. Try to maintain consistency with these recommendations where applicable:`;
    contextReviews.forEach((ctx, idx) => {
      prompt += `\n\nPast Review #${idx + 1}:
Code Snippet:
${ctx.code}
Suggestions:
${JSON.stringify(ctx.suggestions, null, 2)}`;
    });
  }

  const responseSchema = {
    type: "OBJECT",
    properties: {
      score: {
        type: "INTEGER",
        description: "Overall quality rating score from 0 to 100.",
      },
      summary: {
        type: "STRING",
        description: "A summary explaining the key findings and quality of the code.",
      },
      complexityScore: {
        type: "INTEGER",
        description: "Cyclomatic/complexity estimate from 0 (trivial) to 100 (very complex).",
      },
      techDebtMinutes: {
        type: "INTEGER",
        description: "Estimated minutes to fix all identified issues.",
      },
      strengths: {
        type: "ARRAY",
        items: { type: "STRING" },
        description: "Positive aspects of the code worth preserving.",
      },
      metrics: {
        type: "OBJECT",
        properties: {
          security: { type: "INTEGER", description: "Security score from 0 to 100." },
          performance: { type: "INTEGER", description: "Performance score from 0 to 100." },
          readability: { type: "INTEGER", description: "Readability score from 0 to 100." },
          maintainability: { type: "INTEGER", description: "Maintainability score from 0 to 100." },
        },
        required: ["security", "performance", "readability", "maintainability"],
      },
      suggestions: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            lineStart: { type: "INTEGER", description: "The starting line number (1-indexed)." },
            lineEnd: { type: "INTEGER", description: "The ending line number (1-indexed)." },
            type: {
              type: "STRING",
              enum: ["security", "performance", "style", "bug"],
              description: "The classification of the recommendation.",
            },
            severity: {
              type: "STRING",
              enum: ["low", "medium", "high"],
              description: "Severity of the issue.",
            },
            description: { type: "STRING", description: "Clear explanation of the problem and fix." },
            originalCode: { type: "STRING", description: "Exact code lines to replace." },
            suggestedCode: { type: "STRING", description: "Replacement code." },
          },
          required: ["lineStart", "lineEnd", "type", "severity", "description", "originalCode", "suggestedCode"],
        },
      },
    },
    required: ["score", "summary", "complexityScore", "techDebtMinutes", "strengths", "metrics", "suggestions"],
  };

  const { response } = await generateWithFallback({
    label: "analyzeCode",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
      temperature: 0.2,
    },
  });

  return JSON.parse(response.text);
}

/**
 * Generates vector embeddings for a given code block or query.
 */
export async function getEmbedding(text) {
  return embedWithRetry(text);
}

/**
 * Chat conversation logic for code refactoring.
 */
export async function refactorCodeChat(code, language, messages) {
  const systemInstruction = `You are an expert code refactoring assistant.
You will modify the user's code based on their request.
You must return your output in JSON format matching the schema:
{
  "explanation": "A concise explanation of the changes made, including why they were done.",
  "refactoredCode": "The full code file with the applied updates. Ensure it is correct, compiles, and solves the user's request."
}`;

  const chatContents = [
    {
      role: "user",
      parts: [
        {
          text: `Here is the current code we are working with (${language}):
\`\`\`${language}
${code}
\`\`\``,
        },
      ],
    },
  ];

  messages.forEach((msg) => {
    chatContents.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.text }],
    });
  });

  const responseSchema = {
    type: "OBJECT",
    properties: {
      explanation: { type: "STRING", description: "Explanation of the edits." },
      refactoredCode: { type: "STRING", description: "The full, modified code block." },
    },
    required: ["explanation", "refactoredCode"],
  };

  const { response } = await generateWithFallback({
    label: "refactorCodeChat",
    contents: chatContents,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.3,
    },
  });

  return JSON.parse(response.text);
}

/**
 * Detects the most likely programming language from a code snippet.
 */
export async function detectLanguage(code) {
  const responseSchema = {
    type: "OBJECT",
    properties: {
      language: {
        type: "STRING",
        description: "Detected language id: javascript, typescript, python, java, cpp, go, rust, csharp, php, ruby, swift, kotlin, sql, html, css, or other.",
      },
      confidence: {
        type: "INTEGER",
        description: "Confidence from 0 to 100.",
      },
    },
    required: ["language", "confidence"],
  };

  const { response } = await generateWithFallback({
    label: "detectLanguage",
    contents: `Identify the programming language of this code snippet. Return a standard language id.\n\nCODE:\n${code.slice(0, 4000)}`,
    config: {
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0,
    },
  });

  const parsed = JSON.parse(response.text);
  const lang = (parsed.language || "").toLowerCase().trim();
  const aliases = {
    "c++": "cpp",
    "c#": "csharp",
    node: "javascript",
    nodejs: "javascript",
  };
  parsed.language = aliases[lang] || lang.replace(/\s+/g, "");
  return parsed;
}
