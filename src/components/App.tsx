"use client";

import sdk from "@farcaster/frame-sdk";
import { SearchedUser, UserDehydrated } from "@neynar/nodejs-sdk/build/api";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, MessageCircleOff, Share, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import { useDebounce } from "use-debounce";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../components/ui/sheet";
import { UserRow } from "../components/UserRow";
import { useWaitForNotifications } from "../hooks/use-wait-for-notifications";
import {
  createWarpcastComposeUrl,
  createWarpcastDcUrl,
  getBaseUrl,
  getFidColor,
  getRelativeTime,
} from "../lib/utils";
import { useSession } from "../providers/SessionProvider";
import { useSendMessageMutation } from "../lib/messages";

type Message = {
  id: string;
  message: string;
  createdAt: string;
  fromFid: number;
  toFid: number;
  disabled: boolean;
};

type MessagesResponse = {
  messages: Message[];
  users: Record<number, UserDehydrated>;
  nextCursor: string | null;
  messageCounts: {
    inbound: number;
    outbound: number;
  };
};

export function App() {
  const {
    authFetch,
    user,
    session,
    context,
    refetchUser,
    isLoading: isSessionLoading,
  } = useSession();
  const searchParams = useSearchParams();
  const { mutate: waitForNotifications, isPending: isWaitingForNotifications } =
    useWaitForNotifications();

  const [showAddFrameButton, setShowAddFrameButton] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery] = useDebounce(searchQuery, 300);

  const { ref, inView } = useInView();

  const sendMessageMutation = useSendMessageMutation();

  const {
    data,
    isLoading,
    isFetching,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchMessages,
  } = useInfiniteQuery({
    queryKey: ["messages", session?.id],
    queryFn: async ({ pageParam = null }) => {
      const url = new URL("/api/messages", window.location.origin);
      if (pageParam) url.searchParams.set("cursor", pageParam);
      const res = await authFetch(url);
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json() as Promise<MessagesResponse>;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!session,
  });

  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [dialogUser, setDialogUser] = useState<UserDehydrated | null>(null);

  const [showSelfNotificationDialog, setShowSelfNotificationDialog] =
    useState(false);

  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ["search", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery) return null;
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(debouncedQuery)}`
      );
      if (!res.ok) throw new Error("Failed to search");
      return res.json();
    },
    enabled: !!debouncedQuery,
  });

  const [sheetUserId, setSheetUserId] = useState<string | null>(null);
  const sheetUserQuery = useQuery({
    queryKey: ["user", sheetUserId],
    queryFn: async () => {
      if (!sheetUserId) return null;
      const res = await authFetch(`/api/users/${sheetUserId}`);
      if (!res.ok) throw new Error("Failed to fetch user");
      return res.json() as Promise<{
        userData: UserDehydrated;
      }>;
    },
    enabled: !!sheetUserId && !!user,
  });

  useEffect(() => {
    const userId = searchParams.get("user");
    setSheetUserId(userId);
  }, [searchParams]);

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    if (context) {
      setShowAddFrameButton(!context.client.added);
    }
  }, [context]);

  const [showShareDialog, setShowShareDialog] = useState(false);

  useEffect(() => {
    if (searchQuery.length === 0) {
      refetchMessages();
    }
  }, [searchQuery]);

  if (isLoading || isSessionLoading)
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-white-500" />
      </div>
    );
  if (error)
    return <div className="p-4 text-red-500">Error loading messages</div>;

  return (
    <div className="w-full">
      <div className="relative">
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="text-3xl font-bold w-full px-4 py-6 focus:outline-none placeholder:text-gray-300 text-purple-500 rounded-none"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        )}
      </div>

      {isFetching && (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-white-500" />
        </div>
      )}

      {searchQuery ? (
        <div className="w-full">
          {isSearching ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-white-500" />
            </div>
          ) : (
            searchResults?.users?.map((user: SearchedUser) => (
              <UserRow
                key={user.fid}
                user={user}
                fid={user.fid}
                backgroundColor={getFidColor(user.fid)}
                disabled={false}
                onMessageSent={() => {
                  if (context && showAddFrameButton) {
                    setShowSelfNotificationDialog(true);
                  }
                }}
                onShowNotification={(userData) => {
                  setShowNotificationDialog(true);
                  setDialogUser(userData);
                }}
                onLongPress={() => {
                  sdk.actions.viewProfile({ fid: user.fid });
                }}
              />
            ))
          )}
        </div>
      ) : (
        <div>
          <div className="w-full">
            {data?.pages[0]?.messages.length === 0 ? (
              <div className="flex items-center justify-center min-h-[80vh] text-center p-8 text-white">
                <div>
                  <MessageCircleOff className="h-12 w-12 mx-auto mb-4" />
                  <p className="text-xl font-bold uppercase">NO YO'S YET</p>
                  <p className="mt-2 uppercase">Search for users to yo</p>
                </div>
              </div>
            ) : (
              <div>
                {data?.pages.map((page, i) =>
                  page.messages.map((message) => {
                    const otherUserFid =
                      message.fromFid === user?.fid
                        ? message.toFid
                        : message.fromFid;
                    const otherUser = page.users[otherUserFid];

                    return (
                      <UserRow
                        key={message.id}
                        user={otherUser}
                        fid={otherUserFid}
                        backgroundColor={getFidColor(otherUserFid)}
                        disabled={message.disabled}
                        timestamp={getRelativeTime(new Date(message.createdAt))}
                        onMessageSent={() => {
                          setSearchQuery("");
                          if (context && showAddFrameButton) {
                            setShowSelfNotificationDialog(true);
                          }
                        }}
                        onShowNotification={(userData) => {
                          setShowNotificationDialog(true);
                          setDialogUser(userData);
                        }}
                        onLongPress={() => {
                          sdk.actions.viewProfile({ fid: otherUserFid });
                        }}
                      />
                    );
                  })
                )}

                <div ref={ref} className="p-4 text-center">
                  {isFetchingNextPage && (
                    <Loader2 className="h-8 w-8 animate-spin text-white-500 mx-auto" />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="fixed bottom-0 left-0 right-0 p-4 flex justify-center z-50">
        <div
          className={`max-w-[400px] w-full flex items-center gap-2 ${
            !context || !showAddFrameButton ? "justify-center" : ""
          }`}
        >
          {!searchQuery &&
            data?.pages[0]?.messageCounts &&
            (!context || !showAddFrameButton ? (
              <div className="p-4 flex space-x-12 text-3xl font-bold w-full">
                <div className="text-center w-1/2">
                  <div className="">{data.pages[0].messageCounts.outbound}</div>
                  <div className="text-sm">SENT</div>
                </div>
                <div className="text-center w-1/2">
                  <div className="">{data.pages[0].messageCounts.inbound}</div>
                  <div className="text-sm">RECEIVED</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-lg font-bold bg-purple-500 py-4 px-2">
                <div className="flex flex-col items-center">
                  <span>{data.pages[0].messageCounts.outbound}</span>
                </div>
                <div className="h-4 w-[1px] bg-current mx-1 opacity-50" />
                <div className="flex flex-col items-center">
                  <span>{data.pages[0].messageCounts.inbound}</span>
                </div>
              </div>
            ))}
          {context && showAddFrameButton ? (
            <Button
              size={"lg"}
              className="text-lg p-4 flex-1"
              disabled={isWaitingForNotifications}
              onClick={() => {
                sdk.actions.addFrame().then((result) => {
                  if (result.notificationDetails) {
                    waitForNotifications(void 0, {
                      onSuccess: () => {
                        refetchUser();
                        setShowAddFrameButton(false);
                      },
                      onError: () => {
                        // TODO: show error
                      },
                    });
                  }
                });
              }}
            >
              {isWaitingForNotifications ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : null}
              ADD FRAME FOR ALERTS
            </Button>
          ) : (
            <Button
              size={"lg"}
              variant="ghost"
              className="flex-1 text-lg p-4"
              onClick={() => setShowShareDialog(true)}
            >
              <Share
                className="h-12 w-12"
                style={{ width: "36px", height: "36px" }}
              />
            </Button>
          )}
        </div>
      </div>
      <Dialog
        open={showNotificationDialog}
        onOpenChange={(v) => {
          setShowNotificationDialog(v);
          if (!v) {
            setDialogUser(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-purple-500">
              User hasn't enabled notifications
            </DialogTitle>
            <DialogDescription>
              Would you like to send a direct message to let them know?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-4 justify-end">
            <Button
              onClick={() => {
                if (!dialogUser) return;
                const frameDomain = getBaseUrl().hostname;
                const frameDeeplinkUrl = `https://www.warpcast.com/~/frames/launch?domain=${frameDomain}`;
                const text = `Hey, I sent you a yo. ${frameDeeplinkUrl}`;
                const url = createWarpcastDcUrl(dialogUser.fid, text);
                sdk.actions.openUrl(url);
                setShowNotificationDialog(false);
              }}
            >
              Draft DC
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={showSelfNotificationDialog}
        onOpenChange={setShowSelfNotificationDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-purple-500">
              Enable Notifications
            </DialogTitle>
            <DialogDescription>
              Add this frame to get notified when someone sends you a yo!
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button
              onClick={() => {
                sdk.actions.addFrame().then((result) => {
                  if (result.notificationDetails) {
                    waitForNotifications(void 0, {
                      onSuccess: () => {
                        refetchUser();
                        setShowSelfNotificationDialog(false);
                      },
                      onError: () => {
                        // TODO: show error
                      },
                    });
                  }
                });
              }}
              disabled={isWaitingForNotifications}
            >
              {isWaitingForNotifications ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : null}
              Add Frame
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-purple-500">
              Share Your Yo Link
            </DialogTitle>
            <DialogDescription>
              Copy your personal yo link to share with others
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-4 justify-end">
            <Button
              variant="outline"
              className="text-black"
              onClick={() => {
                const url = `${getBaseUrl()}?user=${user?.fid}`;
                navigator.clipboard.writeText(url);
                setShowShareDialog(false);
              }}
            >
              Copy
            </Button>
            <Button
              onClick={() => {
                const url = `${getBaseUrl()}?user=${user?.fid}`;
                const text = `Send me a yo`;
                const castUrl = createWarpcastComposeUrl(text, [url]);
                sdk.actions.openUrl(castUrl);
                setShowShareDialog(false);
              }}
            >
              Draft Cast
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Sheet
        open={!!sheetUserId}
        onOpenChange={() => {
          setSheetUserId(null);
        }}
      >
        <SheetContent side="bottom" className="text-black h-[300px]">
          {sheetUserId && sheetUserQuery.isLoading ? (
            <>
              <SheetTitle className="text-xl"></SheetTitle>
              <div className="flex justify-center items-center h-[30vh]">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
              </div>
            </>
          ) : (
            sheetUserId &&
            sheetUserQuery.data && (
              <SheetHeader className="text-center">
                <div className="flex flex-col items-center gap-4 mt-10">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={sheetUserQuery.data.userData.pfp_url} />
                    <AvatarFallback>
                      {sheetUserQuery.data.userData.display_name?.slice(0, 2) ||
                        sheetUserQuery.data.userData.username?.slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <SheetTitle className="text-xl">
                      {sheetUserQuery.data.userData.username}
                    </SheetTitle>
                    <SheetDescription>
                      @{sheetUserQuery.data.userData.username}
                    </SheetDescription>
                  </div>
                  <Button
                    className="mt-4 w-full uppercase font-bold text-xl py-8"
                    style={{
                      backgroundColor: getFidColor(
                        sheetUserQuery.data.userData.fid
                      ),
                    }}
                    disabled={
                      sendMessageMutation.isSuccess ||
                      sendMessageMutation.isPending ||
                      sendMessageMutation.isError
                    }
                    onClick={() => {
                      if (!sendMessageMutation.isPending) {
                        sendMessageMutation.mutate({
                          fid: sheetUserQuery.data!.userData.fid,
                          authFetch,
                        });
                      }
                    }}
                  >
                    {sendMessageMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : sendMessageMutation.isSuccess && sheetUserId ? (
                      "Yo sent!"
                    ) : (
                      "Send Yo"
                    )}
                  </Button>
                </div>
              </SheetHeader>
            )
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
