// Facade for the task-hub service layer.
// The implementation was split by responsibility into ./service/*; this file
// re-exports the original public surface so external importers stay unchanged.
export {
  listTasks,
  listMyTasks,
  getOwnedTaskSummary,
  getTaskSummary,
  listApplications,
  listAgentProposals,
  listVisibleAgentProposals,
} from "./service/views";
export {
  createTaskDraft,
  createTask,
} from "./service/tasks";
export {
  createAgentProposal,
  acceptAgentProposal,
  rejectAgentProposal,
} from "./service/proposals";
export { applyToTask } from "./service/applications";
export {
  dispatchTask,
  getDispatchDecision,
} from "./service/dispatch";
export {
  runOwnedAgentMarketplaceAutoProposalSweep,
  runGlobalAgentMarketplaceAutoProposalSweep,
} from "./service/marketplace-matching";
export {
  settleTaskLifecycleByOperatorInTx,
  advanceTaskLifecycle,
} from "./service/lifecycle";
