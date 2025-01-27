import { withAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUserDatasCached } from "@/lib/farcaster";
import { sql } from "kysely";

export const GET = withAuth<{ params: Promise<{ userIdOrFid: string }> }>(
  async (req, luciaUser, { params }) => {
    const { userIdOrFid } = await params;

    let userQuery = db
      .selectFrom("users")
      .select([
        "users.fid",
        "users.id",
        sql<number>`COUNT(CASE WHEN messages.from_user_id = users.id THEN 1 END)`.as(
          "outbound"
        ),
        sql<number>`COUNT(CASE WHEN messages.to_user_id = users.id THEN 1 END)`.as(
          "inbound"
        ),
        sql<number>`COUNT(CASE WHEN messages.from_user_id = users.id AND messages.is_onchain = true THEN 1 END)`.as(
          "outboundOnchain"
        ),
        sql<number>`COUNT(CASE WHEN messages.to_user_id = users.id AND messages.is_onchain = true THEN 1 END)`.as(
          "inboundOnchain"
        ),
        sql<number>`(
          SELECT COUNT(*) + 1 FROM users AS u2 
          WHERE (
            SELECT COUNT(*) FROM messages WHERE from_user_id = u2.id OR to_user_id = u2.id
          ) > (
            SELECT COUNT(*) FROM messages WHERE from_user_id = users.id OR to_user_id = users.id
          )
        )`.as("rank"),
      ])
      .leftJoin("messages", (join) =>
        join.on((eb) =>
          eb.or([
            eb("messages.fromUserId", "=", eb.ref("users.id")),
            eb("messages.toUserId", "=", eb.ref("users.id")),
          ])
        )
      )
      .groupBy(["users.id", "users.fid"]);

    let fid: number | null = null;

    if (isNaN(Number(userIdOrFid))) {
      userQuery = userQuery.where("users.id", "=", userIdOrFid);
    } else {
      fid = parseInt(userIdOrFid);
      userQuery = userQuery.where("users.fid", "=", fid);
    }

    const dbUser = await userQuery.executeTakeFirst();

    // const [userData] = await getUserDatasCached([fid || dbUser!.fid]);

    return Response.json({
      messageCounts: {
        inbound: Number(dbUser?.inbound || 0),
        outbound: Number(dbUser?.outbound || 0),
        inboundOnchain: Number(dbUser?.inboundOnchain || 0),
        outboundOnchain: Number(dbUser?.outboundOnchain || 0),
      },
      rank: dbUser ? Number(dbUser.rank || 0) : null,
    });
  }
);
