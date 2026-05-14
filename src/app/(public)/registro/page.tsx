import { RegisterForm } from "./register-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegistroPage() {
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
