"use client";
import { SessionProvider } from "next-auth/react";
import { TRPCProvider } from "@/lib/trpc/react";
import { ServiceWorkerRegistration } from "./sw-register";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TRPCProvider>{children}</TRPCProvider>
      <ServiceWorkerRegistration />
    </SessionProvider>
  );
}
