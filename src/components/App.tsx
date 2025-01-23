"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import sdk from "@farcaster/frame-sdk";
import { SearchedUser, UserDehydrated } from "@neynar/nodejs-sdk/build/api";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import {
  ChartNoAxesColumn,
  Cog,
  Loader2,
  MessageCircleOff,
  Search,
  Share,
  X,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import { useDebounce } from "use-debounce";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { useWaitForNotifications } from "../hooks/use-wait-for-notifications";
import {
  createWarpcastComposeUrl,
  createWarpcastDcUrl,
  formatNumber,
  getBaseUrl,
  getFidColor,
  getRelativeTime,
} from "../lib/utils";
import { useSession } from "../providers/SessionProvider";
import { NotificationPreview } from "./NotificationPreview";
import { UserRow } from "./UserRow";
import { UserSheet } from "./UserSheet";

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

  const [sentCountAdd, setSentCountAdd] = useState(0);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery] = useDebounce(searchQuery, 300);

  const { ref, inView } = useInView();

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

  const [showShareDialog, setShowShareDialog] = useState(false);

  const [sheetUserId, setSheetUserId] = useState<string | null>(null);
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

  useEffect(() => {
    if (searchQuery.length === 0) {
      refetchMessages();
    }
  }, [searchQuery]);

  useEffect(() => {
    if (user) {
      setSentCountAdd(0);
    }
  }, [user]);

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
      <div className="flex items-center">
        <div className="relative h-16 flex-grow">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300"
            size={24}
          />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-2xl font-medium w-full px-12 h-full focus:outline-none placeholder:text-gray-300 text-purple-500 rounded-none"
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
        {searchQuery === "" && (
          <div className="flex bg-gray-100 text-gray-500">
            <Link href="/leaderboard" className="p-0">
              <Button variant="ghost" className="h-16 px-4">
                <ChartNoAxesColumn
                  className="h-12 w-12"
                  style={{ width: "24px", height: "24px" }}
                />
              </Button>
            </Link>

            <Button
              className="h-16 px-4"
              variant="ghost"
              onClick={() => setShowShareDialog(true)}
            >
              <Share style={{ width: "24px", height: "24px" }} />
            </Button>
            <Button
              className="h-16 px-4"
              variant="ghost"
              onClick={() => setShowNotificationSettingsDialog(true)}
            >
              <Cog style={{ width: "24px", height: "24px" }} />
            </Button>
          </div>
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
                  setSentCountAdd((prev) => prev + 1);
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
                          setSentCountAdd((prev) => prev + 1);
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
      <div className="fixed bottom-0 left-0 right-0 p-4 flex z-50">
        <div
          className={`max-w-[400px] w-full flex items-center gap-2 ${
            !context || !showAddFrameButton ? "justify-center" : ""
          }`}
        >
          {!searchQuery && data?.pages[0]?.messageCounts && (
            <div className={"ml-auto"}>
              <Link href="/leaderboard">
                <div className="flex items-center gap-2 text-lg font-bold bg-purple-500 py-4 px-2">
                  <div className="flex flex-col items-center">
                    <span>
                      {formatNumber(
                        data.pages[0].messageCounts.outbound + sentCountAdd
                      )}
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
            </div>
          )}
          {context && showAddFrameButton && (
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
      <UserSheet userId={sheetUserId} onClose={() => setSheetUserId(null)} />
    </div>
  );
}
