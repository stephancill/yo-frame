"use client";

import { ArrowLeft, Loader2, MessageCircleOff, UserPlus } from "lucide-react";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";
import { useEffect } from "react";
import { UserRow } from "../../components/UserRow";
import { getFidColor } from "../../lib/utils";
import { useSession } from "../../providers/SessionProvider";
import { Button } from "../../components/ui/button";
import { User as NeynarUser } from "@neynar/nodejs-sdk/build/api";

type Friend = {
  id: string;
  fid: number;
  createdAt: string;
};

type FriendsResponse = {
  rows: Friend[];
  users: Record<number, NeynarUser>;
  nextCursor: string | null;
};

export default function FriendsPage() {
  const { authFetch } = useSession();
  const { ref, inView } = useInView();

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["friends"],
    queryFn: async ({ pageParam = null }) => {
      const url = new URL("/api/friends", window.location.origin);
      if (pageParam) url.searchParams.set("cursor", pageParam);
      const res = await authFetch(url);
      if (!res.ok) throw new Error("Failed to fetch friends");
      return res.json() as Promise<FriendsResponse>;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div>
      <div className="flex items-center gap-2 px-4 py-6">
        <Link href="/" className="hover:opacity-75">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-3xl font-bold">Friends</h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-white-500" />
        </div>
      ) : error ? (
        <div className="p-4 text-red-500">Error loading friends</div>
      ) : (
        <div className="w-full">
          {data?.pages[0]?.rows.length === 0 ? (
            <div className="flex items-center justify-center min-h-[80vh] text-center p-8 text-white">
              <div className="flex flex-col items-center gap-4">
                <UserPlus className="h-12 w-12 mx-auto mb-4" />
                <p className="text-xl font-bold uppercase">No unyo'd friends</p>
                <p>You can also find users by searching for their username.</p>
                <Link href="/">
                  <Button variant="secondary" className="font-medium">
                    ← Back
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            data?.pages.map((page) =>
              page.rows.map((friend) => {
                const userData = page.users[friend.fid];
                return (
                  <UserRow
                    key={friend.id}
                    user={userData}
                    fid={friend.fid}
                    backgroundColor={getFidColor(friend.fid)}
                    disabled={false}
                  />
                );
              })
            )
          )}

          <div ref={ref} className="p-4 text-center">
            {isFetchingNextPage && (
              <Loader2 className="h-8 w-8 animate-spin text-white-500 mx-auto" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
