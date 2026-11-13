// Precios en tu moneda (tanda 1330, G9 del plan 2027). Los precios de
// Cardmarket son en euros; quien elige otra moneda los ve pasados al cambio del
// día (la función `cambio`, una vez al día) con un «≈» delante, porque es una
// conversión y no lo que cobra nadie. Lo elegido y el cambio viven en este
// navegador. Sin dependencias: lo importa cardmarket.js, que lo baja todo el
// mundo, y se prueba en node.

export const LLAVE_MONEDA = 'pd-moneda'
export const LLAVE_CAMBIO = 'pd-cambio'

// Decimales: el peso chileno y el colombiano no los usan.
export const MONEDAS = {
  EUR: { nombre: 'Euro', simbolo: '€', locale: 'es-ES', dec: 2 },
  USD: { nombre: 'Dólar estadounidense', simbolo: 'US$', locale: 'es-US', dec: 2 },
  MXN: { nombre: 'Peso mexicano', simbolo: 'MX$', locale: 'es-MX', dec: 2 },
  ARS: { nombre: 'Peso argentino', simbolo: 'AR$', locale: 'es-AR', dec: 0 },
  CLP: { nombre: 'Peso chileno', simbolo: 'CLP$', locale: 'es-CL', dec: 0 },
  COP: { nombre: 'Peso colombiano', simbolo: 'COL$', locale: 'es-CO', dec: 0 },
}

const leer = (k) => { try { return localStorage.getItem(k) } catch { return null } }

export function monedaElegida() {
  const m = leer(LLAVE_MONEDA)
  return MONEDAS[m] ? m : 'EUR'
}

// El cambio guardado: { fecha, tasas: { USD: 1.08, … } } (unidades por euro).
export function cambioGuardado() {
  try {
    const c = JSON.parse(leer(LLAVE_CAMBIO) || 'null')
    return c && c.tasas && typeof c.tasas === 'object' ? c : null
  } catch { return null }
}

// Un importe en euros, en otra moneda. null si es el euro, si no hay cambio
// de esa moneda o si el número no vale: entonces quien llama pinta el euro, que
// es la verdad (la 319: no se sabe ≠ cero).
export function enMoneda(eur, moneda = monedaElegida(), cambio = cambioGuardado()) {
  if (moneda === 'EUR' || !MONEDAS[moneda]) return null
  const tasa = Number(cambio?.tasas?.[moneda])
  if (!(typeof eur === 'number' && Number.isFinite(eur)) || !(tasa > 0)) return null
  const m = MONEDAS[moneda]
  const n = eur * tasa
  const cifra = n.toLocaleString(m.locale, { minimumFractionDigits: m.dec, maximumFractionDigits: m.dec, useGrouping: 'always' })
  return `≈ ${m.simbolo} ${cifra}`
}

// Si el cambio guardado es de otro día, toca pedirlo otra vez.
export const cambioViejo = (cambio, hoy = new Date().toISOString().slice(0, 10)) => !cambio?.fecha || String(cambio.fecha).slice(0, 10) < hoy
