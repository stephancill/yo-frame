"use client";

import { SearchedUser, UserDehydrated } from "@neynar/nodejs-sdk/build/api";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { X, Loader2, MessageCircleOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import { useDebounce } from "use-debounce";
import { UserRow } from "../components/UserRow";
import {
  createWarpcastComposeUrl,
  createWarpcastDcUrl,
  getBaseUrl,
  getRelativeTime,
} from "../lib/utils";
import { useSession } from "../providers/SessionProvider";
import { useWaitForNotifications } from "../hooks/use-wait-for-notifications";
import { Button } from "../components/ui/button";
import sdk from "@farcaster/frame-sdk";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";

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

function getFidColor(fid: number): string {
  // Use fid to generate hue (0-360)
  const hue = (fid * 137.508) % 360; // Golden angle approximation for good distribution
  // Use high saturation but lower lightness for better contrast with white text
  return `hsl(${hue}, 65%, 55%)`; // Reduced lightness from 75% to 45%
}

export default function MessagesPage() {
  const { authFetch, user, session, context, refetchUser } = useSession();
  const { mutate: waitForNotifications, isPending: isWaitingForNotifications } =
    useWaitForNotifications();

  const [animatingFid, setAnimatingFid] = useState<number | null>(null);
  const [animationPhase, setAnimationPhase] = useState<
    "initial" | "starting" | "complete"
  >("initial");

  const [showAddFrameButton, setShowAddFrameButton] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery] = useDebounce(searchQuery, 300);

  const { ref, inView } = useInView();

  const {
    data,
    isLoading,
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

  const mutation = useMutation({
    mutationFn: async (otherFid: number) => {
      setAnimatingFid(otherFid);
      setAnimationPhase("starting");

      await new Promise((resolve) => setTimeout(resolve, 100));

      const res = await authFetch("/api/messages", {
        method: "POST",
        body: JSON.stringify({ targetFid: otherFid }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      const data = await res.json();

      // Show dialog if user wasn't notified
      if (!data.userNotified) {
        setShowNotificationDialog(true);
        setDialogUser(data.targetUserData);
      }

      return data;
    },
    onSuccess: async (data) => {
      // Complete animation
      setAnimationPhase("complete");

      // Reset after delay
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setAnimationPhase("initial");
      setAnimatingFid(null);

      // Clear search query
      setSearchQuery("");

      // Show self-notification dialog if user hasn't added the frame
      if (context && showAddFrameButton) {
        setShowSelfNotificationDialog(true);
      }

      refetchMessages();
    },
    onError: () => {
      setAnimationPhase("initial");
      setTimeout(() => {
        setAnimatingFid(null);
      }, 500); // Duration of shake animation
    },
  });

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

  if (isLoading)
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

      {!searchQuery &&
        data?.pages[0]?.messageCounts &&
        data?.pages[0]?.messages.length > 0 && (
          <div className="p-4 flex space-x-12 text-3xl font-bold">
            <div className="text-center w-1/2">
              <div className="">{data.pages[0].messageCounts.outbound}</div>
              <div className="text-sm">SENT</div>
            </div>
            <div className="text-center w-1/2">
              <div className="">{data.pages[0].messageCounts.inbound}</div>
              <div className="text-sm">RECEIVED</div>
            </div>
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
                isAnimating={animatingFid === user.fid}
                animationPhase={animationPhase}
                isError={mutation.isError}
                disabled={mutation.isPending || animatingFid !== null}
                isPending={mutation.isPending}
                onClick={() => {
                  if (!mutation.isPending && !animatingFid) {
                    mutation.mutate(user.fid);
                  }
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
                        isAnimating={animatingFid === otherUserFid}
                        animationPhase={animationPhase}
                        isError={mutation.isError}
                        disabled={
                          message.disabled ||
                          mutation.isPending ||
                          animatingFid !== null
                        }
                        isPending={mutation.isPending}
                        timestamp={getRelativeTime(new Date(message.createdAt))}
                        onClick={() => {
                          if (!mutation.isPending && !animatingFid) {
                            mutation.mutate(otherUserFid);
                          }
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
      {context && showAddFrameButton && (
        <div className="fixed bottom-0 left-0 right-0 p-4 flex justify-center z-50">
          <div className="max-w-[400px] w-full">
            <Button
              size={"lg"}
              className="text-lg p-4 w-full"
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
          </div>
        </div>
      )}
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
              Would you like to draft a cast or send a direct message to let
              them know?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-4 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                if (!dialogUser) return;
                const frameDomain = getBaseUrl().hostname;
                const frameDeeplinkUrl = `https://www.warpcast.com/~/frames/launch?domain=${frameDomain}`;
                const text = `Hey, I sent you a yo. ${frameDeeplinkUrl}`;
                navigator.clipboard.writeText(text);
              }}
              className="text-black"
            >
              Copy
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!dialogUser) return;
                const frameDomain = getBaseUrl().hostname;
                const frameDeeplinkUrl = `https://www.warpcast.com/~/frames/launch?domain=${frameDomain}`;
                const text = `Hey, I sent you a yo. ${frameDeeplinkUrl}`;
                const url = createWarpcastDcUrl(dialogUser.fid, text);
                sdk.actions.openUrl(url);
                setShowNotificationDialog(false);
              }}
              className="text-black"
            >
              Draft DC
            </Button>
            <Button
              onClick={() => {
                if (!dialogUser) return;
                const frameUrl = getBaseUrl().toString();
                const text = `Hey, @${dialogUser.username} I sent you a yo.`;
                const url = createWarpcastComposeUrl(text, [frameUrl]);
                sdk.actions.openUrl(url);
                setShowNotificationDialog(false);
              }}
            >
              Draft Cast
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
    </div>
  );
}
