"use client";

import { SearchedUser, UserDehydrated } from "@neynar/nodejs-sdk/build/api";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { X, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import { useDebounce } from "use-debounce";
import { UserRow } from "../components/UserRow";
import { getRelativeTime } from "../lib/utils";
import { useSession } from "../providers/SessionProvider";

type Message = {
  id: string;
  message: string;
  createdAt: string;
  fromFid: number;
  toFid: number;
  disabled: boolean;
};

type User = {
  username: string;
  displayName?: string;
  pfp?: string;
};

type MessagesResponse = {
  messages: Message[];
  users: Record<number, UserDehydrated>;
  nextCursor: string | null;
};

function getFidColor(fid: number): string {
  // Use fid to generate hue (0-360)
  const hue = (fid * 137.508) % 360; // Golden angle approximation for good distribution
  // Use high saturation but lower lightness for better contrast with white text
  return `hsl(${hue}, 65%, 55%)`; // Reduced lightness from 75% to 45%
}

export default function MessagesPage() {
  const { authFetch, user, session } = useSession();

  const [animatingFid, setAnimatingFid] = useState<number | null>(null);
  const [animationPhase, setAnimationPhase] = useState<
    "initial" | "starting" | "complete"
  >("initial");

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
    queryKey: ["messages"],
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
      return res.json();
    },
    onSuccess: async () => {
      // Complete animation
      setAnimationPhase("complete");

      // Reset after delay
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setAnimationPhase("initial");
      setAnimatingFid(null);

      // Clear search query
      setSearchQuery("");

      refetchMessages();
    },
    onError: () => {
      setAnimationPhase("initial");
      setTimeout(() => {
        setAnimatingFid(null);
      }, 500); // Duration of shake animation
    },
  });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery] = useDebounce(searchQuery, 300);

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
          className="text-4xl font-bold w-full px-4 py-6 focus:outline-none placeholder:text-gray-300 text-purple-500"
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

              {/* Add loading indicator and intersection observer target */}
              <div ref={ref} className="p-4 text-center">
                {isFetchingNextPage ? (
                  <div>Loading more...</div>
                ) : hasNextPage ? (
                  <div>Scroll for more</div>
                ) : (
                  <div>No more messages</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
