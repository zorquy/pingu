// CÓDIGO DE BARRAS Code 128 (tanda 1253): el SKU de una copia en la etiqueta,
// para un lector USB de los de mostrador (escribe lo que lee y un Intro). Se
// usa el juego B (letras, números y guiones, que es todo lo que lleva un SKU)
// y, si el texto es todo cifras en número par, el C, que lo deja a la mitad.
//
// Puro y sin dependencias: lo dibujan las etiquetas (js/tienda-etiquetas.js)
// y lo prueba node. Cada símbolo son tres barras y tres espacios que suman 11
// módulos; el de parada, cuatro barras y 13. Las anchuras de la tabla son las
// del estándar (ISO/IEC 15417), comprobadas contra JsBarcode en la 1253.
const TABLA = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
]
const INICIO_B = 104
const INICIO_C = 105
const PARADA = 106
export const MARGEN_MODULOS = 10 // la zona en blanco a cada lado, que el lector necesita

// Los valores de los símbolos, con el de control y la parada. `null` si el
// texto lleva algo que el juego B no tiene (fuera del ASCII imprimible).
export function simbolosDe(texto) {
  const t = String(texto ?? '')
  if (!t) return null
  let valores
  if (/^(\d\d)+$/.test(t)) {
    valores = [INICIO_C, ...t.match(/\d\d/g).map(Number)]
  } else {
    if (![...t].every((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126)) return null
    valores = [INICIO_B, ...[...t].map((c) => c.charCodeAt(0) - 32)]
  }
  const control = valores.reduce((s, v, i) => s + v * Math.max(1, i), 0) % 103
  return [...valores, control, PARADA]
}

// Las barras como una cadena de módulos: «1» barra, «0» espacio, sin la zona
// en blanco (la pone quien dibuja).
export function modulosDe(texto) {
  const s = simbolosDe(texto)
  if (!s) return null
  let r = ''
  for (const v of s) {
    const p = TABLA[v]
    for (let i = 0; i < p.length; i++) r += (i % 2 ? '0' : '1').repeat(Number(p[i]))
  }
  return r
}

// Dibuja el código en un lienzo, centrado en (x, y, ancho, alto) en píxeles.
// El módulo es un número ENTERO de píxeles (un lector no perdona barras de
// anchos distintos por redondear); si no cabe ni a uno, no dibuja y devuelve
// false.
export function dibujarCodigo(ctx, texto, { x, y, ancho, alto, tinta = '#000000' }) {
  const m = modulosDe(texto)
  if (!m) return false
  const modulo = Math.floor(ancho / (m.length + MARGEN_MODULOS * 2))
  if (modulo < 1) return false
  const x0 = Math.round(x + (ancho - m.length * modulo) / 2)
  ctx.fillStyle = tinta
  let i = 0
  while (i < m.length) {
    if (m[i] === '1') {
      let j = i
      while (j < m.length && m[j] === '1') j++
      ctx.fillRect(x0 + i * modulo, Math.round(y), (j - i) * modulo, Math.round(alto))
      i = j
    } else i++
  }
  return true
}
