import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { NotificationsInbox } from "./inbox";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/notificaciones");
  return <NotificationsInbox />;
}
