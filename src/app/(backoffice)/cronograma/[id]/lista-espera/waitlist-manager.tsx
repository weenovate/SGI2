"use client";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, Mail } from "lucide-react";
import { api } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function WaitlistManager({ instanceId }: { instanceId: string }) {
  const utils = api.useUtils();
  const inst = api.instances.byId.useQuery({ id: instanceId });
  const list = api.enrollments.waitlistForInstance.useQuery({ instanceId });
  const reorder = api.enrollments.reorderWaitlist.useMutation({ onSuccess: () => utils.enrollments.waitlistForInstance.invalidate() });
  const offer = api.enrollments.offerVacancy.useMutation({ onSuccess: () => utils.enrollments.waitlistForInstance.invalidate() });

  function move(idx: number, dir: -1 | 1) {
    if (!list.data) return;
    const ids = list.data.map((e) => e.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j]!, ids[idx]!];
    reorder.mutate({ instanceId, order: ids });
  }

  return (
    <div className="space-y-4">
      <Link href="/cronograma"><Button variant="ghost"><ArrowLeft className="h-4 w-4" /> Volver al cronograma</Button></Link>

      <div>
        <h1 className="text-2xl font-semibold">Lista de espera</h1>
        {inst.data && <p className="text-sm text-muted-foreground">{inst.data.course.abbr} {inst.data.edition} — {inst.data.course.name}</p>}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Pos</TableHead>
            <TableHead>Alumno</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Anotado</TableHead>
            <TableHead>Ofertas</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Cargando…</TableCell></TableRow>}
          {!list.isLoading && (list.data?.length ?? 0) === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Sin alumnos en espera.</TableCell></TableRow>}
          {list.data?.map((e, idx) => {
            const pendingOffers = e.offers.filter((o) => o.status === "pending").length;
            const studentLabel = e.student
              ? `${e.student.lastName ?? ""}, ${e.student.firstName ?? ""}`.trim().replace(/^,\s*/, "")
              : "—";
            return (
              <TableRow key={e.id}>
                <TableCell className="font-mono">{e.position}</TableCell>
                <TableCell>
                  {studentLabel}
                  {e.student?.studentProfile?.docNumber && (
                    <div className="text-xs text-muted-foreground font-mono">DNI {e.student.studentProfile.docNumber}</div>
                  )}
                </TableCell>
                <TableCell className="text-xs">{e.student?.email ?? "—"}</TableCell>
                <TableCell>{new Date(e.createdAt).toLocaleString("es-AR")}</TableCell>
                <TableCell>
                  {e.offers.length === 0 ? "—" :
                    <span>
                      {e.offers.length}{pendingOffers > 0 && <Badge variant="warning" className="ml-1">{pendingOffers} pend.</Badge>}
                    </span>
                  }
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => move(idx, -1)} disabled={idx === 0}><ArrowUp className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => move(idx, 1)} disabled={idx === (list.data?.length ?? 0) - 1}><ArrowDown className="h-4 w-4" /></Button>
                  <Button variant="outline" size="sm" onClick={() => offer.mutate({ entryId: e.id })} disabled={offer.isPending || pendingOffers > 0}>
                    <Mail className="h-4 w-4" /> Ofrecer vacante
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
