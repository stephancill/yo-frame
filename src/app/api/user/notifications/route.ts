import { withAuth } from "@/lib/auth";
import { setUserNotificationDetails } from "@/lib/notifications";
import { db } from "@/lib/db";

export const PATCH = withAuth(async (req, user) => {
  const { token, url, notificationType } = await req.json();

  if (token && url) {
    await setUserNotificationDetails(user.fid, {
      token,
      url,
    });
  }

  if (notificationType) {
    await db
      .updateTable("users")
      .set({
        notificationType,
      })
      .where("id", "=", user.id)
      .execute();
  }

  return Response.json({ success: true });
});
