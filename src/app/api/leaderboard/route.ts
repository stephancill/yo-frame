import { withAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUserDatasCached } from "@/lib/farcaster";
import { sql } from "kysely";

export const GET = withAuth(async (req, user) => {
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limit = 50;
  const offset = cursor ? parseInt(cursor) : 0;

  // Main leaderboard query without rank
  let query = db
    .selectFrom("users")
    .select([
      "users.fid",
      sql<number>`(SELECT COUNT(*) FROM messages WHERE from_user_id = users.id)`.as(
        "messages_sent"
      ),
      sql<number>`(SELECT COUNT(*) FROM messages WHERE to_user_id = users.id)`.as(
        "messages_received"
      ),
      sql<number>`(
        (SELECT COUNT(*) FROM messages WHERE from_user_id = users.id) +
        (SELECT COUNT(*) FROM messages WHERE to_user_id = users.id)
      )`.as("total_messages"),
    ])
    .orderBy(
      sql`(
      (SELECT COUNT(*) FROM messages WHERE from_user_id = users.id) +
      (SELECT COUNT(*) FROM messages WHERE to_user_id = users.id)
    )`,
      "desc"
    )
    .offset(offset)
    .limit(limit + 1);

  const leaderboard = await query.execute();

  // Get current user stats (keeping rank calculation here)
  const currentUserStats = await db
    .selectFrom("users")
    .select([
      "users.fid",
      sql<number>`(SELECT COUNT(*) FROM messages WHERE from_user_id = users.id)`.as(
        "messages_sent"
      ),
      sql<number>`(SELECT COUNT(*) FROM messages WHERE to_user_id = users.id)`.as(
        "messages_received"
      ),
      sql<number>`(
        (SELECT COUNT(*) FROM messages WHERE from_user_id = users.id) +
        (SELECT COUNT(*) FROM messages WHERE to_user_id = users.id)
      )`.as("total_messages"),
      sql<number>`(
        SELECT COUNT(*) + 1 FROM users AS u2 
        WHERE (
          SELECT COUNT(*) FROM messages WHERE from_user_id = u2.id OR to_user_id = u2.id
        ) > (
          SELECT COUNT(*) FROM messages WHERE from_user_id = users.id OR to_user_id = users.id
        )
      )`.as("rank"),
    ])
    .where("users.id", "=", user.id)
    .executeTakeFirst();

  // Get user data for all FIDs
  const fids = Array.from(new Set([...leaderboard.map((entry) => entry.fid)]));
  const userDatas = await getUserDatasCached(fids);
  const users = userDatas.reduce((acc, userData) => {
    acc[userData.fid] = userData;
    return acc;
  }, {} as Record<number, (typeof userDatas)[number]>);

  // Check if there are more results
  const hasMore = leaderboard.length > limit;
  const results = leaderboard.slice(0, limit).map((entry, index) => ({
    ...entry,
    rank: index + 1 + offset,
  }));

  return Response.json({
    leaderboard: results,
    users,
    currentUser: currentUserStats,
    nextCursor: hasMore ? offset + limit : null,
  });
});
