# Multi-Agent System Specification: "ProposalGen MVP"

This file describes the architecture, roles, tools, and interactions of the AI agents within the Proposal Generation System. The system is designed as a RAG-based, multi-agent orchestrator built with TypeScript, LangGraph.js, and Convex.

## 1. Context & Ecostack

* **Goal:** Automate high-quality, persona-aware project proposals based on past successful pairs.
* **Core Stack:** TypeScript, LangGraph.js (Orchestration), Convex (Database, Vector Search, Actions), OpenAI (LLM).
* **Frontend:** Next.js with **shadcn/ui + Tailwind CSS** for rapid prototyping of the dashboard.
* **Integration (Future):** A **Chrome Extension** will act as the primary ingestion and deployment tool, scraping job listings from DOM and inserting generated proposals directly into the target website's text fields.

## 2. Overall Workflow Overview

The system operates in two distinct phases:

1.  **Phase 1: Learning (Ingestion):** Input successful `job-proposal` pairs -> Analyze & Profile (Analyzer) -> Vectorize -> Store in Convex DB (Vector + Structured Metadata).
2.  **Phase 2: Generation (Retrieval & Generation):**
    * *Trigger:* Chrome Extension scrapes new job data -> Sends to Convex Action.
    * *Flow:* Perform Vector Search (RAG) -> Generate Draft (Writer) -> Review & Refine (Critic loop) -> Produce Final Proposal.
    * *Deployment:* Final Proposal sent back to Chrome Extension for insertion.

## 3. Detailed Agent Specification

### Agent 1: Agent-Analyzer

* **Role:** Semantic Data Extractor & Style Profiler.
* **Purpose:** To convert unstructured text (potentially raw DOM scrapes or user inputs) into clean, structured data for effective RAG and precise persona mimicry.
* **Responsibilities:**
    * (Ingestion/Generation) Extract technical stack, core requirements, budget constraints, and client pain points from the job description. *Note: Must be robust enough to handle noise from scraped HTML text.*
    * (Ingestion) Analyze your unique writing style from past proposals to create a dynamic "Style Profile."
* **System Prompt (Persona):**
    > "You are an expert in semantic analysis and text profiling within the global tech and design sectors. Your superpower is distilling essence from noise. Your goal is to convert potentially raw, messy text from job listings (which may come from web scraping) and successful proposals into clear, structured data. You focus on facts: required technologies, materials, specific terminology, and the nuances of the author's unique Tone of Voice (e.g., 'concise, uses active verbs, focuses on ROI, explains technical concepts simply'). Your output must be structured JSON."
* **Structured Output (Zod Schema hint):**
    ```typescript
    z.object({
      tech_stack: z.array(z.string()),
      writing_style_analysis: z.object({
        formality: z.number().min(1).max(10),
        enthusiasm: z.number().min(1).max(10),
        key_vocabulary: z.array(z.string()),
        sentence_structure: z.string()
      }),
      project_constraints: z.array(z.string())
    })
    ```
* **Tools:** None. Operates as a pure LLM function.

---

### Agent 2: Agent-Writer

* **Role:** Persona-Aware Proposal Composer.
* **Purpose:** To synthesize a compelling, structured proposal for a *new* job by strictly mimicking your *past* successful writing persona, using retrieved examples as direct templates.
* **Responsibilities:**
    * Utilize Few-Shot prompting, treating retrieved past proposals as high-fidelity structural templates.
    * Strictly adhere to the Style Profile provided by the Agent-Analyzer.
    * Tailor the proposal structure to address the specific client pain points identified in the new job.
* **System Prompt (Persona):**
    > "You are a master copywriter specialized in crafting winning B2B proposals and pitches on global freelance platforms. Your main objective is to write a compelling proposal for a new job description, strictly mimicking the provided author's writing persona. You do not use generic AI phrases like 'I am writing to...'; you use the Few-Shot examples as direct structural and tonal templates. The proposal must address the client's needs immediately. The output should be ready for easy copy-pasting or automated insertion."
* **Input Data (Passed by Orchestrator):**
    1.  Cleaned text of the new job description.
    2.  RAG Context: 3-4 examples of *similar* past proposal texts.
    3.  Style Profile from Agent-Analyzer.
* **Output Data:** Clean Markdown or Plain Text (optimized for web text fields).
* **Tools:** None.

---

### Agent 3: Agent-Critic

* **Role:** QA & Style Consistency Editor.
* **Purpose:** To review the generated draft, ensuring it meets all new job requirements and perfectly matches your Style Profile. Acts as the safeguard before final output.
* **Responsibilities:**
    * Validate adherence to the new job requirements.
    * Check Tone of Voice and Style Profile match.
    * Identify and remove any generic AI "hallucinations" or fluff.
    * Provide actionable feedback to the Agent-Writer for refinement.
* **System Prompt (Persona):**
    > "You are a rigorous yet constructive editor-in-chief. Your goal is to ensure the generated proposal is flawless before deployment. You check the draft against three strict criteria: 1) Accuracy: Have we met all client requirements? 2) Authenticity: Does it perfectly match the author's Voice (Tone, vocabulary)? 3) Quality: Is it free of AI fluff or hallucinations? If the draft fails, you provide detailed, actionable critique to the Agent-Writer. You never approve mediocrity."
* **Structured Output (Zod Schema hint):**
    ```typescript
    z.object({
      status: z.enum(["APPROVED", "NEEDS_REVISION"]),
      critique_points: z.array(z.string()).optional() // Present only if NEEDS_REVISION
    })
    ```
* **Tools:** None.

## 4. Orchestration & State (LangGraph.js)

The agent interactions are orchestrated by **LangGraph.js**, which manages the system State within a Convex Action. The State includes:

* `newJobDescription`: Cleaned input text.
* `ragContext`: Retrieved past proposal pairs.
* `styleProfile`: Analyzer's output.
* `proposalDraft`: Writer's latest output.
* `criticFeedback`: Critic's latest output.

LangGraph.js will implement the logic of the iterative loop: *Writer -> Critic -> (if NEEDS_REVISION) -> Writer -> Critic -> ...* until APPROVED or a maximum iteration limit is reached.