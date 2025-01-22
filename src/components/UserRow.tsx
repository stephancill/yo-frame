"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SearchedUser, UserDehydrated } from "@neynar/nodejs-sdk/build/api";
import { useState } from "react";
import { twMerge } from "tailwind-merge";
import { useLongPress } from "../hooks/use-long-press";
import { useSendMessageMutation } from "../lib/messages";
import { useSession } from "../providers/SessionProvider";
import { Bell, BellOff } from "lucide-react";

type UserRowProps = {
  user: SearchedUser | UserDehydrated;
  fid: number;
  backgroundColor: string;
  disabled?: boolean;
  timestamp?: string;
  messageCount?: number;
  isNotificationsEnabled?: boolean;
  onMessageSent?: () => void;
  onShowNotification?: (userData: UserDehydrated) => void;
  onLongPress?: () => void;
};

export function UserRow({
  user,
  fid,
  backgroundColor,
  disabled = false,
  timestamp,
  messageCount,
  isNotificationsEnabled,
  onMessageSent,
  onShowNotification,
  onLongPress,
}: UserRowProps) {
  const [animationPhase, setAnimationPhase] = useState<
    "initial" | "starting" | "complete"
  >("initial");
  const { authFetch } = useSession();

  const sendMessageMutation = useSendMessageMutation();

  const longPressBind = useLongPress(onLongPress ?? (() => {}), () => {
    if (!sendMessageMutation.isPending && animationPhase === "initial") {
      setAnimationPhase("starting");
      sendMessageMutation.mutate(
        {
          fid,
          authFetch,
        },
        {
          onSuccess(data, variables, context) {
            if (
              !data.userNotified &&
              data.targetUserData &&
              onShowNotification
            ) {
              onShowNotification(data.targetUserData);
            }

            setAnimationPhase("complete");
            if (onMessageSent) {
              onMessageSent();
            }
          },
          onError(error, variables, context) {
            setAnimationPhase("initial");
          },
        }
      );
    }
  });

  return (
    <button
      {...longPressBind}
      disabled={
        disabled ||
        sendMessageMutation.isPending ||
        animationPhase === "complete"
      }
      className={twMerge(
        "block w-full text-left hover:brightness-95 relative prevent-select",
        (disabled ||
          sendMessageMutation.isPending ||
          animationPhase === "complete") &&
          "cursor-not-allowed opacity-50",
        animationPhase === "initial" &&
          sendMessageMutation.isError &&
          "animate-[shake_0.5s_ease-in-out]"
      )}
      style={{ backgroundColor }}
    >
      <div
        className={twMerge(
          "absolute bottom-0 left-0 h-1 transition-[width] duration-300",
          sendMessageMutation.isError && "bg-red-400/50"
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

      <div className="flex items-center gap-4 p-6">
        <div className="flex-1">
          <div className="flex justify-between items-center">
            {messageCount !== undefined && (
              <span className="text-sm text-white/90 absolute left-4">
                {sendMessageMutation.isSuccess
                  ? Number(messageCount) + 1
                  : messageCount}
              </span>
            )}
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
                  ) : user ? (
                    <Avatar className="w-5 h-5">
                      <AvatarFallback>{user.username}</AvatarFallback>
                    </Avatar>
                  ) : (
                    <Avatar className="w-5 h-5">
                      <AvatarFallback>{fid}</AvatarFallback>
                    </Avatar>
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white uppercase flex items-center">
                    {animationPhase === "complete" ? (
                      <span>yo sent!</span>
                    ) : (
                      <>
                        {user?.username || `!${fid}`}
                        {isNotificationsEnabled !== undefined && (
                          <span className="ml-1 text-white/50">
                            {isNotificationsEnabled ? (
                              <Bell className="w-4 h-4" />
                            ) : (
                              <BellOff className="w-4 h-4" />
                            )}
                          </span>
                        )}
                      </>
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
