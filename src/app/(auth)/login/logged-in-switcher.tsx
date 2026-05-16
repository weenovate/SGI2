"use client";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

/**
 * Mostrado en /login cuando ya hay sesión activa. Permite continuar
 * con esa cuenta o cerrar sesión para entrar con otra (sin quedar
 * trabado por cookies stale).
 */
export function LoggedInSwitcher({
  name,
  email,
  callbackUrl,
}: {
  name: string;
  email: string;
  callbackUrl: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm">
        Ya hay una sesión activa como <strong>{name}</strong>
        {email && <span className="text-muted-foreground"> ({email})</span>}.
      </p>
      <div className="flex gap-2">
        <Link href={callbackUrl} className="flex-1">
          <Button className="w-full">Continuar como {name.split(" ")[0]}</Button>
        </Link>
        <Button
          variant="outline"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}
