# Structured Proposal Engine

This file is the source-of-truth architecture note for the current project.

## 1. Product Goal

The system generates grounded freelance proposals from three controlled inputs:

- structured understanding of the new job
- atomic candidate evidence blocks
- curated reusable patterns from a deduplicated historical case library

The goal is not to copy past proposals. The goal is to reuse high-signal patterns and factual evidence while avoiding fabrication, generic filler, and near-duplicate output.

## 2. Stack Boundary

- Next.js App Router + React 19
- Convex for storage, vector search, actions, and queries
- LangGraph.js for online orchestration
- OpenAI via LangChain/OpenAI wrappers
- Zod for structured contracts
- Vitest for tests

## 3. Core Data Model

### Candidate layer

- `candidate_profiles`
  - canonical candidate identity and positioning
  - stores `candidateId`, `displayName`, `positioningSummary`, `toneProfile`, `coreDomains`, `preferredCtaStyle`, and metadata

- `candidate_evidence_blocks`
  - atomic, grounded fact units used during generation
  - source is either `candidate_profile` or `case_inference`
  - types: `project`, `responsibility`, `tech`, `impact`, `domain`, `achievement`
  - each block stores text, tags, structured fields, confidence, active state, and embedding

### Historical case library

- `historical_cases`
  - canonical case record
  - stores raw and normalized job/proposal text
  - stores structured `jobExtract`, `proposalExtract`, quality scores, optional outcomes, cluster membership, canonical flag
  - stores three embeddings:
    - `rawJobEmbedding`
    - `jobSummaryEmbedding`
    - `needsEmbedding`
  - currently also keeps an optional `source` field only as a compatibility shim for older local Convex documents; new logic must not rely on it

- `proposal_clusters`
  - dedupe control for exact and near-duplicate proposals
  - stores representative case, cluster size, fingerprint, quality score, and duplicate method

- `proposal_fragments`
  - reusable `opening`, `proof`, and `closing` components extracted from canonical cases
  - stores text, tags, quality metrics, retrieval eligibility, and embedding

### Observability

- `generation_runs`
  - immutable saved generation snapshots
  - stores:
    - job input
    - ordered proposal questions
    - job understanding
    - candidate snapshot
    - selected evidence
    - proposal plan
    - execution trace
    - retrieved ids and retrieved-context snapshot
    - draft history
    - critique history
    - copy-risk result
    - step telemetry and telemetry summary
    - final proposal cover letter
    - cover-letter character count
    - structured question answers
    - unresolved proposal questions

- `generation_handoffs`
  - temporary import records used by the Chrome extension handoff flow
  - stores source metadata plus extracted `jobTitle`, `jobDescription`, and ordered `proposalQuestions`
  - used only for fallback/manual prefill into `/generate?handoff=...`

There are no legacy V1 tables in the current schema.

## 4. Candidate Management

Candidate management is handled through `convex/profiles.ts`.

### Public APIs

- `profiles.listCandidateProfiles`
- `profiles.getNextCandidateId`
- `profiles.getCandidateProfile`
- `profiles.getCandidateProfileSummary`
- `profiles.listCandidateEvidenceBlocks`
- `profiles.upsertCandidateProfile`
- `profiles.ingestCandidateEvidence`
- `profiles.deleteCandidateEvidenceBlock`
- `profiles.deleteCandidate`

### Behavior

- Candidate creation and updates write to `candidate_profiles`
- Candidate metadata may include reusable external profile URLs (`githubUrl`, `websiteUrl`, `portfolioUrl`) for exact-link screening questions
- Candidate-authored evidence writes to `candidate_evidence_blocks`
- Candidate deletion cascades through evidence, fragments, historical cases, clusters, and saved generation runs
- The UI treats candidate selection as the workspace context; users do not manually manage separate member entities anymore

## 5. Read APIs

Library and saved-run read models are split out of write actions.

### Library queries

- `library.listCanonicalCases`
- `library.listClusters`
- `library.getHistoricalCaseDetail`
- `library.getHistoricalCasesByIds`
- `library.getProposalFragmentsByIds`
- `library.getCandidateEvidenceByIds`

### Saved run queries

- `runs.listGenerationRuns`
- `runs.getGenerationRun`

### Handoff queries

- `handoffs.getGenerationHandoff`

### Extension generation queries

- `generate.getGenerationProgressById`
- `runs.getGenerationRunById`

## 6. Historical Case Library

Historical case processing is handled through `convex/cases.ts` and `src/lib/proposal-engine/offline.ts`.

### Public APIs

- `cases.ingestHistoricalCase`
- `cases.updateHistoricalCase`
- `cases.deleteHistoricalCase`
- `cases.promoteHistoricalCase`

### Processing flow

Each historical case is processed as:

1. normalize job and proposal text
2. extract `JobExtract`
3. extract `ProposalExtract`
4. score quality with rubric
5. compare against canonical proposals for dedupe/clustering
6. select or update cluster representative
7. create reusable fragments
8. derive seed evidence blocks from the case
9. generate embeddings
10. persist all artifacts

### Deduplication

- exact duplicates collapse into the same cluster
- near-duplicates are detected with deterministic cosine similarity over normalized proposal text
- threshold: `>= 0.92`
- only one canonical representative per cluster is retrieval-eligible by default

Representative selection prefers, in order:

1. higher outcome score
2. lower genericness
3. higher specificity
4. shorter cleaner text

## 7. Generation Entry Points

Online proposal generation is handled through `convex/generate.ts`.

### Public API

- `generate.createProposal`
- `generate.startProposalGeneration`

### Extension handoff

- `POST /api/extension/handoffs`
  - validates extension payload
  - creates a temporary `generation_handoff`
  - returns a short handoff id plus `/generate?handoff=...`

### Extension-native generation

- `GET /api/extension/candidates`
- `POST /api/extension/generate`
- `GET /api/extension/generate/status?id=...`

The extension-native path is asynchronous:

1. start a `generation_progress`
2. schedule background proposal generation in Convex
3. poll progress from the side panel
4. render the final proposal in the extension without leaving the job page

### Behavior

- writes immutable saved snapshots into `generation_runs`
- returns the generated proposal plus the saved run id for history/detail screens
- uses the structured proposal engine in `src/lib/proposal-engine`

## 8. Structured Contracts

### Job extraction

`JobExtract` contains:

- `projectType`
- `domain`
- `requiredSkills`
- `optionalSkills`
- `senioritySignals`
- `deliverables`
- `constraints`
- `stack`
- `softSignals`
- `jobLengthBucket`
- `clientNeeds`
- `summary`

### Proposal extraction

`ProposalExtract` contains:

- `hook`
- `valueProposition`
- `experienceClaims`
- `techMapping`
- `proofPoints`
- `cta`
- `tone`
- `lengthBucket`
- `specificityScore`
- `genericnessScore`

### Online job understanding

`JobUnderstanding` contains:

- `jobSummary`
- `clientNeeds`
- `mustHaveSkills`
- `niceToHaveSkills`
- `projectRiskFlags`
- `proposalStrategy`

### Proposal plan

`ProposalPlan` contains:

- `openingAngle`
- ordered `mainPoints`
- `selectedEvidenceIds`
- `selectedFragmentIds`
- `avoid`
- `ctaStyle`

### Critique

`DraftCritique` contains:

- rubric scores for `relevance`, `specificity`, `credibility`, `tone`, `clarity`, `ctaStrength`
- `issues`
- `revisionInstructions`
- `approvalStatus`
- `copyRisk`

## 9. Retrieval Strategy

Retrieval is not a single raw-text RAG query.

### Lane A: similar canonical cases

- search both `jobSummaryEmbedding` and `needsEmbedding`
- union results
- rerank with weighted score:
  - semantic similarity `0.45`
  - must-skill overlap `0.20`
  - domain/project-type match `0.15`
  - quality score `0.10`
  - outcome score `0.10`
- enforce cluster diversity
- final output: exactly `3` canonical cases

### Lane B: reusable proposal fragments

- retrieve fragments independently of full-case retrieval
- final output:
  - `2` openings
  - `3` proof fragments
  - `1` closing
- at most one fragment per cluster per fragment type

### Lane C: candidate evidence

- retrieve evidence blocks from `candidate_evidence_blocks`
- enforce coverage:
  - at least `2` project/impact blocks
  - at least `1` tech block
  - at least `1` responsibility/domain block
  - max `2` blocks of the same type
- final output: exactly `4` evidence blocks

## 10. Online Generation Graph

The online graph lives in `src/lib/proposal-engine/graph.ts`.

### Nodes

1. `job_understanding`
2. `retrieve_context`
3. `select_evidence`
4. `plan_proposal`
5. `write_draft`
6. `enforce_length`
7. `critique`
8. `revise_if_needed`

### Loop behavior

- first pass writes one draft
- every draft pass goes through `enforce_length` before critique
- critique evaluates it
- if critique returns `NEEDS_REVISION`, run `revise_if_needed`
- stop after `2` total critique passes

### Grounding rule

The writer may use only:

- the new job input
- selected candidate evidence
- selected reusable fragments and canonical patterns

The writer must not invent:

- projects
- domain expertise
- outcomes
- certifications
- team size
- unsupported technical claims

## 11. Copy-Risk Guardrail

The engine uses deterministic copy-risk scoring before approval.

Implemented signals:

- paragraph cosine similarity
- full-draft trigram overlap

Default thresholds:

- paragraph cosine `>= 0.96`
- trigram overlap `>= 0.35`

If triggered, critique must treat the draft as revision-worthy.

## 12. Model Split

### Fast model

Used for:

- job extraction
- proposal extraction
- quality scoring
- candidate evidence extraction
- job understanding
- evidence selection
- proposal planning
- critique

### Stronger model

Used for:

- first draft writing
- rewrite after critique

## 13. Current Routes

- `/ingest`
  - candidate workspace
  - create, edit, and delete candidates
  - ingest and manage candidate-authored evidence
  - ingest historical cases

- `/pairs`
  - canonical case library
  - create, inspect, edit, delete, and promote historical cases
  - review duplicate clusters

- `/generate`
  - proposal generation console
  - shows retrieved signals, selected evidence, proposal plan, evaluator trace, telemetry, and final proposal
  - accepts `?handoff=...` and prefills the form from a temporary extension import
  - acts as fallback/manual tooling, not the primary extension UX

- `/generate/history`
  - saved run history

- `/generate/history/[id]`
  - immutable saved run detail

There is no legacy pair detail route anymore.

## 14. Chrome Extension

- `chrome-extension/`
  - Chrome MV3 Upwork-only importer and side-panel generator
  - side panel is the primary extension UX
  - popup/open-in-app flow is fallback only
  - options page stores the configurable app URL
  - background worker enables side-panel-on-action-click and clears tab-scoped state
  - side panel captures the current Upwork Submit Proposal page, expands the full job description before capture, lets the user review/edit job input plus proposal questions, select a candidate, poll generation, and autofill both the proposal cover letter and question fields on the page
  - cover letters are capped at 5000 characters; generation compresses or deterministically reduces over-limit drafts internally instead of surfacing a length-only failure
  - content script reuses the shared Upwork parser instead of duplicating selectors

## 15. Contributor Rules

When working in this repo:

1. Treat the current schema as the only source of truth.
2. Do not reintroduce legacy style-profile retrieval or raw proposal RAG as a primary path.
3. Reuse the structured proposal-engine schemas before changing prompts or storage.
4. Preserve cluster-aware retrieval diversity.
5. Preserve evidence-grounded writing rules.
6. Preserve deterministic copy-risk checks.
7. Keep saved generation runs immutable.
8. Do not introduce new product logic that depends on `historical_cases.source`; it exists only for compatibility with older local data.

## 16. Deferred Feature

Multi-draft generation plus final ranking is intentionally deferred.

The current shipped path is:

- single draft
- critique
- up to two total passes

If implementation and this document diverge, update this file to match the shipped behavior.
