import { redirect } from "next/navigation";
import { RegisterForm } from "./register-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";

export default async function RegistroPage() {
  const session = await auth();
  // Si ya está logueado, no tiene sentido el registro: va a su home.
  if (session?.user) redirect("/after-login");
  return (
    <section className="max-w-lg mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Registro de alumno</CardTitle>
          <CardDescription>Solo alumnos pueden registrarse desde acá. Vas a recibir un email para verificar la cuenta.</CardDescription>
        </CardHeader>
        <CardContent>
          <RegisterForm />
        </CardContent>
      </Card>
    </section>
  );
}
