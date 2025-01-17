import { Worker } from "bullmq";
import { NOTIFICATIONS_BULK_QUEUE_NAME } from "../lib/constants";
import { redisQueue } from "../lib/redis";
import { NotificationsBulkJobData } from "../types/jobs";
import { sendFrameNotifications } from "../lib/notifications";
import * as Sentry from "@sentry/nextjs";

export const notificationsBulkWorker = new Worker<NotificationsBulkJobData>(
  NOTIFICATIONS_BULK_QUEUE_NAME,
  async (job) => {
    try {
      const { notifications, url, body, notificationId, targetUrl, title } =
        job.data;

      const tokens = notifications.map(({ token }) => token);

      const result = await sendFrameNotifications({
        tokens,
        title,
        body,
        url,
        targetUrl,
        notificationId,
      });

      return result;
    } catch (error) {
      Sentry.captureException(error, {
        extra: {
          jobId: job.id,
          jobName: job.name,
          jobData: job.data,
        },
      });
      throw error; // Re-throw to ensure the job fails properly
    }
  },
  { connection: redisQueue, concurrency: 10 }
);
