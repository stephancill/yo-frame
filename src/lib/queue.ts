import { Queue } from "bullmq";
import {
  NOTIFICATIONS_BULK_QUEUE_NAME,
  ONCHAIN_MESSAGE_QUEUE_NAME,
} from "./constants";
import { redisQueue } from "./redis";
import { NotificationsBulkJobData, OnchainMessageJobData } from "../types/jobs";

export const notificationsBulkQueue = new Queue<NotificationsBulkJobData>(
  NOTIFICATIONS_BULK_QUEUE_NAME,
  {
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
  }
);

export const onchainMessageQueue = new Queue<OnchainMessageJobData>(
  ONCHAIN_MESSAGE_QUEUE_NAME,
  {
    connection: redisQueue,
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: "fixed",
        delay: 2_000,
      },
      removeOnComplete: false,
      removeOnFail: false,
    },
  }
);
