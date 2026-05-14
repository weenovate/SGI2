import { test, expect } from "@playwright/test";

/**
 * Smoke tests: lo mínimo que tiene que estar vivo en producción.
 * Asumen que la home pública sirve el calendario.
 */

test("calendario público responde y renderiza el logo", async ({ page }) => {
  await page.goto("/calendario");
  await expect(page.getByRole("heading", { name: /Calendario de cursos/i })).toBeVisible();
  await expect(page.getByAltText(/FuENN/i).first()).toBeVisible();
});

test("login muestra el formulario", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel(/Usuario/i)).toBeVisible();
  await expect(page.getByLabel(/Contraseña/i)).toBeVisible();
});

test("registro de alumno tiene campos requeridos", async ({ page }) => {
  await page.goto("/registro");
  await expect(page.getByLabel(/Nombres/i)).toBeVisible();
  await expect(page.getByLabel(/Apellidos/i)).toBeVisible();
  await expect(page.getByLabel(/Email/i)).toBeVisible();
  await expect(page.getByLabel(/Contraseña/i)).toBeVisible();
});

test("rutas protegidas redirigen a login", async ({ page }) => {
  const res = await page.goto("/dashboard");
  // Cualquier redirect a /login está bien.
  expect(res?.url()).toContain("/login");
});

test("API health responde OK por tRPC", async ({ request }) => {
  const res = await request.get("/api/trpc/health");
  expect([200, 401]).toContain(res.status());
});
