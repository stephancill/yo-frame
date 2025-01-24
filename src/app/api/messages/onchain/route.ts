import { yoTokenAbi } from "@/abi/yoTokenAbi";
import { withAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUserDatasCached } from "@/lib/farcaster";
import { encodeFunctionData, stringToHex } from "viem/utils";

export const POST = withAuth(async (req, user) => {
  const { targetFids } = await req.json();

  if (!targetFids) {
    return Response.json({ error: "No target fids provided" }, { status: 400 });
  }

  // Look up addresses for users
  const users = await getUserDatasCached(targetFids);

  const addresses = users.map(
    (u) => u.verified_addresses.eth_addresses[0] || null
  );
  const filteredFids = users
    .filter((u, i) => addresses[i] !== null)
    .map((u) => u.fid);
  const filteredAddresses = addresses.filter(Boolean);

  if (addresses.length === 0) {
    return Response.json({ error: "No addresses found" }, { status: 400 });
  }

  // Return transaction calldata
  const calldata = encodeFunctionData({
    abi: yoTokenAbi,
    functionName: "batchYo",
    args: [
      filteredAddresses.map((a) => a as `0x${string}`),
      filteredAddresses.map((a) =>
        stringToHex(JSON.stringify({ fromFid: user.fid }))
      ),
    ],
  });

  return Response.json({
    calldata,
    fids: filteredFids,
    addresses: filteredAddresses,
  });
});
