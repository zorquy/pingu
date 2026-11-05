// Una página recién llegada a una sección lleva «Nuevo» unas semanas (tanda
// 1242: Tiendas entra en Comunidad). Lo leen la lateral, la burbuja del móvil
// y la bienvenida de la sección, sin copiar la fecha. Una página nueva de una
// sección entra aquí con el día en que deja de serlo.
export const NUEVA_HASTA = { tiendas: '2026-12-03' }

export function esNueva(clave, hoy = new Date()) {
  const hasta = NUEVA_HASTA[clave]
  return Boolean(hasta) && hoy < new Date(`${hasta}T00:00:00`)
}
