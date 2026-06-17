import {
  normalizeAgentExecutionLaunchPresetFocusSection,
  toAgentExecutionLaunchPresetFocusSectionFragment,
} from "@/lib/agent-execution-launch-presets";
import { appendQueryStringToRedirectTarget } from "@/lib/platform-action-utils";

function appendFragmentToPath(path: string, fragment?: string | null) {
  return fragment ? `${path}#${encodeURIComponent(fragment)}` : path;
}

export function buildAgentExecutionsRedirectTarget(args: {
  params?: URLSearchParams;
  focusSection?: string | null;
}) {
  const target = appendFragmentToPath(
    "/agent-executions",
    toAgentExecutionLaunchPresetFocusSectionFragment(
      normalizeAgentExecutionLaunchPresetFocusSection(args.focusSection ?? null),
    ),
  );
  return args.params ? appendQueryStringToRedirectTarget(target, args.params) : target;
}
