"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { useState } from "react";
import type { AppRouter } from "@/server/trpc/root";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { getBaseUrl, transformer } from "./shared";

export const api = createTRPCReact<AppRouter>();
export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  );
  const [client] = useState(() =>
    api.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer,
        }),
      ],
    }),
  );

  return (
    <api.Provider client={client} queryClient={qc}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </api.Provider>
  );
}
