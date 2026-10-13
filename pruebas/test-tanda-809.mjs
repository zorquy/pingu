// Tanda 809 — Scrydex fuera, y Abyss Eye primero.
//
// PINGU: «en el set de Abyss Eye, el Pitch Black japonés, las cartas salen
// con el nombre en japonés: las estás cogiendo de Scrydex. Scrydex, nada;
// todo de la API de TCGGO. Empieza por ese set y así lo compruebo».
//   1. scrydex-huecos, retirada entera: no pide nada a nadie.
//   2. tcggo-sueltas, sin el camino de Scrydex.
//   3. El calco japonés: Abyss Eye va primero (y se rehace aunque ya
//      estuviera hecha) y el set viejo de la misma expansión se esconde ya.
import { readFileSync, existsSync } from 'node:fs'

const RAIZ = '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const sueltas = await import(`${RAIZ}/netlify/functions/tcggo-sueltas.mjs`)
const calco = await import(`${RAIZ}/netlify/functions/tcggo-calco-jp.mjs`)
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', SCRYDEX_API_KEY: 'x', SCRYDEX_TEAM_ID: 'y' }

console.log('── 1. scrydex-huecos, retirada (y borrada en la 817) ──')
{
  check('no existe: no puede pedir nada a nadie', !existsSync(`${RAIZ}/netlify/functions/scrydex-huecos.mjs`))
}

console.log('\n── 2. tcggo-sueltas, sin Scrydex ──')
{
  check('el camino de Scrydex está apagado por defecto', sueltas.CON_SCRYDEX === false)
  const js = readFileSync(`${RAIZ}/netlify/functions/tcggo-sueltas.mjs`, 'utf8')
  check('  …y es él quien decide si se le pide (no una copia del interruptor)', /const porScrydex = conScrydex && /.test(js) && /conScrydex = CON_SCRYDEX/.test(js))
}

console.log('\n── 3. El calco japonés: Abyss Eye primero ──')
{
  check('Abyss Eye se reconoce por el nombre, con o sin prefijo', calco.esPrimero({ nombre: 'Abyss Eye' }) && calco.esPrimero({ nombre: 'M3: Abyss Eye' }) && !calco.esPrimero({ nombre: 'Nihil Zero' }))
  const SETS = [
    { id: 'tcggo-1200', name: 'Abyss Eye', name_en: 'Abyss Eye', tcg_online_code: 'M3', tcggo_id: 1200, oculto: false },
    { id: 'm3_ja', name: 'アビスアイ', name_en: 'Abyss Eye', tcg_online_code: null, tcggo_id: null, oculto: false },
    { id: 'M3', name: 'アビスアイ', name_en: null, tcg_online_code: 'M3', tcggo_id: null, oculto: false },
    { id: 'otro', name: 'Otro', name_en: 'Nihil Zero', tcg_online_code: 'M2', tcggo_id: null, oculto: false },
  ]
  const viejos = calco.setsViejosDe({ id: 1200, nombre: 'Abyss Eye', codigo: 'M3' }, SETS, 'tcggo-1200')
  check('los viejos de la expansión: el de Scrydex por el nombre y el de TCGdex por el código', viejos.join() === 'm3_ja,M3', viejos.join())
  check('  …ni el destino, ni otra expansión, ni uno que ya lleva su tcggo_id', !viejos.includes('tcggo-1200') && !viejos.includes('otro'))

  const EPIS = [
    { id: 1100, name: 'Mega Brave', code: 'M1L', cards_total: 92, released_at: '2025-08-01' },
    { id: 1200, name: 'Abyss Eye', code: 'M3', cards_total: 110, released_at: '2026-01-23' },
  ]
  const estados = { [calco.CLAVE_ESTADO]: {
    vuelta: 2,
    // Ya hecha en esta vuelta: se rehace igual, una vez.
    hechos: { 1200: { fecha: '2026-10-13T12:00:00Z', set: 'tcggo-1200', por: 'tcggo_id', entera: true } },
    lista: { fecha: '2026-10-13T17:00:00Z', episodios: EPIS.map((e) => ({ id: e.id, nombre: e.name, codigo: e.code, cartas: e.cards_total, fecha: e.released_at })) },
  } }
  const hechas = []
  const parches = []
  const b = {
    fetchImpl: async () => { throw new Error('la lista es de hoy: no se pide') },
    restImpl: async (ruta, opciones = null) => {
      if (opciones?.method === 'PATCH') { parches.push({ ruta: decodeURIComponent(ruta), cuerpo: JSON.parse(opciones.body) }); return null }
      if (ruta.startsWith('tcg_sets?')) return SETS
      return []
    },
    estadoImpl: async (k) => JSON.parse(JSON.stringify(estados[k] || {})),
    guardarEstadoImpl: async (k, v) => { estados[k] = JSON.parse(JSON.stringify(v)) },
    crearSetsImpl: async (f) => f.length,
    procesarImpl: async (o) => { hechas.push(o); return { ok: true, suyas: 110, escritas: 110, borradas: 110, seQuedan: [] } },
  }
  const pasar = () => calco.pasada({ env: ENV, ...b, ahora: new Date('2026-10-13T18:00:00Z'), pausa: async () => {}, vuelta: 2 })
  const e = () => estados[calco.CLAVE_ESTADO]
  await pasar()
  check('la primera pasada es Abyss Eye, ENTERA, aunque ya estuviera hecha (y la de delante en la lista espera)', hechas[0]?.episodio === 1200 && hechas[0]?.entero === true && hechas[0]?.destino === 'tcggo-1200', JSON.stringify(hechas.map((h) => h.episodio)))
  const ocultos = parches.filter((p) => p.cuerpo.oculto === true).map((p) => p.ruta.match(/id=eq\.([^&]+)/)[1])
  check('  …y sus sets viejos (Scrydex y TCGdex) se esconden en la misma pasada', ocultos.sort().join() === 'M3,m3_ja', ocultos.join())
  check('  …apuntados para /admin', e().hechos[1200].viejosEscondidos?.length === 2 && e().escondidosAlFinal.m3_ja?.por && e().rehechas[1200])
  check('  …y /admin sabe que TCGGO la tiene', e().primero?.encontrados?.[0]?.id === 1200 && e().primero.encontrados[0].rehecha === true)
  await pasar()
  check('la segunda pasada sigue con las demás: no la rehace otra vez', hechas[1]?.episodio === 1100, JSON.stringify(hechas.map((h) => h.episodio)))
  const admin = readFileSync(`${RAIZ}/admin/js/admin.js`, 'utf8')
  check('/admin enseña lo que va primero y los viejos escondidos', /k\.primero/.test(admin) && /viejosEscondidos/.test(admin))
}

console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
