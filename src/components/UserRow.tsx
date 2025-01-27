"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SearchedUser, User as NeynarUser } from "@neynar/nodejs-sdk/build/api";
import { useMemo, useState } from "react";
import { twMerge } from "tailwind-merge";
import { useLongPress } from "../hooks/use-long-press";
import { useSendMessageMutation } from "../lib/messages";
import { useSession } from "../providers/SessionProvider";
import { Bell, BellOff, Check } from "lucide-react";

type UserRowProps = {
  user: SearchedUser | NeynarUser;
  fid: number;
  backgroundColor: string;
  disabled?: boolean;
  timestamp?: string;
  messageCount?: number;
  onchainMessageCount?: number;
  isNotificationsEnabled?: boolean;
  onMessageSent?: () => void;
  onShowNotification?: (userData: NeynarUser) => void;
  onLongPress?: () => void;
  selected?: boolean;
  onSelect?: () => void;
  mode?: "select" | "message";
  isSuper?: boolean;
  animationPhase?: "initial" | "starting" | "complete";
};

export function UserRow(props: UserRowProps) {
  const {
    user,
    fid,
    backgroundColor,
    disabled = false,
    timestamp,
    messageCount,
    onchainMessageCount,
    isNotificationsEnabled,
    onMessageSent,
    onShowNotification,
    onLongPress,
    selected = false,
    onSelect,
    mode = "message",
    isSuper = false,
    animationPhase: animationPhaseOverride,
  } = props;

  const [animationPhaseInternal, setAnimationPhaseInternal] = useState<
    "initial" | "starting" | "complete"
  >("initial");
  const { authFetch } = useSession();

  const sendMessageMutation = useSendMessageMutation();

  const handleClick = () => {
    if (!disabled && mode === "select" && onSelect) {
      onSelect();
      return;
    }

    if (!sendMessageMutation.isPending && animationPhase === "initial") {
      setAnimationPhaseInternal("starting");
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

            setAnimationPhaseInternal("complete");
            if (onMessageSent) {
              onMessageSent();
            }
          },
          onError(error, variables, context) {
            setAnimationPhaseInternal("initial");
          },
        }
      );
    }
  };
  const animationPhase = useMemo(
    () => animationPhaseOverride ?? animationPhaseInternal,
    [animationPhaseOverride, animationPhaseInternal]
  );

  const longPressBind = useLongPress(onLongPress ?? (() => {}), handleClick);

  const isSuperInternal = isSuper && !sendMessageMutation.isSuccess;

  return (
    <button
      {...longPressBind}
      disabled={
        disabled ||
        sendMessageMutation.isPending ||
        animationPhase === "complete"
      }
      className={twMerge(
        "block w-full text-left hover:brightness-95 relative prevent-select border-b border-white/50",
        (disabled ||
          sendMessageMutation.isPending ||
          animationPhase === "complete") &&
          "cursor-not-allowed opacity-50",
        animationPhase === "initial" &&
          sendMessageMutation.isError &&
          "animate-[shake_0.5s_ease-in-out]",
        isSuperInternal && "rainbow-gradient"
      )}
      style={{
        backgroundColor: isSuperInternal ? "transparent" : backgroundColor,
      }}
    >
      <div
        className={twMerge("relative", isSuperInternal && "bg-[inherit]")}
        style={{
          backgroundColor: isSuperInternal ? "transparent" : backgroundColor,
        }}
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
                <span className="text-sm text-white/90 absolute left-4 flex items-center gap-1">
                  {onchainMessageCount !== undefined &&
                    Number(onchainMessageCount) > 0 && (
                      <span className="inline-flex items-center flex gap-1">
                        <span>{onchainMessageCount} ★ / </span>
                      </span>
                    )}
                  {sendMessageMutation.isSuccess
                    ? Number(messageCount) + 1
                    : messageCount}
                </span>
              )}
              <div className="flex-1 text-center">
                <div className="flex justify-center items-center gap-1">
                  <div className="relative">
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
                    {selected && (
                      <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5">
                        <Check className="w-3 h-3 text-purple-500" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white uppercase flex items-center">
                      {animationPhase === "complete" ? (
                        isSuperInternal ? (
                          <span>super yo sent! ★</span>
                        ) : (
                          <span>yo sent!</span>
                        )
                      ) : (
                        <>
                          {user?.username || `!${fid}`}
                          {isNotificationsEnabled !== undefined && (
                            <span className="ml-1 text-white/50">
                              {!isNotificationsEnabled && (
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
      </div>
    </button>
  );
}
