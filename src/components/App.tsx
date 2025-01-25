"use client";

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import sdk from "@farcaster/frame-sdk";
import { User as NeynarUser, SearchedUser } from "@neynar/nodejs-sdk/build/api";
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
import { useEffect, useMemo, useState } from "react";
import { useInView } from "react-intersection-observer";
import { twMerge } from "tailwind-merge";
import { useDebounce } from "use-debounce";
import { base } from "viem/chains";
import { formatEther, parseEther } from "viem/utils";
import {
  useAccount,
  useReadContracts,
  useSendTransaction,
  useWaitForTransactionReceipt,
} from "wagmi";
import { yoTokenAbi } from "../abi/yoTokenAbi";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { useWaitForNotifications } from "../hooks/use-wait-for-notifications";
import { YO_TOKEN_ADDRESS } from "../lib/constants";
import {
  createWarpcastComposeUrl,
  createWarpcastDcUrl,
  formatNumber,
  getBaseUrl,
  getEthUsdPrice,
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
  onchainMessageCount: number;
  notificationsEnabled: boolean;
  isOnchain: boolean;
};

type MessagesResponse = {
  messages: Message[];
  users: Record<number, NeynarUser>;
  nextCursor: string | null;
  messageCounts: {
    inbound: number;
    outbound: number;
  };
  onchainMessageCounts: {
    inbound: number;
    outbound: number;
  };
};

export function App() {
  const account = useAccount();
  const {
    data: yoTokenResults,
    isLoading: isBalanceLoading,
    isError: isBalanceError,
    refetch: refetchBalance,
  } = useReadContracts({
    contracts: [
      {
        address: YO_TOKEN_ADDRESS,
        abi: yoTokenAbi,
        functionName: "balanceOf",
        args: account.address ? [account.address] : undefined,
      },
      {
        address: YO_TOKEN_ADDRESS,
        abi: yoTokenAbi,
        functionName: "yoAmount",
      },
    ],
  });

  const yoToken = useMemo(() => {
    if (!yoTokenResults) return null;

    const balance = yoTokenResults[0].result;
    const yoAmount = yoTokenResults[1].result;

    return {
      balance,
      yoAmount,
    };
  }, [yoTokenResults]);

  const {
    data: txHash,
    sendTransaction,
    isPending,
    isSuccess,
    error: sendTransactionError,
  } = useSendTransaction();

  const { data: receipt, isLoading: isReceiptLoading } =
    useWaitForTransactionReceipt({
      hash: txHash,
    });

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
  const [dialogUser, setDialogUser] = useState<NeynarUser | null>(null);

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

  const [superYoMode, setSuperYoMode] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
  const [superYodUsers, setSuperYodUsers] = useState<Set<number>>(new Set());

  const [showConfirmation, setShowConfirmation] = useState(false);

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

  const superYoMutation = useMutation({
    mutationFn: async (targetFids: number[]) => {
      const response = await authFetch("/api/messages/onchain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ targetFids }),
      });
      if (!response.ok) {
        throw new Error("Failed to prepare transaction");
      }
      return response.json();
    },
  });

  const [showBuyDrawer, setShowBuyDrawer] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);

  const { data: basePrice, isLoading: isBasePriceLoading } = useQuery({
    queryKey: ["yoBasePrice"],
    queryFn: async () => {
      const sellAmount = parseFloat(parseEther("0.0001").toString());
      const res = await authFetch(
        `/api/quote?amount=${sellAmount}&taker=${account.address}`
      );
      if (!res.ok) throw new Error("Failed to fetch price");
      const priceData = await res.json();
      // Get ETH/USD price
      const ethUsdPrice = await getEthUsdPrice();

      const yoPriceUsd =
        1 / (Number(priceData.buyAmount) / sellAmount / ethUsdPrice); // TODO: Change to 1e18

      console.log("yoprice", {
        ...priceData,
        ethUsdPrice,
        yoPriceUsd,
      });

      return {
        ...priceData,
        ethUsdPrice,
        yoPriceUsd,
      };
    },
    enabled: showBuyDrawer,
  });

  const priceQuote = useMemo(() => {
    if (!basePrice || !selectedAmount) return null;

    // Amount of eth to sell to get the selected amount of $YO
    const sellAmount = parseEther(
      (
        (basePrice.yoPriceUsd * selectedAmount) /
        basePrice.ethUsdPrice
      ).toString()
    );

    return {
      ...basePrice,
      sellAmount,
    };
  }, [basePrice, selectedAmount]);

  const buyMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAmount || !priceQuote) throw new Error("Invalid state");
      const res = await authFetch("/api/quote", {
        method: "POST",
        body: JSON.stringify({
          amount: priceQuote.sellAmount.toString(),
          takerAddress: account.address,
        }),
      });
      if (!res.ok) throw new Error("Failed to get transaction");
      return res.json();
    },
    onSuccess: (data) => {
      sendTransaction({
        to: data.transaction.to,
        data: data.transaction.data,
        value: data.transaction.value,
      });
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

  useEffect(() => {
    if (receipt) {
      setShowConfirmation(true);
      refetchBalance();
      setTimeout(() => {
        setShowConfirmation(false);
        setSuperYoMode(false);
        setSuperYodUsers((prev) => {
          // Add current selected users to super yod users
          const next = new Set(prev);
          selectedUsers.forEach((fid) => next.add(fid));
          return next;
        });
        setSelectedUsers(new Set());
      }, 1000);
    }
  }, [receipt]);

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
      {!searchQuery && superYoMode && (
        <div className="flex w-full">
          <Button
            className="flex-1 text-yellow-500 h-16 text-2xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 hover:from-pink-600 hover:via-purple-600 hover:to-indigo-600 border-4 border-yellow-400 shadow-lg hover:shadow-xl transition-all duration-300"
            variant="secondary"
            onClick={() => {
              setSuperYoMode(false);
              setSelectedUsers(new Set());
            }}
          >
            SUPER YO ★
            {yoToken?.balance
              ? (
                  Math.floor(parseFloat(formatEther(yoToken?.balance)) * 10) /
                  10
                ).toLocaleString()
              : "0"}{" "}
            $YO
          </Button>
          <Button
            className="ml-2 h-16 px-6 text-xl font-bold bg-yellow-400 hover:bg-yellow-500 text-black"
            onClick={() => setShowBuyDrawer(true)}
          >
            BUY
          </Button>
        </div>
      )}

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
                mode="message"
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

                    const disabled =
                      message.disabled ||
                      (superYoMode &&
                        !otherUser.verified_addresses.eth_addresses[0]);

                    const isSuperYod =
                      message.isOnchain || superYodUsers.has(otherUserFid);

                    const animationPhaseOverride = isSuperYod
                      ? "complete"
                      : undefined;

                    return (
                      <UserRow
                        key={message.id}
                        user={otherUser}
                        fid={otherUserFid}
                        backgroundColor={getFidColor(otherUserFid)}
                        disabled={disabled}
                        isNotificationsEnabled={message.notificationsEnabled}
                        timestamp={getRelativeTime(new Date(message.createdAt))}
                        messageCount={message.messageCount}
                        onchainMessageCount={
                          superYodUsers.has(otherUserFid)
                            ? Number(message.onchainMessageCount) + 1
                            : message.onchainMessageCount
                        }
                        selected={selectedUsers.has(otherUserFid)}
                        mode={superYoMode ? "select" : "message"}
                        animationPhase={animationPhaseOverride}
                        isSuper={isSuperYod}
                        onSelect={() => {
                          setSelectedUsers((prev) => {
                            const next = new Set(prev);
                            if (next.has(otherUserFid)) {
                              next.delete(otherUserFid);
                            } else {
                              next.add(otherUserFid);
                            }
                            return next;
                          });
                        }}
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
        <div className="max-w-[400px] w-full flex items-center gap-2">
          {!searchQuery && data?.pages[0]?.messageCounts && (
            <div className="ml-auto flex items-center gap-2">
              {!superYoMode && (
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
              )}
              <Button
                size="icon"
                className={twMerge(
                  `py-4 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 hover:from-pink-600 hover:via-purple-600 hover:to-indigo-600 border-yellow-400`,
                  !superYoMode ? "animate-pulse" : ""
                )}
                variant="secondary"
                onClick={() => {
                  setSuperYoMode(!superYoMode);
                  setSelectedUsers(new Set());
                }}
              >
                {superYoMode ? (
                  <X className="h-6 w-6" />
                ) : (
                  <span className="text-yellow-400 text-2xl">★</span>
                )}
              </Button>
            </div>
          )}
          {superYoMode ? (
            <Button
              size="lg"
              className="text-lg p-4 flex-1 uppercase"
              disabled={
                selectedUsers.size === 0 ||
                !yoToken?.balance ||
                !yoToken?.yoAmount ||
                selectedUsers.size >
                  Math.floor(
                    Number(yoToken.balance) / Number(yoToken.yoAmount)
                  ) ||
                superYoMutation.isPending ||
                isPending ||
                isReceiptLoading ||
                showConfirmation
              }
              onClick={async () => {
                try {
                  const result = await superYoMutation.mutateAsync(
                    Array.from(selectedUsers)
                  );
                  sendTransaction(
                    {
                      to: YO_TOKEN_ADDRESS,
                      data: result.calldata as `0x${string}`,
                      chainId: base.id,
                    },
                    {
                      onError(error, variables, context) {
                        console.error("Failed to send Super Yo:", error);
                      },
                    }
                  );
                } catch (error) {
                  console.error("Failed to send Super Yo:", error);
                }
              }}
            >
              {superYoMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Preparing Transaction...
                </>
              ) : isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending Transaction...
                </>
              ) : isReceiptLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Confirming Transaction...
                </>
              ) : showConfirmation ? (
                "Confirmed!"
              ) : selectedUsers.size > 0 ? (
                `SEND SUPER YO (${selectedUsers.size}${
                  yoToken?.balance && yoToken?.yoAmount
                    ? ` / ${Math.floor(
                        Number(yoToken.balance) / Number(yoToken.yoAmount)
                      )}`
                    : ""
                })`
              ) : (
                "Select users"
              )}
            </Button>
          ) : (
            context &&
            showAddFrameButton && (
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
            )
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
      <Drawer open={showBuyDrawer} onOpenChange={setShowBuyDrawer}>
        <DrawerContent className="text-black">
          <DrawerHeader>
            <DrawerTitle>Buy $YO Tokens</DrawerTitle>
            <DrawerDescription>Select amount to purchase</DrawerDescription>
          </DrawerHeader>
          <div className="p-4 space-y-4">
            {[5, 10, 100, 1000].map((amount) => (
              <Button
                key={amount}
                variant={selectedAmount === amount ? "default" : "outline"}
                className={`w-full h-16 text-lg justify-between ${
                  selectedAmount === amount
                    ? "border-2 border-purple-500 bg-white text-black hover:bg-white"
                    : ""
                }`}
                onClick={() => setSelectedAmount(amount)}
              >
                <span>{amount} $YO</span>
                {isBasePriceLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="text-gray-500">
                    ≈ $
                    {basePrice
                      ? (basePrice.yoPriceUsd * amount).toFixed(2)
                      : "0.00"}
                  </span>
                )}
              </Button>
            ))}
          </div>
          <div className="text-sm text-gray-500 text-center">
            Outputs may vary due to slippage
          </div>
          <DrawerFooter className="flex flex-col gap-2">
            <Button
              disabled={!selectedAmount || buyMutation.isPending || isPending}
              onClick={() => buyMutation.mutate()}
              className={`w-full h-12 ${
                !selectedAmount || buyMutation.isPending || isPending
                  ? ""
                  : "bg-purple-500 hover:bg-purple-600"
              }`}
            >
              {buyMutation.isPending || isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isPending ? "Confirming..." : "Preparing..."}
                </>
              ) : (
                `Buy ${selectedAmount} $YO`
              )}
            </Button>

            {/* New button to open Uniswap */}
            <Button
              variant="outline"
              onClick={() => {
                sdk.actions.openUrl(
                  `https://app.uniswap.org/swap?chain=base&inputCurrency=NATIVE&outputCurrency=${YO_TOKEN_ADDRESS}&field=output`
                );
              }}
            >
              Buy on Uniswap
            </Button>

            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
