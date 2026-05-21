import React, { useState, useRef, useEffect } from "react";
import { Send, Loader } from "lucide-react";

export default function Chat({ messages, onSendMessage, isPending }) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isPending) return;
    onSendMessage(input.trim());
    setInput("");
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isPending]);

  return (
    <div className="chat-drawer">
      <div className="panel-header" style={{ padding: "8px 16px" }}>
        <div className="panel-title" style={{ fontSize: "0.85rem" }}>
          <span>AI Refactoring Chat</span>
        </div>
      </div>
      
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", textAlign: "center", marginTop: "20px" }}>
            Ask the AI to refactor code (e.g., "rewrite using promises", "optimize memory usage", etc.)
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className={`chat-bubble ${msg.role}`}>
              {msg.text}
            </div>
          ))
        )}
        {isPending && (
          <div className="chat-bubble assistant" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Loader size={14} className="spinner" />
            <span>Refactoring code...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="chat-input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask AI to modify your code..."
          className="chat-input"
          disabled={isPending}
        />
        <button 
          type="submit" 
          className="btn" 
          style={{ padding: "8px 12px", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center" }}
          disabled={isPending || !input.trim()}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
