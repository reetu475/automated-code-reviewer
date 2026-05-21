import React from "react";
import { Brain, Database } from "lucide-react";

export default function RagContext({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="rag-context-panel">
      <div className="rag-context-header">
        <Brain size={16} />
        <span>Memory-Augmented Review (RAG)</span>
        <Database size={14} style={{ opacity: 0.6 }} />
      </div>
      <p className="rag-context-desc">
        Similar past reviews from ChromaDB were used as context for consistent recommendations.
      </p>
      <div className="rag-context-list">
        {items.map((item) => (
          <div key={item.index} className="rag-context-item">
            <span className="rag-badge">#{item.index}</span>
            <code className="rag-preview">{item.preview}</code>
            <span className="rag-meta">{item.suggestionCount} prior suggestions</span>
          </div>
        ))}
      </div>
    </div>
  );
}
