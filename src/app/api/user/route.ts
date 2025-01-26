import { withAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { User } from "@/types/user";
import { getUserDatasCached } from "../../../lib/farcaster";

export const GET = withAuth(async (req, luciaUser) => {
  // Check if the fid is already registered
  const dbUser = await db
    .selectFrom("users")
    .selectAll()
    .where("users.id", "=", luciaUser.id)
    .executeTakeFirst();

  if (!dbUser) {
    return Response.json({ error: "User not found" }, { status: 400 });
  }

  const [userData] = await getUserDatasCached([dbUser.fid]);

  const user: User = {
    fid: dbUser.fid,
    id: dbUser.id,
    notificationsEnabled: dbUser.notificationUrl !== null,
    notificationType: dbUser.notificationType,
    neynarUser: userData,
  };

  return Response.json(user);
});
