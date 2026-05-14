import "server-only";
import { headers } from "next/headers";
import { appRouter } from "@/server/trpc/root";
import { createContext } from "@/server/trpc/trpc";

export async function createCaller() {
  const h = await headers();
  return appRouter.createCaller(await createContext({ headers: new Headers(h) }));
}
