import { Worker } from "bullmq";
import { ONCHAIN_MESSAGE_QUEUE_NAME } from "../lib/constants";
import { redisQueue } from "../lib/redis";
import { OnchainMessageJobData } from "../types/jobs";
import { processOnchainMessageTx } from "../lib/onchain";
import { db } from "../lib/db";
import { getUsersByAddresses } from "../lib/farcaster";
import { getAddress } from "viem/utils";
import { notifyUsers } from "../lib/notifications";

export const onchainMessageWorker = new Worker<OnchainMessageJobData>(
  ONCHAIN_MESSAGE_QUEUE_NAME,
  async (job) => {
    const { transactionHash, fromAddress, toAddress, amount, data } = job.data;

    // Look up user accounts from addresses
    const { [fromAddress]: fromUser, [toAddress]: toUser } =
      await getUsersByAddresses([
        getAddress(fromAddress),
        getAddress(toAddress),
      ]);

    if (!fromUser || !toUser) {
      console.log("Farcaster user not found", {
        [fromAddress]: fromUser?.fid,
        [toAddress]: toUser?.fid,
      });
      return;
    }

    // Look up or create users in db
    const result = await db
      .selectFrom("users")
      .select((eb) => [
        eb
          .selectFrom("users")
          .select("id")
          .where("fid", "=", fromUser.fid)
          .as("fromUser"),
        eb
          .selectFrom("users")
          .select("id")
          .where("fid", "=", toUser.fid)
          .as("toUser"),
        eb
          .selectFrom("users")
          .select("notificationToken")
          .where("fid", "=", toUser.fid)
          .as("toUserNotificationToken"),
        eb
          .selectFrom("users")
          .select("notificationUrl")
          .where("fid", "=", toUser.fid)
          .as("toUserNotificationUrl"),
      ])
      .executeTakeFirstOrThrow();

    let {
      fromUser: fromUserId,
      toUser: toUserId,
      toUserNotificationToken,
      toUserNotificationUrl,
    } = result;

    if (!fromUserId) {
      ({ id: fromUserId } = await db
        .insertInto("users")
        .values({
          fid: fromUser.fid,
        })
        .returningAll()
        .executeTakeFirstOrThrow());
    }

    if (!toUserId) {
      ({ id: toUserId } = await db
        .insertInto("users")
        .values({
          fid: toUser.fid,
        })
        .returningAll()
        .executeTakeFirstOrThrow());
    }

    // Insert message into db
    await db
      .insertInto("messages")
      .values({
        fromUserId,
        toUserId,
        message: "yo",
        isOnchain: true,
        transactionHash,
      })
      .executeTakeFirstOrThrow();

    // Notify users
    if (toUserNotificationToken && toUserNotificationUrl) {
      await notifyUsers({
        users: [
          {
            fid: toUser.fid,
            token: toUserNotificationToken,
            url: toUserNotificationUrl,
          },
        ],
        title: "super yo ★",
        body: `from ${fromUser.username || `!${fromUser.fid}`}`,
        targetUrl: process.env.APP_URL,
      });
    }
  },
  { connection: redisQueue, concurrency: 2 }
);
