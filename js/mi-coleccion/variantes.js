// Qué versiones existen DE VERDAD de una carta (tanda 383).
//
// PINGU quería marcar cada versión por su lado, como hacen las apps de
// coleccionismo. Y no hace falta preguntarle nada a nadie: TCGdex lo
// trae en `card.variants` y el curador ya lo guarda en
// `tcg_cards.variants` desde la tanda 330.
//
// ── POR QUÉ NO SE ENSEÑAN LAS CUATRO SIEMPRE ──
//
// Porque de casi ninguna carta existen las cuatro. Una común de hoy
// tiene normal y reverse; una ultra rara solo holo; las de 1999 tienen
// primera edición y las de ahora no. Ofrecer cuatro casillas en todas
// sería invitar a marcar una versión que no existe — y entonces tu
// colección diría que tienes algo que no se ha impreso nunca.
//
// Lo que NO se sabe tampoco se inventa: si `variants` viene vacío (la
// carta no se ha engordado todavía) se devuelve una sola versión, la
// normal, que es lo que hacía la pantalla antes de esta tanda. Un hueco
// no puede convertirse en «esta carta solo existe en normal».
//
// Sin DOM y sin Supabase: se prueba en Node.
//
// ── Y LAS VERSIONES DE TCGGO (tanda 862) ──
//
// PINGU, con Dex delante y el Drakloak de Ascended Heroes: Normal, Reverse
// Holo y Quick Ball Holo, cada una su casilla, y tener cualquiera cuenta
// como tener la carta. TCGdex solo sabe de cuatro impresiones; los
// patrones de Mega Evolution («Energy Symbol Pattern», «Quick Ball») y
// la Reverse de un set viejo los trae TCGGO en `tcg_card_versions` (861).
// Quien tiene las filas en la mano las pega a la carta (`pegarVersiones` →
// `carta.versiones`) y desde ahí salen como una versión más: su id en la
// colección es la etiqueta en minúsculas con guiones (`quick-ball`), y la
// que no tiene etiqueta —o dice «Reverse Holo»— ES la reverse de siempre.
import { normalizeSearch } from '../texto.js'
import { rarezaEs } from '../rarezas-nombres.js'

// De cómo lo llama TCGdex a cómo lo llamamos nosotros
// (`user_collection.variante`). `wPromo` se deja fuera a propósito: es
// un SELLO impreso en la carta, no una versión que se coleccione
// aparte, y meterlo añadiría una casilla que nadie sabría qué marca.
const EQUIVALE = [
  { suyo: 'normal', nuestro: 'normal', corto: 'N', nombre: 'Normal' },
  { suyo: 'reverse', nuestro: 'reverse', corto: 'RH', nombre: 'Reverse holo' },
  { suyo: 'holo', nuestro: 'holo', corto: 'H', nombre: 'Holo' },
  { suyo: 'firstEdition', nuestro: 'primera', corto: '1.ª', nombre: '1.ª edición' },
]

export const VARIANTE_POR_DEFECTO = 'normal'

// Lo que TCGGO llama una versión, en nuestros ids. Sin etiqueta es la
// Reverse (es lo único que Cardmarket vende aparte dentro del mismo
// producto en un set viejo); lo que no es ninguna de las cuatro, su
// etiqueta hecha id: minúsculas, sin acentos, guiones.
const CLASICAS = { 'reverse holo': 'reverse', reverse: 'reverse', 'reverse holofoil': 'reverse', holo: 'holo', holofoil: 'holo', standard: 'normal', normal: 'normal', '1st edition': 'primera', 'first edition': 'primera' }
export function varianteDeEtiqueta(etiqueta) {
  const t = normalizeSearch(String(etiqueta || '')).replace(/\s+/g, ' ').trim()
  if (!t) return 'reverse'
  if (CLASICAS[t]) return CLASICAS[t]
  return t.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'reverse'
}
export const esClasica = (id) => EQUIVALE.some((e) => e.nuestro === id)

// El nombre exacto de cada versión de TCGGO («Poké Ball», con su acento),
// apuntado al pegarlas; lo que no se ha visto se deshace del id.
const NOMBRES = new Map()
const deId = (id) => String(id || '').split('-').map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p)).join(' ')

// El dibujo elegido para una versión (934), por su id: lo lee
// iconos-version.js. Aquí y no allí: este módulo lo baja medio sitio y los
// iconos solo Mi colección (la 299).
const DIBUJOS_ELEGIDOS = new Map()
export const dibujoElegido = (id) => DIBUJOS_ELEGIDOS.get(id) || null

// Las filas de `tcg_card_versions` de unas cartas, pegadas a cada una
// (`carta.versiones`). Devuelve el mapa por carta.
export function pegarVersiones(cartas, filas) {
  const por = new Map()
  for (const f of filas || []) {
    if (!f?.card_id) continue
    por.set(f.card_id, (por.get(f.card_id) || []).concat([f]))
    const id = varianteDeEtiqueta(f.etiqueta)
    if (f.etiqueta && !esClasica(id)) NOMBRES.set(id, String(f.etiqueta).trim())
    // El dibujo elegido a mano (934).
    if (f.icono) DIBUJOS_ELEGIDOS.set(id, f.icono)
  }
  for (const c of cartas || []) if (c && por.has(c.id)) c.versiones = por.get(c.id)
  return por
}

// La fila de TCGGO de una versión de esta carta, o null (la normal no
// tiene: es la carta misma).
export function versionDeVariante(carta, id) {
  // Con dos filas para la misma (la «1st Edition» de TCGGO y la de edición,
  // 935), la que lleva foto primero: es la que alguien eligió.
  const todas = (carta?.versiones || []).filter((f) => varianteDeEtiqueta(f.etiqueta) === id)
  return todas.find((f) => f.imagen) || todas[0] || null
}

// Todas las que existen en el TCG, para quien quiera ofrecerlas cuando
// no sabe cuáles tiene esta carta.
export const TODAS = EQUIVALE.slice()

// Las versiones de esta carta, en el orden de arriba. Devuelve al menos
// una: una carta sin ninguna versión no se podría guardar.
//
// ── `siNoSeSabe` NO TIENE UN VALOR «OBVIO», POR ESO SE PIDE ──
//
// Cuando `variants` viene vacío —la carta no se ha engordado— hay dos
// respuestas razonables y son OPUESTAS, según para qué se pregunte:
//
//   · Para MARCAR en el álbum, una sola (la normal). Marcar es AFIRMAR
//     que tienes algo, y ofrecer casillas de versiones que a lo mejor no
//     existen invita a apuntar una carta que no se ha impreso nunca.
//   · Para GUARDAR desde la ficha, todas. Ahí la carta la tienes tú en
//     la mano y sabes mejor que nosotros en qué versión: esconderle la
//     opción sería impedirle apuntar lo que de verdad tiene.
//
// Los dos sitios lo hacían por su cuenta y **ya discrepaban** (la ficha
// suponía normal + reverse y el bolsillo solo normal). Un valor por
// defecto habría enterrado la diferencia otra vez, así que se pide: que
// cada pantalla diga en voz alta qué prefiere.
// LAS EXPANSIONES DE LAS QUE TCGGO NO TIENE VERSIONES (947). La sonda de
// Chaos Rising: «122 cartas suyas, 0 con versiones», ni la Reverse de una
// común. Ahí su fila «Standard» no dice «no hay Reverse», dice «no lo sé», y
// mandan las de TCGdex (o las deducidas, que en un set principal aciertan).
// PINGU: «las variantes las traemos de TCGGO; solo para esos dos sets, de
// otro sitio». Solo sets PRINCIPALES: en uno especial (Ascended Heroes,
// Prismatic) la Reverse de TCGdex puede no existir y la regla de la 931 tiene
// razón. Otro set así: la sonda «versiones» de /admin lo dice, y se añade aquí.
export const SETS_SIN_VERSIONES_TCGGO = new Set(['me04', 'me05'])

export function variantesDeCarta(carta, siNoSeSabe = [EQUIVALE[0]]) {
  // Una carta de Wizards con sus EDICIONES (935) no tiene más versiones que
  // esas: el «holo» y la «1.ª edición» de TCGdex son propiedades de la
  // carta, no impresiones aparte (Chansey ofrecía una «Normal» que no
  // existe).
  const ediciones = edicionesDe(carta)
  if (ediciones.length) return ediciones
  const v = carta?.variants
  const dichas = v && typeof v === 'object' ? EQUIVALE.filter((e) => v[e.suyo] === true) : []
  // Lo que la carta no dice se deduce de su expansión y su rareza (922).
  let base = dichas.length ? dichas : variantesDeducidas(carta) || []
  // Y cuando TCGGO ha hablado de la carta, la Reverse es la SUYA (931,
  // PINGU: «saca en todos los sets las variantes que diga TCGGO»). TCGdex
  // marca `reverse` en sets donde la reverse no existe a secas: en Ascended
  // Heroes las reverse SON los patrones (Dusk Ball, energía), y ofrecer
  // además una «Reverse holo» era ofrecer una carta que no se imprimió.
  // Solo la reverse: la normal, la holo y la 1.ª edición TCGGO las da como
  // la carta misma, no como versión.
  // Las de a mano (934) no cuentan: un sello de Pokémon Day no dice nada de
  // si la carta tiene Reverse.
  // Ni las filas que solo llevan una foto (935).
  const deTcggo = (carta?.versiones || []).filter((f) => !f.origen).map((f) => varianteDeEtiqueta(f.etiqueta))
  if (deTcggo.length && !deTcggo.includes('reverse') && !SETS_SIN_VERSIONES_TCGGO.has(String(carta?.set_id || ''))) base = base.filter((e) => e.nuestro !== 'reverse')
  // Y las de TCGGO (862), detrás de las de TCGdex y sin repetir. La fila
  // «Standard» (937) es la carta misma: dice que TCGGO la ha mirado (y con
  // eso la regla de arriba), pero no es una versión más.
  const extras = []
  for (const f of carta?.versiones || []) {
    if (esFilaDeLaCarta(f)) continue
    const id = varianteDeEtiqueta(f.etiqueta)
    if (base.some((e) => e.nuestro === id) || extras.some((e) => e.nuestro === id)) continue
    const e = EQUIVALE.find((x) => x.nuestro === id)
    // La clase (934): una de a mano dice si es una impresión, un sello o una
    // adicional; las de TCGGO no la dicen y son impresiones.
    extras.push(e ? { ...e, clase: f.clase || null } : { suyo: null, nuestro: id, corto: cortoDeVariante(id), nombre: nombreDeVariante(id), clase: f.clase || null })
  }
  if (base.length) return conSuBrillo([...base, ...extras], carta)
  // Si TCGGO la ha mirado (937), ya se sabe: la carta misma y lo que él dé.
  const mirada = (carta?.versiones || []).some(esFilaDeLaCarta)
  // Sin saber nada, la de por defecto es una sola «Normal»; si la rareza dice
  // que brilla, esa una es la «Holo» (953). Las cuatro de «no se sabe», tal cual.
  const soloNormal = Array.isArray(siNoSeSabe) && siNoSeSabe.length === 1 && siNoSeSabe[0] === EQUIVALE[0]
  if (!extras.length) return mirada || soloNormal ? conSuBrillo([EQUIVALE[0]], carta) : siNoSeSabe
  // Solo versiones de TCGGO: la Standard (la carta misma) existe seguro.
  const sin = !mirada && Array.isArray(siNoSeSabe) && siNoSeSabe.length ? siNoSeSabe : [EQUIVALE[0]]
  const todas = [...sin, ...extras.filter((e) => !sin.some((s) => s.nuestro === e.nuestro))]
  return sin === siNoSeSabe ? todas : conSuBrillo(todas, carta)
}

// ── LA QUE BRILLA DE SERIE ES «HOLO», NO «NORMAL» (tanda 950) ──
//
// PINGU, con Dex delante: el Meganium de Lost Thunder es holo y nosotros
// decíamos «Normal y Reverse»; el Shuckle GX y el Celebi ◇, «Normal»; y en
// el japonés, la Serperior R de un set de Mega, «Normal» donde Dex dice
// «Holo». TCGdex no dice versiones de Lost Thunder (su API da las de por
// defecto, normal y reverse) y TCGGO no da ninguna del japonés (su
// «Standard» es «la carta»), pero la RAREZA sí lo sabe: una «Rare Holo»,
// una GX, una Prisma Estelar brillan siempre. Así que si la rareza dice que
// brilla, la carta misma es la Holo, y la «Normal» de la lista se cambia por
// ella; la Reverse y lo demás se quedan. Si la lista ya trae las dos (una
// rara con su no holo de baraja, Pitch Black), no se toca.
//
// La «Rara» a secas brilla según la ÉPOCA, no siempre: en Lost Thunder hay
// raras sin brillo. Desde Escarlata y Púrpura todas las raras son holo en
// el occidental, y en el japonés desde Sol y Luna (SM1, 2016). Sin el día
// del set no se aplica: no saber no es un «brilla».
//
// Y una rareza que brilla SIEMPRE (GX, V, ex, ilustraciones, Prisma Estelar,
// Radiant, ACE SPEC…) no tiene Reverse: en los ficheros de TCGdex, de unas
// 3.000 cartas de esas rarezas con versiones escritas, NINGUNA la tiene; la
// Reverse les llega de las de por defecto de su API (el Celebi ◇ de Lost
// Thunder). Se quita, salvo que TCGGO la dé como versión suya. La «Rare
// Holo» sí tiene Reverse (475 de 608) y se queda.
const RARA_HOLO_DESDE = { WEST: '2023-03-31', JP: '2016-12-09' }
// Lo que dice una rareza que el vocabulario no conoce (954: las de TCGGO
// para el Shiny Vault, «Rare Shiny GX»): no se traduce —una etiqueta
// inventada miente—, pero sus palabras sí dicen si brilla.
const BRILLA_SIEMPRE_EN = /shiny|secret|ultra|rainbow|illustration|hyper|double|radiant|amazing|prism|gold|full art|gallery|\b(gx|v|vmax|vstar|ex|break|lv\.?x|prime|legend|ace)\b/i
const CONOCIDA = /^(Común|Infrecuente|Rara|Promo|Sin rareza)$|^Rara /
// Y una promo no trae rareza que diga nada («Promo»): lo dice su NOMBRE. Una
// EX, GX, V, VMAX, VSTAR, ex, BREAK, LV.X, LEGEND, Prime, ◇ o ☆ brilla
// siempre, también de promo (954, el Mewtwo GX y los EX de las Black Star).
const MECANICA_QUE_BRILLA = /(?:^|[\s-])(EX|GX|V|VMAX|VSTAR|V-UNION|BREAK|LV\.X|LEGEND|Prime)$|\sex$|[◇☆]|^(Radiant|Shining)\s/
function brillaSiempre(carta) {
  const r = rarezaEs(carta?.rarity_en || carta?.rarity)
  if (r && SOLO_HOLO.has(r)) return true
  if (r && !CONOCIDA.test(r)) return BRILLA_SIEMPRE_EN.test(r)
  if (r && r !== 'Promo' && r !== 'Sin rareza') return false
  return MECANICA_QUE_BRILLA.test(String(carta?.name_en || carta?.name || '').trim())
}
export function brillaDeSerie(carta) {
  if (brillaSiempre(carta)) return true
  const r = rarezaEs(carta?.rarity_en || carta?.rarity)
  if (!r) return false
  if (/^Rara Holo\b/.test(r) || (!CONOCIDA.test(r) && /holo/i.test(r))) return true
  if (r !== 'Rara') return false
  const desde = RARA_HOLO_DESDE[carta?.market || 'WEST']
  const dia = String(carta?.tcg_sets?.release_date || carta?.release_date || '').slice(0, 10)
  return Boolean(desde && /^\d{4}-\d{2}-\d{2}$/.test(dia) && dia >= desde)
}
function conSuBrillo(lista, carta) {
  if (!Array.isArray(lista) || !brillaDeSerie(carta)) return lista
  let fuera = lista
  if (fuera.some((e) => e?.nuestro === 'normal') && !fuera.some((e) => e?.nuestro === 'holo')) {
    const holo = EQUIVALE.find((e) => e.nuestro === 'holo')
    fuera = fuera.map((e) => (e?.nuestro === 'normal' ? holo : e))
  } else if (fuera.some((e) => e?.nuestro === 'normal') && !(carta?.variants?.normal === true && carta?.variants?.holo === true)) {
    // La Holo ya está porque la trae TCGGO (su fila «Holo») y la «Normal» es
    // la de por defecto de TCGdex (1007, el Reshiram de Legendary Treasures:
    // «no tiene dos variantes, solo existe la holográfica»). Se queda solo si
    // TCGdex dice las dos, como Pitch Black.
    fuera = fuera.filter((e) => e?.nuestro !== 'normal')
  }
  const reverseDeTcggo = (carta?.versiones || []).some((f) => !f.origen && varianteDeEtiqueta(f.etiqueta) === 'reverse')
  if (brillaSiempre(carta) && fuera.length > 1) {
    // La que brilla siempre no tiene «Normal» (955): con la «Holo» que da
    // TCGGO al lado, el Shiny Vault salía dos veces al separar versiones.
    const sin = fuera.filter((e) => e?.nuestro !== 'normal' && (reverseDeTcggo || e?.nuestro !== 'reverse'))
    if (sin.length) fuera = sin
  }
  return fuera
}

// ── LAS EDICIONES DE WIZARDS (935) ──
//
// Las filas `origen = 'edicion'` (supabase-migration-935, de los ficheros de
// tcgdex/cards-database): la 1.ª edición, la Shadowless, la Unlimited y lo
// demás, en ese orden; la migración las mete así y sus ids van hacia abajo.
// Detrás, lo que no es de siempre y tenga su fila (una a mano, una Ball de
// TCGGO); la holo o la normal de TCGGO sobran, que no son una edición.
const RANGO_EDICION = { primera: 0, shadowless: 1, unlimited: 2 }
function edicionesDe(carta) {
  const filas = (carta?.versiones || []).filter((f) => f.origen === 'edicion')
  if (!filas.length) return []
  const vistas = new Set()
  const fuera = []
  const poner = (f) => {
    const id = varianteDeEtiqueta(f.etiqueta)
    if (vistas.has(id)) return
    vistas.add(id)
    const e = EQUIVALE.find((x) => x.nuestro === id)
    fuera.push(e ? { ...e, clase: f.clase || null } : { suyo: null, nuestro: id, corto: cortoDeVariante(id), nombre: nombreDeVariante(id), clase: f.clase || null })
  }
  const rango = (f) => RANGO_EDICION[varianteDeEtiqueta(f.etiqueta)] ?? 9
  for (const f of [...filas].sort((a, b) => rango(a) - rango(b) || Number(b.tcggo_id) - Number(a.tcggo_id))) poner(f)
  for (const f of carta.versiones) {
    if (f.origen === 'edicion' || f.origen === 'foto') continue
    const id = varianteDeEtiqueta(f.etiqueta)
    if (id === 'normal' || id === 'holo') continue
    poner(f)
  }
  return fuera
}

// La fila de la carta misma que escribe la pasada de precios (937,
// `filaDeLaCarta` en netlify/lib/tcggo.mjs).
export const esFilaDeLaCarta = (f) => !f?.origen && f?.etiqueta === 'Standard'

// ¿Cuenta para el set maestro? (934, lo recomendado): una impresión sí (la
// Reverse, las de Ball); un sello (Pokémon Day, prerelease) o una adicional
// (la metálica de la UPC) no, o completar el maestro de Base Set pediría una
// carta de 2021.
export const cuentaParaMaestro = (v) => v?.clase !== 'adicional' && v?.clase !== 'sello'

// ── LO QUE NO SE SABE, DEDUCIDO (tanda 922) ──
//
// PINGU, con el Exeggutor del 30 aniversario ofreciendo Normal, Reverse,
// Holo y 1.ª edición: «todas las cartas del 30 aniversario son
// holográficas». Las cartas que crea TCGGO (el 30, Celebrations, lo
// japonés) y las que TCGdex no ha engordado llegan sin `variants`, y la
// hoja de añadir ofrecía las cuatro. Pero la expansión y la rareza dicen
// mucho, y lo que dicen es canónico: una Rara Ilustración Especial solo se
// imprime en holo, una común de hoy en normal y reverse, y la 1.ª edición
// solo la tuvieron las de Wizards. Lo que la regla no sabe (una promo, una
// japonesa sin rareza conocida) sigue siendo «no se sabe»: null.
//
// Las expansiones donde TODO es holo, por su id nuestro (los de la 697).
const SETS_TODO_HOLO = new Set(['30th', '30th-c', 'cel25', 'cel25c', 'cel25cc'])
// Las de Wizards que tuvieron 1.ª edición; y las de antes de la reverse
// (Legendary Collection, 2002, fue la primera con ella).
const SETS_PRIMERA = new Set(['base1', 'base2', 'base3', 'base5', 'gym1', 'gym2', 'neo1', 'neo2', 'neo3', 'neo4'])
const SETS_SIN_REVERSE = new Set([...SETS_PRIMERA, 'base4', 'basep', 'si1'])
// Rarezas que solo se imprimen en holo, en su nombre oficial en español.
const SOLO_HOLO = new Set(['Rara Doble', 'Rara Ultra', 'Rara Ilustración', 'Rara Ilustración Especial', 'Rara Híper', 'Rara Brillante', 'Rara Brillante Ultra', 'Rara Asombrosa', 'Rara Radiante', 'Rara ACE SPEC', 'Rara Ataque Mega', 'Rara Híper Mega', 'Rara Arcoíris', 'Rara Secreta', 'Rara Holo EX', 'Rara Holo GX', 'Rara Holo V', 'Rara Holo VMAX', 'Rara Holo VSTAR', 'Rara Holo LV.X', 'Rara BREAK', 'Rara Prime', 'Rara Prisma Estelar', 'Galería de Entrenadores'])
const SIN_HOLO = new Set(['Común', 'Infrecuente', 'Rara'])
const de = (...ids) => ids.map((id) => EQUIVALE.find((e) => e.nuestro === id))

export function variantesDeducidas(carta) {
  if (!carta) return null
  const set = String(carta.set_id || '')
  if (SETS_TODO_HOLO.has(set)) return de('holo')
  const rareza = rarezaEs(carta.rarity_en || carta.rarity)
  if (rareza && SOLO_HOLO.has(rareza)) return de('holo')
  // La reverse y la 1.ª edición son cosa del catálogo occidental: en el
  // japonés no se deduce más que lo que solo existe en holo.
  if ((carta.market || 'WEST') !== 'WEST') return null
  const primera = SETS_PRIMERA.has(set) ? ['primera'] : []
  const reverse = SETS_SIN_REVERSE.has(set) ? [] : ['reverse']
  if (rareza === 'Rara Holo') return de('holo', ...reverse, ...primera)
  if (rareza && SIN_HOLO.has(rareza)) return de('normal', ...reverse, ...primera)
  return null
}

// ¿Sabemos qué versiones tiene? Si no, quien la añade elige entre las
// cuatro y se le dice (922, PINGU: «elige la tuya»).
export function seSabenVariantes(carta) {
  const v = carta?.variants
  if (v && typeof v === 'object' && EQUIVALE.some((e) => v[e.suyo] === true)) return true
  return Boolean((carta?.versiones || []).length || variantesDeducidas(carta))
}

// UNA «NORMAL» QUE NO EXISTE (tanda 927, PINGU con el 30 aniversario:
// «¿por qué me marca que tengo la normal? Es imposible, no existe»). Hasta
// la 564 una copia se guardaba en «normal» cuando nadie decía cuál, y hay
// colecciones enteras así de cartas que solo existen en holo. Se lee como la
// versión de la carta. Solo la «normal» y solo si se sabe qué versiones
// tiene: una reverse que el catálogo no declara puede ser real (el catálogo
// se queda corto), y esa no se toca.
export function versionPosible(variante, carta) {
  const v = variante || VARIANTE_POR_DEFECTO
  if (v !== VARIANTE_POR_DEFECTO || !carta || !seSabenVariantes(carta)) return v
  const hay = variantesDeCarta(carta).map((e) => e.nuestro)
  // La de por defecto de la carta y no la primera (1007): con ediciones, la
  // Unlimited, no la 1.ª edición.
  return hay.length && !hay.includes(v) ? varianteDeCarta(carta) : v
}

// Lo mismo sobre una lista de copias, en el sitio: se cargan una vez y todo
// lo que cuenta versiones (insignias, «Separar», la ficha, el Panel) las lee.
export function corregirVersionesImposibles(lineas, cartaDe) {
  for (const l of lineas || []) {
    const v = versionPosible(l.variante, cartaDe(l))
    if (v !== (l.variante || VARIANTE_POR_DEFECTO)) l.variante = v
  }
  return lineas
}

// ¿Merece la pena enseñar el selector? Con una sola versión no: sería
// una casilla que solo se puede marcar de una manera.
export function tieneVarias(carta) {
  return variantesDeCarta(carta).length > 1
}

// El nombre largo de una versión, para el `aria-label` y el `title`.
export function nombreDeVariante(id) {
  return EQUIVALE.find((e) => e.nuestro === id)?.nombre || NOMBRES.get(id) || (id ? deId(id) : 'Normal')
}

// El código corto de la chapa: el de siempre para las cuatro; para una de
// TCGGO, las iniciales («ESP», «QB»).
export function cortoDeVariante(id) {
  const e = EQUIVALE.find((x) => x.nuestro === id)
  if (e) return e.corto
  return nombreDeVariante(id).split(/\s+/).map((p) => p[0] || '').join('').toUpperCase().slice(0, 3) || 'N'
}

// En qué versión se añade una carta cuando NADIE ha dicho cuál (tanda
// 564).
//
// Era la cadena `'normal'`, escrita a mano en cuatro sitios, y estaba mal
// en todas las cartas que no tienen normal — que son muchísimas: una
// ultra rara, una full art y una secreta solo existen en holo. El «+» del
// álbum las guardaba como NORMALES, sin dar ningún error y sin que se
// note: la chapa de versión solo sale cuando no es la normal, así que la
// casilla se quedaba igual que una bien puesta.
//
// Las casillas por versión nunca pasaron por aquí —llevan la suya en el
// `data-var`—, y por eso el fallo se escondió: justo las cartas de las
// que se ofrecen varias versiones son las que lo hacían bien.
//
// Lo que NO se sabe sigue siendo normal: una carta sin engordar no dice
// nada de sus versiones, y la normal es la que existe casi siempre.
// Y en una de Wizards (935), la Unlimited: es la que tiene casi todo el
// mundo, aunque la lista empiece por la 1.ª edición.
export function varianteDeCarta(carta) {
  const vs = variantesDeCarta(carta)
  return (vs.find((v) => v.nuestro === 'unlimited') || vs[0])?.nuestro || VARIANTE_POR_DEFECTO
}
