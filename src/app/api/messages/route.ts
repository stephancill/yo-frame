import { withAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUserData, getUserDatasCached, writeCast } from "@/lib/farcaster";
import { sendFrameNotification } from "@/lib/notifications";
import { withCache } from "@/lib/redis";
import { UserDataType } from "@farcaster/core";
import { sql } from "kysely";

export const GET = withAuth(async (req, user) => {
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limit = 50;

  // Subquery to get the most recent message for each conversation
  let query = db
    .selectFrom(
      db
        .selectFrom("messages")
        .innerJoin("users as fromUser", "messages.fromUserId", "fromUser.id")
        .innerJoin("users as toUser", "messages.toUserId", "toUser.id")
        .select([
          "messages.id",
          "messages.message",
          "messages.createdAt",
          "fromUser.id as fromUserId",
          "fromUser.fid as fromFid",
          "toUser.id as toUserId",
          "toUser.fid as toFid",
          sql<Date>`MAX("messages"."created_at") OVER (
            PARTITION BY 
              LEAST("from_user"."id", "to_user"."id"),
              GREATEST("from_user"."id", "to_user"."id")
          )`.as("maxCreatedAt"),
          sql<boolean>`
            "messages"."from_user_id" = ${user.id} 
            AND "messages"."created_at" > NOW() - INTERVAL '1 day'
          `.as("disabled"),
        ])
        .where((eb) =>
          eb.or([eb("fromUserId", "=", user.id), eb("toUserId", "=", user.id)])
        )
        .as("subquery")
    )
    .selectAll()
    .where((eb) => eb("createdAt", "=", eb.ref("maxCreatedAt")))
    .orderBy("createdAt", "desc")
    .limit(limit + 1);

  if (cursor) {
    query = query.where("createdAt", "<", new Date(cursor));
  }

  const messages = await query.execute();

  const presentFids = Array.from(
    new Set([
      ...messages.map((message) => message.fromFid),
      ...messages.map((message) => message.toFid),
    ])
  );
  const userDatas = await getUserDatasCached(presentFids);
  const users = userDatas.reduce((acc, m) => {
    acc[m.fid] = m;
    return acc;
  }, {} as Record<number, (typeof userDatas)[number]>);

  // Check if there are more results
  const hasMore = messages.length > limit;
  const results = messages.slice(0, limit);

  // Add message counts query
  const messageCounts = await db
    .selectFrom("messages")
    .select([
      sql<number>`COUNT(CASE WHEN from_user_id = ${user.id} THEN 1 END)`.as(
        "outbound"
      ),
      sql<number>`COUNT(CASE WHEN to_user_id = ${user.id} THEN 1 END)`.as(
        "inbound"
      ),
    ])
    .executeTakeFirst();

  return new Response(
    JSON.stringify({
      messages: results,
      users,
      nextCursor: hasMore
        ? results[results.length - 1].createdAt.toISOString()
        : null,
      messageCounts: {
        inbound: Number(messageCounts?.inbound || 0),
        outbound: Number(messageCounts?.outbound || 0),
      },
    }),
    { status: 200 }
  );
});

export const POST = withAuth(async (req, user) => {
  const { targetFid } = await req.json();

  const recentMessage = await db
    .selectFrom("messages")
    .innerJoin("users as fromUser", "messages.fromUserId", "fromUser.id")
    .innerJoin("users as toUser", "messages.toUserId", "toUser.id")
    .select([
      sql<boolean>`
        "messages"."from_user_id" = ${user.id} 
        AND "messages"."created_at" > NOW() - INTERVAL '1 day'
      `.as("disabled"),
    ])
    .where((eb) =>
      eb.or([
        eb.and([
          eb("fromUser.fid", "=", user.fid),
          eb("toUser.fid", "=", targetFid),
        ]),
        eb.and([
          eb("fromUser.fid", "=", targetFid),
          eb("toUser.fid", "=", user.fid),
        ]),
      ])
    )
    .orderBy("messages.createdAt", "desc")
    .limit(1)
    .executeTakeFirst();

  if (recentMessage?.disabled) {
    return new Response("Cannot send message - please wait 24 hours", {
      status: 403,
    });
  }

  // Check if we have notification details
  let targetUser = await db
    .selectFrom("users")
    .selectAll()
    .where("fid", "=", targetFid)
    .executeTakeFirst();

  if (!targetUser) {
    // Create user
    targetUser = await db
      .insertInto("users")
      .values({
        fid: targetFid,
      })
      .returningAll()
      .executeTakeFirst();

    if (!targetUser) {
      console.error("Failed to create user", { status: 500 });
      return Response.json({ error: "Failed to create user" }, { status: 500 });
    }
  }

  const insertedMessage = await db
    .insertInto("messages")
    .values({
      fromUserId: user.id,
      toUserId: targetUser.id,
      message: "yo",
    })
    .returningAll()
    .executeTakeFirst();

  if (!insertedMessage) {
    console.error("Failed to send message", { status: 500 });
    return Response.json({ error: "Failed to send message" }, { status: 500 });
  }

  const userData = await withCache(`user:${targetFid}`, () =>
    getUserData(user.fid)
  );

  const username = userData[UserDataType.USERNAME] || `!${user.fid}`;

  if (targetUser?.notificationUrl && targetUser?.notificationToken) {
    await sendFrameNotification({
      token: targetUser.notificationToken,
      url: targetUser.notificationUrl,
      title: `yo`,
      body: `from ${username}`,
      notificationId: insertedMessage.id,
      targetUrl: `${process.env.APP_URL}`,
    });
  } else {
    // Send with bot
    await writeCast({
      segments: [
        user.fid,
        ", someone sent you a yo. Check the your yobox to see who it's from.",
      ],
      embedUrls: [process.env.APP_URL],
      parentCastId: {
        fid: parseInt(process.env.FARCASTER_BOT_FID!),
        hash: "0x0e245dd1db062b2db03ab47aebee41a407a06a56",
      },
    });
  }

  return Response.json(insertedMessage, { status: 200 });
});
