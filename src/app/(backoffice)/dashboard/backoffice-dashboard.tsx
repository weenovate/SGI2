"use client";
import Link from "next/link";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { ArrowRight, ClipboardList, CreditCard, FileCheck, Briefcase, TrendingUp } from "lucide-react";
import { api } from "@/lib/trpc/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function BackofficeDashboard({ role }: { role: string }) {
  const d = api.dashboards.backoffice.useQuery();

  if (d.isLoading) return <p className="text-muted-foreground">Cargando…</p>;
  if (!d.data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {role === "manager" ? "Vista ejecutiva (solo lectura)." : "Resumen operativo del instituto."}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          title="Preinscripciones pendientes"
          value={d.data.pendientesInscripcion}
          href="/inscripciones?status=preinscripto"
          icon={<ClipboardList className="h-5 w-5" />}
          intent={d.data.pendientesInscripcion > 0 ? "warning" : "info"}
        />
        <KpiCard
          title="Pagos a validar"
          value={d.data.pendientesPago}
          href="/inscripciones?status=validar_pago"
          icon={<CreditCard className="h-5 w-5" />}
          intent={d.data.pendientesPago > 0 ? "warning" : "info"}
        />
        <KpiCard
          title="Documentos pendientes"
          value={d.data.pendientesDocs}
          href="/documentacion"
          icon={<FileCheck className="h-5 w-5" />}
          intent={d.data.pendientesDocs > 0 ? "warning" : "info"}
        />
        <KpiCard
          title="Empresas a aprobar"
          value={d.data.empresasPend}
          href="/empresas"
          icon={<Briefcase className="h-5 w-5" />}
          intent={d.data.empresasPend > 0 ? "warning" : "info"}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Inscriptos este mes" value={d.data.inscriptosMes} icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard title="Cursos activos" value={d.data.cursosActivos} />
        <StatCard title="Vacantes libres" value={d.data.vacantesLibres} />
        <StatCard title="Pendientes totales" value={d.data.pendientesInscripcion + d.data.pendientesPago + d.data.pendientesDocs} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inscripciones de los últimos 6 meses</CardTitle>
          <CardDescription>Total creadas vs. inscriptos (confirmadas).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.data.enrollmentsLast6Months}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" name="Creadas" fill="hsl(211 80% 48%)" />
                <Bar dataKey="inscriptos" name="Confirmadas" fill="hsl(199 89% 56%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ title, value, href, icon, intent }: { title: string; value: number; href: string; icon: React.ReactNode; intent: "warning" | "info" }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">{icon}{title}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <span className={"text-3xl font-bold " + (intent === "warning" && value > 0 ? "text-amber-600" : "text-foreground")}>{value}</span>
          <Link href={href}>
            <Button variant="ghost" size="sm">
              Ver <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({ title, value, icon }: { title: string; value: number; icon?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">{icon}{title}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
