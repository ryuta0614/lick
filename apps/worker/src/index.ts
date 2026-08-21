import "./env.js";
import { logger } from "@social-growth-os/shared";
import { startWorkers } from "./workers/index.js";

const workers = startWorkers();
logger.info("worker.started", { queues: workers.length });

async function shutdown() {
  logger.info("worker.shutting_down");
  await Promise.all(workers.map((worker) => worker.close()));
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
