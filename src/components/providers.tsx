"use client";
import { SessionProvider } from "next-auth/react";
import { TRPCProvider } from "@/lib/trpc/react";
import { ServiceWorkerRegistration } from "./sw-register";
import { Toaster } from "./toaster";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TRPCProvider>{children}</TRPCProvider>
      <Toaster />
      <ServiceWorkerRegistration />
    </SessionProvider>
  );
}
