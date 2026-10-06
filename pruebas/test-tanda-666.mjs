// Tanda 666 — el 30 aniversario, ENTERO de TCGGO.
//
// PINGU, la mañana después de la 654: «te paso esto y sustituyes todo, que
// sigue estando mal con cartas duplicadas, cartas que enlazan mal, mal las
// imágenes… simplemente coge todo el set como aquí», con la página 1 de
// `episodes/431/cards` pegada. El fixture ES esa respuesta (la 501), cinco
// cartas tal cual: dos Eevee con el mismo nombre para el nombre
// aproximado.
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = '/home/user/pingu'
const DIR = new URL('.', import.meta.url)
const PAGINA = JSON.parse(readFileSync(new URL('tcggo-30th-431-pagina1.json', DIR), 'utf8'))
const { procesar, equivalencias, pasada, REEMPLAZOS, CLAVE_ESTADO } = await import(`${RAIZ}/netlify/functions/tcggo-reemplazar-set.mjs`)

console.log('── 1. La lista: el 30 va otra vez, entero y con su expansión escrita ──')
{
  const r = REEMPLAZOS.find((x) => x.clave === '30th-entero')
  check('hay un segundo reemplazo del 30, entero, con la Classic, al 30th y con la expansión 431 (de la respuesta de PINGU)', r && r.entero === true && r.sets.join() === '30th,30th-c' && r.destino === '30th' && r.episodio === 431 && r.mercado === 'WEST', JSON.stringify(r))
  check('  …y el primero sigue (hecho, no se repite)', REEMPLAZOS.findIndex((x) => x.clave === '30th') < REEMPLAZOS.findIndex((x) => x.clave === '30th-entero'))
}

console.log('\n── 2. Las equivalencias: por tcggo_id primero; con «aproximar», por nombre al número más cercano ──')
{
  const nuevas = PAGINA.data.map((c) => ({ id: `tcggo-${c.id}`, local_id: String(c.card_number), name_en: c.name, tcggo_id: c.id }))
  const viejas = [
    { id: '30th-106', local_id: '106', name: 'Zacian', name_en: 'Zacian', tcggo_id: 65629 },
    { id: '30th-c-023', local_id: '023', name: 'Eevee', name_en: 'Eevee', tcggo_id: null },
    { id: '30th-c-117', local_id: '117', name: 'Eevee', name_en: 'Eevee', tcggo_id: null },
    { id: '30th-c-009', local_id: '009', name: 'Inventada', name_en: 'Inventada', tcggo_id: null },
  ]
  const e = equivalencias(viejas, nuevas)
  check('la que ya era la misma carta casa por tcggo_id (exacto)', e.get('30th-106')?.a === 'tcggo-65629' && e.get('30th-106').por === 'tcggo_id')
  check('el Eevee 117 casa por nombre + número; el 023 no casa (dos suyas, ningún número igual)', e.get('30th-c-117')?.a === 'tcggo-65640' && e.get('30th-c-117').por === 'nombre+numero' && !e.has('30th-c-023'), JSON.stringify([...e]))
  const a = equivalencias(viejas, nuevas, { aproximar: true })
  check('con «aproximar», el Eevee 023 va al Eevee de número más cercano (116), apuntado como aproximado', a.get('30th-c-023')?.a === 'tcggo-65639' && a.get('30th-c-023').por === 'nombre aproximado', JSON.stringify([...a]))
  check('  …y lo que no tiene NINGUNA suya con ese nombre sigue sin pareja', !a.has('30th-c-009'))
}

console.log('\n── 3. La función en modo entero: nada nuestro se conserva ──')
{
  const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', TCGGO_PAUSA_MS: '0' }
  const PAGINAS = { 1: PAGINA, 2: { data: [], paging: { current: 2, total: 10, per_page: 20 } } }
  const montar = ({ nuestras, lineas = [], deseos = [] } = {}) => {
    const llamadas = []
    const fetchImpl = async (url) => {
      const p = Number((url.match(/[?&]page=(\d+)/) || [])[1])
      const datos = PAGINAS[p]
      return { ok: !!datos, status: datos ? 200 : 404, text: async () => (datos ? JSON.stringify(datos) : 'no') }
    }
    const restImpl = async (ruta, opciones = null) => {
      llamadas.push({ ruta: decodeURIComponent(ruta), metodo: opciones?.method || 'GET', cuerpo: opciones?.body ? JSON.parse(opciones.body) : null })
      if (opciones) return null
      if (ruta.startsWith('tcg_sets?')) return [{ id: '30th', name: '30 aniversario', tcggo_id: 431 }, { id: '30th-c', name: 'Classic', tcggo_id: null }]
      if (ruta.startsWith('tcg_cards?')) return nuestras
      if (ruta.startsWith('user_collection?')) return lineas.filter((l) => ruta.includes(`"${l.card_id}"`))
      if (ruta.startsWith('user_wants?')) return deseos.filter((l) => ruta.includes(`"${l.card_id}"`))
      return []
    }
    const guardadas = []
    return { llamadas, fetchImpl, restImpl, guardarCartasImpl: async (filas) => { guardadas.push(...filas); return filas.length }, guardadas }
  }
  const NUESTRAS = [
    { id: '30th-106', set_id: '30th', local_id: '106', name: 'Zacian', name_en: 'Zacian', tcggo_id: 65629 },
    { id: 'tcggo-65630', set_id: '30th', local_id: '107', name: 'Zamazenta', name_en: 'Zamazenta', tcggo_id: 65630 },
    { id: '30th-c-023', set_id: '30th-c', local_id: '023', name: 'Eevee', name_en: 'Eevee', tcggo_id: null },
    { id: '30th-c-009', set_id: '30th-c', local_id: '009', name: 'Inventada', name_en: 'Inventada', tcggo_id: null },
  ]
  const b = montar({ nuestras: NUESTRAS, lineas: [{ id: 'l1', card_id: '30th-106', user_id: 'u1', cantidad: 2 }, { id: 'l2', card_id: '30th-c-023', user_id: 'u1', cantidad: 1 }, { id: 'l3', card_id: '30th-c-009', user_id: 'u2', cantidad: 3 }], deseos: [{ id: 'd1', card_id: '30th-c-009', user_id: 'u1' }] })
  const r = await procesar({ env: ENV, ...b, sets: ['30th', '30th-c'], episodio: 431, destino: '30th', entero: true, pausa: async () => {} })
  check('va bien, en modo entero', r.ok === true && r.entero === true, JSON.stringify(r).slice(0, 300))
  check('las cinco cartas de TCGGO se escriben TODAS como tcggo-<id>, con su número y su foto (el Zacian nuestro no conserva su id)', r.conservadas === 0 && r.nuevas === 5 && b.guardadas.length === 5 && b.guardadas.every((f) => /^tcggo-\d+$/.test(f.id) && f.set_id === '30th' && /^https:\/\/images\.tcggo\.com\//.test(f.image_tcggo)) && b.guardadas.find((f) => f.id === 'tcggo-65629')?.local_id === '106', JSON.stringify(b.guardadas.map((f) => [f.id, f.local_id])))
  const pat = (tabla) => b.llamadas.filter((l) => l.metodo === 'PATCH' && l.ruta.startsWith(tabla))
  check('la línea del Zacian viejo se reapunta por tcggo_id al tcggo-65629', pat('user_collection').some((l) => l.ruta.includes('id=eq.l1') && l.cuerpo.card_id === 'tcggo-65629'), JSON.stringify(pat('user_collection')))
  check('  …y la del Eevee 023 al Eevee más cercano, apuntado como aproximado', pat('user_collection').some((l) => l.ruta.includes('id=eq.l2') && l.cuerpo.card_id === 'tcggo-65639') && r.aproximadas.length === 1 && r.aproximadas[0].de === '30th-c-023' && r.aproximadas[0].nombre === 'Eevee')
  const del = b.llamadas.filter((l) => l.metodo === 'DELETE')
  check('la Inventada se va con sus dos líneas (nadie en TCGGO con ese nombre), y quedan escritas: quién, qué, cuántas', r.seQuedan.length === 0 && r.lineasSinDestino.length === 2 && r.lineasSinDestino.some((l) => l.tabla === 'user_collection' && l.id === 'l3' && l.usuario === 'u2' && l.copias === 3 && l.nombre === 'Inventada') && r.lineasSinDestino.some((l) => l.tabla === 'user_wants' && l.id === 'd1') && del.some((l) => l.ruta === 'user_collection?id=eq.l3') && del.some((l) => l.ruta === 'user_wants?id=eq.d1'), JSON.stringify(r.lineasSinDestino))
  const borradas = del.find((l) => l.ruta.startsWith('tcg_cards?'))
  check('se borran las tres nuestras que no son filas de TCGGO (el tcggo-65630 que ya lo era se reescribe, no se borra)', r.borradas === 3 && borradas && /"30th-106"/.test(borradas.ruta) && /"30th-c-023"/.test(borradas.ruta) && /"30th-c-009"/.test(borradas.ruta) && !/"tcggo-65630"/.test(borradas.ruta), borradas?.ruta)
  check('  …las líneas sin destino se borran ANTES que la carta (nada queda colgando) y DESPUÉS de reapuntar', del.findIndex((l) => l.ruta === 'user_collection?id=eq.l3') < del.indexOf(borradas) && b.llamadas.findIndex((l) => l.ruta === 'user_collection?id=eq.l3') > b.llamadas.findIndex((l) => l.metodo === 'PATCH'))
  check('el set 30th-c se borra (ya no se queda nada en él) y el 30th queda apuntado a la 431 con 5', r.setsBorrados.join() === '30th-c' && pat('tcg_sets').some((l) => l.ruta.includes('id=eq.30th') && l.cuerpo.tcggo_id === 431 && l.cuerpo.card_count_total === 5))
}

console.log('\n── 4. La pasada: con el primero hecho, hace el entero con la expansión ESCRITA ──')
{
  const estados = { [CLAVE_ESTADO]: { hechos: { '30th': { episodio: 552 } }, intentos: {} }, tcggo_pares: { hechos: { '30th': { episodio: 999 } } } }
  const hechas = []
  const r = await pasada({
    env: { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k' },
    estadoImpl: async (k) => estados[k] || {},
    guardarEstadoImpl: async (k, v) => { estados[k] = JSON.parse(JSON.stringify(v)) },
    restImpl: async (ruta) => (ruta.startsWith('tcg_sets?') ? [{ id: '30th', name: '30 aniversario' }] : []),
    procesarImpl: async (o) => { hechas.push(o); return { ok: true, suyas: 191, escritas: 191, conservadas: 0, nuevas: 191, borradas: 20, lineasMovidas: 3, deseosMovidos: 0, albumesTocados: 0, seQuedan: [], aproximadas: [{ de: '30th-c-023', a: 'tcggo-1', nombre: 'Pikachu' }], lineasSinDestino: [], setsBorrados: ['30th-c'], setsQueSeQuedan: [] } },
  })
  check('hace el 30th-entero con la 431 de la lista (no la 999 de los pares) y en modo entero', r.ok && r.clave === '30th-entero' && hechas.length === 1 && hechas[0].episodio === 431 && hechas[0].entero === true && r.episodioPor === 'lista', JSON.stringify(r).slice(0, 300))
  check('  …y lo apunta con las aproximadas y las líneas sin destino en el resumen', estados[CLAVE_ESTADO].hechos['30th-entero']?.episodio === 431 && estados[CLAVE_ESTADO].hechos['30th-entero'].resumen.aproximadas.length === 1 && Array.isArray(estados[CLAVE_ESTADO].hechos['30th-entero'].resumen.lineasSinDestino))
}

console.log('\n── 5. La foto de una carta de TCGGO va antes que el camino montado a mano ──')
{
  const { cadenaDeEscaneo } = await import(`${RAIZ}/js/escaneo-carta.js`)
  const suya = cadenaDeEscaneo({ id: 'tcggo-65629', market: 'WEST', set_id: '30th', serie_id: 'me', local_id: '4', image_tcggo: 'https://images.tcggo.com/tcggo/storage/1/x.png', tcg_sets: { tcg_online_code: '30C' } })
  check('una carta creada por TCGGO (id tcggo-…) sin foto de TCGdex: la suya primero, el camino a mano después', /images\.tcggo\.com/.test(suya[0]) && /assets\.tcgdex\.net\/en\/me\/30th\/4/.test(suya[1]) && suya.filter((u) => /images\.tcggo\.com/.test(u)).length === 1, suya.join(' | '))
  const nuestra = cadenaDeEscaneo({ id: '30th-004', market: 'WEST', set_id: '30th', serie_id: 'me', local_id: '4', image_tcggo: 'https://images.tcggo.com/tcggo/storage/1/x.png', tcg_sets: { tcg_online_code: '30C' } })
  check('una de TCGdex sin image_path sigue probando su camino a mano primero (arte en español) y TCGGO después', /assets\.tcgdex\.net/.test(nuestra[0]) && /images\.tcggo\.com/.test(nuestra[1]), nuestra.join(' | '))
  const conFoto = cadenaDeEscaneo({ id: 'sv1-1', market: 'WEST', set_id: 'sv1', local_id: '1', image_path: 'sv/sv1/1', image_tcggo: 'https://images.tcggo.com/1.jpg' })
  check('  …y con image_path, TCGdex primero como siempre', /tcgdex/.test(conFoto[0]) && /tcggo/.test(conFoto[1]))
}

console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
