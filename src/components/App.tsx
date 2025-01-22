"use client";

import sdk from "@farcaster/frame-sdk";
import { SearchedUser, UserDehydrated } from "@neynar/nodejs-sdk/build/api";
import { useInfiniteQuery, useQuery, useMutation } from "@tanstack/react-query";
import {
  Loader2,
  MessageCircleOff,
  Search,
  Share,
  X,
  Bell,
  UserRoundSearch,
} from "lucide-react";
import Link from "next/link";
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
import { useSendMessageMutation } from "../lib/messages";
import {
  createWarpcastComposeUrl,
  createWarpcastDcUrl,
  getBaseUrl,
  getFidColor,
  getRelativeTime,
  formatNumber,
} from "../lib/utils";
import { useSession } from "../providers/SessionProvider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Image from "next/image";
import { NotificationPreview } from "./NotificationPreview";

type Message = {
  id: string;
  message: string;
  createdAt: string;
  fromFid: number;
  toFid: number;
  disabled: boolean;
  messageCount: number;
  notificationsEnabled: boolean;
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
  const [notShowSelfNotificationDialog, setNotShowSelfNotificationDialog] =
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
        messageCounts: {
          inbound: number;
          outbound: number;
        };
        rank: number;
      }>;
    },
    enabled: !!sheetUserId && !!user,
  });

  const [showNotificationSettingsDialog, setShowNotificationSettingsDialog] =
    useState(false);

  const [previewNotificationType, setPreviewNotificationType] = useState<
    "all" | "hourly"
  >(user?.notificationType || "all");

  const updateNotificationTypeMutation = useMutation({
    mutationFn: async (type: "all" | "hourly") => {
      const response = await authFetch("/api/user/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notificationType: type,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to update notification type");
      }
      return response.json();
    },
    onSuccess: () => {
      refetchUser();
    },
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
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300"
          size={24}
        />
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="text-3xl font-bold w-full px-12 py-6 focus:outline-none placeholder:text-gray-300 text-purple-500 rounded-none"
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
                  setSheetUserId(String(user.fid));
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
                <div className="flex flex-col items-center gap-4">
                  <MessageCircleOff className="h-12 w-12 mx-auto mb-4" />
                  <p className="text-xl font-bold uppercase">NO YO'S YET</p>
                  <Link href="/friends">
                    <Button variant="secondary" className="font-medium">
                      See who's already on yo →
                    </Button>
                  </Link>
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
                        isNotificationsEnabled={message.notificationsEnabled}
                        timestamp={getRelativeTime(new Date(message.createdAt))}
                        messageCount={message.messageCount}
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
                          setSheetUserId(String(otherUserFid));
                        }}
                      />
                    );
                  })
                )}

                <div ref={ref} className="p-4 text-center mb-40 mt-5">
                  {isFetchingNextPage && (
                    <Loader2 className="h-8 w-8 animate-spin text-white-500 mx-auto" />
                  )}
                  {!isFetchingNextPage && (
                    <div className="flex flex-col items-center gap-2">
                      <h3 className="text-lg font-semibold">
                        Looking for yo' friends?
                      </h3>
                      <Link href="/friends">
                        <Button variant="secondary" className="font-medium">
                          See who's already on yo →
                        </Button>
                      </Link>
                    </div>
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
              <Link href="/leaderboard">
                <div className="p-4 flex space-x-12 text-3xl font-bold w-full">
                  <div className="text-center w-1/2">
                    <div className="">
                      {formatNumber(data.pages[0].messageCounts.outbound)}
                    </div>
                    <div className="text-sm">SENT</div>
                  </div>
                  <div className="text-center w-1/2">
                    <div className="">
                      {formatNumber(data.pages[0].messageCounts.inbound)}
                    </div>
                    <div className="text-sm">RECEIVED</div>
                  </div>
                </div>
              </Link>
            ) : (
              <Link href="/leaderboard">
                <div className="flex items-center gap-2 text-lg font-bold bg-purple-500 py-4 px-2">
                  <div className="flex flex-col items-center">
                    <span>
                      {formatNumber(data.pages[0].messageCounts.outbound)}
                    </span>
                  </div>
                  <div className="h-4 w-[1px] bg-current mx-1 opacity-50" />
                  <div className="flex flex-col items-center">
                    <span>
                      {formatNumber(data.pages[0].messageCounts.inbound)}
                    </span>
                  </div>
                </div>
              </Link>
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
            <div className="flex gap-2">
              <Button
                size={"lg"}
                variant="ghost"
                className="text-lg p-4"
                onClick={() => setShowNotificationSettingsDialog(true)}
              >
                <Bell
                  className="h-12 w-12"
                  style={{ width: "36px", height: "36px" }}
                />
              </Button>
              <Button
                size={"lg"}
                variant="ghost"
                className="text-lg p-4"
                onClick={() => setShowShareDialog(true)}
              >
                <Share
                  className="h-12 w-12"
                  style={{ width: "36px", height: "36px" }}
                />
              </Button>
            </div>
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
        open={showSelfNotificationDialog && !notShowSelfNotificationDialog}
        onOpenChange={(v) => {
          setShowSelfNotificationDialog(v);
          console.log("onOpenChange", v);
          if (!v) {
            setNotShowSelfNotificationDialog(true);
          }
        }}
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
      <Dialog
        open={showNotificationSettingsDialog}
        onOpenChange={setShowNotificationSettingsDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-purple-500">
              Notification Settings
            </DialogTitle>
            <DialogDescription>
              Customize how and when you receive yo notifications
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 text-black">
            {
              <>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">
                    Notification Frequency
                  </label>
                  <Select
                    value={previewNotificationType}
                    onValueChange={(value) =>
                      setPreviewNotificationType(value as "all" | "hourly")
                    }
                    defaultValue={user?.notificationType}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All messages</SelectItem>
                      <SelectItem value="hourly">Hourly summary</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">Preview</p>
                    <div className="border rounded-lg p-4 space-y-4">
                      {previewNotificationType === "hourly" ? (
                        <NotificationPreview
                          title="yo"
                          subtitle="from user1 and 5 others"
                          timestamp="1m"
                        />
                      ) : (
                        <>
                          <NotificationPreview
                            title="yo"
                            subtitle="from user1"
                            timestamp="1m"
                          />
                          <NotificationPreview
                            title="yo"
                            subtitle="from user2"
                            timestamp="2m"
                          />
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  className="w-full mt-4"
                  onClick={() =>
                    updateNotificationTypeMutation.mutate(
                      previewNotificationType
                    )
                  }
                  disabled={
                    updateNotificationTypeMutation.isPending ||
                    previewNotificationType === user?.notificationType
                  }
                >
                  {updateNotificationTypeMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </>
            }
          </div>
        </DialogContent>
      </Dialog>
      <Sheet
        open={!!sheetUserId}
        onOpenChange={() => {
          setSheetUserId(null);
        }}
      >
        <SheetContent side="bottom" className="text-black min-h-[300px]">
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
                      <div className="flex items-center justify-center gap-2">
                        <span>{sheetUserQuery.data.userData.username}</span>
                        {sheetUserQuery.data.rank && (
                          <Link href="/leaderboard">
                            <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800 hover:bg-purple-200 transition-colors">
                              #{sheetUserQuery.data.rank}
                            </span>
                          </Link>
                        )}
                      </div>
                    </SheetTitle>
                  </div>
                  {sheetUserQuery.data.messageCounts && (
                    <div className="flex space-x-12 text-xl font-bold">
                      <div className="text-center">
                        <div>
                          {formatNumber(
                            sheetUserQuery.data.messageCounts.outbound
                          )}
                        </div>
                        <div className="text-sm">SENT</div>
                      </div>
                      <div className="text-center">
                        <div>
                          {formatNumber(
                            sendMessageMutation.isSuccess
                              ? sheetUserQuery.data.messageCounts.inbound + 1
                              : sheetUserQuery.data.messageCounts.inbound
                          )}
                        </div>
                        <div className="text-sm">RECEIVED</div>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-row w-full items-center mt-4 ">
                    <Button
                      className="flex-grow uppercase font-bold text-xl py-8"
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
                    <Button
                      className="font-bold text-xl p-8 bg-gray-200 hover:bg-gray-300 flex-shrink"
                      onClick={() => {
                        sdk.actions.viewProfile({
                          fid: sheetUserQuery.data!.userData.fid,
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
    </div>
  );
}
