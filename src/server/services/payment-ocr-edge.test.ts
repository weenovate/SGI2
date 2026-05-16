import { describe, expect, it } from "vitest";
import { extractPaymentData } from "./payment-ocr";

/**
 * Casos extra del parser de comprobantes. El objetivo es asegurar que
 * el OCR pre-llena los campos correctos en escenarios reales del
 * mercado argentino sin generar falsos positivos.
 */
describe("extractPaymentData — edge cases", () => {
  it("detecta Mercado Pago en distintas escrituras", () => {
    expect(extractPaymentData("MERCADOPAGO 14/05/2026 $ 1.000,00").medio).toBe("Mercado Pago");
    expect(extractPaymentData("Mercado Pago 14/05/2026 $ 1.000").medio).toBe("Mercado Pago");
    expect(extractPaymentData("Pago vía MP nro 12345678").medio).toBe("Mercado Pago");
  });

  it("detecta depósito con tilde y sin tilde", () => {
    expect(extractPaymentData("Comprobante de Deposito $1000 14/05/2026").medio).toBe("Depósito");
    expect(extractPaymentData("Depósito en cuenta corriente 14/05/2026 $1000").medio).toBe("Depósito");
  });

  it("detecta Rapipago / Pago Fácil como efectivo", () => {
    expect(extractPaymentData("Pago Rapipago 14/05/2026 $1500").medio).toBe("Efectivo");
    expect(extractPaymentData("PAGO FACIL 14/05/2026 $1500").medio).toBe("Efectivo");
  });

  it("normaliza monto formato AR (1.234,56)", () => {
    const r = extractPaymentData("Transferencia $ 12.345,67 14/05/2026");
    expect(r.monto).toBe("12345.67");
  });

  it("normaliza monto formato US (1,234.56)", () => {
    const r = extractPaymentData("Transferencia $ 12,345.67 14/05/2026");
    expect(r.monto).toBe("12345.67");
  });

  it("monto entero sin decimales", () => {
    const r = extractPaymentData("Pago $ 50000 el 14/05/2026 referencia AB123456");
    // El fallback con regex de decimales no engancha, pero "$ 50000" sí matcheado
    expect(r.monto).toBe("50000");
  });

  it("no confunde 'Comprobante' con número de operación", () => {
    const r = extractPaymentData("Comprobante de Transferencia 14/05/2026 $1000");
    // No tiene 4 dígitos juntos → no debería matchear
    expect(r.numeroOperacion).toBeNull();
  });

  it("captura número de operación con 'Referencia:'", () => {
    const r = extractPaymentData("Transferencia 14/05/2026 $1000 Referencia: TX-ABC123456789");
    expect(r.numeroOperacion).toMatch(/ABC123456789/);
  });

  it("captura número de operación con 'Nro de operación:'", () => {
    const r = extractPaymentData("Pago realizado. Nro de operación: 987654321012 $5000 14/05/2026");
    expect(r.numeroOperacion).toBe("987654321012");
  });

  it("retorna score 0 con texto vacío", () => {
    expect(extractPaymentData("").score).toBe(0);
  });

  it("rawText queda guardado", () => {
    const txt = "Pago $1000 14/05/2026";
    expect(extractPaymentData(txt).rawText).toBe(txt);
  });

  it("fecha con año de 2 dígitos se interpreta como 20XX", () => {
    const r = extractPaymentData("Pago 14/05/26 $1000");
    expect(r.fechaPago?.getUTCFullYear()).toBe(2026);
  });

  it("ignora año cero / texto raro", () => {
    const r = extractPaymentData("Pago 14/05/00 $1000");
    // 14/05/2000 es valido segun la heuristica.
    expect(r.fechaPago?.getUTCFullYear()).toBe(2000);
  });

  it("score crece con más datos extraídos", () => {
    const completo = extractPaymentData("Transferencia 14/05/2026 $1000 Nro operación: 1234567890");
    const parcial = extractPaymentData("14/05/2026");
    expect(completo.score).toBeGreaterThan(parcial.score);
  });
});
