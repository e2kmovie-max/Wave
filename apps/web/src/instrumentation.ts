/**
 * Next.js instrumentation hook.
 *
 * Runs once when the Node server boots (not during the build, not on edge),
 * and is the canonical place to start long-running background jobs in a
 * Next.js 15 app. We use it to:
 *
 *   1. Sync `INSTANCES_JSON` into Mongo (env-managed records only; admin-
 *      added records are left alone).
 *   2. Start a /health probe loop so the master always knows which instances
 *      are alive when it goes to schedule a room.
 *
 * Failures here are logged but never crash the process — the rest of the app
 * (login, /miniapp, …) must keep working even if Mongo is briefly down.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { connectMongo, syncInstancesFromEnv, startInstanceHealthLoop } = await import(
    "@wave/player"
  );
  const { getEnv } = await import("@wave/interface");
  const env = getEnv();

  try {
    await connectMongo();
  } catch (err) {
    console.error("[wave] instrumentation: mongo connect failed:", err);
    return;
  }

  if (env.INSTANCES_JSON.trim() !== "") {
    try {
      const report = await syncInstancesFromEnv(env.INSTANCES_JSON);
      console.info(
        `[wave] instances synced from env: upserted=${report.upserted} unchanged=${report.unchanged} skippedAdminOwned=${report.skippedAdminOwned} totalEnv=${report.totalEnv}`,
      );
    } catch (err) {
      console.error("[wave] instrumentation: INSTANCES_JSON sync failed:", err);
    }
  } else {
    console.info("[wave] INSTANCES_JSON is empty — skipping env sync");
  }

  startInstanceHealthLoop({
    intervalSeconds: env.INSTANCE_HEALTH_INTERVAL_SECONDS,
    timeoutMs: env.INSTANCE_HEALTH_TIMEOUT_MS,
  });
  console.info(
    `[wave] instance health loop started (interval=${env.INSTANCE_HEALTH_INTERVAL_SECONDS}s, timeout=${env.INSTANCE_HEALTH_TIMEOUT_MS}ms)`,
  );
}
