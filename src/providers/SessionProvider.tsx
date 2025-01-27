"use client";

import { User } from "@/types/user";
import sdk, { Context, FrameNotificationDetails } from "@farcaster/frame-sdk";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Session } from "lucia";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import * as Sentry from "@sentry/nextjs";
import {
  useAccount,
  useChainId,
  useConnect,
  useConnectors,
  useSwitchChain,
} from "wagmi";
import { base } from "viem/chains";

interface SessionContextType {
  user: User | null | undefined;
  session: Session | null | undefined;
  context: Context.FrameContext | null | undefined;
  isLoading: boolean;
  isError: boolean;
  authFetch: typeof fetch;
  /** Trigger refetch of user query */
  refetchUser: () => void;
  /** Fetch user from server */
  fetchUser: () => Promise<User>;
}

function formatLocalStorageSessionKey(fid: number) {
  return `userSession-${fid}`;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.FrameContext>();
  const { connect } = useConnect();
  const connectors = useConnectors();
  const account = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const {
    data: session,
    refetch: refetchSession,
    isFetching: isFetchingSession,
  } = useQuery({
    queryKey: ["session", context?.user.fid],
    queryFn: async () => {
      if (!context?.user?.fid) return null;

      // Check local storage first
      const storedSession = localStorage.getItem(
        formatLocalStorageSessionKey(context.user.fid)
      );

      if (storedSession) {
        const session = JSON.parse(storedSession) as Session;

        if (new Date(session.expiresAt).getTime() < Date.now()) {
          console.log("Session expired, removing from localStorage");

          localStorage.removeItem(
            formatLocalStorageSessionKey(context.user.fid)
          );
        } else {
          return session;
        }
      }

      const challengeId = crypto.randomUUID();
      const challenge = await fetchChallenge(challengeId);

      const result = await sdk.actions.signIn({ nonce: challenge });

      const session = await signIn({
        ...result,
        challengeId,
      });

      // Store the session in localStorage
      localStorage.setItem(
        formatLocalStorageSessionKey(context.user.fid),
        JSON.stringify(session)
      );

      return session;
    },
    enabled: isSDKLoaded && !!context?.user?.fid,
  });

  const authFetch = useCallback(
    (input: RequestInfo | URL, init?: RequestInit) => {
      return fetch(input, {
        ...init,
        headers: session?.id
          ? {
              Authorization: `Bearer ${session?.id}`,
            }
          : undefined,
      });
    },
    [session?.id]
  );

  const fetchUser = useCallback(async () => {
    const response = await authFetch("/api/user");

    if (!response.ok) {
      throw new Error(`Failed to fetch user ${response.status}`);
    }

    return response.json() as Promise<User>;
  }, [authFetch]);

  const {
    data: user,
    isLoading: isLoadingUser,
    isError,
    refetch: refetchUser,
  } = useQuery({
    queryKey: ["user", session?.id],
    queryFn: fetchUser,
    enabled: isSDKLoaded && !!context?.user?.fid && !!session,
    refetchInterval: 1000 * 60,
    retry: false,
  });

  const { mutate: setNotificationsMutation } = useMutation({
    mutationFn: async (notificationDetails: FrameNotificationDetails) => {
      const response = await authFetch("/api/user/notifications", {
        method: "PATCH",
        body: JSON.stringify(notificationDetails),
      });

      if (!response.ok) {
        throw new Error("Failed to set notification details");
      }

      return response.json();
    },
    onSuccess: () => {
      refetchUser();
    },
  });

  useEffect(() => {
    refetchUser();
  }, [session, refetchUser]);

  useEffect(() => {
    if (
      isSDKLoaded &&
      context?.user?.fid &&
      session &&
      isError &&
      !isLoadingUser
    ) {
      localStorage.removeItem(formatLocalStorageSessionKey(context.user.fid));
      refetchSession();
    }
  }, [isSDKLoaded, context?.user?.fid, refetchSession, isError, session]);

  useEffect(() => {
    const load = async () => {
      try {
        const awaitedContext = await sdk.context;
        // awaitedContext.client.added = true; // TODO: Remove
        setContext(awaitedContext);
        sdk.actions.ready();
      } catch (error) {
        console.error("Error loading SDK:", error);
      }
    };
    if (sdk && !isSDKLoaded) {
      setIsSDKLoaded(true);
      load();
    }
  }, [isSDKLoaded]);

  useEffect(() => {
    // Set notification details if somehow not set in db after webhook already called
    if (
      user &&
      !user?.notificationsEnabled &&
      context?.client.notificationDetails
    ) {
      setNotificationsMutation(context.client.notificationDetails);
    }
  }, [user, context, setNotificationsMutation]);

  /** Handle redirect if user needs to complete onboarding */
  useEffect(() => {
    if (isLoadingUser || !isSDKLoaded) return;
    const currentPath = window.location.pathname;
    const searchParams = window.location.search;

    const redirectUrl = encodeURIComponent(`${currentPath}${searchParams}`);

    const onboardingComplete = true;

    if (user && !onboardingComplete) {
      router.push(`/onboarding?redirect=${redirectUrl}`);
    }
  }, [user, isLoadingUser, isError, router, isSDKLoaded]);

  useEffect(() => {
    if (user) {
      posthog.identify(user.id, {
        fid: user.fid,
      });
      Sentry.setUser({
        id: user.id,
        fid: user.fid,
      });
    }
  }, [user]);

  useEffect(() => {
    if (isSDKLoaded && connectors.length > 0 && !account.address) {
      // Connect connector
      connect({
        connector: connectors[0],
        chainId: base.id,
      });
    }
  }, [isSDKLoaded, connectors, connect, account.address]);

  useEffect(() => {
    if (account.address && chainId !== base.id) {
      switchChain({
        chainId: base.id,
      });
    }
  }, [account.address, chainId, switchChain]);

  return (
    <SessionContext.Provider
      value={{
        user,
        session,
        context,
        isLoading: isLoadingUser || isFetchingSession || !isSDKLoaded,
        isError,
        refetchUser,
        authFetch,
        fetchUser,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

async function fetchChallenge(challengeId: string): Promise<string> {
  const response = await fetch("/api/challenge", {
    method: "POST",
    body: JSON.stringify({ challengeId }),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch challenge");
  }

  const { challenge } = await response.json();

  return challenge;
}

async function signIn({
  message,
  signature,
  challengeId,
}: {
  message: string;
  signature: string;
  challengeId: string;
}): Promise<Session> {
  const response = await fetch("/api/sign-in", {
    method: "POST",
    body: JSON.stringify({ message, signature, challengeId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to sign in ${response.status}`);
  }

  const { session } = await response.json();

  if (!session) {
    throw new Error("Could not create session");
  }

  return session;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
