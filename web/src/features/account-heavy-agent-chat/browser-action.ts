import type {
  HeavyChatActionType,
  HeavyChatMessageActionRequest,
  HeavyChatMessageActionResult,
} from "@neuro/contracts";

type BrowserRequest = (
  pathname: string,
  init: RequestInit,
) => Promise<{ result: HeavyChatMessageActionResult }>;

export async function runHeavyChatBrowserAction(args: {
  messageId: string;
  type: HeavyChatActionType;
  request: BrowserRequest;
  refresh: () => Promise<unknown>;
}): Promise<HeavyChatMessageActionResult> {
  const input: HeavyChatMessageActionRequest = { type: args.type };
  const response = await args.request(
    `/api/heavy-chat/messages/${encodeURIComponent(args.messageId)}/actions`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
  await args.refresh();
  return response.result;
}
