import { createProposalEngineRunners } from "../proposal-engine/agents";
import { createProposalEngineGraph } from "../proposal-engine/graph";
import type { CopyRisk } from "../proposal-engine/schemas";
import type { RetrievedContextBundle } from "../proposal-engine/state";

function createEmptyRetrievedContext(): RetrievedContextBundle {
  return {
    similarCases: [],
    fragments: {
      openings: [],
      proofs: [],
      closings: []
    },
    evidenceCandidates: []
  };
}

function createNoCopyRisk(): CopyRisk {
  return {
    triggered: false,
    maxParagraphCosine: 0,
    trigramOverlap: 0,
    matchedCaseIds: [],
    matchedFragmentIds: [],
    reasons: []
  };
}

export const proposalEngineLocalGraph = createProposalEngineGraph({
  runners: createProposalEngineRunners(),
  retrieveContext: async () => ({
    retrievedContext: createEmptyRetrievedContext(),
    stepTelemetry: []
  }),
  assessCopyRisk: () => createNoCopyRisk()
}).compile({
  name: "structured_proposal_engine_local"
});
