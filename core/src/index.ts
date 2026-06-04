import { env } from "@/env";
import { buildServer } from "@/server";

async function main() {
  const app = await buildServer();
  await app.listen({ host: "0.0.0.0", port: env.port });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
