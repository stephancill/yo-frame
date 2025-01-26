"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "../providers/SessionProvider";
import { Suspense } from "react";
import { CSPostHogProvider } from "../providers/PosthogProvider";
import { WagmiProvider } from "wagmi";
import { config } from "../lib/wagmi";

const queryClient = new QueryClient();

export function Provider({ children }: { children: React.ReactNode }) {
  return (
    <CSPostHogProvider>
      <QueryClientProvider client={queryClient}>
        <Suspense>
          <WagmiProvider config={config}>
            <SessionProvider>{children}</SessionProvider>
          </WagmiProvider>
        </Suspense>
      </QueryClientProvider>
    </CSPostHogProvider>
  );
}
