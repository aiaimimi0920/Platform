import { listExecutorTasks, runExecutorTask } from "@/tasks";

async function main() {
  const supportedTasks = listExecutorTasks() as Parameters<typeof runExecutorTask>[0][];
  const [taskKey] = process.argv.slice(2);
  if (!taskKey) {
    throw new Error(`Missing executor task key. Supported tasks: ${supportedTasks.join(", ")}`);
  }

  if (!supportedTasks.includes(taskKey as Parameters<typeof runExecutorTask>[0])) {
    throw new Error(`Unsupported executor task "${taskKey}". Supported tasks: ${supportedTasks.join(", ")}`);
  }

  await runExecutorTask(taskKey as Parameters<typeof runExecutorTask>[0]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
