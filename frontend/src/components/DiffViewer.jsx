import React from "react";
import { Check } from "lucide-react";

export default function DiffViewer({ original, suggested, onApply }) {
  const origLines = original.split("\n");
  const sugLines = suggested.split("\n");

  return (
    <div className="diff-container">
      <div className="diff-header">
        <span>Suggested Changes</span>
        {onApply && (
          <button 
            className="btn btn-secondary" 
            style={{ padding: "4px 8px", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "4px" }}
            onClick={() => onApply(original, suggested)}
          >
            <Check size={14} />
            Apply Fix
          </button>
        )}
      </div>
      
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1px", background: "rgba(255,255,255,0.05)" }}>
        {origLines.map((line, idx) => (
          <div key={`orig-${idx}`} className="diff-line removed">
            <span style={{ width: "20px", display: "inline-block", userSelect: "none", opacity: 0.4 }}>-</span>
            <span>{line}</span>
          </div>
        ))}
        {sugLines.map((line, idx) => (
          <div key={`sug-${idx}`} className="diff-line added">
            <span style={{ width: "20px", display: "inline-block", userSelect: "none", opacity: 0.4 }}>+</span>
            <span>{line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
