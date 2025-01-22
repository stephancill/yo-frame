import "dotenv/config";
import { db } from "@/lib/db";
import { getUserDatasCached } from "@/lib/farcaster";
import { notifyUsers } from "@/lib/notifications";
import { sql } from "kysely";

async function sendBatchNotifications() {
  // Get all users with hourly notifications
  const usersToNotify = await db
    .selectFrom("users")
    .selectAll()
    .where("notificationType", "=", "hourly")
    .where("notificationUrl", "is not", null)
    .where("notificationToken", "is not", null)
    .execute();

  for (const user of usersToNotify) {
    //Only return messages received by the user after the user's last sent message within the last hour
    const messages = await db
      .selectFrom("messages")
      .innerJoin("users as fromUser", "messages.fromUserId", "fromUser.id")
      .select([
        "messages.id",
        "fromUser.fid as fromFid",
        "messages.fromUserId",
        "messages.toUserId",
        "messages.createdAt",
      ])
      .where("messages.toUserId", "=", user.id)
      .where("messages.createdAt", ">", sql<Date>`NOW() - INTERVAL '1 hour'`)
      .where("messages.createdAt", ">", (eb) =>
        eb
          .selectFrom("messages")
          .select(sql<Date>`MAX(created_at)`.as("lastSentAt"))
          .where("messages.fromUserId", "=", user.id)
      )
      .orderBy("messages.createdAt", "desc")
      .execute();

    if (messages.length === 0) continue;

    // Get unique sender FIDs
    const senderFids = [...new Set(messages.map((m) => m.fromFid))];
    const [firstSenderUserData] = await getUserDatasCached([senderFids[0]]);

    // Get the first sender's username for the notification
    const firstUsername = firstSenderUserData?.username || `!${senderFids[0]}`;

    // Construct notification message
    const othersCount = senderFids.length - 1;
    const body =
      othersCount > 0
        ? `from ${firstUsername} and ${othersCount} other${
            othersCount > 1 ? "s" : ""
          }`
        : `from ${firstUsername}`;

    // Send notification
    await notifyUsers({
      users: [
        {
          fid: user.fid,
          token: user.notificationToken!,
          url: user.notificationUrl!,
        },
      ],
      title: "yo",
      body,
      targetUrl: process.env.APP_URL,
      notificationId: messages[0].id,
    });
  }
}

// Execute if running directly
if (require.main === module) {
  sendBatchNotifications()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Error sending batch notifications:", error);
      process.exit(1);
    });
}

export { sendBatchNotifications };
