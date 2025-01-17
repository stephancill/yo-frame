import { Queue } from "bullmq";
import { NOTIFICATIONS_BULK_QUEUE_NAME } from "./constants";
import { redisQueue } from "./redis";

export const notificationsBulkQueue = new Queue(NOTIFICATIONS_BULK_QUEUE_NAME, {
  connection: redisQueue,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "fixed",
      delay: 30_000,
    },
    removeOnComplete: 1000,
    removeOnFail: 1000,
  },
});
