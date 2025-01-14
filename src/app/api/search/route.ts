import { Configuration, NeynarAPIClient } from "@neynar/nodejs-sdk";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query) {
    return Response.json({ error: "Missing query parameter" }, { status: 400 });
  }

  const neynarClient = new NeynarAPIClient(
    new Configuration({
      apiKey: process.env.NEYNAR_API_KEY!,
    })
  );

  const users = await neynarClient.searchUser({
    q: query,
  });

  return Response.json({ users: users.result.users });
}
