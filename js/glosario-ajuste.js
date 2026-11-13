// Apagar el glosario en guías y foro (tanda 1320, P5 del plan): una llave en
// este navegador, para quien ya se lo sabe. Aparte de glosario.js para que
// Ajustes no se baje la lista entera de palabras por un interruptor.
export const LLAVE_SIN_GLOSARIO = 'pd-sin-glosario'
export function glosarioApagado(almacen = globalThis.localStorage) {
  try { return almacen?.getItem(LLAVE_SIN_GLOSARIO) === '1' } catch { return false }
}
