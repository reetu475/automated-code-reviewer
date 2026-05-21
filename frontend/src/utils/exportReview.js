export function exportReviewAsMarkdown({ code, language, analysis, id, timestamp }) {
  const lines = [
    `# Code Review Report`,
    ``,
    `**Review ID:** ${id || "N/A"}`,
    `**Language:** ${language}`,
    `**Date:** ${timestamp ? new Date(timestamp).toLocaleString() : new Date().toLocaleString()}`,
    `**Overall Score:** ${analysis.score}/100`,
    ``,
    `## Summary`,
    analysis.summary,
    ``,
    `## Metrics`,
    `| Metric | Score |`,
    `|--------|-------|`,
    ...Object.entries(analysis.metrics || {}).map(([k, v]) => `| ${k} | ${v}% |`),
    ``,
    `**Complexity:** ${analysis.complexityScore ?? "N/A"}/100`,
    `**Estimated fix time:** ${analysis.techDebtMinutes ?? "N/A"} minutes`,
    ``,
  ];

  if (analysis.strengths?.length) {
    lines.push(`## Strengths`, ...analysis.strengths.map((s) => `- ${s}`), ``);
  }

  if (analysis.suggestions?.length) {
    lines.push(`## Suggestions`, ``);
    analysis.suggestions.forEach((s, i) => {
      lines.push(
        `### ${i + 1}. [${s.type}] Lines ${s.lineStart}-${s.lineEnd} (${s.severity})`,
        s.description,
        ``,
        "```diff",
        ...s.originalCode.split("\n").map((l) => `- ${l}`),
        ...s.suggestedCode.split("\n").map((l) => `+ ${l}`),
        "```",
        ``
      );
    });
  }

  lines.push(`## Source Code`, `\`\`\`${language}`, code, "```");

  return lines.join("\n");
}

export function downloadTextFile(content, filename) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
