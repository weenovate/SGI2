/**
 * Selectores Prisma reutilizables para no filtrar campos sensibles
 * (passwordHash, failedAttempts, lockedUntil) en respuestas tRPC.
 */

export const userPublicSelect = {
  id: true,
  username: true,
  email: true,
  emailVerifiedAt: true,
  role: true,
  status: true,
  firstName: true,
  lastName: true,
  image: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  deletedBy: true,
  // Explícitamente NO incluye: passwordHash, failedAttempts, lockedUntil.
} as const;
