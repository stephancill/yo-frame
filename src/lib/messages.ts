import { UserDehydrated } from "@neynar/nodejs-sdk/build/api";
import { useMutation } from "@tanstack/react-query";
import { useSession } from "../providers/SessionProvider";

type PostMessageResponse = {
  message: {
    id: string;
    fromUserId: string;
    toUserId: string;
    message: string;
    createdAt: Date;
  };
  userNotified: boolean;
  targetUserData: UserDehydrated;
};

export function useSendMessageMutation() {
  const { authFetch } = useSession();

  return useMutation({
    mutationFn: async (variables: {
      fid: number;
      authFetch: typeof window.fetch;
    }) => {
      const res = await authFetch("/api/messages", {
        method: "POST",
        body: JSON.stringify({ targetFid: variables.fid }),
      });

      if (!res.ok) throw new Error("Failed to send message");

      const data = (await res.json()) as Promise<PostMessageResponse>;
      return data;
    },
  });
}
