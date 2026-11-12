// Tandas 1290 y 1291 — «Actualizar desde TCGGO» dice qué cartas nuevas NO se han
// escrito y por qué. PINGU, con las MEP Black Star Promos: «TCGGO tiene 139
// cartas: 105 ya estaban, 34 nuevas; 105 escritas» y las nuevas no estaban.
// El disparador de las correcciones (934) se salta sin error la fila de una
// carta con lápida; el panel no lo decía.
//
//   1. `nuevasSinEscribir`: las nuevas que no están en la base después de
//      escribir, con su lápida si la tienen (y por trozos).
//   2. `procesar` en una expansión: si la base escribe menos de lo mandado,
//      el turno lleva `noEscritas`; si lo escribe todo, no.
//   3. La frase del panel: cuántas, por qué y cuáles.
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const cat = await import(`${RAIZ}/netlify/functions/tcggo-catalogo.mjs`)
const panel = await import(`${RAIZ}/admin/js/tcggo-set-ahora.js`)

console.log('\n── 1. nuevasSinEscribir ──')
{
  const pedidas = []
  const pedir = async (ruta) => {
    pedidas.push(ruta)
    if (ruta.startsWith('tcg_cards')) return [{ id: 'tcggo-3' }]
    if (ruta.startsWith('tcg_correcciones')) return [{ id: 'tcggo-1' }]
    return []
  }
  const filas = [{ id: 'tcggo-1', local_id: 'MEP 093', name: 'Pikachu' }, { id: 'tcggo-2', local_id: 'MEP 094', name: 'Eevee' }, { id: 'tcggo-3', local_id: 'MEP 095', name: 'Mew' }]
  const r = await cat.nuevasSinEscribir(pedir, filas, 'WEST')
  check('las que no están, con su lápida', JSON.stringify(r) === JSON.stringify([{ id: 'tcggo-1', numero: 'MEP 093', nombre: 'Pikachu', lapida: true }, { id: 'tcggo-2', numero: 'MEP 094', nombre: 'Eevee', lapida: false }]), JSON.stringify(r))
  check('pregunta por la lápida de esas cartas y de ese mercado', pedidas.some((p) => /tcg_correcciones\?.*columna=eq.__borrada&market=eq.WEST&id=in\.\("tcggo-1","tcggo-2","tcggo-3"\)/.test(p)), pedidas.join(' | '))
  const muchas = Array.from({ length: 170 }, (_, i) => ({ id: `tcggo-${i}`, local_id: String(i), name: 'X' }))
  const veces = []
  await cat.nuevasSinEscribir(async (ruta) => { veces.push(ruta); return [] }, muchas, 'WEST')
  check('por trozos de 80 (dos consultas por trozo)', veces.length === 6, veces.length)
}

console.log('\n── 2. procesar ──')
const { CLAVE_ESTADO: CLAVE_CATALOGO } = cat
const { CLAVE_ESTADO: CLAVE_PARES } = await import(`${RAIZ}/netlify/functions/tcggo-emparejar.mjs`)
const AHORA = new Date('2026-11-12T12:00:00Z')
const EP = { id: 412, name: 'MEP Black Star Promos', code: 'MEP', cards_total: 3, released_at: '2025-09-26' }
const SUYAS = [
  { id: 900, card_number: '001', name: 'Pikachu', type: 'singles', cardmarket_id: 5001, episode: EP },
  { id: 901, card_number: 'MEP 093', name: 'Mega Darkrai', type: 'singles', cardmarket_id: 5093, episode: EP },
  { id: 902, card_number: 'MEP 094', name: 'Mew', type: 'singles', cardmarket_id: 5094, episode: EP },
]
async function correr(escribe) {
  const estados = {
    [CLAVE_PARES]: { episodios: { fecha: AHORA.toISOString(), lista: [{ id: 412, nombre: 'MEP Black Star Promos', codigo: 'MEP', cartas: 3 }] }, hechos: { mep: { episodio: 412, pares: 1 } } },
    [CLAVE_CATALOGO]: { semana: Math.floor(AHORA.getTime() / (7 * 86_400_000)), hechos: { WEST: [412], JP: [] }, vacias: { WEST: [], JP: [] }, gasto: { dia: '2026-11-12', peticiones: 0 } },
  }
  const r = await cat.procesar({
    env: { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', TCGGO_PAUSA_MS: '0', TCGGO_TOPE_DIARIO: '14000' }, ahora: AHORA, pausa: async () => {},
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ data: SUYAS, paging: { current: 1, total: 1, per_page: 100 } }) }),
    soloEpisodio: { mercado: 'WEST', id: 412, set: 'mep', nombre: 'MEP Black Star Promos' },
    restImpl: async (ruta, opciones) => {
      if (opciones?.method === 'PATCH') return null
      if (/^tcg_sets\?/.test(ruta)) return [{ id: 'mep', name: 'MEP Black Star Promos', name_en: 'MEP Black Star Promos', tcggo_id: 412 }]
      if (/^tcg_cards\?select=id,set_id/.test(ruta)) return [{ id: 'mep-001', set_id: 'mep', local_id: '001', name: 'Pikachu', cm_id_product_propio: 5001, tcggo_id: null }]
      if (/^tcg_cards\?select=id&/.test(ruta)) return escribe === 'todo' ? [{ id: 'tcggo-901' }, { id: 'tcggo-902' }] : []
      if (/^tcg_correcciones\?/.test(ruta)) return [{ id: 'tcggo-901' }]
      throw new Error(`ruta inesperada ${ruta}`)
    },
    guardarCartasImpl: async (filas) => (escribe === 'todo' ? filas.length : 1),
    crearSetsImpl: async () => 0,
    estadoImpl: async (k) => estados[k] || {}, guardarEstadoImpl: async (k, v) => { estados[k] = JSON.parse(JSON.stringify(v)) },
  })
  return (r.esteTurno || []).find((x) => x.episodio === 412) || r
}
{
  const t = await correr('una')
  check('la base escribe 1 de 3: el turno dice qué nuevas faltan y cuál tiene lápida', t.nuevas === 2 && t.noEscritasTotal === 2 && t.noEscritas?.map((x) => `${x.numero}:${x.lapida}`).join() === '093:true,094:false', JSON.stringify(t).slice(0, 400))
  const t2 = await correr('todo')
  check('si lo escribe todo, no hay `noEscritas`', t2.nuevas === 2 && t2.escritas === 3 && !t2.noEscritas, JSON.stringify(t2).slice(0, 300))
}

console.log('\n── 2b. La lista que da menos de lo que anuncia (1291) ──')
{
  // De 100 en 100, TCGGO da 2 de 3 (`results: 3`); de 20 en 20, las 3.
  const urls = []
  const TODAS = [
    { id: 900, card_number: '001', name: 'Pikachu', type: 'singles', cardmarket_id: 5001, episode: EP },
    { id: 902, card_number: 'MEP 094', name: 'Mew', type: 'singles', cardmarket_id: 5094, episode: EP },
    { id: 83581, card_number: 'MEP 111', name: 'Masquerain', type: 'singles', cardmarket_id: null, episode: EP },
  ]
  const estados = {
    [CLAVE_PARES]: { episodios: { fecha: AHORA.toISOString(), lista: [{ id: 412, nombre: 'MEP Black Star Promos', codigo: 'MEP', cartas: 3 }] }, hechos: { mep: { episodio: 412, pares: 1 } } },
    [CLAVE_CATALOGO]: { semana: Math.floor(AHORA.getTime() / (7 * 86_400_000)), hechos: { WEST: [412], JP: [] }, vacias: { WEST: [], JP: [] }, gasto: { dia: '2026-11-12', peticiones: 0 } },
  }
  const guardadas = []
  const r = await cat.procesar({
    env: { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', TCGGO_PAUSA_MS: '0', TCGGO_TOPE_DIARIO: '14000' }, ahora: AHORA, pausa: async () => {},
    fetchImpl: async (url) => {
      urls.push(url)
      const pp = Number(new URL(url).searchParams.get('per_page'))
      const data = pp === 20 ? TODAS : TODAS.slice(0, 2)
      // La de 100 es una foto VIEJA que no avisa (1291b): dice 2 de sus 2.
      return { ok: true, status: 200, text: async () => JSON.stringify({ data, paging: { current: 1, total: 1, per_page: pp }, results: pp === 20 ? 3 : 2 }) }
    },
    soloEpisodio: { mercado: 'WEST', id: 412, set: 'mep', nombre: 'MEP Black Star Promos' },
    restImpl: async (ruta, opciones) => {
      if (opciones?.method === 'PATCH') return null
      if (/^tcg_sets\?/.test(ruta)) return [{ id: 'mep', name: 'MEP Black Star Promos', name_en: 'MEP Black Star Promos', tcggo_id: 412 }]
      if (/^tcg_cards\?select=id,set_id/.test(ruta)) return [{ id: 'mep-001', set_id: 'mep', local_id: '001', name: 'Pikachu', cm_id_product_propio: 5001, tcggo_id: null }]
      return []
    },
    guardarCartasImpl: async (filas) => { guardadas.push(...filas); return filas.length },
    crearSetsImpl: async () => 0,
    estadoImpl: async (k) => estados[k] || {}, guardarEstadoImpl: async (k, v) => { estados[k] = JSON.parse(JSON.stringify(v)) },
  })
  const t = (r.esteTurno || []).find((x) => x.episodio === 412) || r
  check('vuelve a pedir de 20 en 20 y Masquerain MEP 111 entra, con el número como los nuestros («111»)', urls.some((u) => /per_page=20/.test(u)) && guardadas.some((f) => f.id === 'tcggo-83581' && f.local_id === '111'), JSON.stringify(guardadas.map((f) => f.id)))
  check('  …y lo cuenta: anunciadas 3, recibidas 2, recuperadas 1', t.anunciadas === 3 && t.recibidas === 2 && t.recuperadas === 1, JSON.stringify(t).slice(0, 300))
  const s = panel.textoDePaso('cartas', { ok: true, turno: t })
  check('  …y el panel lo dice', /TCGGO dice que tiene 3, pero su lista dio 2: se ha vuelto a pedir de 20 en 20 y han aparecido 1 más\./.test(s), s)
  check('  …y dice lo que contestó TCGGO a cada petición (1291c)', /Lo que contestó TCGGO: de 100, pág\. 1\/1 → 2 \(dice 2\); de 20, pág\. 1\/1 → 3 \(dice 3\)\./.test(s), s)
  // Si cuadra, ni una petición más.
  const urls2 = []
  estados[CLAVE_CATALOGO].hechos.WEST = [412]
  await cat.procesar({
    env: { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', TCGGO_PAUSA_MS: '0', TCGGO_TOPE_DIARIO: '14000' }, ahora: AHORA, pausa: async () => {},
    fetchImpl: async (url) => { urls2.push(url); return { ok: true, status: 200, text: async () => JSON.stringify({ data: TODAS, paging: { current: 1, total: 1 }, results: 3 }) } },
    soloEpisodio: { mercado: 'WEST', id: 412, set: 'mep', nombre: 'MEP Black Star Promos' },
    restImpl: async (ruta) => (/^tcg_sets\?/.test(ruta) ? [{ id: 'mep', name: 'MEP', tcggo_id: 412 }] : []),
    guardarCartasImpl: async (f) => f.length, crearSetsImpl: async () => 0,
    estadoImpl: async (k) => estados[k] || {}, guardarEstadoImpl: async (k, v) => { estados[k] = JSON.parse(JSON.stringify(v)) },
  })
  check('si la lista cuadra, solo el contraste: la primera página de 20 y nada más', urls2.length === 2 && /per_page=20&page=1/.test(urls2[1]), urls2.join(' | '))
}

console.log('\n── 2c. La copia vieja de la lista y el parámetro `fresco` (1291d) ──')
{
  // Sin `_=` TCGGO da una copia vieja que cuadra consigo misma (2 de 2); con
  // él, la lista de verdad (3). Así llegaban las MEP: 139 de 139 al servidor
  // y 164 al playground de PINGU.
  const TODAS = [
    { id: 900, card_number: '001', name: 'Pikachu', type: 'singles', cardmarket_id: 5001, episode: EP },
    { id: 902, card_number: 'MEP 094', name: 'Mew', type: 'singles', cardmarket_id: 5094, episode: EP },
    { id: 83581, card_number: 'MEP 111', name: 'Masquerain', type: 'singles', cardmarket_id: null, episode: EP },
  ]
  const correr = async (fetchImpl) => {
    const urls = []
    const guardadas = []
    const estados = {
      [CLAVE_PARES]: { episodios: { fecha: AHORA.toISOString(), lista: [{ id: 412, nombre: 'MEP Black Star Promos', codigo: 'MEP', cartas: 3 }] }, hechos: { mep: { episodio: 412, pares: 1 } } },
      [CLAVE_CATALOGO]: { semana: Math.floor(AHORA.getTime() / (7 * 86_400_000)), hechos: { WEST: [412], JP: [] }, vacias: { WEST: [], JP: [] }, gasto: { dia: '2026-11-12', peticiones: 0 } },
    }
    const r = await cat.procesar({
      env: { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', TCGGO_PAUSA_MS: '0', TCGGO_TOPE_DIARIO: '14000' }, ahora: AHORA, pausa: async () => {},
      fetchImpl: async (url) => { urls.push(url); return fetchImpl(url) },
      soloEpisodio: { mercado: 'WEST', id: 412, set: 'mep', nombre: 'MEP Black Star Promos' },
      restImpl: async (ruta, opciones) => {
        if (opciones?.method === 'PATCH') return null
        if (/^tcg_sets\?/.test(ruta)) return [{ id: 'mep', name: 'MEP Black Star Promos', tcggo_id: 412 }]
        return []
      },
      guardarCartasImpl: async (filas) => { guardadas.push(...filas); return filas.length },
      crearSetsImpl: async () => 0,
      estadoImpl: async (k) => estados[k] || {}, guardarEstadoImpl: async (k, v) => { estados[k] = JSON.parse(JSON.stringify(v)) },
    })
    return { r, urls, guardadas, t: (r.esteTurno || []).find((x) => x.episodio === 412) }
  }
  const viejaSinFresco = (url) => {
    const fresca = /[?&]_=/.test(url)
    const data = fresca ? TODAS : TODAS.slice(0, 2)
    return { ok: true, status: 200, text: async () => JSON.stringify({ data, paging: { current: 1, total: 1 }, results: data.length }) }
  }
  const a = await correr(viejaSinFresco)
  check('con el botón la lista se pide con `_=` y Masquerain entra', a.urls.length && a.urls.every((u) => /[?&]_=\d+/.test(u)) && a.guardadas.some((f) => f.id === 'tcggo-83581'), a.urls.join(' | '))
  check('  …y el panel dice lo que contestó (3 de 3)', /de 100, pág\. 1\/1 → 3 \(dice 3\)/.test(panel.textoDePaso('cartas', { ok: true, turno: a.t })), JSON.stringify(a.t?.pedidas))
  // Si TCGGO no aceptara `_=` (400), se pide como siempre y no se para.
  const b = await correr((url) => (/[?&]_=/.test(url)
    ? { ok: false, status: 400, text: async () => 'unknown parameter' }
    : { ok: true, status: 200, text: async () => JSON.stringify({ data: TODAS, paging: { current: 1, total: 1 }, results: 3 }) }))
  check('si `_=` da 400, se repite sin él y no se para', !b.r.parado && b.guardadas.some((f) => f.id === 'tcggo-83581') && b.urls.some((u) => !/[?&]_=/.test(u)), JSON.stringify({ parado: b.r.parado, urls: b.urls }))
}

console.log('\n── 3. La frase del panel ──')
{
  const t = { suyas: 139, casadas: 105, nuevas: 34, escritas: 105, noEscritasTotal: 3, noEscritas: [{ numero: 'MEP 093', nombre: 'Mega Darkrai', lapida: true }, { numero: 'MEP 094', nombre: 'Mew', lapida: true }, { numero: 'MEP 095', nombre: 'Eevee', lapida: false }] }
  const s = panel.textoDePaso('cartas', { ok: true, turno: t })
  check('dice cuántas no se han escrito, por qué y cuáles', /3 nuevas NO se han escrito: 2 porque se borraron o se juntaron como repetidas en \/admin.*y 1 por otro motivo\. Son: MEP 093 Mega Darkrai, MEP 094 Mew, MEP 095 Eevee\./.test(s), s)
  check('sin ellas, la frase de siempre', panel.textoDePaso('cartas', { ok: true, turno: { suyas: 3, casadas: 1, nuevas: 2, escritas: 3 } }) === 'TCGGO tiene 3 cartas: 1 ya estaban, 2 nuevas; 3 escritas.')
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
