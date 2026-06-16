/**
 * Owner-specific components — these contain editing logic (POST calls, config dialogs).
 * Currently re-exported from the legacy monolithic files at the module root.
 * Future work should extract the owner-specific editing logic into this directory.
 */
export {
  AccountHonorExecutionPanel,
  AccountHonorArchiveSection,
  AccountHonorSignalSection,
} from "../account-honor-panel";

export { AccountHonorCenter } from "../account-honor-center";
export { AccountHonorEntry } from "../account-honor-entry";
export { useAgentShowcaseConfig } from "./agent-showcase-config";
export type { UseAgentShowcaseConfigProps } from "./agent-showcase-config";
export { AccountHonorTaglineEditor } from "./tagline-editor";
export type { AccountHonorTaglineEditorProps } from "./tagline-editor";
