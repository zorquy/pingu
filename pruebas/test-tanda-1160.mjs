// Tanda 1160 — las MEP 89–92 con su ficha de respaldo y las versiones de la
// 92 (Staff) y la 93 (World Championships, Play! Pokémon Winner, Pokémon
// Game On!). PINGU, con la lista de Bulbapedia: «siguen faltando».
import { pasada, conRespaldo, versionesQueFaltan, idDeVersion, FICHAS_DE_RESPALDO, VERSIONES_EXTRA, BASE_ID_VERSIONES } from '/home/user/pingu/netlify/functions/tcgdex-rellenar-set.mjs'

let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const env = { SUPABASE_SERVICE_ROLE_KEY: 'x' }
const pad = (n) => String(n).padStart(3, '0')

console.log('── Lo puro ──')
{
  check('las cuatro fichas de respaldo, 089–092, con lo de cards-database', FICHAS_DE_RESPALDO.mep.map((f) => f.localId).join() === '089,090,091,092' && FICHAS_DE_RESPALDO.mep[1].name === 'Mega Darkrai ex' && FICHAS_DE_RESPALDO.mep[1].hp === 280 && FICHAS_DE_RESPALDO.mep[3].trainer_type === 'Stadium')
  const sinApi = conRespaldo([], 'mep')
  check('sin la API, salen las cuatro con su id de TCGdex', sinApi.map((c) => c.id).join() === 'mep-089,mep-090,mep-091,mep-092' && sinApi.every((c) => c.respaldo))
  const conApi = conRespaldo([{ id: 'mep-090', localId: '090', name: 'Mega Darkrai ex', image: 'https://assets.tcgdex.net/en/me/mep/090' }], 'mep')
  const d = conApi.find((c) => c.localId === '090')
  check('si la API la trae, manda la API (foto incluida) y se le pone la ficha', conApi.length === 4 && d.image && d.hp === 280 && !d.respaldo)
  check('otro set sin respaldo no cambia', conRespaldo([{ id: 'x-1', localId: '1' }], 'otro').length === 1)
  check('el id de versión es el de la base («Play! Pokémon Winner» = «play-pokemon-winner»)', idDeVersion('Play! Pokémon Winner') === 'play-pokemon-winner' && idDeVersion('Pokémon Game On!') === 'pokemon-game-on')

  const cartas = [{ id: 'tcggo-1', local_id: '092', name: 'Paradise Resort' }, { id: 'tcggo-48518', local_id: '093', name: 'Pikachu' }]
  const { filas, sinCarta } = versionesQueFaltan({ tcgdex: 'mep', mercado: 'WEST', set: 'mep', cartas, existentes: [] })
  check('cuatro versiones: Staff en la 92 y tres en la 93', filas.map((f) => `${f.etiqueta}@${f.card_id}`).join(' | ') === 'Staff@tcggo-1 | World Championships@tcggo-48518 | Play! Pokémon Winner@tcggo-48518 | Pokémon Game On!@tcggo-48518' && !sinCarta.length, filas.map((f) => f.etiqueta).join())
  check('  …de clase «sello» (no cuentan para completar) y con el dibujo de sello', filas.every((f) => f.clase === 'sello' && f.icono === 'sello'))
  check('  …la Staff y la Winner con su producto de Cardmarket (origen tcgdex); las otras, a mano', filas[0].cm_id_product === 905263 && filas[0].origen === 'tcgdex' && filas[2].cm_id_product === 894885 && filas[1].origen === 'mano' && filas[3].origen === 'mano' && filas[1].cm_id_product === null)
  check('  …con ids lejos de la secuencia de /admin', filas.every((f) => f.tcggo_id < BASE_ID_VERSIONES) && new Set(filas.map((f) => f.tcggo_id)).size === 4)
  const otra = versionesQueFaltan({ tcgdex: 'mep', mercado: 'WEST', set: 'mep', cartas, existentes: [{ tcggo_id: -900003, card_id: 'tcggo-48518', etiqueta: 'play pokemon winner' }, { tcggo_id: -5, card_id: 'tcggo-1', etiqueta: 'Staff' }] })
  check('una que ya existe (por su nombre) no se repite, y no se pisa su id', otra.filas.map((f) => f.etiqueta).join() === 'World Championships,Pokémon Game On!' && otra.filas.every((f) => f.tcggo_id < -900003))
  const sin93 = versionesQueFaltan({ tcgdex: 'mep', mercado: 'WEST', set: 'mep', cartas: cartas.slice(0, 1), existentes: [] })
  check('sin la carta 93 en el set, se dice', sin93.sinCarta.join() === '093,093,093' && sin93.filas.length === 1)
  check('la lista es la que pidió PINGU', VERSIONES_EXTRA.mep.length === 4)
}

console.log('── La pasada ──')
{
  // Lo nuestro: 1–88 y 93–110, como en /admin (088 Zarude y 093 Pikachu de TCGGO).
  const nuestras = Array.from({ length: 110 }, (_, i) => i + 1).filter((n) => n < 89 || n > 92).map((n) => ({ id: `tcggo-${48430 + n}`, local_id: pad(n), name: n === 93 ? 'Pikachu' : `Carta ${n}` }))
  const escritas = []
  const versiones = []
  const restImpl = async (ruta, op) => {
    if (op?.method === 'POST' && ruta.startsWith('tcg_cards')) { escritas.push(...JSON.parse(op.body)); return null }
    if (op?.method === 'POST' && ruta.startsWith('tcg_card_versions')) { versiones.push(...JSON.parse(op.body)); return null }
    if (ruta.startsWith('tcg_sets')) return [{ id: 'mep', name: 'MEP Black Star Promos', tcggo_id: 412 }]
    if (ruta.startsWith('tcg_cards?select=id,local_id')) return nuestras
    if (ruta.startsWith('tcg_card_versions?select=tcggo_id,card_id')) return versiones
    return []
  }
  let estado = {}
  const io = { env, restImpl, estadoImpl: async () => estado, guardarEstadoImpl: async (k, v) => { estado = v }, ahora: new Date('2026-11-01T18:00:00Z') }
  // La API de TCGdex todavía sin las nuevas: solo hasta la 088.
  const fetchImpl = async () => ({ ok: true, json: async () => ({ cards: Array.from({ length: 88 }, (_, i) => ({ id: `mep-${pad(i + 1)}`, localId: pad(i + 1), name: `Carta ${i + 1}` })) }) })
  const r = await pasada({ ...io, fetchImpl, forzar: true, clave: 'mep-tcgdex' })
  check('con la API sin ellas, escribe la 89–92 de las fichas de respaldo', r.ok && escritas.map((f) => f.local_id).join() === '089,090,091,092', JSON.stringify(r).slice(0, 300))
  const darkrai = escritas.find((f) => f.local_id === '090')
  check('  …el Darkrai con su ficha, su Cardmarket y sin foto inventada', darkrai.id === 'mep-090' && darkrai.hp === 280 && darkrai.types[0] === 'Darkness' && darkrai.cm_id_product_propio === 903676 && darkrai.image_path === null && darkrai.rarity === 'Promo' && darkrai.variants.holo && darkrai.origen === 'relleno', JSON.stringify(darkrai))
  check('  …Paradise Resort como Estadio', escritas.find((f) => f.local_id === '092')?.trainer_type === 'Stadium')
  check('  …las cuatro versiones: la Staff sobre la 92 recién escrita y tres sobre el Pikachu', versiones.map((v) => `${v.etiqueta}@${v.card_id}`).join(' | ') === 'Staff@mep-092 | World Championships@tcggo-48523 | Play! Pokémon Winner@tcggo-48523 | Pokémon Game On!@tcggo-48523', versiones.map((v) => `${v.etiqueta}@${v.card_id}`).join(' | '))
  check('  …y queda dicho en el estado', estado.hechos['mep-tcgdex'].conFicha === '089, 090, 091, 092' && estado.hechos['mep-tcgdex'].versiones.creadas.length === 4)
  const antes = versiones.length
  escritas.length = 0
  nuestras.push(...[89, 90, 91, 92].map((n) => ({ id: `mep-${pad(n)}`, local_id: pad(n), name: 'x' })))
  const r2 = await pasada({ ...io, fetchImpl, forzar: true, clave: 'mep-tcgdex' })
  check('la segunda vez no escribe ni repite nada', r2.ok && escritas.length === 0 && versiones.length === antes && r2.hecho.versiones.creadas.length === 0, JSON.stringify(r2.hecho.versiones))

  // TCGdex caído: con respaldo, se escribe igual y se avisa.
  nuestras.splice(-4)
  versiones.length = 0
  estado = {}
  const r3 = await pasada({ ...io, fetchImpl: async () => ({ ok: false, status: 503 }), forzar: true, clave: 'mep-tcgdex' })
  check('con TCGdex caído, escribe lo de respaldo y lo avisa', r3.ok && escritas.map((f) => f.local_id).join() === '089,090,091,092' && r3.hecho.avisoTcgdex === 'TCGdex 503' && !estado.intentos['mep-tcgdex'], JSON.stringify(r3.hecho).slice(0, 300))

  // Si escribir versiones falla, las cartas quedan y el fallo se dice.
  escritas.length = 0
  versiones.length = 0
  const mal = async (ruta, op) => { if (op?.method === 'POST' && ruta.startsWith('tcg_card_versions')) throw new Error('Supabase 400: columna'); return restImpl(ruta, op) }
  const r4 = await pasada({ ...io, restImpl: mal, fetchImpl, forzar: true, clave: 'mep-tcgdex' })
  check('si las versiones fallan, las cartas se escriben y el error sale', r4.ok && escritas.length === 4 && /columna/.test(r4.hecho.versiones.error))
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
