import { describe, expect, it } from "vitest";
import { extractPaymentData } from "./payment-ocr";

describe("extractPaymentData", () => {
  it("extrae datos de un comprobante Mercado Pago", () => {
    const text = `MERCADO PAGO\nTransferencia\nFecha: 14/05/2026\nMonto: $ 12.450,50\nNúmero de operación: 67890432109\n`;
    const r = extractPaymentData(text);
    expect(r.medio).toBe("Mercado Pago");
    expect(r.fechaPago).not.toBeNull();
    expect(r.fechaPago?.toISOString().slice(0, 10)).toBe("2026-05-14");
    expect(r.monto).toBe("12450.50");
    expect(r.numeroOperacion).toBe("67890432109");
    expect(r.score).toBeGreaterThanOrEqual(60);
  });

  it("extrae datos de transferencia bancaria con formato US", () => {
    const text = `Comprobante de Transferencia\n01-06-2026\n$ 8,500.00\nReferencia: TX-ABC123456789\n`;
    const r = extractPaymentData(text);
    expect(r.medio).toBe("Transferencia");
    expect(r.fechaPago?.toISOString().slice(0, 10)).toBe("2026-06-01");
    expect(r.monto).toBe("8500.00");
    expect(r.numeroOperacion).toMatch(/ABC123456789/);
  });

  it("tolera texto sin datos y devuelve score 0", () => {
    const r = extractPaymentData("texto cualquiera sin nada útil");
    expect(r.medio).toBeNull();
    expect(r.fechaPago).toBeNull();
    expect(r.score).toBe(0);
  });

  it("ignora fechas inválidas (mes > 12)", () => {
    const r = extractPaymentData("Pago realizado 31/13/2026 $1000");
    expect(r.fechaPago).toBeNull();
  });
});
