# Automated Code Reviewer - Reviewer.AI

An intelligent, full-stack automated code review system built with **React**, **Node.js (Express)**, **Gemini AI (Google GenAI)**, and **ChromaDB Cloud**.

This application analyzes code in any programming language, provides detailed scores (Security, Performance, Readability, Maintainability), generates visual line-by-line diff recommendations, allows you to **auto-apply code suggestions** directly back into the editor with one click, enables interactive refactoring chat, remembers review history semantically in **ChromaDB**, and visualizes code health statistics over time.

---

## Key Features

1. **Monaco Editor Workspace**: VS Code–grade editor with syntax highlighting, file upload, and **inline issue highlighting** on problematic lines.
2. **AI-Powered Code Review**: `gemini-2.5-flash` with structured JSON — scores, metrics, strengths, complexity, and estimated tech-debt fix time.
3. **Semantic Memory (ChromaDB Cloud)**: Stores reviews at `api.trychroma.com`. **RAG panel** shows similar past snippets used as context for consistent recommendations.
4. **Visual Diff & One-Click Fixes**: Side-by-side diffs with **Apply Fix** or **Apply All** to patch the editor instantly.
5. **Language Auto-Detect**: AI detects language from pasted code (or from uploaded file extension).
6. **Interactive Refactoring Chat**: Ask the AI to refactor live code; changes apply directly in the editor.
7. **Export Reports**: Download full review reports as Markdown.
8. **Review History**: Keyword or **semantic search** over past reviews in ChromaDB.
9. **Insights Dashboard**: Trends, issue breakdowns, and activity charts via Recharts.

---

## Getting Started

### Prerequisites

- **Node.js** (v18.0.0 or higher)
- **NPM** (v9.0.0 or higher)

### Environment Configuration

Configure your API keys in `backend/.env`. A template is provided in `backend/.env.example`:

1. Open `backend/.env`
2. Add your **Gemini API Key**:
   ```env
   GEMINI_API_KEY=YOUR_GEMINI_API_KEY
   ```
3. Add your **ChromaDB Cloud Key**:
   ```env
   CHROMA_API_KEY=YOUR_CHROMA_API_KEY
   ```
   *Note: Tenant and Database settings are preconfigured to the parameters provided:*
   ```env
   CHROMA_HOST=api.trychroma.com
   CHROMA_TENANT=0d59f2f2-3122-4407-b10f-076b2471c986
   CHROMA_DATABASE=aii
   ```
   
> **Mock Mode Fallback**: If you do not have a ChromaDB API Key yet, the application will run in **Mock Memory Mode**. All search, analytics, and history features remain functional in memory.

---

## Installation & Running

1. **Install Dependencies**:
   You can install all root, backend, and frontend packages with the following root script command:
   ```bash
   npm run install-all
   ```

2. **Start Dev Servers**:
   Launch both the backend Express server (port `5000`) and Vite frontend dev server (port `5173`) concurrently:
   ```bash
   npm run dev
   ```

3. **Open the App**:
   Navigate to the URL printed in your console (usually `http://localhost:5173`).
# automated-code-reviewer
