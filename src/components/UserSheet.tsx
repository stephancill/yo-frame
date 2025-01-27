import { User as NeynarUser } from "@neynar/nodejs-sdk/build/api";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, UserRoundSearch } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { useSendMessageMutation } from "../lib/messages";
import { getFidColor, formatNumber } from "../lib/utils";
import { useSession } from "../providers/SessionProvider";
import sdk from "@farcaster/frame-sdk";
import { Skeleton } from "./ui/skeleton";

interface UserSheetProps {
  userId: string | null;
  onClose: () => void;
  addSuperYoFid?: (fid: number) => void;
}

export function UserSheet({ userId, onClose, addSuperYoFid }: UserSheetProps) {
  const { authFetch, user } = useSession();
  const sendMessageMutation = useSendMessageMutation();

  const userQuery = useQuery({
    queryKey: ["user", userId],
    queryFn: async () => {
      if (!userId) return null;
      const res = await authFetch(`/api/users/${userId}`);
      if (!res.ok) throw new Error("Failed to fetch user");
      return res.json() as Promise<{
        userData: NeynarUser;
      }>;
    },
    enabled: !!userId && !!user,
  });

  const statsQuery = useQuery({
    queryKey: ["user-stats", userId],
    queryFn: async () => {
      if (!userId) return null;
      const res = await authFetch(`/api/users/${userId}/stats`);
      if (!res.ok) throw new Error("Failed to fetch user stats");
      return res.json() as Promise<{
        messageCounts: {
          inbound: number;
          outbound: number;
          inboundOnchain: number;
          outboundOnchain: number;
        };
        rank: number | null;
      }>;
    },
    enabled: !!userId && !!user,
  });

  return (
    <Sheet open={!!userId} onOpenChange={onClose}>
      <SheetContent side="bottom" className="text-black min-h-[300px]">
        {userId && userQuery.isLoading ? (
          <>
            <SheetTitle className="text-xl"></SheetTitle>
            <div className="flex justify-center items-center h-[30vh]">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            </div>
          </>
        ) : (
          userId &&
          userQuery.data && (
            <SheetHeader className="text-center">
              <div className="flex flex-col items-center gap-4 mt-10">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={userQuery.data.userData.pfp_url} />
                  <AvatarFallback>
                    {userQuery.data.userData.display_name?.slice(0, 2) ||
                      userQuery.data.userData.username?.slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <SheetTitle className="text-xl">
                    <div className="flex items-center justify-center gap-2">
                      <span>{userQuery.data.userData.username}</span>
                      {statsQuery.isLoading ? (
                        <Skeleton className="h-5 w-12 rounded-full" />
                      ) : (
                        statsQuery.data?.rank && (
                          <Link href="/leaderboard">
                            <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800 hover:bg-purple-200 transition-colors">
                              #{statsQuery.data.rank}
                            </span>
                          </Link>
                        )
                      )}
                    </div>
                  </SheetTitle>
                </div>
                {statsQuery.isLoading ? (
                  <div className="flex space-x-12 text-xl font-bold">
                    <div className="text-center">
                      <Skeleton className="h-8 w-20 mb-2" />
                      <Skeleton className="h-4 w-12 mx-auto" />
                    </div>
                    <div className="text-center">
                      <Skeleton className="h-8 w-20 mb-2" />
                      <Skeleton className="h-4 w-12 mx-auto" />
                    </div>
                  </div>
                ) : (
                  statsQuery.data?.messageCounts && (
                    <div className="flex space-x-12 text-xl font-bold">
                      <div className="text-center">
                        <div>
                          {statsQuery.data.messageCounts.outboundOnchain > 0 ? (
                            <>
                              {formatNumber(
                                statsQuery.data.messageCounts.outboundOnchain
                              )}{" "}
                              ★{" "}
                              <span className="text-gray-500 text-sm">
                                /{" "}
                                {formatNumber(
                                  statsQuery.data.messageCounts.outbound
                                )}
                              </span>
                            </>
                          ) : (
                            formatNumber(statsQuery.data.messageCounts.outbound)
                          )}
                        </div>
                        <div className="text-sm">SENT</div>
                      </div>
                      <div className="text-center">
                        <div>
                          {statsQuery.data.messageCounts.inboundOnchain > 0 ? (
                            <>
                              {formatNumber(
                                statsQuery.data.messageCounts.inboundOnchain
                              )}{" "}
                              ★{" "}
                              <span className="text-gray-500 text-sm">
                                /{" "}
                                {formatNumber(
                                  sendMessageMutation.isSuccess
                                    ? statsQuery.data.messageCounts.inbound + 1
                                    : statsQuery.data.messageCounts.inbound
                                )}
                              </span>
                            </>
                          ) : (
                            formatNumber(
                              sendMessageMutation.isSuccess
                                ? statsQuery.data.messageCounts.inbound + 1
                                : statsQuery.data.messageCounts.inbound
                            )
                          )}
                        </div>
                        <div className="text-sm">RECEIVED</div>
                      </div>
                    </div>
                  )
                )}
                <div className="flex flex-row w-full items-center mt-4 ">
                  <Button
                    className="flex-grow uppercase font-bold text-xl py-8"
                    style={{
                      backgroundColor: getFidColor(userQuery.data.userData.fid),
                    }}
                    disabled={
                      sendMessageMutation.isSuccess ||
                      sendMessageMutation.isPending ||
                      sendMessageMutation.isError
                    }
                    onClick={() => {
                      if (!sendMessageMutation.isPending) {
                        sendMessageMutation.mutate({
                          fid: userQuery.data!.userData.fid,
                          authFetch,
                        });
                      }
                    }}
                  >
                    {sendMessageMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : sendMessageMutation.isSuccess && userId ? (
                      "Yo sent!"
                    ) : (
                      "Send Yo"
                    )}
                  </Button>
                  {addSuperYoFid && (
                    <Button
                      className="px-4 bg-black font-bold shadow-lg rainbow-gradient"
                      size="lg"
                      onClick={() => {
                        addSuperYoFid(userQuery.data!.userData.fid);
                      }}
                    >
                      <span className="text-xl">$YO</span>
                    </Button>
                  )}
                  <Button
                    className="font-bold text-xl p-8 bg-gray-200 hover:bg-gray-300 flex-shrink"
                    onClick={() => {
                      sdk.actions.viewProfile({
                        fid: userQuery.data!.userData.fid,
                      });
                    }}
                  >
                    <UserRoundSearch
                      className="h-4 w-4 text-gray-500"
                      style={{ width: "24px", height: "24px" }}
                    />
                  </Button>
                </div>
              </div>
            </SheetHeader>
          )
        )}
      </SheetContent>
    </Sheet>
  );
}
