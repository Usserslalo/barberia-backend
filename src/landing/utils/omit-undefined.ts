/**
 * Elimina las propiedades con valor `undefined` de un objeto.
 * Útil para PATCH parcial: Prisma no debe recibir undefined en data.
 */
export function omitUndefined<T extends Record<string, unknown>>(
  obj: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}
