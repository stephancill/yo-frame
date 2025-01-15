"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "../providers/SessionProvider";
import { Suspense } from "react";
import { CSPostHogProvider } from "../providers/PosthogProvider";

const queryClient = new QueryClient();

export function Provider({ children }: { children: React.ReactNode }) {
  return (
    <CSPostHogProvider>
      <QueryClientProvider client={queryClient}>
        <Suspense>
          <SessionProvider>{children}</SessionProvider>
        </Suspense>
      </QueryClientProvider>
    </CSPostHogProvider>
  );
}
