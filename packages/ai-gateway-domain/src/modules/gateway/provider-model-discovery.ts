import { mapWithConcurrency } from "@neuro/backend-foundation/async/map-with-concurrency";

export const GATEWAY_PROVIDER_MODEL_DISCOVERY_CONCURRENCY = 6;

export async function discoverGatewayProviderModelIds<T>(args: {
  providers: readonly T[];
  discover: (provider: T) => Promise<string[]>;
  fallback: (provider: T) => Promise<string[]>;
  concurrency?: number;
}) {
  return mapWithConcurrency(
    args.providers,
    args.concurrency ?? GATEWAY_PROVIDER_MODEL_DISCOVERY_CONCURRENCY,
    async (provider) => {
      try {
        return await args.discover(provider);
      } catch {
        return args.fallback(provider);
      }
    },
  );
}
