import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getUserDatasCached } from "@/lib/farcaster";
import { getFidColor } from "../../../lib/utils";
import { getCloudinaryProxyUrl } from "../../../lib/cloudinary";

const size = {
  width: 600,
  height: 400,
};

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const fid = searchParams.get("fid") as string;

  const [farcasterUser] = await getUserDatasCached([parseInt(fid)]);

  if (!farcasterUser) {
    throw new Error(`User ${fid} not found`);
  }

  const transformedProfileImage = farcasterUser?.pfp_url
    ? getCloudinaryProxyUrl(farcasterUser.pfp_url, 100, 100)
    : null;
  const interBold = await fetch(
    new URL("/Inter-Bold.ttf", process.env.APP_URL)
  ).then((res) => res.arrayBuffer());

  return new ImageResponse(
    (
      <div tw="h-full w-full flex flex-col items-center justify-center relative bg-purple-500">
        <p tw="text-7xl text-white font-bold uppercase">YO</p>
        <div
          tw="flex items-center justify-center gap-6 w-full py-8 mt-5"
          style={{ backgroundColor: getFidColor(parseInt(fid)) }}
        >
          {transformedProfileImage ? (
            <img
              src={transformedProfileImage}
              alt={farcasterUser.display_name}
              tw="mr-4 w-16 h-16 rounded-full"
            />
          ) : null}
          <div tw="flex flex-col">
            <p tw="text-5xl font-bold text-white uppercase">
              {farcasterUser.username}
            </p>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Inter",
          data: interBold,
          weight: 700,
        },
      ],
    }
  );
}
