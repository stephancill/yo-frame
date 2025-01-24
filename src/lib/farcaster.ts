import {
  CastType,
  FarcasterNetwork,
  makeCastAdd,
  makeCastRemove,
  makeUserDataAdd,
  Message,
  NobleEd25519Signer,
  UserDataAddMessage,
  UserDataType,
} from "@farcaster/core";
import { hexToBytes } from "@farcaster/frame-node";
import { Configuration, NeynarAPIClient } from "@neynar/nodejs-sdk";
import { type User as NeynarUser } from "@neynar/nodejs-sdk/build/api";
import {
  QueryParameter,
  DuneClient,
  RunQueryArgs,
} from "@duneanalytics/client-sdk";
import { getUserDataByAddressKey, getUserDataKey } from "./keys";
import { redisCache } from "./redis";
import { getAddress } from "viem/utils";

type CastTextSegment = string | number;

export async function writeCast({
  segments,
  embedUrls,
  parentUrl,
  parentCastId,
}: {
  segments: CastTextSegment[];
  embedUrls: string[];
  parentUrl?: string;
  parentCastId?: {
    fid: number;
    hash: `0x${string}`;
  };
}) {
  const mentions: number[] = [];
  const mentionsPositions: number[] = [];

  const text = segments.reduce<string>((acc, segment) => {
    if (typeof segment === "number") {
      mentions.push(segment);
      mentionsPositions.push(acc.length);
      return acc;
    }
    return acc + segment;
  }, "");

  const signer = new NobleEd25519Signer(
    hexToBytes(process.env.FARCASTER_BOT_SIGNER! as `0x${string}`)
  );

  if (process.env.NODE_ENV === "development" && !process.env.FARCASTER) {
    console.log("Sending cast (skipped)", { text, embeds: embedUrls });
    return;
  }

  const castAddMessage = await makeCastAdd(
    {
      text,
      embeds: embedUrls.map((url) => ({ url })),
      mentions,
      mentionsPositions,
      parentUrl,
      type: CastType.CAST,
      embedsDeprecated: [],
      parentCastId: parentCastId
        ? {
            fid: parentCastId.fid,
            hash: hexToBytes(parentCastId.hash),
          }
        : undefined,
    },
    {
      fid: parseInt(process.env.FARCASTER_BOT_FID!),
      network: FarcasterNetwork.MAINNET,
    },
    signer
  );

  if (castAddMessage.isErr()) {
    throw castAddMessage.error;
  }

  const castAdd = castAddMessage.value;

  const responseJson = await submitMessage(castAdd);

  return responseJson;
}

export async function writeUserData({
  type,
  value,
}: {
  type: UserDataType;
  value: string;
}) {
  const signer = new NobleEd25519Signer(
    hexToBytes(process.env.FARCASTER_BOT_SIGNER! as `0x${string}`)
  );

  const userDataMessage = await makeUserDataAdd(
    {
      type,
      value,
    },
    {
      fid: parseInt(process.env.FARCASTER_BOT_FID!),
      network: FarcasterNetwork.MAINNET,
    },
    signer
  );

  if (userDataMessage.isErr()) {
    throw userDataMessage.error;
  }

  const responseJson = await submitMessage(userDataMessage.value);

  return responseJson;
}
export async function removeCast(targetHash: `0x${string}`) {
  const signer = new NobleEd25519Signer(
    hexToBytes(process.env.FARCASTER_BOT_SIGNER! as `0x${string}`)
  );

  const castRemoveMessage = await makeCastRemove(
    {
      targetHash: hexToBytes(targetHash),
    },
    {
      fid: parseInt(process.env.FARCASTER_BOT_FID!),
      network: FarcasterNetwork.MAINNET,
    },
    signer
  );

  if (castRemoveMessage.isErr()) {
    throw castRemoveMessage.error;
  }

  const responseJson = await submitMessage(castRemoveMessage.value);

  return responseJson;
}

async function submitMessage(message: Message) {
  const messageEncoded = Message.encode(message).finish();

  const response = await fetch(`${process.env.HUB_URL!}/v1/submitMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      api_key: process.env.HUB_API_KEY || "",
    },
    body: messageEncoded,
  });

  if (!response.ok) {
    throw new Error(`Failed to submit message: ${await response.text()}`);
  }

  const responseJson = await response.json();

  return responseJson;
}

export async function getUserData(fid: number) {
  const res = await fetch(`${process.env.HUB_URL}/v1/userDataByFid?fid=${fid}`);

  if (!res.ok) {
    throw new Error(
      `Failed to fetch user data: ${res.statusText} (${res.status})`
    );
  }

  const data = (await res.json()) as { messages: any[] };

  const userData = data.messages.reduce<
    Record<UserDataType, string | undefined>
  >((acc, message) => {
    const decoded = Message.fromJSON(message) as UserDataAddMessage;

    acc[decoded.data.userDataBody.type] = decoded.data.userDataBody.value;
    return acc;
  }, {} as Record<UserDataType, string | undefined>);

  return userData;
}

export async function getUserDatasCached(
  fids: number[]
): Promise<NeynarUser[]> {
  if (fids.length === 0) {
    return [];
  }

  const neynarClient = new NeynarAPIClient(
    new Configuration({
      apiKey: process.env.NEYNAR_API_KEY!,
    })
  );

  // Get users from cache
  const cachedUsersRes = await redisCache.mget(
    fids.map((fid) => getUserDataKey(fid))
  );
  const cachedUsers: NeynarUser[] = cachedUsersRes
    .filter((user) => user !== null)
    .map((user) => JSON.parse(user));

  // Users to fetch
  const cachedUserFids = new Set(cachedUsers.map((user) => user.fid));
  const uncachedFids = fids.filter((fid) => !cachedUserFids.has(fid));

  if (uncachedFids.length === 0) {
    return cachedUsers;
  }

  // TODO: Implement pagination
  if (uncachedFids.length > 100) {
    throw new Error("Can't fetch more than 100 users at a time");
  }

  const res = await neynarClient.fetchBulkUsers({ fids: uncachedFids });

  // Cache fetched users
  await redisCache.mset(
    res.users
      .map((user) => [getUserDataKey(user.fid), JSON.stringify(user)])
      .flat()
  );

  // Set expiration for all newly cached users
  let multi = redisCache.multi();
  for (const user of res.users) {
    multi = multi.expire(getUserDataKey(user.fid), 60 * 60 * 24 * 3); // 3 days
  }
  await multi.exec();

  return [...cachedUsers, ...res.users];
}

export async function getUsersByAddresses(addresses: `0x${string}`[]) {
  if (addresses.length === 0) {
    return {};
  }

  const neynarClient = new NeynarAPIClient(
    new Configuration({
      apiKey: process.env.NEYNAR_API_KEY!,
    })
  );

  // Get users from cache
  const cachedUsersRes = await redisCache.mget(
    addresses.map((address) => getUserDataByAddressKey(address))
  );
  const cachedUsers = cachedUsersRes.map((user) =>
    user ? (JSON.parse(user) as NeynarUser) : null
  );

  // Create map of cached address -> user
  const uncachedAddresses: `0x${string}`[] = [];

  const result = cachedUsers.reduce<
    Record<`0x${string}`, NeynarUser | undefined>
  >((acc, user, index) => {
    const address = addresses[index];
    if (user) {
      acc[address] = user;
    } else {
      uncachedAddresses.push(address);
    }
    return acc;
  }, {});

  if (uncachedAddresses.length === 0) {
    return result;
  }

  // Fetch uncached users
  const res = await neynarClient.fetchBulkUsersByEthOrSolAddress({
    addresses: uncachedAddresses,
  });

  console.log("res", res);

  // Cache fetched users and add to result
  await redisCache.mset(
    Object.entries(res).map(([addressRaw, users]) => {
      const addressKey = getAddress(addressRaw) as `0x${string}`;
      // Update result
      result[addressKey] = users[0];
      return [getUserDataByAddressKey(addressKey), JSON.stringify(users[0])];
    })
  );

  // Set expiration for all newly cached addresses
  let multi = redisCache.multi();
  for (const [addressRaw] of Object.entries(res)) {
    multi = multi.expire(
      getUserDataByAddressKey(getAddress(addressRaw) as `0x${string}`),
      60 * 60 * 24 * 3
    ); // 3 days
  }
  await multi.exec();

  console.log("result", result);

  return result;
}

export async function getMutuals(fid: number) {
  const neynarClient = new NeynarAPIClient(
    new Configuration({
      apiKey: process.env.NEYNAR_API_KEY!,
    })
  );
  const res = await neynarClient.fetchRelevantFollowers({
    targetFid: fid,
    viewerFid: fid,
  });

  const users = res.all_relevant_followers_dehydrated
    .map((f) => f.user)
    .filter((f) => f !== undefined);

  return users;
}
