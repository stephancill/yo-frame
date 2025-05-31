import { lucia } from "@/lib/auth";
import { db } from "@/lib/db";
import { redisCache } from "@/lib/redis";
import { createAppClient, viemConnector } from "@farcaster/auth-client";
import { NextRequest } from "next/server";

const selectUser = db.selectFrom("users").selectAll();

export async function POST(req: NextRequest) {
  const { message, signature, challengeId, referrerId } = await req.json();

  if (!signature || !challengeId || !message) {
    console.error("Missing required fields", {
      signature,
      challengeId,
      message,
    });
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const challenge = await redisCache.get(`challenge:${challengeId}`);

  if (!challenge) {
    console.error("Challenge not found", { challengeId });
    return Response.json({ error: "Challenge not found" }, { status: 400 });
  }

  const appClient = createAppClient({
    ethereum: viemConnector(),
  });

  const verifyResponse = await appClient.verifySignInMessage({
    message,
    signature,
    domain: new URL(process.env.APP_URL ?? "").hostname,
    nonce: challenge,
    acceptAuthAddress: true,
  });

  if (!verifyResponse.success) {
    console.error("Invalid signature", { verifyResponse });
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  const fid = verifyResponse.fid;

  // Check if the fid is already registered
  const existingUser = await selectUser
    .where("fid", "=", fid)
    .executeTakeFirst();

  let dbUser: typeof existingUser;

  if (existingUser) {
    dbUser = existingUser;
  } else {
    // Create user
    try {
      // Create the new user and migrate messages in a transaction
      dbUser = await db.transaction().execute(async (trx) => {
        const newUser = await trx
          .insertInto("users")
          .values({
            fid,
          })
          .returningAll()
          .executeTakeFirst();

        if (!newUser) {
          throw new Error("Failed to create user");
        }

        return newUser;
      });

      if (!dbUser) {
        throw new Error("Failed to create user");
      }
    } catch (error) {
      console.error(error);

      if (error instanceof Error) {
        return Response.json({ error: error.message }, { status: 500 });
      }

      return Response.json({ error: "Failed to create user" }, { status: 500 });
    }
  }

  if (!dbUser) {
    console.error("No db user found");
    return Response.json({ error: "Failed to create user" }, { status: 500 });
  }

  if (!dbUser.registeredAt) {
    dbUser.registeredAt = new Date();
    await db
      .updateTable("users")
      .set({ registeredAt: dbUser.registeredAt })
      .where("id", "=", dbUser.id)
      .returningAll()
      .executeTakeFirst();
  }

  const session = await lucia.createSession(dbUser!.id, {});

  return Response.json(
    {
      success: true,
      session,
    },
    {
      headers: {
        "Set-Cookie": lucia.createSessionCookie(session.id).serialize(),
      },
    }
  );
}
