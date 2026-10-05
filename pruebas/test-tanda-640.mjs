// Tanda 640 — el catálogo desde TCGGO: los ayudantes, la función semanal
// (occidental y japonés) con TCGGO y base de mentira, la foto de TCGGO en
// la cadena, y la guarda de los selects. Sin red.
import { readFileSync, readdirSync } from 'node:fs'
import { baseJpDe, categoriaDe, idDeSetNuevo, filaDeSetNuevo, filaDeCartaTcggo, setDeEpisodio } from '/home/user/pingu/netlify/lib/tcggo.mjs'
import { procesar, CLAVE_ESTADO, semanaDe } from '/home/user/pingu/netlify/functions/tcggo-catalogo.mjs'
import { CLAVE_ESTADO as CLAVE_PARES } from '/home/user/pingu/netlify/functions/tcggo-emparejar.mjs'
import { cadenaDeEscaneo } from '/home/user/pingu/js/escaneo-carta.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const DIR = new URL('./fixtures/', import.meta.url)
const CARTAS = JSON.parse(readFileSync(new URL('tcggo-cards-ejemplo.json', DIR), 'utf8')).data
const AHORA = new Date('2026-10-06T12:00:00Z')

console.log('── 1. Los ayudantes ──')
{
  check('la base japonesa sale de la occidental', baseJpDe('https://cardmarket-api-tcg.p.rapidapi.com/pokemon') === 'https://cardmarket-api-tcg.p.rapidapi.com/pokemon-jp')
  check('su supertype → nuestra categoría', categoriaDe('Pokémon') === 'Pokemon' && categoriaDe('Trainer') === 'Trainer' && categoriaDe('Energy') === 'Energy' && categoriaDe(null) === null)
  check('el id de un set nuevo: su código en minúsculas si está libre, si no tg-<id>', idDeSetNuevo({ id: 415, codigo: 'PBL' }, ['sv01']) === 'pbl' && idDeSetNuevo({ id: 415, codigo: 'PBL' }, ['pbl']) === 'tg-415' && idDeSetNuevo({ id: 9, codigo: null }, []) === 'tg-9')
  const set = filaDeSetNuevo({ id: 415, nombre: 'Pitch Black', codigo: 'PBL', cartas: 120, fecha: '2026-07-17', logo: 'https://images.tcggo.com/x.png' }, [])
  check('la fila de un set nuevo', set.id === 'pbl' && set.name === 'Pitch Black' && set.tcg_online_code === 'PBL' && set.release_date === '2026-07-17' && set.card_count_total === 120 && set.logo_tcggo === 'https://images.tcggo.com/x.png' && set.tcggo_id === 415, JSON.stringify(set))
  const tropius = CARTAS[0]
  const nueva = filaDeCartaTcggo(tropius, { setId: 'me05' })
  check('una carta NUEVA: id tcggo-<id>, su número, su nombre, sus ids y su foto', nueva.id === 'tcggo-49770' && nueva.set_id === 'me05' && nueva.local_id === '1' && nueva.name === 'Tropius' && nueva.name_en === 'Tropius' && nueva.cm_id_product === 895789 && nueva.tp_id_product === 704758 && nueva.image_tcggo === tropius.image && nueva.rarity_en === 'Common' && nueva.tcggo_id === 49770, JSON.stringify(nueva))
  const nuestra = filaDeCartaTcggo(tropius, { setId: 'x', nuestra: { id: 'me05-1', set_id: 'me05', local_id: '001', name: 'Tropius ES' } })
  check('  …y con la nuestra, conserva NUESTRO id, número, nombre y set', nuestra.id === 'me05-1' && nuestra.set_id === 'me05' && nuestra.local_id === '001' && nuestra.name === 'Tropius ES' && nuestra.name_en === 'Tropius' && nuestra.tcggo_id === 49770, JSON.stringify(nuestra))
  check('hp y artista, cuando vienen', filaDeCartaTcggo({ id: 1, hp: 120, artist: { name: 'Akira Egawa' }, supertype: 'Pokémon' }, { setId: 'x' }).hp === 120 && filaDeCartaTcggo({ id: 1, artist: { name: 'Akira Egawa' } }, { setId: 'x' }).illustrator === 'Akira Egawa' && filaDeCartaTcggo({ id: 1, hp: null }, { setId: 'x' }).hp === null)
  const SETS_JP = [{ id: 'SV1a', name: 'トリプレットビート', name_en: 'Triplet Beat', tcg_online_code: null }, { id: 'SV2a', name: 'ポケモンカード151', name_en: 'Pokémon Card 151', tcg_online_code: null }]
  check('qué set nuestro es una expansión japonesa: por el código, aunque nuestro id vaya en otra caja', setDeEpisodio({ id: 7, codigo: 'sv1a', nombre: 'Triplet Beat' }, SETS_JP).set?.id === 'SV1a')
  check('  …o por el nombre inglés', setDeEpisodio({ id: 8, codigo: 'XX', nombre: 'Pokémon Card 151' }, SETS_JP).set?.id === 'SV2a' && setDeEpisodio({ id: 8, codigo: 'XX', nombre: 'Pokémon Card 151' }, SETS_JP).por === 'nombre')
  check('  …y sin ninguno, nada', setDeEpisodio({ id: 9, codigo: 'ZZ', nombre: 'Otra' }, SETS_JP).set === null)
}

console.log('── 2. La función: occidental y japonés ──')
{
  const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', TCGGO_PAUSA_MS: '0', TCGGO_TOPE_DIARIO: '14000' }
  const PARES = {
    episodios: { fecha: '2026-10-05T10:00:00Z', lista: [{ id: 415, nombre: 'Pitch Black', codigo: 'PBL', cartas: 120 }, { id: 20, nombre: 'Scarlet & Violet Energies', codigo: 'SVE', cartas: 0 }, { id: 36, nombre: 'Celebrations: Classic Collection', codigo: 'CEL', cartas: 25 }] },
    hechos: { me05: { episodio: 415, pares: 20 } },
  }
  const EPS_JP = [{ id: 701, name: 'Triplet Beat', code: 'SV1a', cards_total: 3, released_at: '2023-03-10', logo: 'https://images.tcggo.com/sv1a.png' }, { id: 702, name: 'Abyss Eye', code: 'M5', cards_total: 2, released_at: '2026-07-17', logo: null }]
  // Nuestras cartas: en me05, dos con par propio y una sin; en SV1a, dos por número; sin set para M5.
  const NUESTRAS = {
    WEST: { me05: [{ id: 'me05-1', set_id: 'me05', local_id: '1', name: 'Tropius', cm_id_product_propio: 895789 }, { id: 'me05-2', set_id: 'me05', local_id: '2', name: 'Grubbin', cm_id_product_propio: 895790 }, { id: 'me05-3', set_id: 'me05', local_id: '3', name: 'Charjabug', cm_id_product_propio: null }] },
    JP: { SV1a: [{ id: 'SV1a-001', set_id: 'SV1a', local_id: '001', name: 'タロップ', cm_id_product_propio: null }, { id: 'SV1a-002', set_id: 'SV1a', local_id: '002', name: 'ワカシャモ', cm_id_product_propio: null }] },
  }
  const SETS = { WEST: [{ id: 'me05', name: 'Negro Absoluto', name_en: 'Pitch Black', tcg_online_code: 'PBL' }, { id: 'cel25cc', name: 'Celebrations Classic Collection', name_en: 'Celebrations Classic Collection', tcg_online_code: 'CEL' }], JP: [{ id: 'SV1a', name: 'トリプレットビート', name_en: 'Triplet Beat', tcg_online_code: null }] }
  function montar(estadoInicial = {}) {
    const estados = { [CLAVE_PARES]: JSON.parse(JSON.stringify(PARES)), [CLAVE_ESTADO]: estadoInicial }
    const cartas = []
    const sets = []
    const urls = []
    const fetchImpl = async (url) => {
      urls.push(url)
      const u = new URL(url)
      const jp = /pokemon-jp/.test(u.pathname)
      const page = (data) => ({ ok: true, status: 200, text: async () => JSON.stringify({ data, paging: { current: 1, total: 1, per_page: 100 } }) })
      if (u.pathname.endsWith('/episodes')) return page(jp ? EPS_JP : [])
      const ep = Number(u.searchParams.get('episode_id'))
      if (ep === 415) return page([...CARTAS.slice(0, 3), { id: 49999, name: 'Tropius', card_number: '1', cardmarket_id: 999001, tcgplayer_id: 1, image: 'https://images.tcggo.com/tropius-staff.png', rarity: 'Promo' }])
      if (ep === 36) return page([{ id: 60001, name: 'Charizard', card_number: '4', cardmarket_id: 600001, image: 'https://images.tcggo.com/cc4.png' }])
      if (ep === 701) return page([{ id: 70001, name: 'Tarountula', card_number: '001', cardmarket_id: 700001 }, { id: 70002, name: 'Quaxly', card_number: '002', cardmarket_id: 700002 }, { id: 70003, name: 'Quaxly', card_number: '003', cardmarket_id: 700003 }])
      if (ep === 702) return page([{ id: 70011, name: 'Mew ex', card_number: '001', cardmarket_id: 700011 }, { id: 70012, name: 'Mew', card_number: '002', cardmarket_id: 700012 }])
      return { ok: false, status: 404, text: async () => 'no' }
    }
    const restImpl = async (ruta) => {
      const m = ruta.match(/market=eq\.(\w+)/)
      const mercado = m?.[1]
      if (ruta.startsWith('tcg_sets?')) return SETS[mercado]
      const s = ruta.match(/set_id=in\.\(([^)]*)\)/)
      if (s) {
        const ids = s[1].split(',').map((x) => decodeURIComponent(x.replace(/"/g, '')))
        return ids.flatMap((id) => NUESTRAS[mercado]?.[id] || [])
      }
      throw new Error(`ruta inesperada ${ruta}`)
    }
    return {
      estados, cartas, sets, urls, fetchImpl, restImpl,
      guardarCartasImpl: async (filas, mercado) => { cartas.push(...filas.map((f) => ({ ...f, market: mercado }))); return filas.length },
      crearSetsImpl: async (filas, mercado) => { sets.push(...filas.map((f) => ({ ...f, market: mercado }))); return filas.length },
      estadoImpl: async (clave) => estados[clave],
      guardarEstadoImpl: async (clave, valor) => { estados[clave] = JSON.parse(JSON.stringify(valor)) },
    }
  }
  const sinPausa = async () => {}
  const b = montar()
  const r = await procesar({ env: ENV, ...b, pausa: sinPausa, ahora: AHORA })
  check('una pasada hace las dos expansiones occidentales con cartas, la vacía, y las dos japonesas', r.ok && r.hecho === true && r.hechas.WEST === 3 && r.hechas.JP === 2 && r.quedan === 0, JSON.stringify(r).slice(0, 300))
  check('peticiones: 2 cartas WEST + 1 episodios JP + 2 cartas JP = 5 (la vacía no se pide)', r.peticionesEstaPasada === 5, String(r.peticionesEstaPasada))
  const pbl = r.esteTurno.find((t) => t.episodio === 415)
  check('Pitch Black: 2 casadas por el id de Cardmarket, 1 por número, 1 NUEVA (la variante staff)', pbl?.casadas === 3 && pbl.nuevas === 1 && pbl.nuestrasSinSuya === 0, JSON.stringify(pbl))
  const tropius = b.cartas.find((c) => c.id === 'me05-1')
  check('  …la nuestra conserva su id y gana el tcggo_id, la foto y los ids', tropius?.tcggo_id === 49770 && tropius.image_tcggo === CARTAS[0].image && tropius.cm_id_product === 895789 && tropius.name === 'Tropius', JSON.stringify(tropius))
  const charjabug = b.cartas.find((c) => c.id === 'me05-3')
  check('  …la casada por número gana el id de Cardmarket que le faltaba', charjabug?.cm_id_product === 895791 && charjabug.tcggo_id === CARTAS[2].id, JSON.stringify(charjabug))
  const staff = b.cartas.find((c) => c.id === 'tcggo-49999')
  check('  …y la variante se crea en me05 con su foto y su número', staff?.set_id === 'me05' && staff.local_id === '1' && staff.image_tcggo === 'https://images.tcggo.com/tropius-staff.png' && staff.market === 'WEST', JSON.stringify(staff))
  const cc = r.esteTurno.find((t) => t.episodio === 36)
  check('Celebrations Classic (sin par de antes) encuentra cel25cc por el nombre y crea su carta allí', cc?.sets?.[0] === 'cel25cc' && cc.nuevas === 1 && b.cartas.find((c) => c.id === 'tcggo-60001')?.set_id === 'cel25cc', JSON.stringify(cc))
  check('la expansión vacía se apunta sin gastar', r.esteTurno.find((t) => t.episodio === 20)?.nota === 'vacía')
  const sv1a = r.esteTurno.find((t) => t.episodio === 701)
  check('Japón: Triplet Beat casa con nuestro SV1a por el código y sus dos cartas por número («001»)', sv1a?.sets?.[0] === 'SV1a' && sv1a.casadas === 2 && sv1a.nuevas === 1 && b.cartas.find((c) => c.id === 'SV1a-001')?.cm_id_product === 700001, JSON.stringify(sv1a))
  check('  …y la tercera se crea en SV1a, en el mercado JP', b.cartas.find((c) => c.id === 'tcggo-70003')?.set_id === 'SV1a' && b.cartas.find((c) => c.id === 'tcggo-70003').market === 'JP')
  const m5 = r.esteTurno.find((t) => t.episodio === 702)
  check('Abyss Eye no existía: se crea el set «m5» en JP con su fecha y sus dos cartas', m5?.setNuevo === 'm5' && b.sets[0]?.id === 'm5' && b.sets[0].market === 'JP' && b.sets[0].release_date === '2026-07-17' && m5.nuevas === 2 && r.setsCreados === 1, JSON.stringify([m5, b.sets]))
  check('las expansiones japonesas quedan guardadas una semana', b.estados[CLAVE_ESTADO].episodiosJp?.lista?.length === 2 && b.estados[CLAVE_ESTADO].semana === semanaDe(AHORA))
  const antes = b.urls.length
  const r2 = await procesar({ env: ENV, ...b, pausa: sinPausa, ahora: AHORA })
  check('la segunda pasada de la semana no pide nada', r2.ok && r2.hecho === true && b.urls.length === antes && r2.peticionesEstaPasada === 0)
  const r3 = await procesar({ env: ENV, ...b, pausa: sinPausa, ahora: new Date('2026-10-13T12:00:00Z') })
  check('a la semana siguiente vuelve a empezar (y las expansiones JP, aún frescas, no se piden)', r3.ok && r3.hechas.WEST === 3 && r3.peticionesEstaPasada === 4, String(r3.peticionesEstaPasada))
  // Sin tiempo: deja para la siguiente.
  let tic = 0
  const b4 = montar()
  const r4 = await procesar({ env: ENV, ...b4, pausa: sinPausa, ahora: AHORA, reloj: () => (tic++ > 3 ? 1e9 : 0) })
  check('sin tiempo, deja expansiones y lo dice', r4.ok && r4.hecho === false && r4.quedan >= 1 && /próxima pasada/.test(r4.nota || ''), JSON.stringify([r4.hecho, r4.quedan]))
  // Sin pares del emparejador: WEST espera, JP sigue.
  const b5 = montar()
  b5.estados[CLAVE_PARES] = {}
  const r5 = await procesar({ env: ENV, ...b5, pausa: sinPausa, ahora: AHORA })
  check('sin la lista del emparejador, lo occidental espera (no se da por hecho) y lo japonés se hace', r5.ok && r5.hecho === false && r5.hechas.JP === 2 && r5.hechas.WEST === 0, JSON.stringify(r5.hechas))
  // Sin la migración.
  const b6 = montar()
  b6.guardarCartasImpl = async () => { throw new Error('Could not find the function public.tcggo_guardar_cartas (PGRST202)') }
  check('sin la migración se salta nombrándola', /tcggo-catalogo\.sql/.test((await procesar({ env: ENV, ...b6, pausa: sinPausa, ahora: AHORA })).saltado || ''))
}

console.log('── 3. La foto de TCGGO en la cadena ──')
{
  const cadena = cadenaDeEscaneo({ id: 'x', market: 'WEST', set_id: 'sv1', local_id: '1', image_path: 'sv/sv1/1', image_tcggo: 'https://images.tcggo.com/x.png' }, 'SVI')
  const i = cadena.indexOf('https://images.tcggo.com/x.png')
  check('va detrás del espejo de TCGdex y delante de Limitless', i > 0 && /assets\.tcgdex\.net/.test(cadena[i - 1]) && /limitless/.test(cadena[i + 1] || ''), JSON.stringify(cadena))
  const solo = cadenaDeEscaneo({ id: 'tcggo-9', market: 'JP', set_id: 'm5', local_id: '001', image_path: null, image_tcggo: 'https://images.tcggo.com/m5-1.png' })
  check('una carta creada por TCGGO (sin TCGdex) tiene su foto', solo.includes('https://images.tcggo.com/m5-1.png'))
  check('sin foto de TCGGO, nada cambia', !cadenaDeEscaneo({ id: 'x', market: 'WEST', set_id: 'sv1', local_id: '1', image_path: 'sv/sv1/1' }, 'SVI').some((u) => /tcggo/.test(u)))
}

console.log('── 4. La guarda de los selects: donde se pide image_scrydex se pide image_tcggo ──')
{
  const ficheros = []
  const recorrer = (dir) => { for (const f of readdirSync(dir, { withFileTypes: true })) { if (f.isDirectory()) recorrer(`${dir}/${f.name}`); else if (f.name.endsWith('.js')) ficheros.push(`${dir}/${f.name}`) } }
  recorrer('/home/user/pingu/js')
  const malos = []
  for (const f of ficheros) {
    const s = readFileSync(f, 'utf8')
    for (const m of s.matchAll(/'([^'\n]*\bimage_scrydex\b[^'\n]*)'/g)) {
      if (!m[1].includes('image_tcggo')) malos.push(`${f.replace('/home/user/pingu/', '')}: ${m[1].slice(0, 60)}`)
    }
  }
  check('ninguna lista de columnas con image_scrydex sin image_tcggo', malos.length === 0, malos.join(' | '))
  const sql = readFileSync('/home/user/pingu/supabase-migration-tcggo-catalogo.sql', 'utf8')
  check('la migración: las columnas, las dos funciones, y las creadas no las visita TCGdex', /add column if not exists image_tcggo/.test(sql) && /tcggo_crear_sets/.test(sql) && /tcggo_guardar_cartas/.test(sql) && /'tcggo', now\(\), now\(\), 'tcggo'/.test(sql) && /on conflict \(id, market\) do update/.test(sql))
  check('  …y lo nuestro no se pisa: coalesce(tcg_cards.x, excluded.x)', /rarity_en = coalesce\(tcg_cards\.rarity_en, excluded\.rarity_en\)/.test(sql) && /cm_id_product_propio = coalesce\(tcg_cards\.cm_id_product_propio, excluded\.cm_id_product_propio\)/.test(sql))
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
