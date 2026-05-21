const RULES = [
  { lang: "python", test: (c) => /^\s*(def |class |import |from .+ import|print\()/m.test(c) || /:\s*$/m.test(c) },
  { lang: "java", test: (c) => /\b(public|private)\s+(static\s+)?(class|void|int|String)\b/.test(c) },
  { lang: "typescript", test: (c) => /\b(interface\s+\w+|:\s*(string|number|boolean|void)\b|as const)/.test(c) },
  { lang: "javascript", test: (c) => /\b(function|const|let|var|=>|console\.log)\b/.test(c) },
  { lang: "csharp", test: (c) => /\b(namespace|using System|Console\.WriteLine)\b/.test(c) },
  { lang: "cpp", test: (c) => /#include\s*<|std::|cout\s*<</.test(c) },
  { lang: "go", test: (c) => /\bpackage\s+\w+|func\s+\w+\(|fmt\.Print/.test(c) },
  { lang: "rust", test: (c) => /\bfn\s+\w+|let\s+mut\b|println!/.test(c) },
  { lang: "php", test: (c) => /<\?php|\$\w+\s*=/.test(c) },
  { lang: "ruby", test: (c) => /\bdef\s+\w+|puts\s+|end\s*$/m.test(c) },
  { lang: "kotlin", test: (c) => /\bfun\s+\w+|val\s+\w+/.test(c) && !/fn\s/.test(c) },
  { lang: "sql", test: (c) => /\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE)\b/i.test(c) },
  { lang: "html", test: (c) => /<\/?[a-z][\s\S]*>/i.test(c) },
  { lang: "css", test: (c) => /[.#][\w-]+\s*\{[^}]*\}/.test(c) && !/<html/i.test(c) },
];

const NORMALIZE = {
  "c++": "cpp",
  "c#": "csharp",
  "cs": "csharp",
  "js": "javascript",
  "ts": "typescript",
  py: "python",
};

export function detectLanguageLocal(code) {
  const trimmed = code.trim();
  if (!trimmed) return null;

  for (const { lang, test } of RULES) {
    if (test(trimmed)) return { language: lang, confidence: 75, source: "local" };
  }
  return { language: "javascript", confidence: 40, source: "local" };
}

export function normalizeLanguageId(id) {
  if (!id) return null;
  const lower = id.toLowerCase().trim();
  return NORMALIZE[lower] || lower.replace(/\s+/g, "");
}
