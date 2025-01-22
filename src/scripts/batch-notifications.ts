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
    // Get the latest message for each conversation in the last hour
    const messages = await db
      .selectFrom(
        db
          .selectFrom("messages")
          .innerJoin("users as fromUser", "messages.fromUserId", "fromUser.id")
          .select([
            "messages.id",
            "fromUser.fid as fromFid",
            "messages.fromUserId",
            "messages.toUserId",
            "messages.createdAt",
            sql<Date>`MAX("messages"."created_at") OVER (
              PARTITION BY 
                LEAST("from_user_id", "to_user_id"),
                GREATEST("from_user_id", "to_user_id")
            )`.as("maxCreatedAt"),
          ])
          .where((eb) =>
            eb.or([
              eb("messages.fromUserId", "=", user.id),
              eb("messages.toUserId", "=", user.id),
            ])
          )
          .where(
            "messages.createdAt",
            ">",
            sql<Date>`NOW() - INTERVAL '1 hour'`
          )
          .as("subquery")
      )
      .selectAll()
      .where((eb) => eb("createdAt", "=", eb.ref("maxCreatedAt")))
      // Only get conversations where the last message was TO the user
      .where("toUserId", "=", user.id)
      .orderBy("createdAt", "desc")
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
