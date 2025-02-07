import { withAuth } from "@/lib/auth";
import { getUserDataKey } from "@/lib/keys";
import { redisCache } from "@/lib/redis";

export const POST = withAuth(async (req, luciaUser) => {
  await redisCache.del(getUserDataKey(luciaUser.fid));

  return new Response("OK", { status: 200 });
});
