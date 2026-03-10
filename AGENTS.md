# Structured Proposal Engine V2

This file is the source-of-truth architecture note for the current project. It replaces the earlier V1 mental model built around style-profile retrieval and direct proposal few-shoting.

## 1. Product Goal

The system generates grounded freelance proposals from three controlled inputs:

- structured understanding of the new job
- atomic candidate evidence blocks
- curated reusable patterns from a cleaned, deduplicated historical case library

The goal is not to copy past proposals. The goal is to reuse high-signal patterns and factual evidence while avoiding fabrication, generic filler, and near-duplicate output.

## 2. Stack Boundary

- Next.js App Router + React 19
- Convex for storage, vector search, actions, and queries
- LangGraph.js for online orchestration
- OpenAI via LangChain/OpenAI wrappers
- Zod for structured contracts
- Vitest for tests

The stack remains the same. The architecture inside the stack is now V2.

## 3. Core Data Model

### Candidate profile layer

- `candidate_profiles`
  - canonical candidate identity and positioning
  - `candidateId`, `displayName`, `positioningSummary`, `toneProfile`, `coreDomains`, `preferredCtaStyle`, metadata

- `candidate_evidence_blocks`
  - atomic, grounded fact units used during generation
  - source is either `candidate_profile` or `case_inference`
  - types: `project`, `responsibility`, `tech`, `impact`, `domain`, `achievement`
  - each block stores text, tags, structured fields, confidence, active state, and embedding

### Historical case library

- `historical_cases`
  - canonical V2 case record
  - stores raw and normalized job/proposal text
  - stores structured `jobExtract`, `proposalExtract`, quality scores, optional outcomes, cluster membership, canonical flag
  - stores three embeddings:
    - `rawJobEmbedding`
    - `jobSummaryEmbedding`
    - `needsEmbedding`

- `proposal_clusters`
  - dedupe control for exact and near-duplicate proposals
  - stores representative case, cluster size, fingerprint, quality score, and duplicate method

- `proposal_fragments`
  - reusable `opening`, `proof`, and `closing` components extracted from canonical cases
  - stores text, tags, quality metrics, retrieval eligibility, and embedding

### Observability

- `generation_runs_v2`
  - stores the full V2 run trace:
    - job input
    - job understanding
    - retrieved ids
    - selected evidence
    - proposal plan
    - draft history
    - critique history
    - copy-risk result
    - final proposal

### Legacy V1 tables

These still exist only to support backfill and migration:

- `raw_jobs`
- `style_profiles`
- `processed_proposals`
- `jobProposalPairs`
- `generationRuns`

New features must not use them as the primary source of truth.

## 4. Offline Pipeline

Implemented through V2 ingestion actions and helpers.

### Entry points

- `cases.ingestHistoricalCase`
- `cases.backfillFromV1`
- `profiles.upsertCandidateProfile`
- `profiles.ingestCandidateEvidence`

### Historical case processing

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

### Backfill

`cases.backfillFromV1` migrates V1 `raw_jobs + processed_proposals + style_profiles` into:

- candidate profiles
- historical cases
- clusters
- fragments
- seed evidence blocks

## 5. Structured Contracts

### Job extraction

`JobExtract` must contain:

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

`ProposalExtract` must contain:

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

`JobUnderstanding` must contain:

- `jobSummary`
- `clientNeeds`
- `mustHaveSkills`
- `niceToHaveSkills`
- `projectRiskFlags`
- `proposalStrategy`

### Proposal plan

`ProposalPlan` must contain:

- `openingAngle`
- ordered `mainPoints`
- `selectedEvidenceIds`
- `selectedFragmentIds`
- `avoid`
- `ctaStyle`

### Critique

`DraftCritique` must contain:

- rubric scores for `relevance`, `specificity`, `credibility`, `tone`, `clarity`, `ctaStrength`
- `issues`
- `revisionInstructions`
- `approvalStatus`
- `copyRisk`

## 6. Retrieval Strategy

V2 retrieval is not a single raw-text RAG query.

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

## 7. Online Generation Graph

The V2 online graph lives in `src/lib/ai/v2/graph.ts`.

### Nodes

1. `job_understanding`
2. `retrieve_context`
3. `select_evidence`
4. `plan_proposal`
5. `write_draft`
6. `critique`
7. `revise_if_needed`

### Loop behavior

- first pass writes one draft
- critique evaluates it
- if critique returns `NEEDS_REVISION`, run `revise_if_needed`
- stop after `2` total critique passes

### Grounding rule

The writer may use only:

- the new job input
- selected candidate evidence
- selected reusable fragments/patterns

The writer must not invent:

- projects
- domain expertise
- outcomes
- certifications
- team size
- unsupported technical claims

## 8. Copy-Risk Guardrail

V2 uses deterministic copy-risk scoring before approval.

Implemented signals:

- paragraph cosine similarity
- full-draft trigram overlap

Default thresholds:

- paragraph cosine `>= 0.96`
- trigram overlap `>= 0.35`

If triggered, critique must treat the draft as revision-worthy.

## 9. Model Split

### Small / fast model

Used for:

- job extraction
- proposal extraction
- quality scoring
- candidate evidence extraction
- job understanding
- evidence selection
- proposal planning
- critique

### Stronger / reasoning model

Used for:

- first draft writing
- rewrite after critique

## 10. UI Architecture

The frontend still follows shadcn/ui wrapper rules.

- reusable primitives live in `src/components/ui`
- feature components must not import Radix directly
- forms use shadcn form wrappers + `react-hook-form` + `zodResolver`
- toasts use `use-toast`, `toast.tsx`, and `toaster.tsx`
- dynamic classes use `cn` from `src/lib/utils.ts`

### Current routes

- `/ingest`
  - V2 ingestion console
  - candidate profile, candidate evidence, historical case ingest, V1 backfill

- `/pairs`
  - canonical case library
  - duplicate cluster review

- `/generate`
  - V2 generation console
  - shows retrieved signals, selected evidence, proposal plan, evaluator trace, and final proposal

## 11. Contributor Rules

When working in this repo:

1. Treat V2 tables as the only write target for new functionality.
2. Keep V1 tables read-only except for migration/backfill support.
3. Reuse the V2 structured schemas before changing prompts or storage.
4. Preserve cluster-aware retrieval diversity.
5. Preserve evidence-grounded writing rules.
6. Preserve deterministic copy-risk checks.
7. Do not reintroduce style-profile-only generation as the primary path.

## 12. Future Feature

Multi-draft generation plus final ranker is intentionally deferred.

It is a future capability, not current shipped behavior.

The current V2 path is:

- single draft
- critique
- up to two total passes

If implementation and this document diverge, update this file to match the shipped V2 behavior.
