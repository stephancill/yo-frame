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

    if (isNaN(Number(userIdOrFid))) {
      userQuery = userQuery.where("users.id", "=", userIdOrFid);
    } else {
      userQuery = userQuery.where("users.fid", "=", parseInt(userIdOrFid));
    }

    const dbUser = await userQuery.executeTakeFirst();

    if (!dbUser) {
      return Response.json({ error: "User not found" }, { status: 400 });
    }

    const [userData] = await getUserDatasCached([dbUser.fid]);

    return Response.json({
      userData,
      messageCounts: {
        inbound: Number(dbUser.inbound || 0),
        outbound: Number(dbUser.outbound || 0),
      },
    });
  }
);
