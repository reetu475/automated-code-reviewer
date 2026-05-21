import React, { useState, useEffect, useRef, useCallback } from "react";
import Editor from "@monaco-editor/react";
import DiffViewer from "./DiffViewer";
import Chat from "./Chat";
import RagContext from "./RagContext";
import { reviewCode, sendChatRefactor, detectLanguage } from "../utils/api";
import { exportReviewAsMarkdown, downloadTextFile } from "../utils/exportReview";
import { detectLanguageLocal, normalizeLanguageId } from "../utils/detectLanguageLocal";
import {
  Play,
  Sparkles,
  MessageSquare,
  AlertCircle,
  Award,
  Terminal,
  Wand2,
  Upload,
  Download,
  CheckCheck,
  Clock,
  Layers,
  ClipboardPaste,
  Eraser,
  Languages,
} from "lucide-react";

const LANGUAGES = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "csharp", label: "C#" },
  { value: "php", label: "PHP" },
  { value: "ruby", label: "Ruby" },
  { value: "kotlin", label: "Kotlin" },
  { value: "sql", label: "SQL" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
];

const EXT_TO_LANG = {
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  java: "java",
  cpp: "cpp",
  cc: "cpp",
  go: "go",
  rs: "rust",
  cs: "csharp",
  php: "php",
  rb: "ruby",
  kt: "kotlin",
  sql: "sql",
  html: "html",
  css: "css",
};

export default function Reviewer({ selectedReview, onReviewSuccess }) {
  const [code, setCode] = useState(
    `// Paste your code here to review\nfunction calculateTotal(price, tax) {\n    var total = price + tax;\n    console.log("Total is: " + total);\n    return total;\n}`
  );
  const [language, setLanguage] = useState("javascript");

  const [reviewResult, setReviewResult] = useState(null);
  const [reviewMeta, setReviewMeta] = useState(null);
  const [ragContext, setRagContext] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detectingLang, setDetectingLang] = useState(false);
  const [error, setError] = useState("");

  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatPending, setChatPending] = useState(false);

  const [expandedSuggestions, setExpandedSuggestions] = useState({});
  const [editorReady, setEditorReady] = useState(false);
  const [editorFailed, setEditorFailed] = useState(false);
  const [pasteHint, setPasteHint] = useState("");
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const decorationsRef = useRef([]);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const applyLineDecorations = useCallback((analysis) => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !analysis?.suggestions?.length) {
      decorationsRef.current = editor?.deltaDecorations(decorationsRef.current, []) || [];
      return;
    }

    const decorations = analysis.suggestions.map((sug) => {
      const severityMap = { high: 3, medium: 2, low: 1 };
      return {
        range: new monaco.Range(sug.lineStart, 1, sug.lineEnd, 1),
        options: {
          isWholeLine: true,
          className: `issue-line issue-${sug.type}`,
          glyphMarginClassName: `issue-glyph issue-${sug.severity}`,
          linesDecorationsClassName: `issue-margin severity-${severityMap[sug.severity] || 1}`,
          hoverMessage: { value: `**${sug.type}** (${sug.severity}): ${sug.description}` },
        },
      };
    });

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, decorations);
  }, []);

  useEffect(() => {
    if (selectedReview) {
      setCode(selectedReview.code);
      setLanguage(selectedReview.language || "javascript");
      setReviewResult(selectedReview.analysis);
      setReviewMeta({ id: selectedReview.id, timestamp: selectedReview.timestamp });
      setRagContext([]);
      setChatMessages([]);
      setShowChat(false);
      applyLineDecorations(selectedReview.analysis);
    }
  }, [selectedReview, applyLineDecorations]);

  useEffect(() => {
    applyLineDecorations(reviewResult);
  }, [reviewResult, applyLineDecorations]);

  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setEditorReady(true);
    setEditorFailed(false);
    applyLineDecorations(reviewResult);
  };

  const handlePasteCode = async () => {
    setPasteHint("");
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setPasteHint("Clipboard is empty. Copy your code first (Ctrl+C), then click Paste Code.");
        return;
      }
      setCode(text);
      editorRef.current?.setValue?.(text);
      setPasteHint("Code pasted successfully.");
      setTimeout(() => setPasteHint(""), 3000);
    } catch {
      setEditorFailed(true);
      setPasteHint("Use the text box below: click inside it, then press Ctrl+V to paste.");
      textareaRef.current?.focus();
    }
  };

  const handleClearCode = () => {
    setCode("");
    editorRef.current?.setValue?.("");
    setReviewResult(null);
    setRagContext([]);
    setPasteHint("");
  };

  const handleReview = async () => {
    if (!code.trim() || loading) return;
    try {
      setLoading(true);
      setError("");
      setReviewResult(null);
      setRagContext([]);
      const res = await reviewCode(code, language);
      setReviewResult(res.analysis);
      setReviewMeta({ id: res.id, timestamp: res.timestamp });
      setRagContext(res.ragContext || []);
      onReviewSuccess();
    } catch (err) {
      const msg = err.message || "Failed to analyze code.";
      setError(
        msg.includes("503") || msg.includes("busy") || msg.includes("high demand")
          ? "Gemini AI is temporarily overloaded. Wait 30 seconds and click Review again."
          : msg
      );
    } finally {
      setLoading(false);
    }
  };

  const applyDetectedLanguage = (langId, confidence, source) => {
    const normalized = normalizeLanguageId(langId);
    const supported = LANGUAGES.some((l) => l.value === normalized);
    if (normalized && supported && normalized !== "other") {
      setLanguage(normalized);
      const label = LANGUAGES.find((l) => l.value === normalized)?.label || normalized;
      setPasteHint(`Detected: ${label}${confidence != null ? ` (${confidence}% confidence)` : ""} via ${source}.`);
      setError("");
      setTimeout(() => setPasteHint(""), 5000);
      return true;
    }
    return false;
  };

  const handleDetectLanguage = async () => {
    if (detectingLang) return;

    if (!code.trim()) {
      setPasteHint("No code found! Paste in the browser editor below — NOT in the PowerShell/terminal window.");
      setError("");
      return;
    }

    setDetectingLang(true);
    setPasteHint("");
    setError("");

    try {
      const ext = fileInputRef.current?.files?.[0]?.name?.split(".").pop()?.toLowerCase();
      if (ext && EXT_TO_LANG[ext]) {
        applyDetectedLanguage(EXT_TO_LANG[ext], 100, "file extension");
        return;
      }

      const local = detectLanguageLocal(code);
      if (local) {
        applyDetectedLanguage(local.language, local.confidence, "pattern match");
      }

      try {
        const res = await detectLanguage(code);
        const ok = applyDetectedLanguage(res.language, res.confidence, "AI");
        if (!ok) {
          setPasteHint(
            local
              ? `AI was unsure; kept pattern match: ${LANGUAGES.find((l) => l.value === language)?.label}`
              : "Could not detect language. Please pick one from the dropdown."
          );
        }
      } catch (apiErr) {
        if (!local) {
          setError(apiErr.message || "Language detection failed. Pick language manually from the dropdown.");
        } else if (local) {
          const label = LANGUAGES.find((l) => l.value === local.language)?.label;
          setPasteHint(`AI offline; used pattern match: ${label}`);
        }
      }
    } finally {
      setDetectingLang(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext && EXT_TO_LANG[ext]) setLanguage(EXT_TO_LANG[ext]);

    const reader = new FileReader();
    reader.onload = (ev) => setCode(ev.target?.result || "");
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleApplyFix = (original, suggested) => {
    const index = code.indexOf(original);
    if (index !== -1) {
      setCode(code.substring(0, index) + suggested + code.substring(index + original.length));
      return;
    }
    const cleanOriginal = original.trim();
    const cleanIndex = code.indexOf(cleanOriginal);
    if (cleanIndex !== -1) {
      setCode(code.substring(0, cleanIndex) + suggested + code.substring(cleanIndex + cleanOriginal.length));
    } else {
      alert("Unable to locate original lines exactly. They may have been modified.");
    }
  };

  const handleApplyAllFixes = () => {
    if (!reviewResult?.suggestions?.length) return;
    let updated = code;
    const sorted = [...reviewResult.suggestions].sort((a, b) => b.lineStart - a.lineStart);
    let applied = 0;

    for (const sug of sorted) {
      const idx = updated.indexOf(sug.originalCode);
      if (idx !== -1) {
        updated = updated.substring(0, idx) + sug.suggestedCode + updated.substring(idx + sug.originalCode.length);
        applied++;
      }
    }

    setCode(updated);
    if (applied < sorted.length) {
      alert(`Applied ${applied} of ${sorted.length} fixes. Some snippets could not be matched exactly.`);
    }
  };

  const handleExport = () => {
    if (!reviewResult) return;
    const md = exportReviewAsMarkdown({
      code,
      language,
      analysis: reviewResult,
      id: reviewMeta?.id,
      timestamp: reviewMeta?.timestamp,
    });
    downloadTextFile(md, `review-${reviewMeta?.id?.slice(0, 8) || "report"}.md`);
  };

  const handleSendChatMessage = async (text) => {
    if (!text.trim() || chatPending) return;

    const newMsg = { role: "user", text };
    const updatedMessages = [...chatMessages, newMsg];
    setChatMessages(updatedMessages);

    try {
      setChatPending(true);
      const res = await sendChatRefactor(code, language, updatedMessages);
      if (res.refactoredCode) setCode(res.refactoredCode);
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", text: res.explanation || "Refactored your code as requested." },
      ]);
    } catch (err) {
      setChatMessages((prev) => [...prev, { role: "assistant", text: `Error: ${err.message}` }]);
    } finally {
      setChatPending(false);
    }
  };

  const toggleSuggestion = (index) => {
    setExpandedSuggestions((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const expandAll = () => {
    if (!reviewResult?.suggestions) return;
    const all = {};
    reviewResult.suggestions.forEach((_, i) => (all[i] = true));
    setExpandedSuggestions(all);
  };

  return (
    <div className="workspace">
      <div className="panel-card" style={{ display: "flex", flexDirection: "column" }}>
        <div className="panel-header workspace-header">
          <div className="panel-title">
            <Terminal size={18} />
            <span>Workspace Editor</span>
          </div>
          <div className="editor-toolbar">
            <input
              ref={fileInputRef}
              type="file"
              accept=".js,.jsx,.ts,.tsx,.py,.java,.cpp,.go,.rs,.cs,.php,.rb,.kt,.sql,.html,.css,.txt"
              style={{ display: "none" }}
              onChange={handleFileUpload}
            />
            <button
              type="button"
              className="btn btn-secondary toolbar-btn paste-btn"
              onClick={handlePasteCode}
              title="Paste code from clipboard"
            >
              <ClipboardPaste size={14} />
              <span>Paste Code</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary toolbar-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Upload code file"
            >
              <Upload size={14} />
              <span>Upload</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary toolbar-btn"
              onClick={handleClearCode}
              title="Clear editor"
            >
              <Eraser size={14} />
            </button>
            <button type="button" className="btn btn-secondary toolbar-btn" onClick={() => setShowChat(!showChat)}>
              <MessageSquare size={14} />
              <span>AI Chat</span>
            </button>
            <button type="button" className="btn toolbar-btn" onClick={handleReview} disabled={loading}>
              <Play size={14} fill="currentColor" />
              <span>Review</span>
            </button>
          </div>
        </div>

        <div className="language-bar">
          <div className="language-bar-label">
            <Languages size={16} />
            <label htmlFor="code-language-select">Programming Language</label>
          </div>
          <select
            id="code-language-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="select-lang select-lang-prominent"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-secondary toolbar-btn"
            onClick={handleDetectLanguage}
            disabled={detectingLang}
            title="Auto-detect language from code"
          >
            <Wand2 size={14} />
            <span>{detectingLang ? "Detecting..." : "Auto-Detect"}</span>
          </button>
        </div>

        <div className="editor-hint-bar">
          <span>
            <strong>Important:</strong> Paste code in the <strong>browser editor below</strong> — not in the terminal.
            Use <strong>Paste Code</strong> or <kbd>Ctrl</kbd>+<kbd>V</kbd>, then <strong>Auto-Detect</strong> or <strong>Review</strong>.
          </span>
          {pasteHint && <span className="paste-hint-msg">{pasteHint}</span>}
        </div>

        <div className="editor-container">
          {editorFailed ? (
            <textarea
              ref={textareaRef}
              className="code-textarea-fallback"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste your code here (Ctrl+V)..."
              spellCheck={false}
            />
          ) : (
            <>
              {!editorReady && (
                <div className="editor-loading">
                  <div className="spinner" />
                  <span>Loading editor...</span>
                </div>
              )}
              <Editor
                height="420px"
                language={language}
                theme="vs-dark"
                value={code}
                onChange={(val) => setCode(val || "")}
                onMount={handleEditorMount}
                loading={null}
                onValidate={() => {}}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  fontFamily: "Fira Code, Consolas, monospace",
                  automaticLayout: true,
                  padding: { top: 12 },
                  lineNumbersMinChars: 3,
                  glyphMargin: true,
                  scrollBeyondLastLine: false,
                }}
              />
            </>
          )}
        </div>

        {editorFailed && (
          <button
            type="button"
            className="btn-link-fallback"
            onClick={() => setEditorFailed(false)}
          >
            Try advanced editor again
          </button>
        )}

        {showChat && <Chat messages={chatMessages} onSendMessage={handleSendChatMessage} isPending={chatPending} />}
      </div>

      <div className="panel-card">
        <div className="panel-header">
          <div className="panel-title">
            <Sparkles size={18} style={{ color: "var(--accent-cyan)" }} />
            <span>Review Results</span>
          </div>
          {reviewResult && (
            <div className="editor-toolbar">
              <button type="button" className="btn btn-secondary toolbar-btn" onClick={expandAll}>
                Expand All
              </button>
              {reviewResult.suggestions?.length > 0 && (
                <button type="button" className="btn btn-secondary toolbar-btn" onClick={handleApplyAllFixes}>
                  <CheckCheck size={14} />
                  <span>Apply All</span>
                </button>
              )}
              <button type="button" className="btn btn-secondary toolbar-btn" onClick={handleExport}>
                <Download size={14} />
                <span>Export</span>
              </button>
            </div>
          )}
        </div>

        <div className="review-panel">
          {loading ? (
            <div className="loader-container">
              <div className="spinner"></div>
              <span style={{ fontSize: "0.9rem" }}>Running automated code review...</span>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", maxWidth: "280px", textAlign: "center" }}>
                Gemini analyzes your code; ChromaDB recalls similar past reviews for smarter suggestions.
              </span>
            </div>
          ) : error ? (
            <div className="error-panel">
              <AlertCircle size={32} />
              <p>{error}</p>
              <p className="error-hint">Add GEMINI_API_KEY to backend/.env to enable reviews.</p>
            </div>
          ) : reviewResult ? (
            <>
              <RagContext items={ragContext} />

              <div className="review-summary-card">
                <div className="rating-row">
                  <div className="radial-score" style={{ "--score-percent": `${reviewResult.score}%` }}>
                    <div className="radial-score-text">{reviewResult.score}</div>
                  </div>
                  <div className="summary-details">
                    <div className="summary-title">Summary</div>
                    <div className="summary-text">{reviewResult.summary}</div>
                    <div className="meta-chips">
                      {reviewResult.complexityScore != null && (
                        <span className="meta-chip">
                          <Layers size={12} /> Complexity {reviewResult.complexityScore}%
                        </span>
                      )}
                      {reviewResult.techDebtMinutes != null && (
                        <span className="meta-chip">
                          <Clock size={12} /> ~{reviewResult.techDebtMinutes} min to fix
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="metrics-grid">
                  {Object.keys(reviewResult.metrics || {}).map((key) => {
                    const val = reviewResult.metrics[key];
                    return (
                      <div className="metric-item" key={key}>
                        <div className="metric-header">
                          <span className="metric-label">{key}</span>
                          <span className="metric-value">{val}%</span>
                        </div>
                        <div className="metric-bar-bg">
                          <div className="metric-bar-fill" style={{ width: `${val}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {reviewResult.strengths?.length > 0 && (
                  <div className="strengths-box">
                    <div className="strengths-title">What you did well</div>
                    <ul>
                      {reviewResult.strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="suggestions-container">
                <h4 className="suggestions-heading">
                  Detailed Suggestions ({reviewResult.suggestions?.length || 0})
                </h4>

                {!reviewResult.suggestions?.length ? (
                  <div className="no-issues-banner">No major issues found. Excellent work.</div>
                ) : (
                  reviewResult.suggestions.map((sug, idx) => {
                    const isExpanded = !!expandedSuggestions[idx];
                    return (
                      <div key={idx} className="suggestion-card">
                        <div className="suggestion-header" onClick={() => toggleSuggestion(idx)}>
                          <div className="suggestion-title">
                            <span className={`badge ${sug.type}`}>{sug.type}</span>
                            <span>
                              Lines {sug.lineStart}-{sug.lineEnd}
                            </span>
                          </div>
                          <div className={`severity-indicator ${sug.severity}`}>
                            Severity: <span>{sug.severity}</span>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="suggestion-body">
                            <p className="suggestion-desc">{sug.description}</p>
                            <DiffViewer
                              original={sug.originalCode}
                              suggested={sug.suggestedCode}
                              onApply={handleApplyFix}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div className="reviewer-welcome">
              <div className="welcome-icon">
                <Award size={36} />
              </div>
              <h2 className="welcome-title">Automated Code Review</h2>
              <p className="welcome-desc">
                On the left, use the <strong>Paste Code</strong> button (or Ctrl+V in the editor), then click <strong>Review</strong>.
                Results will appear here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
