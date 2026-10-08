// Tanda 755 — los japoneses antiguos que TCGGO añade después, de TCGGO.
//
// PINGU: «TCGGO ha metido los sets japoneses de 2004 a 2008 (el más antiguo,
// Flight of Legends). Ya los tenemos, de Scrydex, pero sin precio; nuestra
// prioridad es que lo que exista en TCGGO se rellene de ahí: nombre inglés,
// enlace a Cardmarket y su precio». Lo que se mira: la HUELLA (día de salida
// y cuenta) encuentra el set de Scrydex que ni el código ni el nombre casan;
// `procesar` conserva por NÚMERO nuestras cartas (mismo id, el inglés y el
// id de Cardmarket de TCGGO) y, si el destino lo eligió la huella, comprueba
// antes que es la misma expansión; el calco pide la lista cada día, no crea
// lo dudoso y FUNDE lo que creó de nuevo cuando ya había set; y el espejo y
// el repaso de Scrydex no pisan lo que ya es de TCGGO.
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = '/home/user/pingu'
const { setDeEpisodioPorHuella, resumirEpisodio } = await import(`${RAIZ}/netlify/lib/tcggo.mjs`)
const { procesar, paresPorNumero, noEsLaMisma } = await import(`${RAIZ}/netlify/functions/tcggo-reemplazar-set.mjs`)
const calco = await import(`${RAIZ}/netlify/functions/tcggo-calco-jp.mjs`)

console.log('── 1. La huella: el día de salida y la cuenta ──')
{
  const ep = (o) => ({ id: 900, nombre: 'Rocket Gang Strikes Back', codigo: 'PCG4', cartas: 108, impresas: 104, fecha: '2005-04-08', ...o })
  const sets = [
    { id: 'pcg4_ja', name: 'ロケット団の逆襲', name_en: 'Team Rocket Strikes Back', release_date: '2005-04-08', card_count_total: 108, scrydex_id: 'pcg4_ja', tcggo_id: null },
    { id: 'pcg3', name: 'Holon Research Tower', name_en: 'Holon Research Tower', release_date: '2005-01-20', card_count_total: 86, tcggo_id: null },
  ]
  const r = setDeEpisodioPorHuella(ep(), sets)
  check('el set de Scrydex con otro inglés casa por el DÍA (y por el código sin «_ja»)', r.set?.id === 'pcg4_ja' && r.por === 'fecha', JSON.stringify(r))
  check('la fecha con barras también vale', setDeEpisodioPorHuella(ep({ fecha: '2005/04/08' }), sets).set?.id === 'pcg4_ja')
  check('un set que ya lleva OTRA expansión no es candidato', setDeEpisodioPorHuella(ep(), [{ ...sets[0], tcggo_id: 12 }]).set === null)
  const barajas = [
    { id: 'dpd', name: 'ディアルガ', name_en: 'Dialga LV.X Constructed Standard Deck', release_date: '2007-12-07', card_count_total: 30, tcggo_id: null },
    { id: 'dpp', name: 'パルキア', name_en: 'Palkia LV.X Constructed Standard Deck', release_date: '2007-12-07', card_count_total: 30, tcggo_id: null },
  ]
  const d = setDeEpisodioPorHuella({ id: 901, nombre: 'Palkia LV.X Constructed Standard Deck', codigo: null, cartas: 30, fecha: '2007-12-07' }, barajas)
  check('dos barajas del mismo día y la misma cuenta: las distingue el nombre', d.set?.id === 'dpp', JSON.stringify(d))
  const x = setDeEpisodioPorHuella({ id: 902, nombre: 'Entry Pack', codigo: null, cartas: 30, fecha: '2007-12-07' }, barajas)
  check('…y si nada las distingue: DUDOSO, sin set (crear sería duplicar)', x.set === null && x.dudoso === true && x.candidatos.length === 2, JSON.stringify(x))
  const c = setDeEpisodioPorHuella(ep({ fecha: '2005-04-11' }), sets)
  check('sin ninguno ese día: uno a tres días con la cuenta EXACTA', c.set?.id === 'pcg4_ja' && c.por === 'fecha cercana y cuenta', JSON.stringify(c))
  check('…y sin la cuenta, nada', setDeEpisodioPorHuella(ep({ fecha: '2005-04-11', cartas: 50, impresas: 50 }), sets).set === null)
  check('sin fecha suya, nada', setDeEpisodioPorHuella(ep({ fecha: null }), sets).set === null)
}

console.log('\n── 2. Por número, y «¿es la misma?» ──')
{
  const nuestras = [{ id: 'a', local_id: '001' }, { id: 'b', local_id: '2' }, { id: 'c', local_id: '7' }, { id: 'd', local_id: '7' }]
  const suyas = [{ id: 1, card_number: '1' }, { id: 2, card_number: '002' }, { id: 7, card_number: '7' }]
  const p = paresPorNumero(nuestras, suyas)
  check('«001» casa con «1» y «2» con «002»; un número repetido en lo nuestro no casa', p.length === 2 && p.some((x) => x.nuestra.id === 'a' && x.suya.id === 1) && p.some((x) => x.nuestra.id === 'b' && x.suya.id === 2), JSON.stringify(p.map((x) => [x.nuestra.id, x.suya.id])))
  const destino = Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, local_id: String(i + 1), name: 'ピカチュウ', name_en: `Poke ${i}` }))
  const todas = destino.map((c, i) => ({ nuestra: c, suya: { id: i, name: `Poke ${i}` } }))
  check('con la mitad o más por número y los nombres de acuerdo: es la misma', noEsLaMisma(destino, todas) === null)
  check('con menos de la mitad por número: no lo es', /solo 3 casan/.test(noEsLaMisma(destino, todas.slice(0, 3)) || ''))
  const otros = todas.map((x) => ({ ...x, suya: { ...x.suya, name: `Otra ${x.suya.id}` } }))
  check('por número sí, pero con otros nombres (otra baraja del mismo día): no lo es', /se llaman igual/.test(noEsLaMisma(destino, otros) || ''))
  const japo = otros.map((x) => ({ ...x, nuestra: { ...x.nuestra, name_en: null } }))
  check('un nombre en japonés no cuenta en contra (no se puede comparar)', noEsLaMisma(destino, japo) === null)
}

// Un doble pequeño de la base y de TCGGO para `procesar`.
const montar = ({ cartas, lineas = [], sets }) => {
  const llamadas = []
  const guardadas = []
  const db = { cartas: cartas.map((c) => ({ ...c })), lineas: lineas.map((l) => ({ ...l })), sets: sets.map((s) => ({ ...s })) }
  return {
    llamadas, guardadas, db,
    restImpl: async (ruta, opciones = null) => {
      const r = decodeURIComponent(ruta)
      llamadas.push({ ruta: r, metodo: opciones?.method || 'GET', cuerpo: opciones?.body ? JSON.parse(opciones.body) : null })
      const ids = (k) => ((r.match(new RegExp(`${k}=in\\.\\(([^)]*)\\)`)) || [])[1] || '').split(',').map((x) => x.replace(/"/g, '')).filter(Boolean)
      if (!opciones || opciones.method === 'GET' || !opciones.method) {
        if (r.startsWith('tcg_sets?')) return db.sets.filter((s) => ids('id').includes(s.id))
        if (r.startsWith('tcg_cards?')) return db.cartas.filter((c) => ids('set_id').includes(c.set_id))
        if (r.startsWith('user_collection?')) return db.lineas.filter((l) => ids('card_id').includes(l.card_id))
        return []
      }
      if (opciones.method === 'POST' && r.startsWith('tcg_cards?on_conflict')) {
        for (const f of JSON.parse(opciones.body)) { const c = db.cartas.find((x) => x.id === f.id); if (c) Object.assign(c, f) }
      }
      if (opciones.method === 'PATCH' && r.startsWith('user_collection?')) { const id = r.match(/id=eq\.([^&]+)/)[1]; Object.assign(db.lineas.find((l) => l.id === id), JSON.parse(opciones.body)) }
      if (opciones.method === 'DELETE' && r.startsWith('tcg_cards?')) db.cartas = db.cartas.filter((c) => !ids('id').includes(c.id))
      if (opciones.method === 'DELETE' && r.startsWith('tcg_sets?')) { const id = r.match(/id=eq\.([^&]+)/)[1]; db.sets = db.sets.filter((s) => s.id !== id) }
      return null
    },
    guardarCartasImpl: async (filas) => {
      guardadas.push(...filas)
      // La RPC: inserta lo nuevo; en lo que existe NO toca set_id ni pisa name_en.
      for (const f of filas) {
        const c = db.cartas.find((x) => x.id === f.id)
        if (c) Object.assign(c, { tcggo_id: f.tcggo_id, cm_id_product_propio: c.cm_id_product_propio ?? f.cm_id_product, name_en: c.name_en ?? f.name_en })
        else db.cartas.push({ id: f.id, set_id: f.set_id, local_id: f.local_id, name: f.name, name_en: f.name_en, tcggo_id: f.tcggo_id, cm_id_product_propio: f.cm_id_product })
      }
      return filas.length
    },
  }
}
const SUYAS = [
  { id: 501, name: 'Pikachu', card_number: '1', cardmarket_id: 7001, type: 'singles' },
  { id: 502, name: 'Raichu δ', card_number: '2', cardmarket_id: 7002, type: 'singles' },
  { id: 503, name: 'Mew', card_number: '3', cardmarket_id: 7003, type: 'singles' },
]
const fetchTcggo = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ data: SUYAS, paging: { current: 1, total: 1 } }) })
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', TCGGO_PAUSA_MS: '0' }

console.log('\n── 3. `procesar` conserva por número (el set de Scrydex) ──')
{
  const b = montar({
    sets: [{ id: 'pcg4_ja', name: 'ロケット団の逆襲' }],
    cartas: [
      { id: 'scrydex-pcg4_ja-1', set_id: 'pcg4_ja', local_id: '001', name: 'ピカチュウ', name_en: null, tcggo_id: null },
      { id: 'scrydex-pcg4_ja-2', set_id: 'pcg4_ja', local_id: '002', name: 'ライチュウδ', name_en: 'Raichu (Delta Species)', tcggo_id: null },
      { id: 'scrydex-pcg4_ja-99', set_id: 'pcg4_ja', local_id: '099', name: 'なにか', name_en: null, tcggo_id: null },
    ],
  })
  const r = await procesar({ env: ENV, fetchImpl: fetchTcggo, ...b, sets: ['pcg4_ja'], destino: 'pcg4_ja', mercado: 'JP', episodio: 900, conservarPorNumero: true, pausa: async () => {} })
  const de = (id) => b.db.cartas.find((c) => c.id === id)
  check('sale bien: dos conservadas por número y la tercera suya entra nueva', r.ok && r.porNumero === 2 && r.nuevas === 1 && b.guardadas.some((f) => f.id === 'tcggo-503'), JSON.stringify(r).slice(0, 300))
  check('  …las nuestras se quedan con SU id y ganan el id de Cardmarket de TCGGO (el precio llega por ahí)', de('scrydex-pcg4_ja-1')?.cm_id_product_propio === 7001 && de('scrydex-pcg4_ja-2')?.tcggo_id === 502)
  check('  …y el INGLÉS de TCGGO, también encima del de Scrydex', de('scrydex-pcg4_ja-1')?.name_en === 'Pikachu' && de('scrydex-pcg4_ja-2')?.name_en === 'Raichu δ')
  const ajuste = b.llamadas.find((l) => l.metodo === 'POST' && /^tcg_cards\?on_conflict=id,market/.test(l.ruta))
  check('  …por un upsert que repite las `not null` (id, market, set_id, local_id, name)', ajuste && ajuste.cuerpo.every((f) => f.id && f.market === 'JP' && f.set_id && f.local_id && f.name), JSON.stringify(ajuste?.cuerpo))
  check('  …y la nuestra sin pareja que no tiene nadie se va', !de('scrydex-pcg4_ja-99'))

  const sin = montar({ sets: [{ id: 'pcg4_ja' }], cartas: [{ id: 'x1', set_id: 'pcg4_ja', local_id: '1', name: 'ピカチュウ', tcggo_id: null }] })
  await procesar({ env: ENV, fetchImpl: fetchTcggo, ...sin, sets: ['pcg4_ja'], destino: 'pcg4_ja', mercado: 'JP', episodio: 900, pausa: async () => {} })
  check('sin la opción, lo de antes: entra como «tcggo-…» y la nuestra se va', sin.guardadas.every((f) => f.id.startsWith('tcggo-')) && !sin.db.cartas.some((c) => c.id === 'x1'))

  const otra = montar({
    sets: [{ id: 'dpd' }],
    cartas: Array.from({ length: 6 }, (_, i) => ({ id: `d${i}`, set_id: 'dpd', local_id: String(i + 10), name: 'ディアルガ', name_en: `Dialga ${i}`, tcggo_id: null })),
  })
  const ro = await procesar({ env: ENV, fetchImpl: fetchTcggo, ...otra, sets: ['dpd'], destino: 'dpd', mercado: 'JP', episodio: 900, conservarPorNumero: true, comprobarQueEsLaMisma: true, pausa: async () => {} })
  check('elegido por la huella y NO es la misma: no se escribe ni se borra nada', ro.ok === false && ro.noEsLaMisma === true && otra.guardadas.length === 0 && otra.db.cartas.length === 6 && !otra.llamadas.some((l) => l.metodo === 'DELETE'), JSON.stringify(ro).slice(0, 200))
}

console.log('\n── 4. Fundir: el set creado de nuevo, dentro del de Scrydex ──')
{
  const b = montar({
    sets: [{ id: 'pcg4_ja' }, { id: 'tcggo-900' }],
    cartas: [
      { id: 'scrydex-1', set_id: 'pcg4_ja', local_id: '1', name: 'ピカチュウ', name_en: 'Pikachu', tcggo_id: null },
      { id: 'scrydex-2', set_id: 'pcg4_ja', local_id: '2', name: 'ライチュウ', name_en: 'Raichu δ', tcggo_id: null },
      { id: 'tcggo-501', set_id: 'tcggo-900', local_id: '1', name: 'Pikachu', name_en: 'Pikachu', tcggo_id: 501 },
      { id: 'tcggo-502', set_id: 'tcggo-900', local_id: '2', name: 'Raichu δ', name_en: 'Raichu δ', tcggo_id: 502 },
      { id: 'tcggo-503', set_id: 'tcggo-900', local_id: '3', name: 'Mew', name_en: 'Mew', tcggo_id: 503 },
    ],
    lineas: [{ id: 'l1', card_id: 'tcggo-501', user_id: 'u', cantidad: 2 }, { id: 'l3', card_id: 'tcggo-503', user_id: 'u', cantidad: 1 }],
  })
  const r = await procesar({ env: ENV, fetchImpl: fetchTcggo, ...b, sets: ['pcg4_ja', 'tcggo-900'], destino: 'pcg4_ja', mercado: 'JP', episodio: 900, conservarPorNumero: true, comprobarQueEsLaMisma: true, pausa: async () => {} })
  const de = (id) => b.db.cartas.find((c) => c.id === id)
  check('sale bien', r.ok, JSON.stringify(r).slice(0, 300))
  check('  la línea de la «tcggo-501» pasa a la nuestra del mismo número (por su tcggo_id)', b.db.lineas.find((l) => l.id === 'l1').card_id === 'scrydex-1')
  check('  la «tcggo-503», que no tiene pareja nuestra, se MUEVE al set de Scrydex (la RPC no cambia el set_id; si no, la cascada se la llevaba con el set)', de('tcggo-503')?.set_id === 'pcg4_ja' && b.db.lineas.find((l) => l.id === 'l3').card_id === 'tcggo-503', JSON.stringify(de('tcggo-503')))
  check('  las «tcggo-…» duplicadas se borran y el set creado, vacío, también', !de('tcggo-501') && !de('tcggo-502') && !b.db.sets.some((s) => s.id === 'tcggo-900') && r.setsBorrados.includes('tcggo-900'), JSON.stringify(r.setsBorrados))
}

console.log('\n── 5. El calco: la lista cada día, la huella, lo dudoso y la fusión ──')
{
  const EPIS = [
    { id: 900, name: 'Rocket Gang Strikes Back', code: 'PCG4', cards_total: 108, released_at: '2005-04-08' },
    { id: 902, name: 'Entry Pack', code: null, cards_total: 30, released_at: '2007-12-07' },
  ]
  const sets = [
    { id: 'pcg4_ja', name: 'ロケット団の逆襲', name_en: 'Team Rocket Strikes Back', release_date: '2005-04-08', card_count_total: 108, scrydex_id: 'pcg4_ja', tcggo_id: null, oculto: false },
    { id: 'dpd', name: 'x', name_en: 'Dialga LV.X Constructed Standard Deck', release_date: '2007-12-07', card_count_total: 30, tcggo_id: null, oculto: false },
    { id: 'dpp', name: 'y', name_en: 'Palkia LV.X Constructed Standard Deck', release_date: '2007-12-07', card_count_total: 30, tcggo_id: null, oculto: false },
    { id: 'tcggo-800', name: 'Holon Phantom', name_en: 'Holon Phantom', release_date: '2006-03-24', card_count_total: 110, tcggo_id: 800, oculto: false },
    { id: 'pcg5_ja', name: 'ホロンの幻影', name_en: 'Holon Phantom (Japanese)', release_date: '2006-03-24', card_count_total: 110, scrydex_id: 'pcg5_ja', tcggo_id: null, oculto: true },
  ]
  const estados = { [calco.CLAVE_ESTADO]: { hechos: { 800: { fecha: '2026-10-01T00:00:00Z', set: 'tcggo-800', por: 'nuevo' } }, lista: { fecha: '2026-10-06T00:00:00Z', episodios: [{ id: 800, nombre: 'Holon Phantom', codigo: null, cartas: 110, fecha: '2006-03-24' }] } }, tcggo_precios: { hechosJp: [800, 5] } }
  const urls = []
  const hechas = []
  const parches = []
  const creados = []
  const b = {
    fetchImpl: async (url) => { urls.push(url); return { ok: true, status: 200, text: async () => JSON.stringify({ data: [...EPIS, { id: 800, name: 'Holon Phantom', code: null, cards_total: 110, released_at: '2006-03-24' }], paging: { current: 1, total: 1 } }) } },
    restImpl: async (ruta, opciones = null) => {
      if (opciones?.method === 'PATCH') { parches.push({ ruta: decodeURIComponent(ruta), cuerpo: JSON.parse(opciones.body) }); return null }
      if (ruta.startsWith('tcg_sets?')) return sets
      if (ruta.startsWith('tcg_cards?')) return [{ id: 'una' }]
      return []
    },
    estadoImpl: async (k) => JSON.parse(JSON.stringify(estados[k] || {})),
    guardarEstadoImpl: async (k, v) => { estados[k] = JSON.parse(JSON.stringify(v)) },
    crearSetsImpl: async (filas) => { creados.push(...filas); return filas.length },
    procesarImpl: async (o) => { hechas.push(o); return { ok: true, suyas: 100, escritas: 100, porNumero: 95, borradas: 0, seQuedan: [] } },
  }
  const AHORA = new Date('2026-10-08T10:00:00Z')
  const r1 = await calco.pasada({ env: ENV, ...b, ahora: AHORA, pausa: async () => {} })
  const e = () => estados[calco.CLAVE_ESTADO]
  check('la lista de hace dos días se vuelve a pedir (una vez al DÍA) y trae las nuevas', urls.filter((u) => /episodes/.test(u)).length === 1 && e().lista.episodios.length === 3 && calco.DIAS_DE_LISTA === 1, JSON.stringify(r1).slice(0, 200))
  check('Rocket Gang (otro inglés que el de Scrydex) va al pcg4_ja por la HUELLA, sin crear set', creados.length === 0 && hechas[0]?.destino === 'pcg4_ja' && e().hechos[900]?.por === 'fecha', JSON.stringify(hechas[0] && { d: hechas[0].destino }))
  check('  …conservando por número y comprobando que es la misma', hechas[0]?.conservarPorNumero === true && hechas[0]?.comprobarQueEsLaMisma === true)
  const r2 = await calco.pasada({ env: ENV, ...b, ahora: AHORA, pausa: async () => {} })
  check('Entry Pack: dos barajas ese día y nada las distingue → DUDOSA: ni se crea ni se pide', creados.length === 0 && hechas.length === 1 && e().dudosos?.[902]?.candidatos?.length === 2, JSON.stringify(r2).slice(0, 200))
  const r3 = await calco.pasada({ env: ENV, ...b, ahora: AHORA, pausa: async () => {} })
  check('la creada de nuevo (tcggo-800) se FUNDE en el de Scrydex de su huella', hechas[1]?.destino === 'pcg5_ja' && JSON.stringify(hechas[1]?.sets) === '["pcg5_ja","tcggo-800"]' && hechas[1]?.comprobarQueEsLaMisma === true && e().hechos[800]?.fundidoDe === 'tcggo-800' && e().hechos[800]?.set === 'pcg5_ja', JSON.stringify(r3).slice(0, 300))
  check('  …el de Scrydex, que estaba escondido, se enseña', parches.some((p) => /id=eq\.pcg5_ja/.test(p.ruta) && p.cuerpo.oculto === false), JSON.stringify(parches))
  check('  …y a la pasada de precios se le quita del día, para que lo escriba ya', !estados.tcggo_precios.hechosJp.includes(800) && estados.tcggo_precios.hechosJp.includes(5), JSON.stringify(estados.tcggo_precios))
  const r4 = await calco.pasada({ env: ENV, ...b, ahora: AHORA, pausa: async () => {} })
  check('después no se vuelve a fundir nada ni a pedir la dudosa', hechas.length === 2 && !r4.fusion, JSON.stringify(r4).slice(0, 200))
}

console.log('\n── 6. Lo estático ──')
{
  const espejo = readFileSync(`${RAIZ}/netlify/functions/precios-espejo.mjs`, 'utf8')
  check('el espejo no toca las que ya casó TCGGO (borraría su precio)', /origen=eq\.scrydex&tcggo_id=is\.null/.test(espejo))
  const huecos = readFileSync(`${RAIZ}/netlify/functions/scrydex-huecos.mjs`, 'utf8')
  check('el repaso de nombres de Scrydex se salta los sets que ya son de TCGGO', /de TCGGO: no se reescribe/.test(huecos))
  check('/admin enseña las dudosas y las fundidas', /dudosa #/.test(readFileSync(`${RAIZ}/admin/js/admin.js`, 'utf8')) && /fundida #/.test(readFileSync(`${RAIZ}/admin/js/admin.js`, 'utf8')))
  void resumirEpisodio
}

console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
