"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Loader2, Trophy, ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { useInView } from "react-intersection-observer";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useSession } from "../providers/SessionProvider";
import { twMerge } from "tailwind-merge";
import Link from "next/link";
import { Button } from "./ui/button";

type LeaderboardEntry = {
  fid: number;
  messagesSent: number;
  messagesReceived: number;
  totalMessages: number;
  rank: number;
};

type LeaderboardResponse = {
  leaderboard: LeaderboardEntry[];
  users: Record<
    number,
    {
      fid: number;
      username: string;
      displayName?: string;
      pfp_url: string;
    }
  >;
  currentUser: LeaderboardEntry;
  nextCursor: number | null;
};

function LeaderboardRow({
  entry,
  user,
  isCurrentUser,
}: {
  entry: LeaderboardEntry;
  user: { username: string; displayName?: string; pfp_url: string };
  isCurrentUser: boolean;
}) {
  return (
    <div className="flex items-center gap-4 p-6 relative">
      <div className="absolute left-4 font-bold text-lg">
        {entry.rank === 1 ? (
          <Trophy className="h-6 w-6 text-yellow-500" />
        ) : (
          <span
            className={twMerge(
              "text-white/50",
              entry.rank === 2 && "text-gray-300",
              entry.rank === 3 && "text-amber-600"
            )}
          >
            #{entry.rank}
          </span>
        )}
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-center">
          <div className="flex-1 text-center">
            <div className="flex justify-center items-center gap-1">
              <div>
                {user?.pfp_url ? (
                  <Avatar className="w-5 h-5">
                    <AvatarImage src={user.pfp_url} alt={user.username} />
                    <AvatarFallback>
                      {user.username?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <Avatar className="w-5 h-5">
                    <AvatarFallback>{user.username}</AvatarFallback>
                  </Avatar>
                )}
              </div>
              <div>
                <h3 className="text-xl font-bold text-white uppercase">
                  {user.username}
                </h3>
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="font-medium">
              {entry.totalMessages.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Leaderboard() {
  const { authFetch, user } = useSession();
  const { ref, inView } = useInView();

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["leaderboard"],
    queryFn: async ({ pageParam = 0 }) => {
      const url = new URL("/api/leaderboard", window.location.origin);
      url.searchParams.set("cursor", pageParam.toString());
      const res = await authFetch(url);
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      return res.json() as Promise<LeaderboardResponse>;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading)
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-white-500" />
      </div>
    );

  if (error)
    return <div className="p-4 text-red-500">Error loading leaderboard</div>;

  const currentUser = data?.pages[0]?.currentUser;

  return (
    <div>
      <div className="flex items-center gap-2 px-4 py-6">
        <Link href="/" className="hover:opacity-75">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-3xl font-bold">Leaderboard</h1>
      </div>

      <div className="w-full">
        {/* Current User Stats */}
        {currentUser && (
          <div className="bg-black z-10 border-b border-gray-800">
            <LeaderboardRow
              entry={currentUser}
              user={data.pages[0].users[currentUser.fid]}
              isCurrentUser={true}
            />
          </div>
        )}

        {data?.pages[0]?.leaderboard.length === 0 ? (
          <div className="flex items-center justify-center min-h-[80vh] text-center p-8 text-white">
            <div className="flex flex-col items-center gap-4">
              <Trophy className="h-12 w-12 mx-auto mb-4" />
              <p className="text-xl font-bold uppercase">
                No leaderboard data yet
              </p>
              <p>Start chatting to appear on the leaderboard!</p>
              <Link href="/">
                <Button variant="secondary" className="font-medium">
                  ← Back
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {data?.pages.map((page) =>
              page.leaderboard.map((entry) => {
                const user = page.users[entry.fid];
                return (
                  <LeaderboardRow
                    key={entry.fid}
                    entry={entry}
                    user={user}
                    isCurrentUser={entry.fid === currentUser?.fid}
                  />
                );
              })
            )}
          </div>
        )}

        <div ref={ref} className="p-4 text-center">
          {isFetchingNextPage && (
            <Loader2 className="h-8 w-8 animate-spin text-white-500 mx-auto" />
          )}
        </div>
      </div>
    </div>
  );
}
