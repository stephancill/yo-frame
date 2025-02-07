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
  Copy,
  Loader2,
  MessageCircleOff,
  Plus,
  Search,
  Share,
  X,
  Check,
  ExternalLink,
  HelpCircle,
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
  useChainId,
  useReadContracts,
  useSendTransaction,
  useSwitchChain,
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
import { Skeleton } from "./ui/skeleton";
import { useToast } from "../hooks/use-toast";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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

type NotificationType = "all" | "hourly" | "semi_daily";

export function App() {
  const account = useAccount();
  const chainId = useChainId();
  const { data: switchChainData, switchChain } = useSwitchChain();
  const { toast } = useToast();

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
    data: superYoTxHash,
    sendTransaction: sendSuperYoTransaction,
    isPending: isSuperYoTxPending,
  } = useSendTransaction();

  const {
    data: buyTxHash,
    sendTransaction: sendBuyTransaction,
    isPending: isBuyPending,
    isSuccess: isBuySuccess,
    error: buySendTransactionError,
  } = useSendTransaction();

  const { data: superYoReceipt, isLoading: isSuperYoReceiptLoading } =
    useWaitForTransactionReceipt({
      hash: superYoTxHash,
    });

  const { data: buyReceipt, isLoading: isBuyReceiptLoading } =
    useWaitForTransactionReceipt({
      hash: buyTxHash,
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
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  const [previewNotificationType, setPreviewNotificationType] =
    useState<NotificationType>(user?.notificationType || "all");

  const [superYoMode, setSuperYoMode] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
  const [superYodUsers, setSuperYodUsers] = useState<Set<number>>(new Set());

  const [showConfirmation, setShowConfirmation] = useState(false);

  const [showCopyCheck, setShowCopyCheck] = useState(false);

  const [showSuperYoInfoDialog, setShowSuperYoInfoDialog] = useState(false);

  const updateNotificationTypeMutation = useMutation({
    mutationFn: async (type: NotificationType) => {
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
  const [selectedAmount, setSelectedAmount] = useState<number | null>(5000);

  const {
    data: basePrice,
    isLoading: isBasePriceLoading,
    error: basePriceError,
    refetch: refetchBasePrice,
  } = useQuery({
    queryKey: ["yoBasePrice"],
    queryFn: async () => {
      const sellAmount = parseFloat(parseEther("0.0001").toString());
      const res = await authFetch(
        `/api/quote?amount=${sellAmount}&taker=${account.address}`
      );
      if (!res.ok) throw new Error("Failed to fetch price");
      const priceData = await res.json();
      const ethUsdPrice = await getEthUsdPrice();

      const yoPriceUsd =
        1 / (Number(priceData.buyAmount) / sellAmount / ethUsdPrice);

      return {
        ...priceData,
        ethUsdPrice,
        yoPriceUsd,
      };
    },
    enabled: showBuyDrawer,
    retry: false,
  });

  const priceQuote = useMemo(() => {
    if (!basePrice || !selectedAmount) return null;

    const yoPriceUsdBI = BigInt(
      Math.floor(basePrice.yoPriceUsd * 1e18).toString()
    );
    const ethUsdPriceBI =
      BigInt(Math.floor(basePrice.ethUsdPrice).toString()) * BigInt(1e18);

    // Amount of eth to sell to get the selected amount of $YO
    const sellAmount =
      (yoPriceUsdBI * BigInt(selectedAmount) * BigInt(1e18)) / ethUsdPriceBI;

    return {
      ...basePrice,
      sellAmount,
    };
  }, [basePrice, selectedAmount]);

  const userAddressVerified = useMemo(() => {
    if (!user || !account.address) return false;

    return user.neynarUser.verified_addresses.eth_addresses.find(
      (address) => address.toLowerCase() === account.address!.toLowerCase()
    );
  }, [user, account.address]);

  const buyMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAmount || !priceQuote) throw new Error("Invalid state");
      switchChain({ chainId: base.id });
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
      sendBuyTransaction(
        {
          to: data.transaction.to,
          data: data.transaction.data,
          value: data.transaction.value,
        },
        {
          onError(error, variables, context) {
            console.error("Failed to send transaction:", error);
          },
        }
      );
    },
  });

  const refreshUserMutation = useMutation({
    mutationFn: async () => {
      const response = await authFetch("/api/user/refresh", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to refresh user data");
      }
    },
    onSuccess: () => {
      refetchUser();
      toast({
        title: "User data refreshed",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Failed to refresh user data",
        description: error.message,
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
    if (user) {
      setSentCountAdd(0);
    }
  }, [user]);

  useEffect(() => {
    if (superYoReceipt) {
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
  }, [superYoReceipt]);

  useEffect(() => {
    if (buyReceipt) {
      setShowBuyDrawer(false);
      refetchBalance();
    }
  }, [buyReceipt]);

  useEffect(() => {
    if (chainId !== base.id && account.address && superYoMode) {
      switchChain({ chainId: base.id });
    }
  }, [chainId, account.address, switchChain, superYoMode]);

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
      {superYoMode && (
        <div className="flex w-full sticky top-0 z-50 bg-black shadow-lg">
          <button className="h-16 px-4 flex grow w-full items-center gap-2 text-xl font-bold bg-gray-800 text-center rainbow-gradient prevent-select">
            <div
              className="flex items-center justify-between w-full"
              onClick={() => setShowSuperYoInfoDialog(true)}
            >
              <div>
                SUPER YO •{" "}
                {yoToken?.balance
                  ? formatNumber(
                      Math.floor(
                        parseFloat(formatEther(yoToken?.balance)) * 10
                      ) / 10
                    )
                  : "0"}{" "}
                $YO
              </div>
              <HelpCircle className="h-4 w-4" />
            </div>
          </button>
          <Button
            className="text-xl font-bold uppercase flex gap-1 items-center hover:bg-gray-700 px-2"
            size="lg"
            onClick={() => setShowBuyDrawer(true)}
          >
            <Plus
              className="h-6 w-6"
              style={{ width: "24px", height: "24px" }}
            />
            <span className="text-lg">BUY</span>
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
        {searchQuery === "" && !superYoMode && (
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
              onClick={() => setShowSettingsDialog(true)}
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
            searchResults?.users?.map((user: SearchedUser) => {
              const disabled =
                superYoMode && !user.verified_addresses.eth_addresses[0];

              const isSuperYodUser = superYodUsers.has(user.fid);
              const isSuperYod = isSuperYodUser;

              const animationPhaseOverride = isSuperYodUser
                ? "complete"
                : undefined;

              return (
                <UserRow
                  key={user.fid}
                  user={user}
                  fid={user.fid}
                  backgroundColor={getFidColor(user.fid)}
                  disabled={disabled}
                  isSuper={isSuperYod}
                  selected={selectedUsers.has(user.fid)}
                  mode={superYoMode ? "select" : "message"}
                  animationPhase={animationPhaseOverride}
                  onSelect={() => {
                    console.log("onSelect", user.fid);
                    setSelectedUsers((prev) => {
                      const next = new Set(prev);
                      if (next.has(user.fid)) {
                        next.delete(user.fid);
                      } else {
                        next.add(user.fid);
                      }
                      return next;
                    });
                  }}
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
              );
            })
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

                    const disabled = !superYoMode
                      ? message.disabled
                      : superYoMode &&
                        !otherUser.verified_addresses.eth_addresses[0] &&
                        (message.fromFid !== user?.fid ||
                          Date.now() - new Date(message.createdAt).getTime() >
                            60 * 60 * 1000);

                    const isSuperYodUser = superYodUsers.has(otherUserFid);
                    const isSuperYod = message.isOnchain || isSuperYodUser;

                    const animationPhaseOverride = isSuperYodUser
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
                        onInitiateSuperYo={
                          account.address
                            ? () => {
                                setSuperYoMode(true);
                                setSelectedUsers((prev) => {
                                  const next = new Set(prev);
                                  next.add(otherUserFid);
                                  return next;
                                });
                              }
                            : undefined
                        }
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
          {!searchQuery && data?.pages[0]?.messageCounts && !superYoMode && (
            <div className="ml-auto flex items-center gap-2">
              {account.address && (
                <Button
                  className="px-4 bg-black font-bold shadow-lg rainbow-gradient"
                  size="lg"
                  onClick={() => {
                    setSuperYoMode(!superYoMode);
                    setSelectedUsers(new Set());
                  }}
                >
                  <span className="text-xl">$YO</span>
                </Button>
              )}
              {!showAddFrameButton && (
                <Link href="/leaderboard">
                  <div className="flex h-16 items-center gap-2 text-lg font-bold bg-purple-500 py-4 px-2">
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
            </div>
          )}
          {superYoMode ? (
            <div className="flex gap-2 w-full">
              <Button
                size="lg"
                className="flex-shrink-0"
                onClick={() => {
                  setSuperYoMode(false);
                  setSelectedUsers(new Set());
                }}
              >
                <X
                  className="h-12 w-12"
                  style={{ width: "24px", height: "24px" }}
                />
              </Button>
              <Button
                size="lg"
                className="text-lg p-4 flex-1 uppercase grow-1 w-full font-bold"
                disabled={
                  !userAddressVerified ||
                  selectedUsers.size === 0 ||
                  !yoToken?.balance ||
                  !yoToken?.yoAmount ||
                  selectedUsers.size >
                    Math.floor(
                      Number(yoToken.balance) / Number(yoToken.yoAmount)
                    ) ||
                  superYoMutation.isPending ||
                  isSuperYoTxPending ||
                  isSuperYoReceiptLoading ||
                  showConfirmation
                }
                onClick={async () => {
                  try {
                    switchChain({ chainId: base.id });
                    const result = await superYoMutation.mutateAsync(
                      Array.from(selectedUsers)
                    );
                    sendSuperYoTransaction(
                      {
                        to: YO_TOKEN_ADDRESS,
                        data: result.calldata as `0x${string}`,
                        chainId: base.id,
                      },
                      {
                        onError(error, variables, context) {
                          console.error("Failed to send Super Yo:", error);
                          toast({
                            variant: "destructive",
                            title: `Failed to send transaction (${error.name})`,
                            description: error.message,
                          });
                        },
                      }
                    );
                  } catch (error) {
                    if (error instanceof Error) {
                      console.error("Failed to send Super Yo:", error);
                      toast({
                        variant: "destructive",
                        title: "Failed to send Super Yo",
                        description: error.message,
                      });
                    } else {
                      console.error("Failed to send Super Yo:", error);
                      toast({
                        variant: "destructive",
                        title: "Failed to send Super Yo",
                        description:
                          "Failed to send Super Yo. Please try again.",
                      });
                    }
                  }
                }}
              >
                {superYoMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Preparing Transaction...
                  </>
                ) : isSuperYoTxPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending Transaction...
                  </>
                ) : isSuperYoReceiptLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Confirming Transaction...
                  </>
                ) : showConfirmation ? (
                  "Confirmed!"
                ) : !userAddressVerified ? (
                  "Connected Address Not Verified"
                ) : (yoToken?.balance !== undefined &&
                    yoToken?.yoAmount !== undefined &&
                    yoToken.balance < yoToken.yoAmount) ||
                  selectedUsers.size >
                    Math.floor(
                      Number(yoToken?.balance) / Number(yoToken?.yoAmount)
                    ) ? (
                  "Insufficient $YO"
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
            </div>
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
            <Button variant="outline" className="text-black">
              {showCopyCheck ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
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
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="text-black">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Notifications Section */}
            <div className="space-y-4">
              <h4 className="text-md font-medium">Notifications</h4>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">
                  Notification Frequency
                </label>
                <Select
                  value={previewNotificationType}
                  onValueChange={(value) =>
                    setPreviewNotificationType(value as NotificationType)
                  }
                  defaultValue={user?.notificationType}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All messages</SelectItem>
                    <SelectItem value="hourly">Hourly summary</SelectItem>
                    <SelectItem value="semi_daily">
                      Semi-daily summary
                    </SelectItem>
                  </SelectContent>
                </Select>

                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">Preview</p>
                  <div className="border rounded-lg p-4 space-y-4">
                    {previewNotificationType === "hourly" ||
                    previewNotificationType === "semi_daily" ? (
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
                  updateNotificationTypeMutation.mutate(previewNotificationType)
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
            </div>

            {/* Advanced Section */}
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="advanced">
                <AccordionTrigger className="text-md">
                  Advanced
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    <Button
                      onClick={() => refreshUserMutation.mutate()}
                      disabled={refreshUserMutation.isPending}
                      className="w-full"
                    >
                      {refreshUserMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        "Refresh User Data"
                      )}
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </DialogContent>
      </Dialog>
      <UserSheet
        userId={sheetUserId}
        onClose={() => setSheetUserId(null)}
        addSuperYoFid={
          account.address
            ? (fid) => {
                setSuperYoMode(true);
                setSelectedUsers((prev) => new Set([...prev, fid]));
                setSheetUserId(null);
                setSearchQuery("");
              }
            : undefined
        }
      />
      <Drawer open={showBuyDrawer} onOpenChange={setShowBuyDrawer}>
        <DrawerContent className="text-black">
          <DrawerHeader>
            <DrawerTitle>Buy $YO Tokens</DrawerTitle>
            <div
              className="text-sm text-gray-500 flex items-center justify-center gap-1 w-full"
              onClick={() => {
                navigator.clipboard.writeText(YO_TOKEN_ADDRESS);
                setShowCopyCheck(true);
                setTimeout(() => setShowCopyCheck(false), 2000);
              }}
            >
              {YO_TOKEN_ADDRESS.slice(0, 6)}...{YO_TOKEN_ADDRESS.slice(-4)}
              <Button variant="ghost" size="sm" className="h-6 px-2">
                {showCopyCheck ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
          </DrawerHeader>
          <div className="p-4 space-y-4">
            {basePriceError ? (
              <div className="text-red-500 text-center p-4 space-y-2">
                <p>Failed to load price quote</p>
                <Button
                  variant="outline"
                  onClick={() => refetchBasePrice()}
                  className="mx-auto"
                >
                  Retry
                </Button>
              </div>
            ) : isBalanceLoading || isBasePriceLoading ? (
              <>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                  </div>
                ))}
              </>
            ) : (
              [
                yoToken?.yoAmount
                  ? parseFloat(formatEther(yoToken.yoAmount)) * 5
                  : 5000,
                yoToken?.yoAmount
                  ? parseFloat(formatEther(yoToken.yoAmount)) * 10
                  : 10000,
                yoToken?.yoAmount
                  ? parseFloat(formatEther(yoToken.yoAmount)) * 100
                  : 100000,
                yoToken?.yoAmount
                  ? parseFloat(formatEther(yoToken.yoAmount)) * 1000
                  : 1000000,
              ].map((amount) => (
                <Button
                  key={amount}
                  variant={selectedAmount === amount ? "default" : "outline"}
                  className={`w-full h-16 text-lg justify-between ${
                    selectedAmount === amount
                      ? "border-2 border-purple-500 bg-white text-black hover:bg-white"
                      : ""
                  }`}
                  onClick={() => setSelectedAmount(amount)}
                  disabled={isBuyReceiptLoading}
                >
                  <span>{formatNumber(amount)} $YO</span>
                  <span className="text-gray-500">
                    ≈ $
                    {basePrice
                      ? (basePrice.yoPriceUsd * amount).toFixed(2)
                      : "0.00"}
                  </span>
                </Button>
              ))
            )}
          </div>
          <div className="text-sm text-gray-500 text-center">
            Actual outputs may vary due to slippage
          </div>
          <DrawerFooter className="flex flex-col gap-2">
            {!basePriceError && (
              <Button
                disabled={
                  !selectedAmount ||
                  buyMutation.isPending ||
                  isBuyPending ||
                  isBasePriceLoading ||
                  isBalanceLoading
                }
                onClick={() => buyMutation.mutate()}
                className={`w-full h-12 ${
                  !selectedAmount ||
                  buyMutation.isPending ||
                  isBuyPending ||
                  isBasePriceLoading ||
                  isBalanceLoading ||
                  isBuyReceiptLoading
                    ? ""
                    : "bg-purple-500 hover:bg-purple-600"
                }`}
              >
                {buyMutation.isPending || isBuyPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isBuyPending || isBuyReceiptLoading
                      ? "Confirming..."
                      : "Preparing..."}
                  </>
                ) : isBalanceLoading || isBasePriceLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  `Buy ${selectedAmount} $YO`
                )}
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() => {
                sdk.actions.openUrl(
                  `https://app.uniswap.org/swap?chain=base&inputCurrency=NATIVE&outputCurrency=${YO_TOKEN_ADDRESS}&field=output`
                );
              }}
            >
              Buy on Uniswap <ExternalLink className="h-4 w-4" />
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
      <Dialog
        open={showSuperYoInfoDialog}
        onOpenChange={setShowSuperYoInfoDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-purple-500">
              Super YO ($YO)
            </DialogTitle>
            <DialogDescription></DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-2 text-black">
            <div>Send on-chain YOs that are stored forever on Base.</div>
            <div>
              Each Super Yo transfers{" "}
              {yoToken?.yoAmount ? formatEther(yoToken.yoAmount) : "0"} $YO to
              the recipient.
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setShowSuperYoInfoDialog(false)}>
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
