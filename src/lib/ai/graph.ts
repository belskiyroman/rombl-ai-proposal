import { Annotation, END, START, StateGraph } from "@langchain/langgraph/web";

import {
  runAnalyzerNode,
  runCriticNode,
  runWriterNode,
  type AnalyzerNodeDependencies,
  type CriticNodeDependencies,
  type WriterNodeDependencies
} from "./nodes";
import type { ProposalGraphState } from "./state";

export const ProposalStateAnnotation = Annotation.Root({
  newJobDescription: Annotation<string>,
  ragContext: Annotation<Array<{ jobText: string; proposalText: string; similarity?: number }>>,
  styleProfile: Annotation<ProposalGraphState["styleProfile"]>,
  proposalDraft: Annotation<string>,
  criticFeedback: Annotation<ProposalGraphState["criticFeedback"]>,
  revisionCount: Annotation<number>,
  maxRevisions: Annotation<number>,
  executionTrace: Annotation<string[]>
});

export interface ProposalGraphNodeDependencies {
  analyzer: AnalyzerNodeDependencies;
  writer: WriterNodeDependencies;
  critic: CriticNodeDependencies;
}

export interface AnalyzerOnlyGraphDependencies {
  analyzer: AnalyzerNodeDependencies;
}

export function routeAfterCritic(state: ProposalGraphState): "writer" | typeof END {
  if (
    state.criticFeedback?.status === "NEEDS_REVISION" &&
    state.revisionCount < state.maxRevisions
  ) {
    return "writer";
  }

  return END;
}

export function createProposalGraph(dependencies: ProposalGraphNodeDependencies) {
  return new StateGraph(ProposalStateAnnotation)
    .addNode("analyzer", (state: ProposalGraphState) => runAnalyzerNode(state, dependencies.analyzer))
    .addNode("writer", (state: ProposalGraphState) => runWriterNode(state, dependencies.writer))
    .addNode("critic", (state: ProposalGraphState) => runCriticNode(state, dependencies.critic))
    .addEdge(START, "analyzer")
    .addEdge("analyzer", "writer")
    .addEdge("writer", "critic")
    .addConditionalEdges("critic", routeAfterCritic, ["writer", END]);
}

export function createAnalyzerOnlyGraph(dependencies: AnalyzerOnlyGraphDependencies) {
  return new StateGraph(ProposalStateAnnotation)
    .addNode("analyzer", (state: ProposalGraphState) => runAnalyzerNode(state, dependencies.analyzer))
    .addEdge(START, "analyzer")
    .addEdge("analyzer", END);
}

export async function runProposalGraph(
  initialState: ProposalGraphState,
  dependencies: ProposalGraphNodeDependencies
): Promise<ProposalGraphState> {
  const graph = createProposalGraph(dependencies).compile({
    name: "proposal_generation_graph"
  });

  return graph.invoke(initialState);
}

export async function runAnalyzerOnlyGraph(
  initialState: ProposalGraphState,
  dependencies: AnalyzerOnlyGraphDependencies
): Promise<ProposalGraphState> {
  const graph = createAnalyzerOnlyGraph(dependencies).compile({
    name: "ingestion_analyzer_graph"
  });

  return graph.invoke(initialState);
}

// Temporary alias kept for backward compatibility while the graph evolves.
export const createGraphSkeleton = createProposalGraph;
