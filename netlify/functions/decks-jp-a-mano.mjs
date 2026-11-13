// LOS DECKS JAPONESES A MANO (884): el Silver Deck Kit, y los que vengan.
//
// Un usuario con un わるいカイリュー 014/020 que no está en PokeDoc. Es del
// Silver Deck Kit (構築済みデッキ ロケット団ハーフデッキW -silver-, 2004-10-15,
// 20 cartas, solo Japón): TCGGO no tiene los decks, TCGdex tampoco (su base
// de datos, clonada y mirada fichero a fichero: la era PCG está sin ningún
// deck kit) y Scrydex no se sabe desde aquí. PINGU: «saca la info tú e
// intenta escribirlo como puedas».
//
// Así que la lista va ESCRITA (`DECKS`): número, nombre japonés, nombre
// inglés y de qué carta occidental se copia la ficha. Las veinte del Silver
// Deck Kit son reimpresiones de EX Team Rocket Returns (nuestro `ex7`), que
// ya tenemos entera con sus textos: la Dark Dragonite 014/020 es la 15/109
// (Nakaoka, 120 PS, Dark Trance, Double Wing Attack, Claw Swipe), y así las
// demás. Potion y Energy Search no están en ese set: se copian de cualquier
// occidental de la era EX con ese nombre. Lo que NO hay es foto: no se
// inventa ninguna (la 441), la casilla enseña el nombre.
//
// Orden con las otras fuentes, para no duplicar:
//   · si ya hay un set japonés con ese nombre (o esa fecha y esa cuenta),
//     no se crea: lo trajo TCGGO, Scrydex (883) o esta misma función;
//   · si `scrydex-decks-jp` ya tiene su lista y Scrydex LISTA el deck, se
//     deja que lo traiga ella (con fotos, que es mejor); si no está en su
//     lista, se crea aquí; sin lista todavía, se espera unas pasadas.
// Lo creado queda en `conservados` de la 883: el calco no lo esconde y, si
// TCGGO lo trae un día, lo vuelca encima por número.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY.
import { clave as claveDe } from '../lib/scrydex.mjs'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
export const CLAVE_ESTADO = 'decks_jp_a_mano'
export const CLAVE_DECKS_SCRYDEX = 'scrydex_decks_jp'
export const MERCADO = 'JP'
export const MAXIMO_INTENTOS = 3
export const ESPERAS_MAXIMAS = 6

// Las columnas de la ficha que se copian de la carta occidental. Todas
// existen en `tcg_cards` (las migraciones de detalle y de la Pokédex).
export const COLUMNAS_COPIADAS = ['category', 'hp', 'types', 'stage', 'evolve_from', 'retreat', 'attacks', 'abilities', 'weaknesses', 'resistances', 'trainer_type', 'energy_type', 'suffix', 'rarity', 'rarity_en', 'illustrator', 'description', 'dex_ids', 'detalle_lang', 'variants']
const SELECT_WEST = `id,name,name_en,${COLUMNAS_COPIADAS.join(',')}`

export const DECKS = [
  {
    clave: 'pcg-silver_ja',
    set: {
      id: 'pcg-silver_ja', name: 'ロケット団ハーフデッキW -silver-', name_en: 'Silver Deck Kit',
      release_date: '2004-10-15', card_count_official: 20, card_count_total: 20,
      // La serie se copia del set japonés que salió el mismo día (Rocket
      // Gang Strikes Back): es su era.
      serieDe: { name_en: 'Rocket Gang Strikes Back', release_date: '2004-10-15' },
    },
    // `de`: la carta occidental de la que se copia la ficha (TCGdex,
    // data/EX/Team Rocket Returns: 70 Psyduck, 65 Magikarp, 35 Dark Golduck,
    // 36 Dark Gyarados, 66 Magnemite, 39 Dark Magneton, 71 Rattata, 52 y 53
    // Dratini, 96 Rocket's Articuno ex, 31 y 32 Dark Dragonair, 15 Dark
    // Dragonite, 89 Rocket's Poké Ball, 86 Rocket's Admin., 88 Rocket's
    // Mission, 95 R Energy). `buscar`: por nombre en la era EX.
    cartas: [
      { n: '001', ja: 'コダック', en: 'Psyduck', de: 'ex7-70' },
      { n: '002', ja: 'コイキング', en: 'Magikarp', de: 'ex7-65' },
      { n: '003', ja: 'わるいゴルダック', en: 'Dark Golduck', de: 'ex7-35' },
      { n: '004', ja: 'わるいギャラドス', en: 'Dark Gyarados', de: 'ex7-36' },
      { n: '005', ja: 'コイル', en: 'Magnemite', de: 'ex7-66' },
      { n: '006', ja: 'わるいレアコイル', en: 'Dark Magneton', de: 'ex7-39' },
      { n: '007', ja: 'コラッタ', en: 'Rattata', de: 'ex7-71' },
      { n: '008', ja: 'ミニリュウ', en: 'Dratini', de: 'ex7-52' },
      { n: '009', ja: 'ミニリュウ', en: 'Dratini', de: 'ex7-53' },
      { n: '010', ja: 'ロケット団のフリーザーex', en: "Rocket's Articuno ex", de: 'ex7-96', holo: true },
      { n: '011', ja: 'わるいハクリュー', en: 'Dark Dragonair', de: 'ex7-31' },
      { n: '012', ja: 'わるいハクリュー', en: 'Dark Dragonair', de: 'ex7-32' },
      { n: '013', ja: 'わるいカイリュー', en: 'Dark Dragonite', de: 'ex7-15' },
      { n: '014', ja: 'わるいカイリュー', en: 'Dark Dragonite', de: 'ex7-15', holo: true },
      { n: '015', ja: 'エネルギーサーチ', en: 'Energy Search', buscar: 'Energy Search', category: 'Trainer', trainer_type: 'Item', description: 'Search your deck for a basic Energy card, show it to your opponent, and put it into your hand. Shuffle your deck afterward.' },
      { n: '016', ja: 'キズぐすり', en: 'Potion', buscar: 'Potion', category: 'Trainer', trainer_type: 'Item', description: 'Remove 2 damage counters from 1 of your Pokémon.' },
      { n: '017', ja: 'ロケット団のモンスターボール', en: "Rocket's Poké Ball", de: 'ex7-89' },
      { n: '018', ja: 'ロケット団の幹部', en: "Rocket's Admin.", de: 'ex7-86' },
      { n: '019', ja: 'ロケット団の使命', en: "Rocket's Mission", de: 'ex7-88' },
      { n: '020', ja: 'Rエネルギー', en: 'R Energy', de: 'ex7-95' },
    ],
  },
  // LA BARAJA DE TREECKO (950). En el foro: «Treecko Constructed Starter
  // Deck, set no añadido (hay primera edición y unlimited)». キモリデッキ,
  // 2003-01-31, salió con el Expansion Pack; 19 cartas (las tres energías
  // básicas 020–022 van fuera de la cuenta). La lista sale de Bulbapedia,
  // TCGCollector y PokéCardex, que coinciden (desde el contenedor no se
  // llega a ninguna: se leyó por la búsqueda). Las reimpresiones son de EX
  // Ruby & Sapphire (`ex1`), pero allí hay dos Treecko, dos Grovyle, dos
  // Sceptile, tres Makuhita, dos Hariyama, tres Skitty y dos Delcatty: la
  // ficha se copia SOLO donde se sabe cuál es (el Treecko 003 es el 76, dice
  // Bulbapedia; Scyther ex y los entrenadores solo tienen una). Las demás
  // nacen con número y nombre, sin ficha ni foto inventada (la 441).
  {
    clave: 'adv-treecko_ja',
    set: {
      id: 'adv-treecko_ja', name: 'キモリデッキ', name_en: 'Treecko Constructed Starter Deck',
      release_date: '2003-01-31', card_count_official: 19, card_count_total: 19,
      serieDe: { name_en: 'Expansion Pack', release_date: '2003-01-31' },
    },
    cartas: [
      { n: '001', ja: 'ストライクex', en: 'Scyther ex', de: 'ex1-102', holo: true },
      { n: '002', ja: 'キモリ', en: 'Treecko' },
      { n: '003', ja: 'キモリ', en: 'Treecko', de: 'ex1-76' },
      { n: '004', ja: 'ジュプトル', en: 'Grovyle' },
      { n: '005', ja: 'ジュプトル', en: 'Grovyle' },
      { n: '006', ja: 'ジュカイン', en: 'Sceptile' },
      { n: '007', ja: 'マクノシタ', en: 'Makuhita' },
      { n: '008', ja: 'マクノシタ', en: 'Makuhita' },
      { n: '009', ja: 'ハリテヤマ', en: 'Hariyama' },
      { n: '010', ja: 'エネコ', en: 'Skitty' },
      { n: '011', ja: 'エネコ', en: 'Skitty' },
      { n: '012', ja: 'エネコロロ', en: 'Delcatty' },
      { n: '013', ja: 'エネルギーサーチ', en: 'Energy Search', de: 'ex1-90' },
      { n: '014', ja: 'エネルギーリムーブ2', en: 'Energy Removal 2', de: 'ex1-80' },
      { n: '015', ja: 'キズぐすり', en: 'Potion', de: 'ex1-91' },
      { n: '016', ja: 'ポケナビ', en: 'PokéNav', de: 'ex1-88' },
      { n: '017', ja: 'モンスターボール', en: 'Poké Ball', de: 'ex1-86' },
      { n: '018', ja: 'オダマキ博士', en: 'Professor Birch', de: 'ex1-89' },
      { n: '019', ja: 'ラムのみ', en: 'Lum Berry', de: 'ex1-84' },
    ],
  },  // ── Las de Sergio.M en el foro (957) ──
  // スターターセットVSTAR ルカリオ (sLL): la lista es la de TCGdex
  // (data-asia/S/SLL, nombres en japonés y chino) con el inglés de Bulbapedia;
  // la Energía Lucha básica no lleva número. Sin `de`: no hay una ficha
  // occidental comprobada de la que copiar, y se pone a mano.
  {
    clave: 'sll_ja',
    set: {
      id: 'sll_ja', name: 'スターターセットVSTAR ルカリオ', name_en: 'Starter Set VSTAR Lucario',
      release_date: '2022-02-25', card_count_official: 21, card_count_total: 21,
      serieDe: { name_en: 'Star Birth', release_date: '2022-01-14' },
    },
    cartas: [
      { n: '001', ja: 'ストライク', en: 'Scyther' },
      { n: '002', ja: 'アサナン', en: 'Meditite' },
      { n: '003', ja: 'チャーレム', en: 'Medicham' },
      { n: '004', ja: 'ルカリオV', en: 'Lucario V', holo: true },
      { n: '005', ja: 'ルカリオVSTAR', en: 'Lucario VSTAR', holo: true },
      { n: '006', ja: 'ランドロス', en: 'Landorus' },
      { n: '007', ja: 'イワンコ', en: 'Rockruff' },
      { n: '008', ja: 'タイレーツ', en: 'Falinks' },
      { n: '009', ja: 'バサギリ', en: 'Kleavor' },
      { n: '010', ja: 'クロバットV', en: 'Crobat V', holo: true },
      { n: '011', ja: 'ガッツのつるはし', en: 'Gutsy Pickaxe' },
      { n: '012', ja: 'クイックボール', en: 'Quick Ball' },
      { n: '013', ja: 'ハイパーボール', en: 'Ultra Ball' },
      { n: '014', ja: 'ポケモンいれかえ', en: 'Switch' },
      { n: '015', ja: 'こだわりベルト', en: 'Choice Belt' },
      { n: '016', ja: 'サナ', en: 'Shauna' },
      { n: '017', ja: 'ジュン', en: 'Barry' },
      { n: '018', ja: 'シロナの覇気', en: "Cynthia's Ambition" },
      { n: '019', ja: '博士の研究（ナナカマド博士）', en: "Professor's Research (Professor Rowan)" },
      { n: '020', ja: 'ボスの指令（アカギ）', en: "Boss's Orders (Cyrus)" },
      { n: '021', ja: 'ダブルターボエネルギー', en: 'Double Turbo Energy' },
    ],
  },
  // バトル強化デッキ ゼクロムEX (BKZ): la lista de Bulbapedia (18 con número;
  // las Energías básicas no llevan). La fecha no la pongo: Bulbapedia y
  // PokeInvesting no dicen la misma, y se pone desde /admin.
  {
    clave: 'bkz_ja',
    set: {
      id: 'bkz_ja', name: 'バトル強化デッキ ゼクロムEX', name_en: 'Zekrom-EX Battle Strength Deck',
      release_date: null, card_count_official: 18, card_count_total: 18,
      serieDe: { name_en: 'Dark Rush', release_date: '2011-12-16' },
    },
    cartas: [
      { n: '001', ja: 'ストライク', en: 'Scyther' },
      { n: '002', ja: 'リーフィア', en: 'Leafeon' },
      { n: '003', ja: 'イシズマイ', en: 'Dwebble' },
      { n: '004', ja: 'イワパレス', en: 'Crustle' },
      { n: '005', ja: 'コリンク', en: 'Shinx' },
      { n: '006', ja: 'ルクシオ', en: 'Luxio' },
      { n: '007', ja: 'エモンガ', en: 'Emolga' },
      { n: '008', ja: 'シビシラス', en: 'Tynamo' },
      { n: '009', ja: 'ゼクロムEX', en: 'Zekrom-EX', holo: true },
      { n: '010', ja: 'イーブイ', en: 'Eevee' },
      { n: '011', ja: 'ハイパーボール', en: 'Ultra Ball' },
      { n: '012', ja: 'ポケモンいれかえ', en: 'Switch' },
      { n: '013', ja: 'ポケモンキャッチャー', en: 'Pokémon Catcher' },
      { n: '014', ja: 'ランダムレシーバー', en: 'Random Receiver' },
      { n: '015', ja: 'アララギ博士', en: 'Professor Juniper' },
      { n: '016', ja: 'N', en: 'N' },
      { n: '017', ja: 'チェレン', en: 'Cheren' },
      { n: '018', ja: 'ダブル無色エネルギー', en: 'Double Colorless Energy' },
    ],
  },
  // El pack de McDonald's de 2002 (1158, PINGU con la lista de Dex delante):
  // 18 cartas de la era e-Card, solo Japón, que no tienen ni TCGGO ni TCGdex
  // (su base de datos, mirada fichero a fichero: ni en e-Card ni en las
  // promos). No son reimpresiones: no se copia ficha, va lo que se lee en la
  // carta (nombre, tipo, PS y su Pokédex). Holo o normal, como en Dex. Sin
  // foto ni fecha ni precio inventados: la foto y el id de producto de
  // Cardmarket se ponen en /admin → Colecciones (con el id, el precio lo pone
  // cada día `cardmarket-precios-jp`). `soloAMano`: no espera a Scrydex.
  {
    clave: 'mcd-e-minimum_ja',
    soloAMano: true,
    set: {
      id: 'mcd-e-minimum_ja', name: "McDonald's Pokémon-e Minimum Pack", name_en: "McDonald's Pokémon-e Minimum Pack",
      release_date: null, card_count_official: 18, card_count_total: 18,
      serieDe: { name_en: 'Expedition Expansion Pack', release_date: '2001-12-01' },
    },
    cartas: [
      ['001', 'フシギダネ', 'Bulbasaur', 'Grass', 50, 1, false],
      ['002', 'ナゾノクサ', 'Oddish', 'Grass', 50, 43, false],
      ['003', 'チコリータ', 'Chikorita', 'Grass', 50, 152, true],
      ['004', 'ヒトカゲ', 'Charmander', 'Fire', 50, 4, true],
      ['005', 'ロコン', 'Vulpix', 'Fire', 50, 37, false],
      ['006', 'ヒノアラシ', 'Cyndaquil', 'Fire', 50, 155, false],
      ['007', 'ゼニガメ', 'Squirtle', 'Water', 50, 7, true],
      ['008', 'ワニノコ', 'Totodile', 'Water', 50, 158, false],
      ['009', 'マリル', 'Marill', 'Water', 50, 183, false],
      ['010', 'ピカチュウ', 'Pikachu', 'Lightning', 50, 25, true],
      ['011', 'チョンチー', 'Chinchou', 'Lightning', 40, 170, false],
      ['012', 'メリープ', 'Mareep', 'Lightning', 40, 179, false],
      ['013', 'ケーシィ', 'Abra', 'Psychic', 40, 63, false],
      ['014', 'ヤドン', 'Slowpoke', 'Psychic', 40, 79, true],
      ['015', 'ネイティ', 'Natu', 'Psychic', 40, 177, false],
      ['016', 'サンド', 'Sandshrew', 'Fighting', 40, 27, false],
      ['017', 'ゴマゾウ', 'Phanpy', 'Fighting', 50, 231, false],
      ['018', 'ヨーギラス', 'Larvitar', 'Fighting', 50, 246, true],
    ].map(([n, ja, en, tipo, hp, dex, holo]) => ({ n, ja, en, holo, category: 'Pokemon', stage: 'Basic', types: [tipo], hp, dex_ids: [dex] })),
  },
  // El pack de la película de 2009 (1247, PINGU con la lista de Bulbapedia y
  // la de Dex delante): 映画公開記念ランダムパック, 22 cartas, solo Japón, el
  // 18 de julio de 2009 (el estreno de la película de Arceus). Ni TCGGO (el
  // calco no lo ha traído) ni TCGdex (de DP y Platino japonés solo tiene el
  // nombre de los sets, sin cartas). No son reimpresiones: va el número, los
  // dos nombres (con la «M» de película, como lo nombra Cardmarket: así lo
  // encuentra «Buscar en Cardmarket»), el tipo de la lista y su Pokédex. Ni
  // PS ni ataques ni fase: no se inventan. Holo las tres Pichu (009–011) y las
  // tres Arceus (020–022), como en Dex. La era, la de Pt4 (アルセウス光臨, el
  // 8 de julio de 2009). Las fotos las pone PINGU en /admin → «Fotos de todas».
  {
    clave: 'dpt-movie-random_ja',
    soloAMano: true,
    set: {
      id: 'dpt-movie-random_ja', name: '映画公開記念ランダムパック', name_en: 'Movie Commemoration Random Pack',
      release_date: '2009-07-18', card_count_official: 22, card_count_total: 22,
      serieDe: { name_en: 'Advent of Arceus', release_date: '2009-07-08' },
    },
    cartas: [
      ['001', 'チコリータM', 'Chikorita M', 'Grass', 152, false],
      ['002', 'ヘラクロスM', 'Heracross M', 'Grass', 214, false],
      ['003', 'アゲハントM', 'Beautifly M', 'Grass', 267, false],
      ['004', 'ヒノアラシM', 'Cyndaquil M', 'Fire', 155, false],
      ['005', 'ヒードランM', 'Heatran M', 'Fire', 485, false],
      ['006', 'ワニノコM', 'Totodile M', 'Water', 158, false],
      ['007', 'ポッチャマM', 'Piplup M', 'Water', 393, false],
      ['008', 'パルキアM', 'Palkia M', 'Water', 484, false],
      ['009', 'ギザみみピチューM', 'Spiky-eared Pichu M', 'Lightning', 172, true],
      ['010', 'ギザみみピチューM', 'Spiky-eared Pichu M', 'Lightning', 172, true],
      ['011', 'ギザみみピチューM', 'Spiky-eared Pichu M', 'Lightning', 172, true],
      ['012', 'ピカチュウM', 'Pikachu M', 'Lightning', 25, false],
      ['013', 'グレッグルM', 'Croagunk M', 'Psychic', 453, false],
      ['014', 'ギラティナM', 'Giratina M', 'Psychic', 487, false],
      ['015', 'ドータクンM', 'Bronzong M', 'Metal', 437, false],
      ['016', 'ディアルガM', 'Dialga M', 'Metal', 483, false],
      ['017', 'ニャースM', 'Meowth M', 'Colorless', 52, false],
      ['018', 'ムクホークM', 'Staraptor M', 'Colorless', 398, false],
      ['019', 'ミミロルM', 'Buneary M', 'Colorless', 427, false],
      ['020', 'アルセウス', 'Arceus', 'Colorless', 493, true],
      ['021', 'アルセウス', 'Arceus', 'Colorless', 493, true],
      ['022', 'アルセウス', 'Arceus', 'Colorless', 493, true],
    ].map(([n, ja, en, tipo, dex, holo]) => ({ n, ja, en, holo, category: 'Pokemon', types: [tipo], dex_ids: [dex] })),
  },
]

async function rest(ruta, clave, opciones = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...(opciones || {}),
    headers: {
      apikey: clave,
      authorization: `Bearer ${clave}`,
      ...(opciones ? { 'content-type': 'application/json' } : {}),
      ...(opciones && !ruta.startsWith('rpc/') ? { prefer: 'resolution=merge-duplicates,return=minimal' } : {}),
      ...(opciones?.headers || {}),
    },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const texto = await res.text()
  if (!texto) return null
  try { return JSON.parse(texto) } catch { return null }
}

// ── Lo puro ──

// ¿Ya existe ese set entre los nuestros? Por id, por nombre inglés, o por
// el día de salida con la misma cuenta (lo que TCGGO o Scrydex habrían
// creado con otro id).
export function setQueYaExiste(set, sets) {
  const nombre = claveDe(set.name_en)
  return (sets || []).find((s) => s && (s.id === set.id || (nombre && [s.name_en, s.name].some((n) => claveDe(n) === nombre)) || (set.release_date && s.release_date === set.release_date && Number(s.card_count_total) === Number(set.card_count_total)))) || null
}

// ¿Scrydex lista el deck? (de la lista que guarda `scrydex-decks-jp`)
export function loTraeScrydex(set, expansiones) {
  const nombre = claveDe(set.name_en)
  return (expansiones || []).find((e) => e && ((nombre && [e.name_en, e.name].some((n) => claveDe(n) === nombre)) || (set.release_date && String(e.release_date || '').slice(0, 10).replace(/\//g, '-') === set.release_date && Number(e.total) === Number(set.card_count_total)))) || null
}

// Las filas de las cartas: lo escrito a mano y, encima, la ficha copiada
// de la occidental (`porId` y `porNombre` son lo que devolvió la base).
export function filasDelDeck(deck, { porId = new Map(), porNombre = new Map(), ahora = new Date() } = {}) {
  const claves = new Set()
  const filas = deck.cartas.map((c) => {
    const fuente = c.de ? porId.get(c.de) : c.buscar ? porNombre.get(c.buscar) : null
    const fila = {
      id: `${deck.set.id}-${c.n}`, market: MERCADO, set_id: deck.set.id, local_id: c.n,
      name: c.ja, name_en: c.en, origen: 'mano', detalle_at: ahora.toISOString(),
    }
    for (const k of COLUMNAS_COPIADAS) if (fuente && fuente[k] !== undefined && fuente[k] !== null) fila[k] = fuente[k]
    // Lo escrito a mano en la lista manda sobre lo copiado.
    for (const k of COLUMNAS_COPIADAS) if (c[k] !== undefined) fila[k] = c[k]
    if (!fila.detalle_lang) fila.detalle_lang = 'en'
    // La impresión: holo o normal, que es lo que trae un deck.
    fila.variants = c.holo ? { holo: true } : { normal: true }
    fila.copiadaDe = fuente?.id || null
    for (const k of Object.keys(fila)) claves.add(k)
    return fila
  })
  // Las filas de un upsert llevan las mismas claves (la 391): lo que una
  // no tenga va a null, nunca ausente.
  const sinCopiadaDe = filas.map((f) => { const { copiadaDe, ...resto } = f; return resto })
  claves.delete('copiadaDe')
  return {
    filas: sinCopiadaDe.map((f) => Object.fromEntries([...claves].map((k) => [k, f[k] === undefined ? null : f[k]]))),
    copiadas: filas.filter((f) => f.copiadaDe).length,
    sinFuente: filas.filter((f) => !f.copiadaDe).map((f) => f.local_id),
  }
}

export function filaDelSet(deck, serie = null) {
  const s = deck.set
  return {
    id: s.id, market: MERCADO, name: s.name, name_en: s.name_en, release_date: s.release_date,
    card_count_official: s.card_count_official, card_count_total: s.card_count_total,
    serie_id: serie?.serie_id || null, serie_name: serie?.serie_name || null, serie_name_en: serie?.serie_name_en || null,
    tcg_online_code: s.tcg_online_code || null, oculto: false, origen: 'mano',
  }
}

// ── La pasada ──
export async function pasada({ env = process.env, restImpl = null, estadoImpl = null, guardarEstadoImpl = null, ahora = new Date(), decks = DECKS } = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }
  const pedir = restImpl || ((ruta, opciones = null) => rest(ruta, clave, opciones))
  const leerEstado = estadoImpl || (async (k) => (await pedir(`scrydex_estado?select=valor&clave=eq.${k}&limit=1`))?.[0]?.valor || {})
  const guardarEstado = guardarEstadoImpl || ((k, valor) => rest('scrydex_estado', clave, { method: 'POST', body: JSON.stringify([{ clave: k, valor, updated_at: new Date().toISOString() }]) }))

  let estado
  let deScrydex
  try {
    estado = await leerEstado(CLAVE_ESTADO)
    deScrydex = await leerEstado(CLAVE_DECKS_SCRYDEX)
  } catch (e) {
    const m = String(e?.message || e)
    if (/42P01|scrydex_estado/.test(m)) return { ok: true, saltado: 'falta ejecutar supabase-migration-scrydex-cartas.sql (scrydex_estado)' }
    return { ok: false, error: m.slice(0, 200) }
  }
  estado = estado && typeof estado === 'object' ? estado : {}
  for (const k of ['hechos', 'intentos', 'esperas']) if (!estado[k] || typeof estado[k] !== 'object') estado[k] = {}
  const persistir = () => guardarEstado(CLAVE_ESTADO, estado)
  const pendiente = decks.find((d) => !estado.hechos[d.clave] && (Number(estado.intentos[d.clave]) || 0) < MAXIMO_INTENTOS)
  if (!pendiente) return { ok: true, hecho: true, hechos: estado.hechos }

  let sets
  try {
    sets = (await pedir(`tcg_sets?select=id,name,name_en,release_date,card_count_total,serie_id,serie_name,serie_name_en,oculto&market=eq.${MERCADO}&limit=2000`)) || []
  } catch (e) {
    return { ok: false, error: `nuestra base: ${String(e?.message || e).slice(0, 160)}` }
  }
  const yaExiste = setQueYaExiste(pendiente.set, sets)
  if (yaExiste) {
    estado.hechos[pendiente.clave] = { fecha: ahora.toISOString(), estado: 'yaExiste', set: yaExiste.id }
    await persistir()
    return { ok: true, clave: pendiente.clave, yaExiste: yaExiste.id }
  }
  // Scrydex primero, si lo tiene: trae fotos. Lo que no es un deck
  // (`soloAMano`, 1158) no espera a nadie.
  const lista = !pendiente.soloAMano && Array.isArray(deScrydex?.lista?.expansiones) ? deScrydex.lista.expansiones : null
  if (pendiente.soloAMano) {
    // nada que esperar
  } else if (lista) {
    const suya = loTraeScrydex(pendiente.set, lista)
    if (suya) {
      estado.hechos[pendiente.clave] = { fecha: ahora.toISOString(), estado: 'laTraeScrydex', expansion: suya.id }
      await persistir()
      return { ok: true, clave: pendiente.clave, laTraeScrydex: suya.id }
    }
  } else if (!deScrydex?.parado) {
    const n = (Number(estado.esperas[pendiente.clave]) || 0) + 1
    estado.esperas[pendiente.clave] = n
    await persistir()
    if (n <= ESPERAS_MAXIMAS) return { ok: true, clave: pendiente.clave, esperando: `a que scrydex-decks-jp traiga su lista (${n} de ${ESPERAS_MAXIMAS})` }
  }

  // Las fichas occidentales de las que se copia.
  const ids = [...new Set(pendiente.cartas.map((c) => c.de).filter(Boolean))]
  const nombres = [...new Set(pendiente.cartas.map((c) => c.buscar).filter(Boolean))]
  const porId = new Map()
  const porNombre = new Map()
  try {
    if (ids.length) for (const f of (await pedir(`tcg_cards?select=${SELECT_WEST}&market=eq.WEST&id=in.(${ids.map((x) => `"${x}"`).join(',')})`)) || []) porId.set(f.id, f)
    for (const nombre of nombres) {
      const f = (await pedir(`tcg_cards?select=${SELECT_WEST}&market=eq.WEST&name_en=eq.${encodeURIComponent(nombre)}&set_id=like.ex*&order=set_id&limit=1`))?.[0] || null
      if (f) porNombre.set(nombre, f)
    }
  } catch (e) {
    return { ok: false, clave: pendiente.clave, error: `nuestra base al leer las occidentales: ${String(e?.message || e).slice(0, 160)}` }
  }
  const { filas, copiadas, sinFuente } = filasDelDeck(pendiente, { porId, porNombre, ahora })
  const serieK = claveDe(pendiente.set.serieDe?.name_en)
  const hermano = sets.find((s) => s.serie_id && ((serieK && [s.name_en, s.name].some((n) => claveDe(n) === serieK)) || (pendiente.set.serieDe?.release_date && s.release_date === pendiente.set.serieDe.release_date))) || null
  const fila = filaDelSet(pendiente, hermano)
  try {
    await pedir('tcg_sets', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify([fila]) })
    await pedir('tcg_cards?on_conflict=id,market', { method: 'POST', body: JSON.stringify(filas) })
    // Conservado (883): el calco no lo esconde.
    const conservados = deScrydex && typeof deScrydex === 'object' ? deScrydex : {}
    conservados.conservados = { ...(conservados.conservados || {}), [fila.id]: { fecha: ahora.toISOString(), por: 'mano', nombre: fila.name_en, cartas: filas.length } }
    await guardarEstado(CLAVE_DECKS_SCRYDEX, conservados)
  } catch (e) {
    const n = (Number(estado.intentos[pendiente.clave]) || 0) + 1
    estado.intentos[pendiente.clave] = n
    estado.ultimoError = { fecha: ahora.toISOString(), clave: pendiente.clave, intento: n, error: `nuestra base: ${String(e?.message || e).slice(0, 160)}` }
    await persistir()
    return { ok: false, clave: pendiente.clave, error: estado.ultimoError.error }
  }
  estado.hechos[pendiente.clave] = { fecha: ahora.toISOString(), estado: 'creado', set: fila.id, cartas: filas.length, copiadas, sinFuente, serie: hermano?.serie_id || null }
  await persistir()
  return { ok: true, clave: pendiente.clave, creado: { set: fila.id, cartas: filas.length, copiadas, sinFuente } }
}

export default async () => {
  const r = await pasada()
  if (!r.ok) console.warn('decks-jp-a-mano:', JSON.stringify(r).slice(0, 400))
  return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } })
}

// Cada diez minutos; con la lista hecha es leer un estado y nada más.
// Más espaciada desde la 1310 (C1 del plan): cada despertar se paga aunque
// no haya nada que hacer, y esta termina su trabajo antes. SCHEMA 1310.
export const config = { schedule: '9 */6 * * *' }
