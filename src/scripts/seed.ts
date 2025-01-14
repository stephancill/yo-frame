import { db } from "../lib/db";

async function main() {
  // Clear existing data
  await db.deleteFrom("messages").execute();
  await db.deleteFrom("users").execute();

  const randomFids = Array.from({ length: 100 }, () =>
    Math.floor(Math.random() * 20000)
  );

  const fids = Array.from(new Set([2, 3, 1214, 1689, 20054, ...randomFids]));

  // Create users
  const users = await db
    .insertInto("users")
    .values(fids.map((fid) => ({ fid })))
    .returningAll()
    .execute();

  // Generate random timestamps over the past 3 days
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  const timestamps = Array.from({ length: 10000 }, () => {
    return new Date(
      threeDaysAgo.getTime() +
        Math.random() * (now.getTime() - threeDaysAgo.getTime())
    );
  }).sort((a, b) => a.getTime() - b.getTime());

  // Create random messages between users
  const messages = await db
    .insertInto("messages")
    .values(
      timestamps.map((timestamp) => {
        // Randomly select sender and receiver
        const fromUser = users[Math.floor(Math.random() * users.length)];
        let toUser;
        do {
          toUser = users[Math.floor(Math.random() * users.length)];
        } while (toUser.id === fromUser.id); // Ensure sender != receiver

        return {
          fromUserId: fromUser.id,
          toUserId: toUser.id,
          message: `yo`,
          createdAt: timestamp,
        };
      })
    )
    .returningAll()
    .execute();

  console.log(`Created ${messages.length} messages`);
}

main();
