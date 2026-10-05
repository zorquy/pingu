// Tanda 654 — reemplazar una expansión por la de TCGGO, entera.
//
// PINGU, con el 30 aniversario roto a partir de la Classic Collection:
// «sustituye todo el set con todas las cartas que tenga dentro la API de
// TCGGO y ya está; no hagas mezclas de nada». Y sin migración SQL.
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = '/home/user/pingu'
const { procesar, equivalencias } = await import(`${RAIZ}/netlify/functions/tcggo-reemplazar-set.mjs`)

console.log('── 1. Las equivalencias: por nombre, y por nombre + número si el nombre se repite ──')
{
  const viejas = [
    { id: '30th-c-001', local_id: '001', name: 'Charizard', name_en: 'Charizard' },
    { id: '30th-c-004', local_id: '004', name: 'Pikachu', name_en: 'Pikachu' },
    { id: '30th-c-005', local_id: '005', name: 'Dark Raichu', name_en: null },
    { id: '30th-c-009', local_id: '009', name: 'Inventada', name_en: 'Inventada' },
  ]
  const nuevas = [
    { id: 'tcggo-1', local_id: '4', name_en: 'Charizard' },
    { id: 'tcggo-2', local_id: '58', name_en: 'Pikachu' },
    { id: 'tcggo-3', local_id: '5', name_en: 'Pikachu' },
    { id: 'tcggo-4', local_id: '83', name_en: 'Dark Raichu' },
  ]
  const e = equivalencias(viejas, nuevas)
  check('Charizard casa por nombre', e.get('30th-c-001')?.a === 'tcggo-1' && e.get('30th-c-001').por === 'nombre')
  check('Dark Raichu también, por `name` si no hay `name_en`', e.get('30th-c-005')?.a === 'tcggo-4')
  check('Pikachu NO casa por nombre (hay dos suyas) ni por número (004 ≠ 58 ni 5)', !e.has('30th-c-004'), JSON.stringify([...e]))
  check('  …pero sí si el número coincide', equivalencias([viejas[1]], [{ id: 'tcggo-2', local_id: '004', name_en: 'Pikachu' }, nuevas[2]]).get('30th-c-004')?.por === 'nombre+numero')
  check('lo que no está en TCGGO no casa con nada', !e.has('30th-c-009'))
}

console.log('\n── 2. La función: pide la expansión entera y reemplaza ──')
{
  const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', TCGGO_PAUSA_MS: '0' }
  const carta = (id, numero, nombre, extra = {}) => ({ id, card_number: numero, name: nombre, cardmarket_id: 1000 + id, image: `https://images.tcggo.com/${id}.jpg`, rarity: 'rare', type: 'singles', ...extra })
  // Su expansión en DOS páginas, con un sobre en medio (que no es una carta).
  const PAGINAS = {
    1: { data: [carta(1, '1', 'Ho-Oh'), carta(2, '2', 'Reshiram'), carta(99, '—', 'Booster Box', { type: 'sealed' })], paging: { current: 1, total: 2, per_page: 100 } },
    2: { data: [carta(3, '4', 'Charizard'), carta(4, '5', 'Pikachu'), carta(5, '58', 'Pikachu'), carta(6, '83', 'Dark Raichu')], paging: { current: 2, total: 2, per_page: 100 } },
  }
  const montar = ({ paginas = PAGINAS, nuestras, lineas = [], deseos = [], albumes = [] } = {}) => {
    const llamadas = []
    const urls = []
    const fetchImpl = async (url) => {
      urls.push(url)
      const p = Number((url.match(/[?&]page=(\d+)/) || [])[1])
      const datos = paginas[p]
      return { ok: !!datos, status: datos ? 200 : 404, text: async () => (datos ? JSON.stringify(datos) : 'no') }
    }
    const restImpl = async (ruta, opciones = null) => {
      llamadas.push({ ruta: decodeURIComponent(ruta), metodo: opciones?.method || 'GET', cuerpo: opciones?.body ? JSON.parse(opciones.body) : null })
      if (opciones) return null
      if (ruta.startsWith('tcg_sets?')) return [{ id: '30th', name: '30 aniversario', tcggo_id: null }, { id: '30th-c', name: 'Classic', tcggo_id: null }]
      if (ruta.startsWith('tcg_cards?')) return nuestras
      if (ruta.startsWith('user_collection?')) return lineas.filter((l) => ruta.includes(`"${l.card_id}"`))
      if (ruta.startsWith('user_wants?')) return deseos.filter((l) => ruta.includes(`"${l.card_id}"`))
      if (ruta.startsWith('user_albums?')) { const id = JSON.parse(decodeURIComponent(ruta.split('cartas=cs.')[1]))[0].id; return albumes.filter((a) => a.cartas.some((c) => c.id === id)) }
      return []
    }
    const guardadas = []
    return { llamadas, urls, fetchImpl, restImpl, guardarCartasImpl: async (filas) => { guardadas.push(...filas); return filas.length }, guardadas }
  }
  const NUESTRAS = [
    // En 30th: Ho-Oh ya casado por tcggo_id (conserva su id), Reshiram sin casar (se va, pero tiene equivalente por nombre).
    { id: '30th-001', set_id: '30th', local_id: '001', name: 'Ho-Oh', name_en: 'Ho-Oh', tcggo_id: 1 },
    { id: '30th-002', set_id: '30th', local_id: '002', name: 'Reshiram', name_en: 'Reshiram', tcggo_id: null },
    // En 30th-c: Charizard (alguien la tiene → se reapunta), Pikachu (alguien la tiene, dos suyas → se queda), Inventada (nadie → se borra).
    { id: '30th-c-001', set_id: '30th-c', local_id: '001', name: 'Charizard', name_en: 'Charizard', tcggo_id: null },
    { id: '30th-c-004', set_id: '30th-c', local_id: '004', name: 'Pikachu', name_en: 'Pikachu', tcggo_id: null },
    { id: '30th-c-009', set_id: '30th-c', local_id: '009', name: 'Inventada', name_en: 'Inventada', tcggo_id: null },
  ]
  const b = montar({ nuestras: NUESTRAS, lineas: [{ id: 'l1', card_id: '30th-c-001' }, { id: 'l2', card_id: '30th-c-004' }, { id: 'l3', card_id: '30th-002' }], deseos: [{ id: 'd1', card_id: '30th-c-001' }], albumes: [{ id: 'a1', cartas: [{ id: '30th-c-001', pos: 0 }, { id: 'otra', pos: 1 }] }] })
  const r = await procesar({ env: ENV, ...b, sets: ['30th', '30th-c'], episodio: 552, destino: '30th', pausa: async () => {} })
  check('va bien', r.ok === true, JSON.stringify(r).slice(0, 300))
  check('pide las dos páginas de la expansión', r.peticiones === 2 && b.urls.every((u) => /episode_id=552/.test(u)), b.urls.join(' '))
  check('seis cartas suyas, el sobre apartado', r.suyas === 6 && r.descartadas === 1)
  check('Ho-Oh conserva su id (ya era la misma carta); las demás entran como tcggo-<id>', r.conservadas === 1 && r.nuevas === 5 && b.guardadas.some((f) => f.id === '30th-001' && f.set_id === '30th') && b.guardadas.filter((f) => /^tcggo-/.test(f.id)).length === 5 && b.guardadas.every((f) => f.set_id === '30th'), JSON.stringify(b.guardadas.map((f) => f.id)))
  check('  …y con la foto y el id de Cardmarket de TCGGO', b.guardadas.every((f) => f.image_tcggo && f.cm_id_product))
  const pat = (tabla) => b.llamadas.filter((l) => l.metodo === 'PATCH' && l.ruta.startsWith(tabla))
  check('la línea del Charizard viejo se reapunta al de TCGGO', pat('user_collection').some((l) => l.ruta.includes('id=eq.l1') && l.cuerpo.card_id === 'tcggo-3'), JSON.stringify(pat('user_collection')))
  check('  …y la del Reshiram también (estaba en 30th sin casar)', pat('user_collection').some((l) => l.ruta.includes('id=eq.l3') && l.cuerpo.card_id === 'tcggo-2'))
  check('  …y el deseo y el álbum', pat('user_wants').some((l) => l.cuerpo.card_id === 'tcggo-3') && pat('user_albums').some((l) => l.cuerpo.cartas[0].id === 'tcggo-3' && l.cuerpo.cartas[1].id === 'otra'), JSON.stringify(pat('user_albums')))
  check('Pikachu se queda: alguien la tiene y hay dos suyas con ese nombre', r.seQuedan.length === 1 && r.seQuedan[0].id === '30th-c-004')
  const del = b.llamadas.filter((l) => l.metodo === 'DELETE')
  const borradas = del.find((l) => l.ruta.startsWith('tcg_cards?'))
  check('se borran Reshiram, Charizard e Inventada, y no Pikachu ni Ho-Oh', r.borradas === 3 && borradas && /"30th-002"/.test(borradas.ruta) && /"30th-c-001"/.test(borradas.ruta) && /"30th-c-009"/.test(borradas.ruta) && !/"30th-c-004"/.test(borradas.ruta) && !/"30th-001"/.test(borradas.ruta), borradas?.ruta)
  check('  …con sus precios y su histórico', del.some((l) => l.ruta.startsWith('tcg_card_prices?')) && del.some((l) => l.ruta.startsWith('tcg_card_history?')))
  check('  …y DESPUÉS de escribir las nuevas y reapuntar (nada se queda colgando)', b.llamadas.findIndex((l) => l === borradas) > b.llamadas.findIndex((l) => l.metodo === 'PATCH'))
  check('el set 30th-c NO se borra porque Pikachu se queda en él', r.setsBorrados.length === 0 && r.setsQueSeQuedan[0]?.set === '30th-c' && !del.some((l) => l.ruta.startsWith('tcg_sets?')))
  check('el destino queda apuntado a la expansión con su total', pat('tcg_sets').some((l) => l.ruta.includes('id=eq.30th') && l.cuerpo.tcggo_id === 552 && l.cuerpo.card_count_total === 6))

  // Sin nadie con el Pikachu, el set que sobra se va entero.
  const b2 = montar({ nuestras: NUESTRAS })
  const r2 = await procesar({ env: ENV, ...b2, sets: ['30th', '30th-c'], episodio: 552, destino: '30th', pausa: async () => {} })
  const del2 = b2.llamadas.filter((l) => l.metodo === 'DELETE')
  check('sin líneas de nadie, 30th-c se borra con su valor diario y sus favoritos', r2.setsBorrados.join() === '30th-c' && del2.some((l) => l.ruta.startsWith('tcg_sets?') && l.ruta.includes('id=eq.30th-c')) && del2.some((l) => l.ruta.startsWith('tcg_set_valor?')) && del2.some((l) => l.ruta.startsWith('collection_favorite_sets?')), JSON.stringify(del2.map((l) => l.ruta)))
  check('  …y las cuatro nuestras sin casar se van', r2.borradas === 4 && r2.seQuedan.length === 0)

  // Una expansión a medias no toca nada.
  const b3 = montar({ nuestras: NUESTRAS, paginas: { 1: PAGINAS[1] } })
  const r3 = await procesar({ env: ENV, ...b3, sets: ['30th', '30th-c'], episodio: 552, destino: '30th', pausa: async () => {} })
  check('si TCGGO no da la segunda página, no se escribe nada', r3.ok === false && b3.guardadas.length === 0 && !b3.llamadas.some((l) => l.metodo !== 'GET'), r3.error)
  const b4 = montar({ nuestras: NUESTRAS, paginas: { 1: { data: [], paging: { current: 1, total: 1 } } } })
  const r4 = await procesar({ env: ENV, ...b4, sets: ['30th'], episodio: 552, pausa: async () => {} })
  check('  …ni si da cero cartas (no se reemplaza nada por nada)', r4.ok === false && /ninguna carta/.test(r4.error) && b4.guardadas.length === 0)
  check('sin sets, sin episodio o con un destino que no está, se para antes de pedir', (await procesar({ env: ENV, ...montar({ nuestras: [] }), sets: [], episodio: 552 })).ok === false && (await procesar({ env: ENV, ...montar({ nuestras: [] }), sets: ['30th'], episodio: 0 })).ok === false && (await procesar({ env: ENV, ...montar({ nuestras: [] }), sets: ['30th'], episodio: 552, destino: 'otro' })).ok === false)
}

console.log('\n── 3. La pasada programada: sola, una vez, y apuntada ──')
{
  const { pasada, episodioDe, CLAVE_ESTADO, MAXIMO_INTENTOS, REEMPLAZOS } = await import(`${RAIZ}/netlify/functions/tcggo-reemplazar-set.mjs`)
  check('el 30 aniversario está en la lista, con la Classic y todo al 30th', REEMPLAZOS.some((r) => r.clave === '30th' && r.sets.join() === '30th,30th-c' && r.destino === '30th'))
  const SET = { id: '30th', name: '30 aniversario', name_en: '30th Celebration', tcg_online_code: '30C' }
  check('la expansión suya sale de los pares del emparejador', episodioDe(SET, { hechos: { '30th': { episodio: 552 } } }).episodio === 552)
  check('  …o de su lista por código/nombre', episodioDe(SET, { episodios: { lista: [{ id: 7, nombre: '30th Celebration', codigo: '30C', cartas: 60 }] } }).episodio === 7)
  check('  …y sin nada, no se inventa', episodioDe(SET, {}).episodio === null && episodioDe(SET, { hechos: { '30th': { episodio: 552, sospechoso: 'x' } } }).episodio === null)
  const montar = (estadoInicial = {}, pares = { hechos: { '30th': { episodio: 552 } } }) => {
    const estados = { [CLAVE_ESTADO]: estadoInicial, tcggo_pares: pares }
    const guardados = []
    const llamadas = []
    return {
      estados, guardados, llamadas,
      estadoImpl: async (k) => estados[k] || {},
      guardarEstadoImpl: async (k, v) => { estados[k] = JSON.parse(JSON.stringify(v)); guardados.push(k) },
      restImpl: async (ruta) => { llamadas.push(ruta); return ruta.startsWith('tcg_sets?') ? [SET] : [] },
    }
  }
  const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k' }
  const b = montar()
  const hechas = []
  const r = await pasada({ env: ENV, ...b, procesarImpl: async (o) => { hechas.push(o); return { ok: true, suyas: 6, escritas: 6, conservadas: 1, nuevas: 5, borradas: 3, lineasMovidas: 2, deseosMovidos: 1, albumesTocados: 1, seQuedan: [], setsBorrados: ['30th-c'], setsQueSeQuedan: [] } } })
  check('la primera pasada hace el reemplazo con la expansión de los pares', r.ok && hechas.length === 1 && hechas[0].episodio === 552 && hechas[0].sets.join() === '30th,30th-c' && hechas[0].destino === '30th' && r.clave === '30th', JSON.stringify(r))
  check('  …y lo apunta como hecho, con su resumen', b.estados[CLAVE_ESTADO].hechos['30th']?.episodio === 552 && b.estados[CLAVE_ESTADO].hechos['30th'].resumen.borradas === 3)
  const r2 = await pasada({ env: ENV, ...b, procesarImpl: async () => { throw new Error('no debería llamarse') } })
  check('la segunda pasada no toca nada: todo hecho', r2.ok && r2.hecho === true && r2.hechos.join() === '30th', JSON.stringify(r2))
  // Un fallo cuenta como intento, y a los cinco se para.
  const b3 = montar()
  for (let k = 0; k < MAXIMO_INTENTOS + 2; k++) await pasada({ env: ENV, ...b3, procesarImpl: async () => ({ ok: false, error: 'TCGGO 500' }) })
  const cuantas = b3.guardados.length
  check(`un fallo cuenta como intento y a los ${MAXIMO_INTENTOS} se para (no es una factura)`, b3.estados[CLAVE_ESTADO].intentos['30th'] === MAXIMO_INTENTOS && cuantas === MAXIMO_INTENTOS && b3.estados[CLAVE_ESTADO].ultimo.error === 'TCGGO 500', JSON.stringify(b3.estados[CLAVE_ESTADO]))
  const r4 = await pasada({ env: ENV, ...b3, procesarImpl: async () => ({ ok: true }) })
  check('  …y después dice que está parado', r4.hecho === true && r4.parados.join() === '30th')
  // Sin expansión suya todavía, se espera sin gastar ni contar.
  const b5 = montar({}, {})
  const r5 = await pasada({ env: ENV, ...b5, procesarImpl: async () => { throw new Error('no debería llamarse') } })
  check('sin expansión de TCGGO para el set, espera sin contar intento', r5.ok && /esperando/.test(JSON.stringify(r5)) && !b5.guardados.length, JSON.stringify(r5))
}

console.log('\n── 4. Lo estático ──')
{
  const fn = readFileSync(`${RAIZ}/netlify/functions/tcggo-reemplazar-set.mjs`, 'utf8')
  check('es programada, a y 4 de cada cinco minutos', /schedule: '4-59\/5 \* \* \* \*'/.test(fn))
  check('escribe por la RPC del catálogo (sin SQL nuevo)', /rpc\/tcggo_guardar_cartas/.test(fn) && !/create or replace function/.test(fn))
  const html = readFileSync(`${RAIZ}/admin/index.html`, 'utf8')
  const js = readFileSync(`${RAIZ}/admin/js/admin.js`, 'utf8')
  check('NO hay botón en /admin (PINGU: «hazlo tú automáticamente»)', !/btnTcggoReemplazar|tcggoReemplazar/.test(html) && !/tcggoReemplazar/.test(js))
}

console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
