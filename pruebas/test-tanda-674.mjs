// Tanda 674 — el calco japonés: el catálogo japonés, entero, de TCGGO.
//
// PINGU: «el catálogo japonés está prácticamente vacío; yo lo volcaría
// todo desde TCGGO con todas las cartas dentro y copiaría su estructura».
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = '/home/user/pingu'
const { pasada, CLAVE_ESTADO, MAXIMO_INTENTOS, MAXIMO_PROBADOS } = await import(`${RAIZ}/netlify/functions/tcggo-calco-jp.mjs`)
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k' }
const AHORA = new Date('2026-10-06T10:00:00Z')
const EPISODIOS = {
  data: [
    { id: 552, name: 'Storm Emerald', code: 'M6', cards_total: 113, cards_printed_total: 76, released_at: '2026-07-31', logo: 'https://images.tcggo.com/m6.png', series: { name: 'Mega Evolution', slug: 'mega-evolution' }, prices: { cardmarket: { total: 874 } } },
    { id: 100, name: 'Expansion Pack', code: 'BASE1', cards_total: 102, cards_printed_total: 102, released_at: '1996-10-20', logo: null, series: { name: 'Original', slug: 'original' } },
    { id: 101, name: 'Jungle', code: 'JUNGLE', cards_total: 48, cards_printed_total: 48, released_at: '1997-03-07', logo: null, series: { name: 'Original', slug: 'original' } },
    { id: 102, name: 'Energías', code: null, cards_total: 0, released_at: null, logo: null, series: { name: 'Original', slug: 'original' } },
  ],
  paging: { current: 1, total: 1, per_page: 100 },
}
const montar = ({ sets, llenos = [], falla = null, plan = false } = {}) => {
  const estados = { [CLAVE_ESTADO]: {} }
  const llamadas = []
  const urls = []
  const hechas = []
  const creados = []
  return {
    estados, llamadas, urls, hechas, creados,
    fetchImpl: async (url) => {
      urls.push(url)
      if (plan) return { ok: false, status: 403, text: async () => JSON.stringify({ message: 'Japanese catalog requires an Ultra or Mega plan.', feature: 'japanese_catalog', required_plan: 'ULTRA' }) }
      if (/pokemon-jp\/episodes/.test(url)) return { ok: true, status: 200, text: async () => JSON.stringify(EPISODIOS) }
      return { ok: false, status: 404, text: async () => 'no' }
    },
    restImpl: async (ruta, opciones = null) => {
      llamadas.push({ ruta: decodeURIComponent(ruta), metodo: opciones?.method || 'GET', cuerpo: opciones?.body ? JSON.parse(opciones.body) : null })
      if (opciones) return null
      if (ruta.startsWith('tcg_sets?')) return sets.filter((s) => !/tcggo_id=is\.null/.test(ruta) || s.tcggo_id == null).filter((s) => !/oculto=is\.false/.test(ruta) || !s.oculto)
      if (ruta.startsWith('tcg_cards?')) { const id = decodeURIComponent((ruta.match(/set_id=eq\.([^&]+)/) || [])[1] || ''); return llenos.includes(id) ? [{ id: 'una' }] : [] }
      return []
    },
    estadoImpl: async (k) => estados[k] || {},
    guardarEstadoImpl: async (k, v) => { estados[k] = JSON.parse(JSON.stringify(v)) },
    crearSetsImpl: async (filas) => { creados.push(...filas); sets.push(...filas.map((f) => ({ ...f, oculto: false }))); return filas.length },
    procesarImpl: async (o) => { hechas.push({ sets: o.sets, destino: o.destino, mercado: o.mercado, episodio: o.episodio }); return falla && falla(o) ? { ok: false, error: falla(o) } : { ok: true, suyas: 100, escritas: 100, borradas: 2, seQuedan: [] } },
  }
}
const SETS = () => [
  { id: 'M6', name: 'Storm Emerald', name_en: 'Storm Emerald', tcg_online_code: null, serie_id: 'M', tcggo_id: 552, oculto: false },
  { id: 'BASE1_', name: 'Expansion Pack', name_en: 'Expansion Pack', tcg_online_code: null, serie_id: 'base', tcggo_id: null, oculto: false },
  { id: 'XY1', name: 'Collection X', name_en: 'Collection X', tcg_online_code: null, serie_id: 'xy', tcggo_id: null, oculto: false },
]

console.log('── 1. Expansión a expansión: la que ya lleva tcggo_id, la que casa por nombre, la que se crea ──')
{
  const b = montar({ sets: SETS(), llenos: ['M6'] })
  const r1 = await pasada({ env: ENV, ...b, ahora: AHORA, pausa: async () => {} })
  check('la primera pasada trae la lista japonesa (una vez a la semana) y hace la PRIMERA expansión', r1.ok && b.estados[CLAVE_ESTADO].lista.episodios.length === 4 && b.urls.filter((u) => /episodes/.test(u)).length === 1 && b.hechas.length === 1, JSON.stringify(r1).slice(0, 300))
  check('  …la Storm Emerald va al set que ya lleva su tcggo_id (M6)', b.hechas[0].destino === 'M6' && b.hechas[0].mercado === 'JP' && b.hechas[0].episodio === 552 && b.estados[CLAVE_ESTADO].hechos[552].por === 'tcggo_id')
  const r2 = await pasada({ env: ENV, ...b, ahora: AHORA, pausa: async () => {} })
  check('la segunda: el Expansion Pack casa por NOMBRE con nuestro BASE1_ (vacío de TCGdex) y se rellena ahí', r2.ok && b.hechas[1].destino === 'BASE1_' && b.hechas[1].episodio === 100 && b.estados[CLAVE_ESTADO].hechos[100].por === 'nombre', JSON.stringify(r2).slice(0, 200))
  const r3 = await pasada({ env: ENV, ...b, ahora: AHORA, pausa: async () => {} })
  check('la tercera: Jungle no existe aquí: se CREA el set (jungle, con su serie) y se rellena', r3.ok && b.creados.length === 1 && b.creados[0].id === 'jungle' && b.creados[0].tcggo_id === 101 && b.hechas[2].destino === 'jungle' && r3.hecha.setCreado === 'jungle', JSON.stringify(b.creados))
  check('  …sin volver a pedir la lista', b.urls.filter((u) => /episodes/.test(u)).length === 1)
  const r4 = await pasada({ env: ENV, ...b, ahora: AHORA, pausa: async () => {} })
  check('la cuarta: las Energías (cero cartas en su lista) se apuntan sin pedir nada', r4.ok && r4.hecha?.nota === 'vacía' && b.hechas.length === 3 && b.estados[CLAVE_ESTADO].hechos[102]?.nota === 'vacía en TCGGO')
  // Con todo hecho: los cascarones.
  const r5 = await pasada({ env: ENV, ...b, ahora: AHORA, pausa: async () => {} })
  check('con todo hecho, los cascarones: XY1 (sin tcggo_id y sin cartas) se esconde; nada más se pide a TCGGO', r5.ok && r5.cascarones?.escondidos === 1 && b.llamadas.some((l) => l.metodo === 'PATCH' && /id=eq\.XY1/.test(l.ruta) && l.cuerpo.oculto === true) && b.hechas.length === 3, JSON.stringify(r5))
  const r6 = await pasada({ env: ENV, ...b, ahora: AHORA, pausa: async () => {} })
  check('  …y después, hecho: leer el estado y nada más', r6.hecho === true && b.urls.length === 1, JSON.stringify(r6))
}

console.log('\n── 2. Lo que falla cuenta y para; el plan bloquea el día ──')
{
  const b = montar({ sets: SETS(), falla: (o) => (o.episodio === 552 ? 'TCGGO 500' : null) })
  for (let k = 0; k < MAXIMO_INTENTOS + 2; k++) await pasada({ env: ENV, ...b, ahora: AHORA, pausa: async () => {} })
  const e = b.estados[CLAVE_ESTADO]
  check(`a los ${MAXIMO_INTENTOS} fallos la expansión queda parada con su error y se pasa a la siguiente`, e.intentos[552] === MAXIMO_INTENTOS && e.ultimoError?.error === 'TCGGO 500' && b.hechas.filter((h) => h.episodio === 552).length === MAXIMO_INTENTOS && b.hechas.some((h) => h.episodio === 100), JSON.stringify({ i: e.intentos, n: b.hechas.length }))
  const p = montar({ sets: SETS(), plan: true })
  const rp = await pasada({ env: ENV, ...p, ahora: AHORA, pausa: async () => {} })
  check('si TCGGO dice que el japonés pide otro plan, se apunta, se bloquea el día y no se vuelve a pedir', rp.ok === false && p.estados[CLAVE_ESTADO].planBloqueado?.dia === '2026-10-06' && (await pasada({ env: ENV, ...p, ahora: AHORA })).saltado && p.urls.length === 1, JSON.stringify(rp).slice(0, 200))
}

console.log('\n── 3. Lo estático ──')
{
  const fn = readFileSync(`${RAIZ}/netlify/functions/tcggo-calco-jp.mjs`, 'utf8')
  check('programada cada dos minutos, en los impares', /schedule: '1-59\/2 \* \* \* \*'/.test(fn))
  check('escribe por `procesar` (el reemplazo de la 654) y crea sets por la RPC del catálogo', /from '\.\/tcggo-reemplazar-set\.mjs'/.test(fn) && /rpc\/tcggo_crear_sets/.test(fn))
  check('/admin lo enseña', /CALCO JAPONÉS \(tcggo_calco_jp, 674\)/.test(readFileSync(`${RAIZ}/admin/js/admin.js`, 'utf8')))
}

console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
