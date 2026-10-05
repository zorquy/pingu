// Tanda 646 — las expansiones son los episodios de TCGGO: los sets que
// comparten `tcggo_id` se pliegan en uno (el más grande manda), el valor
// del set y su semanal salen de `tcg_set_valor`, y la pasada de precios
// escribe ese valor cada día (también para los japoneses).
import { readFileSync } from 'node:fs'
import { padresPorEpisodio, registrarEpisodios, padreDeColeccion, idsDeColeccion, plegarHermanos, variacionSemanal } from '/home/user/pingu/js/catalogo-series.js'
import { resumirEpisodio, filaDeSetTcggo } from '/home/user/pingu/netlify/lib/tcggo.mjs'
import { procesar } from '/home/user/pingu/netlify/functions/tcggo-precios.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')
const EPISODIOS = JSON.parse(readFileSync(new URL('./fixtures/tcggo-episodios-ejemplo.json', import.meta.url), 'utf8'))

console.log('── 1. Plegar por expansión de TCGGO ──')
{
  const SETS = [
    { id: 'me02', name: '30th Celebration', card_count_total: 92, tcggo_id: 431 },
    { id: 'me02.5', name: 'Classic Collection', card_count_total: 36, tcggo_id: 431 },
    { id: 'swsh9', name: 'Brilliant Stars', card_count_total: 172, tcggo_id: 40 },
    { id: 'swsh9tg', name: 'Trainer Gallery', card_count_total: 30, tcggo_id: 40 },
    { id: 'bw11', name: 'Legendary Treasures', card_count_total: 140 },
    { id: 'rc', name: 'Radiant Collection', card_count_total: 25 },
    { id: 'sv1', name: 'Scarlet & Violet', card_count_total: 258, tcggo_id: 19 },
  ]
  const padres = padresPorEpisodio(SETS)
  check('dos sets con el mismo tcggo_id: el pequeño cuelga del grande', padres.get('me02.5') === 'me02' && padres.get('swsh9tg') === 'swsh9' && padres.size === 2, JSON.stringify([...padres]))
  check('  …uno solo con su tcggo_id no cuelga de nadie, y sin tcggo_id tampoco', !padres.has('sv1') && !padres.has('rc'))
  check('con empate de tamaño manda el id más corto', padresPorEpisodio([{ id: 'swsh9.5tg', card_count_total: 30, tcggo_id: 9 }, { id: 'swsh9tg', card_count_total: 30, tcggo_id: 9 }]).get('swsh9.5tg') === 'swsh9tg')
  registrarEpisodios(SETS)
  check('registrado, padreDeColeccion contesta por TCGGO…', padreDeColeccion('me02.5') === 'me02' && padreDeColeccion('swsh9tg') === 'swsh9' && padreDeColeccion('me02') === null)
  check('  …y por la lista a mano para lo que TCGGO no empareja', padreDeColeccion('rc') === 'bw11')
  check('  …y encadena: la copia de la Trainer Gallery (a mano) sube hasta Brilliant Stars (TCGGO)', padreDeColeccion('swsh9.5tg') === 'swsh9', padreDeColeccion('swsh9.5tg'))
  check('la página del padre se lleva los ids de los hijos, registrados y a mano', JSON.stringify(idsDeColeccion('me02')) === '["me02","me02.5"]' && JSON.stringify(idsDeColeccion('swsh9').sort()) === '["swsh9","swsh9.5tg","swsh9tg"]' && JSON.stringify(idsDeColeccion('bw11')) === '["bw11","rc"]' && idsDeColeccion('sv1').length === 0, JSON.stringify(idsDeColeccion('swsh9')))
  const plegados = plegarHermanos(SETS.map((s) => ({ ...s })))
  const ids = plegados.map((s) => s.id)
  check('plegarHermanos deja una fila por expansión, con las cartas sumadas', !ids.includes('me02.5') && !ids.includes('swsh9tg') && !ids.includes('rc') && ids.includes('me02') && plegados.find((s) => s.id === 'me02').card_count_total === 128 && plegados.find((s) => s.id === 'swsh9').card_count_total === 202, JSON.stringify(ids))
  registrarEpisodios([])
  check('sin registro, solo la lista a mano (lo que había)', padreDeColeccion('me02.5') === null && padreDeColeccion('rc') === 'bw11')
}

console.log('── 2. El valor del set y su semanal ──')
{
  const filas = [
    { set_id: 'pbl', dia: '2026-09-28', valor_cm: 600 },
    { set_id: 'pbl', dia: '2026-10-05', valor_cm: 616.4 },
    { set_id: 'pbl', dia: '2026-10-01', valor_cm: 590 },
    { set_id: '30c', dia: '2026-10-05', valor_cm: 11133.72 },
    { set_id: 'cri', dia: '2026-09-28', valor_cm: 563 },
    { set_id: 'cri', dia: '2026-10-05', valor_cm: 535 },
    { set_id: 'nada', dia: '2026-10-05', valor_cm: null },
    { set_id: 'raro', dia: 'ayer', valor_cm: 5 },
  ]
  const v = variacionSemanal(filas)
  check('el de hoy, el de hace una semana y el porcentaje, por set', v.get('pbl').ahora === 616.4 && v.get('pbl').antes === 600 && v.get('pbl').pct === 3 && v.get('pbl').dia === '2026-10-05', JSON.stringify(v.get('pbl')))
  check('  …baja en negativo', v.get('cri').pct === -5)
  check('  …con un solo día hay valor y no hay semanal', v.get('30c').ahora === 11133.72 && v.get('30c').pct === null && v.get('30c').antes === null)
  check('  …y sin cifra o sin fecha, nada', !v.has('nada') && !v.has('raro') && variacionSemanal(null).size === 0)
  const ep = resumirEpisodio(EPISODIOS.data[2])
  check('del episodio sale el valor en Cardmarket y en TCGplayer', ep.nombre === 'Pitch Black' && ep.valorCm === 668.8 && ep.valorTp === 672.01, JSON.stringify(ep))
  check('  …y un total a cero es «no hay»', resumirEpisodio(EPISODIOS.data[0]).valorCm === null)
  const fila = filaDeSetTcggo('pbl', ep)
  check('la fila del set lleva valor_cm y valor_tp', fila.valor_cm === 668.8 && fila.valor_tp === 672.01 && filaDeSetTcggo('x', { ...ep, valorCm: null }).valor_cm === null)
}

console.log('── 3. La pasada de precios escribe el valor, también de los japoneses ──')
{
  const escritos = []
  const AHORA = new Date('2026-10-06T07:00:00Z')
  const episodiosJp = [{ id: 900, nombre: 'Mega Brave', codigo: 'M1S', cartas: 100, fecha: '2025-07-01', logo: 'https://images.tcggo.com/m1s.png', valorCm: 321, valorTp: null }]
  const estados = {
    tcggo_pares: { hechos: { pbl: { episodio: 415 } }, episodios: { fecha: AHORA.toISOString(), lista: [resumirEpisodio(EPISODIOS.data[2])] } },
    tcggo_catalogo: { setsPorEpisodio: { JP: { 900: ['M1S'] } }, episodiosJp: { fecha: AHORA.toISOString(), lista: episodiosJp } },
    tcggo_precios: {},
  }
  const r = await procesar({
    env: { SUPABASE_SERVICE_ROLE_KEY: 'k', TCGGO_API_KEY: 't', TCGGO_PAUSA_MS: '0' },
    ahora: AHORA,
    estadoImpl: async (k) => estados[k] || {},
    guardarEstadoImpl: async (k, v) => { estados[k] = v },
    restImpl: async (ruta) => (ruta.startsWith('tcg_cards?') ? [] : []),
    guardarImpl: async () => {},
    guardarSetsImpl: async (filas, mercado) => { escritos.push({ mercado, filas }); return filas.length },
    fetchImpl: async () => ({ ok: true, text: async () => JSON.stringify({ data: [], paging: { current: 1, total: 1 } }) }),
    peticiones: 5,
  })
  check('la pasada ha ido', r.ok === true, JSON.stringify(r).slice(0, 200))
  const west = escritos.find((e) => e.mercado === 'WEST')
  const jp = escritos.find((e) => e.mercado === 'JP')
  check('los sets occidentales van con su valor', west && west.filas[0].id === 'pbl' && west.filas[0].valor_cm === 668.8, JSON.stringify(west?.filas))
  check('  …y los japoneses también, con la lista del catálogo', jp && jp.filas[0].id === 'M1S' && jp.filas[0].valor_cm === 321 && jp.filas[0].tcggo_id === 900, JSON.stringify(jp?.filas))
}

console.log('── 4. Lo estático ──')
{
  const sql = leer('supabase-migration-tcggo-expansiones.sql')
  check('la migración: la tabla con su clave por set, mercado y día, lectura pública, y la función la rellena', /create table if not exists public\.tcg_set_valor/.test(sql) && /primary key \(set_id, market, dia\)/.test(sql) && /create policy tcg_set_valor_ver on public\.tcg_set_valor for select using \(true\)/.test(sql) && /insert into public\.tcg_set_valor \(set_id, market, dia, valor_cm, valor_tp\)/.test(sql) && /on conflict \(set_id, market, dia\) do update/.test(sql) && /grant execute on function public\.tcggo_guardar_sets\(jsonb, text\) to service_role/.test(sql))
  check('  …y sigue sin pisar lo del set (solo rellena)', /card_count_official = coalesce\(s\.card_count_official, nullif\(p\.impresas, 0\)\)/.test(sql))
  const cartas = leer('js/cartas.js')
  check('/cartas pide tcggo_id y los valores, y no rompe si la tabla no está', /card_count_total,tcggo_id'\)/.test(cartas) && /from\('tcg_set_valor'\)/.test(cartas) && /variacionSemanal\(valores \|\| \[\]\)/.test(cartas) && /catch \{\n\s*variacionDeSets = new Map\(\)/.test(cartas))
  const mc = leer('js/mi-coleccion.js')
  check('la estantería registra los episodios antes de contar y pide los valores', /registrarEpisodios\(sets\)\n\s*await cargarValoresDeSets\(\)/.test(mc) && /orden,oculto,tcggo_id'\)/.test(mc))
  const col = leer('js/coleccion.js')
  check('la página de una colección registra a sus hermanos por tcggo_id', /\.eq\('tcggo_id', set\.tcggo_id\)/.test(col) && /registrarEpisodios\(hermanos \|\| \[\]\)/.test(col) && /idsDeColeccion\(setId\)\.length > 1/.test(col))
  const css = leer('css/carta.css')
  check('las tarjetas de /cartas: rejilla, arte, cifras; y la fila de antes ya no es una fila', /\.serie-lista \{\n  display: grid;/.test(css) && /\.serie-arte::before/.test(css) && /\.serie-cifras \{/.test(css) && !/grid-template-columns: 56px minmax\(0, 1fr\) 104px 88px/.test(css))
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
