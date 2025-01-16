import { Metadata, ResolvingMetadata } from "next";
import { App } from "../components/App";
import { FRAME_METADATA } from "../lib/constants";
import { getUserDatasCached } from "../lib/farcaster";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata(
  props: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const resolvedParent = await parent;
  const originalMetadata = {
    title: resolvedParent.title,
    description: resolvedParent.description,
    other: {
      ...resolvedParent.other,
    },
    openGraph: {
      ...resolvedParent.openGraph,
    },
  };

  const searchParams = await props.searchParams;
  const fid = searchParams["user"] as string;

  if (fid) {
    const [farcasterUser] = await getUserDatasCached([parseInt(fid)]);

    if (!farcasterUser) {
      throw new Error(`User ${fid} not found (fid: ${fid})`);
    }

    const modifiedFrame = {
      ...FRAME_METADATA,
    };
    modifiedFrame.imageUrl = `${process.env.APP_URL}/images/user?fid=${fid}`;
    modifiedFrame.button.action.url = `${process.env.APP_URL}?user=${fid}`;
    modifiedFrame.button.title = `Yo @${farcasterUser.username}`;

    return {
      title: `@${farcasterUser.username} on Yo`,
      description: originalMetadata.description,
      other: {
        "fc:frame": JSON.stringify(modifiedFrame),
      },
    };
  }

  return originalMetadata;
}

export default function Page() {
  return <App />;
}
