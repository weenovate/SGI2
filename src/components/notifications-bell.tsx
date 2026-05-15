"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bell } from "lucide-react";
import { api } from "@/lib/trpc/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function NotificationsBell() {
  const router = useRouter();
  const utils = api.useUtils();
  const unread = api.notifications.myUnreadCount.useQuery(undefined, { refetchInterval: 60_000 });
  const list = api.notifications.myList.useQuery({ limit: 8 });
  const markRead = api.notifications.markRead.useMutation({
    onSuccess: () => { utils.notifications.myUnreadCount.invalidate(); utils.notifications.myList.invalidate(); },
  });
  const markAll = api.notifications.markAllRead.useMutation({
    onSuccess: () => { utils.notifications.myUnreadCount.invalidate(); utils.notifications.myList.invalidate(); },
  });
  const [open, setOpen] = useState(false);

  function onItemClick(id: string, read: boolean | Date | string | null) {
    if (!read) markRead.mutate({ id });
    setOpen(false);
    router.push("/notificaciones");
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificaciones">
          <Bell className="h-5 w-5" />
          {(unread.data ?? 0) > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] rounded-full h-5 min-w-5 px-1 flex items-center justify-center">
              {unread.data}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-96 max-h-[60vh] overflow-auto">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-sm font-medium">Notificaciones</span>
          {(unread.data ?? 0) > 0 && (
            <Button variant="ghost" size="sm" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
              Marcar todas
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        {list.data?.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">Sin notificaciones.</div>
        )}
        {list.data?.map((n) => (
          <DropdownMenuItem
            key={n.id}
            onClick={(e) => { e.preventDefault(); onItemClick(n.id, n.read); }}
            className={"flex-col items-start gap-1 cursor-pointer " + (n.read ? "opacity-70" : "")}
          >
            <div className="flex items-center justify-between w-full">
              <span className={"text-sm " + (n.read ? "" : "font-semibold")}>{n.title}</span>
              {n.level === "critical" && <Badge variant="destructive">crítica</Badge>}
              {n.level === "important" && <Badge variant="warning">importante</Badge>}
            </div>
            <span className="text-xs text-muted-foreground line-clamp-2">{n.body}</span>
            <span className="text-[10px] text-muted-foreground">
              {new Date(n.createdAt).toLocaleString("es-AR")}
              {n.read ? " · leída" : " · no leída"}
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/notificaciones" className="justify-center text-sm font-medium text-primary">
            Ver todas
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
