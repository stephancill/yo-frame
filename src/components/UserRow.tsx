"use client";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { twMerge } from "tailwind-merge";
import { SearchedUser, UserDehydrated } from "@neynar/nodejs-sdk/build/api";
import { useLongPress } from "../hooks/use-long-press";

type UserRowProps = {
  user: SearchedUser | UserDehydrated;
  fid: number;
  backgroundColor: string;
  isAnimating?: boolean;
  animationPhase?: "initial" | "starting" | "complete";
  isError?: boolean;
  disabled?: boolean;
  isPending?: boolean;
  timestamp?: string;
  onClick?: () => void;
  onLongPress?: () => void;
};

export function UserRow({
  user,
  fid,
  backgroundColor,
  isAnimating = false,
  animationPhase = "initial",
  isError = false,
  disabled = false,
  isPending = false,
  timestamp,
  onClick,
  onLongPress,
}: UserRowProps) {
  const longPressBind = useLongPress(
    onLongPress ?? (() => {}),
    onClick ?? (() => {})
  );

  return (
    <button
      {...longPressBind}
      disabled={disabled}
      className={twMerge(
        "block w-full text-left hover:brightness-95 relative prevent-select",
        (disabled || isPending) && "cursor-not-allowed opacity-50",
        isAnimating && isError && "animate-[shake_0.5s_ease-in-out]"
      )}
      style={{ backgroundColor }}
    >
      {isAnimating && (
        <div
          className={twMerge(
            "absolute bottom-0 left-0 h-1 transition-[width] duration-300",
            isError ? "bg-red-400/50" : "bg-white/50"
          )}
          style={{
            width:
              animationPhase === "starting"
                ? "10%"
                : animationPhase === "complete"
                ? "100%"
                : "0%",
          }}
        />
      )}

      <div className="flex items-center gap-4 p-6">
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
                    {isAnimating && animationPhase === "complete" ? (
                      <span className="animate-fade-out">yo!</span>
                    ) : (
                      user?.username || `!${fid}`
                    )}
                  </h3>
                </div>
              </div>
            </div>
            {timestamp && (
              <span className="text-sm text-white/90 absolute right-4">
                {timestamp}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
