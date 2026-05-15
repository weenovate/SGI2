"use client";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOut, User as UserIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

/**
 * Dropdown reutilizable: muestra el nombre del usuario y ofrece
 * "Mi perfil" + "Cerrar sesión". Para alumnos/público.
 */
export function UserMenu({ name, email, profileHref = "/mis-datos" }: { name: string; email?: string; profileHref?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 max-w-[14rem]">
          <UserIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {email && (
          <>
            <div className="px-2 py-1.5 text-xs text-muted-foreground truncate" title={email}>{email}</div>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild>
          <Link href={profileHref}>
            <UserIcon className="h-4 w-4 mr-2" /> Mi perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            signOut({ callbackUrl: "/calendario" });
          }}
        >
          <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
