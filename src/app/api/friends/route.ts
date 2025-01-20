import { withAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMutuals, getUserDatasCached } from "@/lib/farcaster";
import { getMutualsKey } from "@/lib/keys";
import { withCache } from "@/lib/redis";

export const GET = withAuth(async (req, user) => {
  const cursor = req.nextUrl.searchParams.get("cursor");
  const limit = 20;

  const mutuals = await withCache(
    getMutualsKey(user.fid),
    () => getMutuals(user.fid),
    {
      ttl: 60 * 60 * 24 * 7,
    }
  );

  let query = db
    .selectFrom("users")
    .leftJoin("messages", (join) =>
      join.on((eb) =>
        eb.and([
          eb.or([
            eb("messages.fromUserId", "=", eb.ref("users.id")),
            eb("messages.toUserId", "=", eb.ref("users.id")),
          ]),
          eb("messages.fromUserId", "=", user.id),
        ])
      )
    )
    .select(["users.id", "users.fid", "users.createdAt"])
    .where(
      "users.fid",
      "in",
      mutuals.map((m) => m.fid)
    )
    .where("users.notificationToken", "is not", null)
    .where("messages.id", "is", null)
    .orderBy("users.createdAt", "desc")
    .limit(limit + 1);

  // Add cursor pagination
  if (cursor) {
    query = query.where("users.createdAt", "<", new Date(cursor));
  }

  const mutualsWithNotifications = await query.execute();

  // Check if there are more results
  const hasMore = mutualsWithNotifications.length > limit;
  const results = mutualsWithNotifications.slice(0, limit);

  const userDatas = await getUserDatasCached(results.map((m) => m.fid));

  const users = userDatas.reduce((acc, m) => {
    acc[m.fid] = m;
    return acc;
  }, {} as Record<number, (typeof userDatas)[number]>);

  return Response.json({
    rows: mutualsWithNotifications,
    users,
    nextCursor: hasMore
      ? results[results.length - 1].createdAt.toISOString()
      : null,
  });
});
