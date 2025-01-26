import { Worker } from "bullmq";
import { sql } from "kysely";
import { decodeAbiParameters, getAddress, hexToString } from "viem/utils";
import { ONCHAIN_MESSAGE_QUEUE_NAME } from "../lib/constants";
import { db } from "../lib/db";
import { getUsersByAddresses } from "../lib/farcaster";
import { notifyUsers } from "../lib/notifications";
import { redisQueue } from "../lib/redis";
import { OnchainMessageJobData } from "../types/jobs";

export const onchainMessageWorker = new Worker<OnchainMessageJobData>(
  ONCHAIN_MESSAGE_QUEUE_NAME,
  async (job) => {
    const { transactionHash, fromAddress, toAddress, amount, data } = job.data;

    // Look up user accounts from addresses
    const { [fromAddress]: fromUsers, [toAddress]: toUsers } =
      await getUsersByAddresses([
        getAddress(fromAddress),
        getAddress(toAddress),
      ]);

    if (!fromUsers || !toUsers) {
      console.log("Farcaster user not found", {
        fromAddress,
        toAddress,
      });
      return {
        success: false,
        message: "Farcaster user not found",
      };
    }

    let desiredFromFid: number | undefined = undefined;
    let desiredToFid: number | undefined = undefined;

    if (data.length > 0) {
      try {
        const metadata = JSON.parse(hexToString(data));
        desiredFromFid = metadata.fromFid;
        desiredToFid = metadata.toFid;
      } catch (error) {
        console.error("Failed to parse metadata", error);
      }
    }

    const fromUser = desiredFromFid
      ? fromUsers.find((u) => u.fid === desiredFromFid)
      : fromUsers[0];
    const toUser = desiredToFid
      ? toUsers.find((u) => u.fid === desiredToFid)
      : toUsers[0];

    if (!fromUser || !toUser) {
      console.log("Farcaster user not found", {
        [fromAddress]: fromUser?.fid,
        [toAddress]: toUser?.fid,
      });
      return {
        success: false,
        message: "Farcaster user not found",
      };
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

    // If both users exist, check last message between them
    if (fromUserId && toUserId) {
      // Check last message between these users
      const lastMessage = await db
        .selectFrom("messages")
        .select([
          "fromUserId",
          "createdAt",
          sql<boolean>`created_at > NOW() - INTERVAL '1 day'`.as(
            "timeoutElapsed"
          ),
        ])
        .where((eb) =>
          eb.or([
            eb.and([
              eb("fromUserId", "=", fromUserId),
              eb("toUserId", "=", toUserId),
            ]),
            eb.and([
              eb("fromUserId", "=", toUserId),
              eb("toUserId", "=", fromUserId),
            ]),
          ])
        )
        .orderBy("createdAt", "desc")
        .limit(1)
        .executeTakeFirst();

      if (
        !lastMessage?.timeoutElapsed &&
        lastMessage?.fromUserId === fromUserId
      ) {
        console.log(
          "Rejecting message: sender must wait 24 hours between messages"
        );
        return {
          success: false,
          message:
            "Rejecting message: sender must wait 24 hours between messages",
        };
      }
    }

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

    // Notify recipient
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

    return {
      success: true,
      message: "Message sent",
      fromFid: fromUser.fid,
      toFid: toUser.fid,
      desiredFromFid: desiredFromFid ?? null,
      desiredToFid: desiredToFid ?? null,
    };
  },
  { connection: redisQueue, concurrency: 5 }
);
