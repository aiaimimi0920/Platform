export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new TypeError("Concurrency must be a positive integer");
  }

  if (items.length === 0) {
    return [];
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;
  let stopped = false;

  async function runWorker() {
    while (!stopped) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) {
        return;
      }

      try {
        results[index] = await mapper(items[index]!, index);
      } catch (error) {
        stopped = true;
        throw error;
      }
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}
