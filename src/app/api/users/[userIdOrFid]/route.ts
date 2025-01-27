import { withAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUserDatasCached } from "@/lib/farcaster";

export const GET = withAuth<{ params: Promise<{ userIdOrFid: string }> }>(
  async (req, luciaUser, { params }) => {
    const { userIdOrFid } = await params;

    let fid;

    if (isNaN(Number(userIdOrFid))) {
      const user = await db
        .selectFrom("users")
        .select("fid")
        .where("users.id", "=", userIdOrFid)
        .executeTakeFirst();

      if (!user) {
        return Response.json({ error: "User not found" }, { status: 400 });
      }

      fid = user.fid;
    } else {
      fid = parseInt(userIdOrFid);
    }

    const [userData] = await getUserDatasCached([fid]);

    return Response.json({ userData });
  }
);
