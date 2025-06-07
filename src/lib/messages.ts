import { User as NeynarUser } from "@neynar/nodejs-sdk/build/api";
import { useMutation } from "@tanstack/react-query";
import { useSession } from "../providers/SessionProvider";
import { sdk } from "@farcaster/frame-sdk";

type PostMessageResponse = {
  message: {
    id: string;
    fromUserId: string;
    toUserId: string;
    message: string;
    createdAt: Date;
  };
  userNotified: boolean;
  targetUserData: NeynarUser;
};

export function useSendMessageMutation() {
  const { authFetch } = useSession();

  return useMutation({
    mutationFn: async (variables: {
      fid: number;
      authFetch: typeof window.fetch;
    }) => {
      sdk.haptics.impactOccurred("heavy");

      const res = await authFetch("/api/messages", {
        method: "POST",
        body: JSON.stringify({ targetFid: variables.fid }),
      });

      if (!res.ok) throw new Error("Failed to send message");

      const data = (await res.json()) as Promise<PostMessageResponse>;
      return data;
    },
    onSuccess(data, variables, context) {
      sdk.haptics.impactOccurred("light");
    },
    onError(error, variables, context) {
      sdk.haptics.notificationOccurred("error");
    },
  });
}
