import type { DevelopmentQueueStatus, EventName } from "@neuro/contracts";

export function getDevelopmentQueueStatusEventName(status: DevelopmentQueueStatus): EventName {
  switch (status) {
    case "planned":
      return "developmentQueue.planned";
    case "in_progress":
      return "developmentQueue.started";
    case "completed":
      return "developmentQueue.completed";
    case "archived":
      return "developmentQueue.archived";
    default:
      return "developmentQueue.queued";
  }
}
