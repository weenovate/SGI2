import { describe, expect, it } from "vitest";
import { extractExpiryDate } from "@/lib/ocr";

describe("extractExpiryDate", () => {
  it("toma la fecha más alta del texto (probable vencimiento)", () => {
    const text = "Fecha emisión: 14/05/2024\nVence: 14/05/2034";
    const r = extractExpiryDate(text);
    expect(r?.toISOString().slice(0, 10)).toBe("2034-05-14");
  });

  it("soporta separadores - y .", () => {
    expect(extractExpiryDate("Vto 31-12-2030")?.toISOString().slice(0, 10)).toBe("2030-12-31");
    expect(extractExpiryDate("Venc.: 30.06.2028")?.toISOString().slice(0, 10)).toBe("2028-06-30");
  });

  it("devuelve null cuando no hay fechas válidas", () => {
    expect(extractExpiryDate("texto sin fechas")).toBeNull();
    expect(extractExpiryDate("32/13/2030")).toBeNull();
  });
});
