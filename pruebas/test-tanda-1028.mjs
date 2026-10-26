// Tanda 1028 — los precios por idioma de las versiones de una carta, a
// demanda (`tcggo-versiones-ahora`): el Lugia Reverse de Darkness Ablaze
// decía «0,10 €, cualquier idioma» con el español a 25 € en TCGGO, porque la
// pasada de idiomas solo mira las versiones que alguien tiene apuntadas.
//
// El fixture es el ejemplo «Get card» de su especificación
// (pruebas/fixtures/tcggo-carta-1028.json, tal cual): se usa como lo que
// contesta `/cards?ids=` para la versión, con su id puesto, porque una
// versión pedida por id contesta con la forma de una carta (929).
import { readFileSync } from 'node:fs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const REAL = JSON.parse(readFileSync(new URL('./fixtures/tcggo-carta-1028.json', import.meta.url), 'utf8')).carta.data
const fn = await import(`${RAIZ}/netlify/functions/tcggo-versiones-ahora.mjs`)
const { filaDeIdiomasDeVersion } = await import(`${RAIZ}/netlify/lib/tcggo.mjs`)

console.log('── 1. Lo puro ──')
{
  const f = filaDeIdiomasDeVersion({ ...REAL, id: 35162 }, { cardId: 'swsh3-140', market: 'WEST', ahora: new Date('2026-10-26T10:00:00Z') })
  check('la fila por idioma lleva ahora el producto de Cardmarket (el enlace exacto) y el español', f.cm_id_product === 877413 && f.cm_low_es === 0.02 && f.cm_low === 0.03 && f.tcggo_id === 35162 && f.card_id === 'swsh3-140', JSON.stringify(f))
  check('  …y sin cardmarket_id no se manda la columna (merge-duplicates no la pisa)', !('cm_id_product' in filaDeIdiomasDeVersion({ ...REAL, id: 1, cardmarket_id: null }, { cardId: 'x' })))
  const suyas = fn.versionesDeTcggo([{ tcggo_id: 35162 }, { tcggo_id: -1, origen: 'mano' }, { tcggo_id: 7, origen: 'edicion' }, { tcggo_id: 9, origen: 'tcgdex' }, { tcggo_id: 11, origen: 'tcggo' }, { tcggo_id: null }])
  check('las versiones que se pueden pedir: las de TCGGO con su id, sin las a mano, las ediciones ni las de TCGdex', JSON.stringify(suyas.map((x) => x.tcggo_id)) === '[35162,11]', JSON.stringify(suyas))
}

console.log('\n── 2. La función ──')
{
  const FILA = { tcggo_id: 35162, market: 'WEST', card_id: 'swsh3-140', set_id: 'swsh3', etiqueta: 'Reverse Holo', origen: null, cm_id_product: null, link_cm: 'https://www.tcggo.com/external/cm/35162', cm_low: 0.1, cm_low_es: null, actualizado_at: '2026-10-22T03:00:00Z' }
  const montar = ({ filas = [FILA], estado = {}, respuesta = null, status = 200, env = {} } = {}) => {
    const llamadas = []
    const guardadas = []
    let base = filas.map((f) => ({ ...f }))
    let guardado = estado
    const restImpl = async (ruta) => {
      if (ruta.startsWith('tcg_card_versions?select=')) return base
      throw new Error(`ruta inesperada ${ruta}`)
    }
    const guardarImpl = async (nuevas) => {
      guardadas.push(...nuevas)
      base = base.map((f) => { const n = nuevas.find((x) => x.tcggo_id === f.tcggo_id); return n ? { ...f, ...n } : f })
    }
    const fetchImpl = async (url) => { llamadas.push(url); return new Response(status === 200 ? JSON.stringify(respuesta || { data: [{ ...REAL, id: 35162 }] }) : 'no', { status }) }
    return { llamadas, guardadas, restImpl, guardarImpl, fetchImpl, estadoImpl: async () => guardado, guardarEstadoImpl: async (v) => { guardado = v }, estado: () => guardado, env: { SUPABASE_SERVICE_ROLE_KEY: 'x', TCGGO_API_KEY: 'k', ...env } }
  }
  const ahora = new Date('2026-10-26T10:00:00Z')

  const a = montar()
  const r = await fn.procesar({ ...a, cardId: 'swsh3-140', market: 'WEST', ahora })
  check('la Reverse sin precio por idioma se pide a TCGGO por su id (una petición, el lote por ids)', a.llamadas.length === 1 && /\/pokemon\/cards\?ids=35162/.test(a.llamadas[0]), a.llamadas.join())
  check('  …y se guarda con el español y el producto de Cardmarket, sin tocar la etiqueta', a.guardadas.length === 1 && a.guardadas[0].cm_low_es === 0.02 && a.guardadas[0].cm_id_product === 877413 && !('etiqueta' in a.guardadas[0]), JSON.stringify(a.guardadas))
  check('  …la respuesta trae las filas ya con lo nuevo y lo de antes', r.estado === 200 && r.cuerpo.pedido === true && r.cuerpo.nuevas === 1 && r.cuerpo.filas[0].etiqueta === 'Reverse Holo' && r.cuerpo.filas[0].cm_low_es === 0.02 && r.cuerpo.filas[0].cm_id_product === 877413, JSON.stringify(r.cuerpo).slice(0, 300))
  check('  …y queda apuntada como pedida hoy, con la petición contada', a.estado().dia === '2026-10-26' && a.estado().peticiones === 1 && a.estado().hechas.includes(35162))
  const r2 = await fn.procesar({ ...a, cardId: 'swsh3-140', market: 'WEST', ahora: new Date('2026-10-26T12:00:00Z') })
  check('abrirla otra vez hoy no gasta: «pedidas hoy»', a.llamadas.length === 1 && r2.cuerpo.pedido === false && r2.cuerpo.porque === 'pedidas hoy', JSON.stringify(r2.cuerpo).slice(0, 120))
  const r3 = await fn.procesar({ ...a, cardId: 'swsh3-140', market: 'WEST', ahora: new Date('2026-10-27T10:00:00Z') })
  check('  …y mañana sí (una vez al día por versión)', a.llamadas.length === 2 && r3.cuerpo.pedido === true)

  const b = montar({ estado: { dia: '2026-10-26', version: fn.VERSION_FRENO, peticiones: fn.TOPE_DIARIO, hechas: [] } })
  const rb = await fn.procesar({ ...b, cardId: 'swsh3-140', ahora })
  check('con el tope diario gastado, se sirve lo que hay sin pedir', b.llamadas.length === 0 && rb.cuerpo.pedido === false && /tope diario/.test(rb.cuerpo.porque) && rb.cuerpo.filas.length === 1)

  const c = montar({ status: 429 })
  const rc = await fn.procesar({ ...c, cardId: 'swsh3-140', ahora })
  const rc2 = await fn.procesar({ ...c, cardId: 'swsh3-140', ahora: new Date('2026-10-26T11:00:00Z') })
  check('un 429 del plan para hasta mañana: la segunda ficha del día ya no pide', c.llamadas.length === 1 && /plan/.test(rc.cuerpo.porque) && rc2.cuerpo.pedido === false && /plan/.test(rc2.cuerpo.porque), `${rc.cuerpo.porque} | ${rc2.cuerpo.porque}`)

  const d = montar({ filas: [{ ...FILA, tcggo_id: -5, origen: 'mano' }] })
  const rd = await fn.procesar({ ...d, cardId: 'swsh3-140', ahora })
  check('una carta solo con versiones a mano no pide nada', d.llamadas.length === 0 && rd.cuerpo.porque === 'sin versiones de TCGGO')

  const e = montar({ env: { TCGGO_API_KEY: '' } })
  const re = await fn.procesar({ ...e, cardId: 'swsh3-140', ahora })
  check('sin clave de TCGGO, se sirve lo que hay', e.llamadas.length === 0 && re.cuerpo.porque === 'sin clave de TCGGO')
  check('un id de carta raro es un 400', (await fn.procesar({ ...montar(), cardId: 'x;drop' })).estado === 400)
}

console.log('\n── 2b. El lote se calla las versiones (1028c, el Lugia de verdad) ──')
{
  // La respuesta real que pegó PINGU: «Get card» de la Reverse 39644.
  const LUGIA_REVERSE = JSON.parse(readFileSync(new URL('./fixtures/tcggo-carta-39644-1028.json', import.meta.url), 'utf8')).carta
  const STANDARD = { tcggo_id: 6545, market: 'WEST', card_id: 'swsh3-140', set_id: 'swsh3', etiqueta: 'Standard', origen: null, cm_id_product: 483579, cm_low: 0.1, cm_low_es: 1.5, actualizado_at: '2026-10-20T10:40:43Z' }
  const REVERSE = { tcggo_id: 39644, market: 'WEST', card_id: 'swsh3-140', set_id: 'swsh3', etiqueta: 'Reverse Holo', origen: null, cm_id_product: null, link_cm: null, cm_low: 0.1, cm_low_es: null, actualizado_at: '2026-10-26T00:42:05Z' }
  const montar = ({ estado = {}, sueltaContesta = true } = {}) => {
    const llamadas = []
    const guardadas = []
    let base = [STANDARD, REVERSE].map((f) => ({ ...f }))
    let guardado = estado
    const fetchImpl = async (url) => {
      llamadas.push(url)
      // El lote devuelve SOLO la Standard (como en producción); la suelta, la Reverse.
      if (/\/cards\?ids=/.test(url)) return new Response(JSON.stringify({ data: [{ ...REAL, id: 6545, cardmarket_id: 483579 }] }), { status: 200 })
      if (/\/cards\/39644$/.test(url)) return new Response(sueltaContesta ? JSON.stringify(LUGIA_REVERSE) : 'no', { status: sueltaContesta ? 200 : 404 })
      return new Response('no', { status: 404 })
    }
    return {
      llamadas, guardadas, fetchImpl,
      restImpl: async (ruta) => { if (ruta.startsWith('tcg_card_versions?select=')) return base; throw new Error(`ruta ${ruta}`) },
      guardarImpl: async (nuevas) => { guardadas.push(...nuevas); base = base.map((f) => { const n = nuevas.find((x) => x.tcggo_id === f.tcggo_id); return n ? { ...f, ...n } : f }) },
      estadoImpl: async () => guardado, guardarEstadoImpl: async (v) => { guardado = v }, estado: () => guardado,
      env: { SUPABASE_SERVICE_ROLE_KEY: 'x', TCGGO_API_KEY: 'k' },
    }
  }
  const ahora = new Date('2026-10-26T12:00:00Z')
  const a = montar()
  const r = await fn.procesar({ ...a, cardId: 'swsh3-140', ahora })
  check('el lote devuelve solo la Standard: la Reverse se repesca con «Get card» (dos peticiones)', a.llamadas.length === 2 && /ids=6545,39644/.test(a.llamadas[0]) && /\/cards\/39644$/.test(a.llamadas[1]), a.llamadas.join(' | '))
  const rev = a.guardadas.find((x) => x.tcggo_id === 39644)
  check('  …y la Reverse se guarda con el español a 25 € y el producto 483579 (el de la carta: en Cardmarket es el mismo producto con isReverseHolo)', rev && rev.cm_low_es === 25 && rev.cm_id_product === 483579 && rev.cm_low === 5 && a.guardadas.length === 2, JSON.stringify(rev))
  check('  …la respuesta lo dice: dos nuevas, dos peticiones, nada sin respuesta', r.cuerpo.nuevas === 2 && r.cuerpo.peticiones === 2 && !r.cuerpo.sinRespuesta && r.cuerpo.filas.find((f) => f.tcggo_id === 39644).cm_low_es === 25, JSON.stringify(r.cuerpo).slice(0, 200))
  check('  …y las dos quedan hechas hoy, con las peticiones contadas de verdad (2, no 3)', a.estado().hechas.includes(6545) && a.estado().hechas.includes(39644) && a.estado().peticiones === 2 && !a.estado().fallidas[39644], JSON.stringify(a.estado()))

  // Lo de hoy en producción: la Reverse ya está apuntada como «hecha» por la
  // primera 1028. Subir VERSION_FRENO vuelve a mirarla ese mismo día.
  const b = montar({ estado: { dia: '2026-10-26', peticiones: 1, hechas: [6545, 39644] } })
  const rb = await fn.procesar({ ...b, cardId: 'swsh3-140', ahora })
  check('un estado de la versión anterior del freno (sin `version`) se vuelve a mirar hoy', rb.cuerpo.pedido === true && b.llamadas.length === 2 && b.guardadas.some((x) => x.tcggo_id === 39644 && x.cm_low_es === 25), JSON.stringify(rb.cuerpo).slice(0, 120))

  // Una versión que ni el lote ni «Get card» dan: dos intentos al día y ya.
  const c = montar({ sueltaContesta: false })
  const r1 = await fn.procesar({ ...c, cardId: 'swsh3-140', ahora })
  const r2 = await fn.procesar({ ...c, cardId: 'swsh3-140', ahora })
  const r3 = await fn.procesar({ ...c, cardId: 'swsh3-140', ahora })
  check('una versión que no contesta se intenta DOS veces al día (la Standard, hecha a la primera, no se repide)', r1.cuerpo.sinRespuesta?.join() === '39644' && r2.cuerpo.pedido === true && r3.cuerpo.pedido === false && c.llamadas.filter((u) => /39644$/.test(u)).length === 2 && c.llamadas.filter((u) => /ids=/.test(u)).length === 2 && c.estado().fallidas[39644] === 2, `${c.llamadas.join(' | ')} · ${JSON.stringify(c.estado())}`)
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
