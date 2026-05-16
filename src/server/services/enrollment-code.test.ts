import { describe, expect, it } from "vitest";
import { generateEnrollmentCode } from "./enrollment-code";

// Mock minimal de Prisma TransactionClient: solo necesitamos
// courseInstance.findUniqueOrThrow y enrollment.count.
function makeMockTx(opts: { abbr: string; edition: number; count: number }) {
  return {
    courseInstance: {
      async findUniqueOrThrow() {
        return {
          id: "instance1",
          edition: opts.edition,
          course: { abbr: opts.abbr },
        };
      },
    },
    enrollment: {
      async count() {
        return opts.count;
      },
    },
  };
}

describe("generateEnrollmentCode", () => {
  it("genera el código en formato I-{ABBR}{EDITION}-{NNN}", async () => {
    const tx = makeMockTx({ abbr: "LCI", edition: 5626, count: 17 });
    const code = await generateEnrollmentCode(tx as never, "instance1");
    expect(code).toBe("I-LCI5626-018");
  });

  it("padea el secuencial a 3 dígitos", async () => {
    const tx = makeMockTx({ abbr: "AB", edition: 1, count: 0 });
    expect(await generateEnrollmentCode(tx as never, "instance1")).toBe("I-AB1-001");
  });

  it("respeta abbr largo", async () => {
    const tx = makeMockTx({ abbr: "EBTGN", edition: 12345, count: 99 });
    expect(await generateEnrollmentCode(tx as never, "instance1")).toBe("I-EBTGN12345-100");
  });

  it("count=999 → 1000 con 4 dígitos (no rompe)", async () => {
    const tx = makeMockTx({ abbr: "X", edition: 100, count: 999 });
    expect(await generateEnrollmentCode(tx as never, "instance1")).toBe("I-X100-1000");
  });
});
