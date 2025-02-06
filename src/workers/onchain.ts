import { Worker } from "bullmq";
import { sql } from "kysely";
import { decodeAbiParameters, getAddress, hexToString } from "viem/utils";
import { ONCHAIN_MESSAGE_QUEUE_NAME } from "../lib/constants";
import { db } from "../lib/db";
import { getUsersByAddressesCached } from "../lib/farcaster";
import { notifyUsers } from "../lib/notifications";
import { redisCache, redisQueue } from "../lib/redis";
import { OnchainMessageJobData } from "../types/jobs";
import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";
import { getUserDataByAddressKey } from "../lib/keys";

export const onchainMessageWorker = new Worker<OnchainMessageJobData>(
  ONCHAIN_MESSAGE_QUEUE_NAME,
  async (job) => {
    const { transactionHash, fromAddress, toAddress, amount, data } = job.data;

    // Look up user accounts from addresses
    let { [fromAddress]: fromUsers, [toAddress]: toUsers } =
      await getUsersByAddressesCached([
        getAddress(fromAddress),
        getAddress(toAddress),
      ]);

    const neynarClient = new NeynarAPIClient(
      new Configuration({
        apiKey: process.env.NEYNAR_API_KEY!,
      })
    );

    // Try again with uncached users
    if (!fromUsers) {
      fromUsers = (
        await neynarClient.fetchBulkUsersByEthOrSolAddress({
          addresses: [getAddress(fromAddress)],
        })
      ).users;

      if (fromUsers.length > 0) {
        // Expire the cache
        await redisCache.del(getUserDataByAddressKey(fromAddress));
      }
    }

    if (!toUsers) {
      toUsers = (
        await neynarClient.fetchBulkUsersByEthOrSolAddress({
          addresses: [getAddress(toAddress)],
        })
      ).users;

      if (toUsers.length > 0) {
        // Expire the cache
        await redisCache.del(getUserDataByAddressKey(toAddress));
      }
    }

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
