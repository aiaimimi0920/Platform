import { and, eq, ne } from "drizzle-orm";

import { tasks } from "@/modules/task-hub/schema";

export function buildPublishedTaskCreatorFilter(userId: string) {
  return and(eq(tasks.creatorUserId, userId), ne(tasks.status, "draft"))!;
}
