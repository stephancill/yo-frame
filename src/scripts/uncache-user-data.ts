import { redisCache } from "../lib/redis";

async function deleteUserCacheData(): Promise<number> {
  let totalDeleted = 0;
  let cursor = "0";
  const pattern = "farcaster:users:*";

  try {
    // Use scan to iterate through keys without blocking Redis
    do {
      // The scan command returns an array where the first element is the next cursor
      // and the second element is an array of keys from the current scan
      const [nextCursor, keys] = await redisCache.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        // Delete the batch of keys
        const deleted = await redisCache.del(...keys);
        totalDeleted += deleted;
        console.log(
          `Deleted ${deleted} keys in this batch. Total deleted: ${totalDeleted}`
        );
      }
    } while (cursor !== "0");

    console.log(
      `Successfully deleted all ${totalDeleted} keys matching pattern: ${pattern}`
    );

    // Close the Redis connection
    await redisCache.quit();
    return totalDeleted;
  } catch (error) {
    console.error("Error deleting Redis keys:", error);
    await redisCache.quit();
    throw error;
  }
}

// Execute the function
deleteUserCacheData()
  .then((count) =>
    console.log(`Operation completed. Total keys deleted: ${count}`)
  )
  .catch((err) => console.error("Failed to delete cache data:", err));
