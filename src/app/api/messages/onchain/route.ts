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

  const addressPairs = users
    .map((u, i) => ({
      fid: u.fid,
      address:
        u.verified_addresses.primary.eth_address ||
        u.verified_addresses.eth_addresses[0] ||
        null,
    }))
    .filter((pair) => pair.address !== null);

  const filteredFids = addressPairs.map((pair) => pair.fid);
  const filteredAddresses = addressPairs.map((pair) => pair.address);

  if (filteredAddresses.length === 0) {
    return Response.json({ error: "No addresses found" }, { status: 400 });
  }

  // Return transaction calldata
  const calldata = encodeFunctionData({
    abi: yoTokenAbi,
    functionName: "batchYo",
    args: [
      filteredAddresses.map((a) => a as `0x${string}`),
      filteredAddresses.map((a, i) =>
        stringToHex(
          JSON.stringify({ fromFid: user.fid, toFid: filteredFids[i] })
        )
      ),
    ],
  });

  return Response.json({
    calldata,
    fids: filteredFids,
    addresses: filteredAddresses,
  });
});
