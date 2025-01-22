import { db } from "../lib/db";
import readline from "readline";

async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("ERROR: DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  const messagesOnly = process.argv.includes("--messages");

  console.log(`Database URL: ${databaseUrl}`);
  const shouldProceed = await confirm(
    `Are you sure you want to proceed with ${
      messagesOnly ? "creating messages" : "seeding"
    }? ${!messagesOnly ? "This will clear existing data. " : ""}(y/N) `
  );

  if (!shouldProceed) {
    console.log("Operation cancelled");
    process.exit(0);
  }

  if (!messagesOnly) {
    // Clear existing data
    await db.deleteFrom("messages").execute();
    await db.deleteFrom("users").execute();

    const randomFids = Array.from({ length: 100 }, () =>
      Math.floor(Math.random() * 20000)
    );

    const fids = Array.from(new Set([2, 3, 1214, 1689, 20054, ...randomFids]));

    // Create users
    await db
      .insertInto("users")
      .values(
        fids.map((fid) => ({
          fid,
          notificationToken: fid % 3 !== 0 ? "test" : null,
          notificationUrl: fid % 3 !== 0 ? "http://example.com" : null,
        }))
      )
      .returningAll()
      .execute();
  }

  // Fetch existing users
  const users = await db.selectFrom("users").selectAll().execute();

  if (users.length < 2) {
    console.error(
      "Error: Need at least 2 users in the database to create messages"
    );
    process.exit(1);
  }

  // Clear existing messages if --messages flag is used
  if (messagesOnly) {
    await db.deleteFrom("messages").execute();
  }

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

main().catch((error) => {
  console.error("Error seeding database:", error);
  process.exit(1);
});
