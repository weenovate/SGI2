"use client";
import { useMemo, useState } from "react";
import { CheckCheck, Mail, MailOpen } from "lucide-react";
import { api } from "@/lib/trpc/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Filter = "todas" | "no_leidas" | "leidas";

export function NotificationsInbox() {
  const utils = api.useUtils();
  const list = api.notifications.myList.useQuery({ limit: 100 });
  const markRead = api.notifications.markRead.useMutation({
    onSuccess: () => { utils.notifications.myList.invalidate(); utils.notifications.myUnreadCount.invalidate(); },
  });
  const markAll = api.notifications.markAllRead.useMutation({
    onSuccess: () => { utils.notifications.myList.invalidate(); utils.notifications.myUnreadCount.invalidate(); },
  });
  const [filter, setFilter] = useState<Filter>("todas");

  const filtered = useMemo(() => {
    const data = list.data ?? [];
    if (filter === "no_leidas") return data.filter((n) => !n.read);
    if (filter === "leidas") return data.filter((n) => n.read);
    return data;
  }, [list.data, filter]);

  const totals = useMemo(() => {
    const data = list.data ?? [];
    return {
      total: data.length,
      unread: data.filter((n) => !n.read).length,
      read: data.filter((n) => n.read).length,
    };
  }, [list.data]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Notificaciones</CardTitle>
            <CardDescription>Tus mensajes del sistema.</CardDescription>
          </div>
          {totals.unread > 0 && (
            <Button size="sm" variant="outline" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
              <CheckCheck className="h-4 w-4 mr-1" /> Marcar todas como leídas
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="todas">Todas ({totals.total})</TabsTrigger>
            <TabsTrigger value="no_leidas">No leídas ({totals.unread})</TabsTrigger>
            <TabsTrigger value="leidas">Leídas ({totals.read})</TabsTrigger>
          </TabsList>
          <TabsContent value={filter} className="space-y-2 mt-4">
            {list.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
            {!list.isLoading && filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No hay notificaciones.</p>
            )}
            {filtered.map((n) => {
              const isUnread = !n.read;
              return (
                <div
                  key={n.id}
                  className={[
                    "rounded-md border p-3 flex items-start gap-3 transition-colors",
                    isUnread ? "bg-sky-50 border-sky-200" : "bg-white",
                  ].join(" ")}
                >
                  <div className="mt-0.5">
                    {isUnread ? <Mail className="h-4 w-4 text-sky-600" /> : <MailOpen className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={"text-sm " + (isUnread ? "font-semibold" : "")}>{n.title}</span>
                      <div className="flex items-center gap-1">
                        {n.level === "critical" && <Badge variant="destructive">crítica</Badge>}
                        {n.level === "important" && <Badge variant="warning">importante</Badge>}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{n.body}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(n.createdAt).toLocaleString("es-AR")}
                        {n.read && (
                          <> · Leída el {new Date(n.read).toLocaleString("es-AR")}</>
                        )}
                      </span>
                      {isUnread && (
                        <Button size="sm" variant="ghost" onClick={() => markRead.mutate({ id: n.id })} disabled={markRead.isPending}>
                          Marcar como leída
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
