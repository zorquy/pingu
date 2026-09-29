// El corazón del constructor de mazos: qué es cada carta, qué reglas
// cumple un mazo y cómo se escribe hacia fuera (TCG Live, Limitless,
// un enlace). Sin DOM y sin Supabase a propósito: así se prueba en Node
// tal cual, que es donde se ve si una regla está mal — en la pantalla,
// una regla mal escrita no da error, deja pasar un mazo ilegal.
//
// Una «entrada» del mazo es { carta, n }: la fila de `tcg_cards` y las
// copias. Todo lo de aquí trabaja sobre esa forma.

// ── Qué es cada carta ──
//
// El espejo guarda los campos del detalle EN DOS IDIOMAS a la vez
// (comprobado el 2026-09-28 contra la base): las cartas engordadas antes
// de la tanda 330 dicen «Pokemon», «Trainer», «Supporter», «Basic»; las
// de después, «Pokémon», «Entrenador», «Partidario», «Básico». Así que
// nada se compara con un valor suelto: se normaliza primero.
export function plano(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

// 'P' | 'T' | 'E', o null si no se sabe. El null importa: ~190 cartas
// del espejo aún no tienen categoría, y una carta sin categoría NO es un
// Pokémon por defecto (la sección saldría mal y el recuento de básicos
// mentiría).
export function categoriaDe(carta) {
  const c = plano(carta?.category)
  if (c.startsWith('pokemon')) return 'P'
  if (c === 'trainer' || c === 'entrenador') return 'T'
  if (c === 'energy' || c === 'energia') return 'E'
  // Sin categoría, se deduce de lo que sí haya: solo un Pokémon tiene PS
  // o fase, solo una energía tiene tipo de energía.
  if (carta?.energy_type) return 'E'
  if (carta?.trainer_type) return 'T'
  if (carta?.hp || carta?.stage) return 'P'
  if (esEnergiaBasica(carta)) return 'E'
  return null
}

// Las ocho energías básicas por su letra de TCG Live, en el orden en que
// las numeran SVE y MEE (1 Planta … 8 Metálica).
const LETRAS_ENERGIA = ['G', 'R', 'W', 'L', 'P', 'F', 'D', 'M']
const NOMBRES_ENERGIA = {
  G: ['grass', 'planta'],
  R: ['fire', 'fuego'],
  W: ['water', 'agua'],
  L: ['lightning', 'rayo', 'electrica', 'electrico'],
  P: ['psychic', 'psiquica', 'psiquico'],
  F: ['fighting', 'lucha'],
  D: ['darkness', 'oscura', 'oscuro', 'oscuridad', 'siniestra'],
  M: ['metal', 'metalica', 'metalico'],
}
const SETS_DE_ENERGIA_BASICA = ['sve', 'mee']

// La letra de una energía básica a partir de su nombre, en cualquiera de
// las formas que circulan: «Energía Fuego», «Fire Energy», «Basic Fire
// Energy», «Basic {R} Energy».
export function letraDeEnergia(nombre) {
  const n = plano(nombre)
  const llave = n.match(/\{([grwlpfdm])\}/)
  if (llave) return llave[1].toUpperCase()
  if (!/energ/.test(n)) return null
  for (const [letra, palabras] of Object.entries(NOMBRES_ENERGIA)) {
    if (palabras.some((p) => new RegExp(`(^|\\s)${p}(\\s|$)`).test(n))) return letra
  }
  return null
}

// ── La imagen de una energía básica ──
//
// TCGdex no trae imagen de NINGUNA energía básica del espejo (sve y mee
// tienen `image_path` a null), así que en el constructor salían como un
// hueco con el nombre. Se pintan con las de la colección del 30
// aniversario —MEE 9 a 16, las que llevan el sello del 30 aniversario—
// sacadas de la CDN de Limitless, que es donde están; si esa no
// contesta, las MEE 1 a 8 normales, y si tampoco, el nombre (tanda 321:
// un respaldo tiene que estar en otro sitio, y el último es el texto).
//
// Es solo lo que se VE: la carta del mazo sigue siendo la del espejo
// (mee-00X), que es la que se guarda y se exporta.
const CDN_LIMITLESS = 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/MEE/MEE_'
export function letraDeCartaDeEnergia(carta) {
  if (!carta) return null
  const letra = letraDeEnergia(carta.name) || letraDeEnergia(carta.name_es)
  if (letra) return letra
  const n = Number(carta.local_id)
  return SETS_DE_ENERGIA_BASICA.includes(String(carta.set_id).toLowerCase()) && n >= 1 ? LETRAS_ENERGIA[(n - 1) % 8] : null
}

export function imagenDeEnergiaBasica(carta, tamanio = 'SM') {
  const letra = letraDeCartaDeEnergia(carta)
  if (!letra) return null
  const i = LETRAS_ENERGIA.indexOf(letra)
  const url = (n) => `${CDN_LIMITLESS}${String(n).padStart(3, '0')}_R_EN_${tamanio}.png`
  return { url: url(9 + i), respaldo: url(1 + i) }
}

// El identificador de la energía básica que se usa al añadirla por
// nombre o al importarla: la de MEE de su tipo, que es la que se pinta.
export function idDeEnergiaBasica(letra) {
  const i = LETRAS_ENERGIA.indexOf(String(letra || '').toUpperCase())
  return i < 0 ? null : `mee-${String(i + 1).padStart(3, '0')}`
}

// ¿Es una energía BÁSICA? Por el NOMBRE, no por `energy_type`: en el
// espejo ese campo miente — la Energía Prisma, la Ignición, la del Team
// Rocket y las ocho «Energía X Burbujeante / Rocosa / Nitro…» de la era
// ME vienen marcadas «Básico» y son ESPECIALES (comprobado contra
// Limitless). Tomarlas por básicas les quitaba el límite de 4 copias.
// Solo se fía de `energy_type` para decir que NO (si dice especial).
// El Hada cuenta como básica (lo fue hasta 2020 y sigue en Expandido)
// aunque no tenga gemela en MEE: por eso está aquí y NO en
// NOMBRES_ENERGIA — no se puede llevar a una mee-00X.
const TIPOS_BASICOS = 'planta|fuego|agua|rayo|psiquica|psiquico|lucha|oscura|oscuro|metalica|metalico|hada|grass|fire|water|lightning|psychic|fighting|darkness|metal|fairy'
const NOMBRE_DE_BASICA = [
  new RegExp(`^energia (${TIPOS_BASICOS})( basica)?$`),
  new RegExp(`^(basic )?(\\{[grwlpfdm]\\}|${TIPOS_BASICOS}) energy$`),
]
export function esEnergiaBasica(carta) {
  if (!carta) return false
  const tipo = plano(carta.energy_type)
  if (tipo === 'special' || tipo === 'especial') return false
  if (SETS_DE_ENERGIA_BASICA.includes(String(carta.set_id || '').toLowerCase())) return true
  return [carta.name, carta.name_es].some((n) => n && NOMBRE_DE_BASICA.some((r) => r.test(plano(n))))
}

// Supporter / Item / Tool / Stadium, en los dos idiomas del espejo.
export function subtipoDeEntrenador(carta) {
  const t = plano(carta?.trainer_type)
  if (t === 'supporter' || t === 'partidario') return 'partidario'
  if (t === 'item' || t === 'objeto') return 'objeto'
  if (t === 'tool' || t === 'herramienta' || t === 'pokemon tool') return 'herramienta'
  if (t === 'stadium' || t === 'estadio') return 'estadio'
  if (t) return 'otro'
  return null
}

// «Básico» es lo que cuenta para la regla de «al menos un Pokémon
// básico». Las fases que NO son básicas se dicen en inglés y en español
// («Stage1», «Fase 1»…); lo que no se sabe se devuelve como null para
// no acusar a un mazo por una carta sin engordar.
export function esBasico(carta) {
  if (categoriaDe(carta) !== 'P') return false
  const s = plano(carta.stage)
  if (!s) return null
  return s === 'basic' || s === 'basico' || s === 'baby' || s === 'bebe'
}

// AS TÁCTICO (ACE SPEC): una por mazo, entre todas. El espejo lo dice en
// la rareza («Rara AS TÁCTICO», «ACE SPEC Rare»).
export function esAsTactico(carta) {
  return /ace\s*spec|as\s+tactico/.test(plano(carta?.rarity))
}

// Pokémon Radiante: uno por mazo, entre todos.
export function esRadiante(carta) {
  return /^radiant\b|\bradiante\b/.test(plano(carta?.name)) || /\bradiante\b/.test(plano(carta?.name_es)) || /radiante|radiant/.test(plano(carta?.rarity))
}

// La regla de las 4 copias va por NOMBRE, no por impresión: cuatro
// «Órdenes de Jefes» de colecciones distintas ya son cuatro.
//
// Va por el nombre TRADUCIDO cuando lo hay, y no por `name_key`: mientras
// dura la reparación de la tanda 335 unas impresiones llevan el inglés en
// `name` (y en `name_key`) y otras todavía el español, así que la promo
// de «Boss's Orders» y la «Órdenes de Jefes» moderna no compartían clave
// y se podían meter 4 + 4. `name_es` lo llevan las dos. Sin él (cartas
// viejas que nunca se tradujeron), la clave del espejo o el nombre plano.
export function claveDeNombre(carta) {
  if (carta?.name_es) return plano(carta.name_es)
  return String(carta?.name_key || plano(carta?.name))
}

// El nombre que se ENSEÑA. Desde la tanda 335 `name` es el inglés (la
// clave con la que se cruzan las impresiones y lo que entiende TCG Live)
// y el traducido va en `name_es`. Es la misma regla que `nombreDeCarta`
// de carta-nucleo.js, copiada en una línea porque importar aquel módulo
// —que pinta HTML— haría que esta página «usara» sus clases (prueba 299).
export function nombreVisible(carta) {
  return String(carta?.name_es || carta?.name || '')
}

// ── Las reglas del mazo ──
//
// Devuelve { total, problemas, porCarta }. `problemas` es la lista que
// se enseña; `porCarta` marca cada carta con lo que tiene mal, para
// pintarla en rojo en la rejilla.
//
// Igual que en las listas de torneo, señalar es AVISAR: la pantalla deja
// guardar un mazo que no cumple (se puede estar a medias), solo lo dice.
//
// `reimpresionLegal` es el conjunto de claves de nombre que tienen alguna
// impresión con marca legal. Es la regla de la reimpresión que ya aplica
// /torneo: una «Investigación de Profesores» antigua se juega si existe
// la moderna. Lo decide la base, así que llega hecho.
export function validarMazo(entradas, { formato = 'standard', legales = ['H', 'I', 'J'], reimpresionLegal = new Set() } = {}) {
  const problemas = []
  const porCarta = new Map()
  const marcar = (id, motivo) => {
    if (!porCarta.has(id)) porCarta.set(id, [])
    porCarta.get(id).push(motivo)
  }
  const total = entradas.reduce((s, e) => s + e.n, 0)

  if (total !== 60) {
    problemas.push({
      tipo: 'total',
      texto:
        total < 60
          ? `${60 - total === 1 ? 'Falta 1 carta' : `Faltan ${60 - total} cartas`} para llegar a 60.`
          : `${total - 60 === 1 ? 'Sobra 1 carta' : `Sobran ${total - 60} cartas`}: un mazo lleva exactamente 60.`,
    })
  }

  // Máximo 4 por nombre (las energías básicas no tienen límite).
  const porNombre = new Map()
  for (const e of entradas) {
    if (esEnergiaBasica(e.carta)) continue
    const k = claveDeNombre(e.carta)
    const g = porNombre.get(k) || { n: 0, nombre: nombreVisible(e.carta), ids: [] }
    g.n += e.n
    g.ids.push(e.carta.id)
    porNombre.set(k, g)
  }
  for (const g of porNombre.values()) {
    if (g.n > 4) {
      problemas.push({ tipo: 'copias', texto: `${g.nombre}: llevas ${g.n} copias y el máximo son 4 (cuentan juntas todas sus versiones).` })
      g.ids.forEach((id) => marcar(id, 'Más de 4 copias'))
    }
  }

  // Al menos un Pokémon básico. Si alguna carta de Pokémon aún no tiene
  // la fase en el catálogo, no se acusa: puede ser justo esa.
  const pokemon = entradas.filter((e) => categoriaDe(e.carta) === 'P')
  const hayBasico = pokemon.some((e) => esBasico(e.carta) === true)
  const hayDudosos = pokemon.some((e) => esBasico(e.carta) === null)
  if (entradas.length && !hayBasico && !hayDudosos) {
    problemas.push({ tipo: 'basico', texto: 'El mazo necesita al menos un Pokémon básico para poder empezar la partida.' })
  }

  const ases = entradas.filter((e) => esAsTactico(e.carta))
  const nAses = ases.reduce((s, e) => s + e.n, 0)
  if (nAses > 1) {
    problemas.push({ tipo: 'as', texto: `Llevas ${nAses} cartas AS TÁCTICO y solo se permite una por mazo.` })
    ases.forEach((e) => marcar(e.carta.id, 'Más de un AS TÁCTICO'))
  }

  const radiantes = entradas.filter((e) => esRadiante(e.carta))
  const nRad = radiantes.reduce((s, e) => s + e.n, 0)
  if (nRad > 1) {
    problemas.push({ tipo: 'radiante', texto: `Llevas ${nRad} Pokémon Radiantes y solo se permite uno por mazo.` })
    radiantes.forEach((e) => marcar(e.carta.id, 'Más de un Radiante'))
  }

  // El formato. Una carta SIN marca no se acusa en Estándar (sin dato no
  // hay acusación, como en /torneo); en Expandido se mira la colección.
  if (formato === 'standard') {
    const fuera = entradas.filter(
      (e) =>
        !esEnergiaBasica(e.carta) &&
        e.carta.regulation_mark &&
        !legales.includes(e.carta.regulation_mark) &&
        !reimpresionLegal.has(claveDeNombre(e.carta))
    )
    if (fuera.length) {
      const n = fuera.reduce((s, e) => s + e.n, 0)
      problemas.push({
        tipo: 'formato',
        texto: `${n} ${n === 1 ? 'carta no es legal' : 'cartas no son legales'} en Estándar: esta temporada valen las marcas ${legales.join(', ')} (la letra de la esquina de abajo) y no tienen reimpresión legal.`,
      })
      fuera.forEach((e) => marcar(e.carta.id, `Marca ${e.carta.regulation_mark}: fuera de Estándar`))
    }
  } else if (formato === 'expanded') {
    const fuera = entradas.filter((e) => !esEnergiaBasica(e.carta) && !esDeExpandido(e.carta) && !reimpresionLegal.has(claveDeNombre(e.carta)))
    if (fuera.length) {
      const n = fuera.reduce((s, e) => s + e.n, 0)
      problemas.push({ tipo: 'formato', texto: `${n} ${n === 1 ? 'carta es' : 'cartas son'} de antes de Negro y Blanco y no ${n === 1 ? 'entra' : 'entran'} en Expandido.` })
      fuera.forEach((e) => marcar(e.carta.id, 'Fuera de Expandido'))
    }
  }

  return { total, problemas, porCarta }
}

// Expandido = desde Negro y Blanco (2011). Se mira por la serie que dice
// el identificador del set en TCGdex: bw…, xy…, sm…, swsh…, sv…, me…
// (y sus promos). La lista de prohibidas de Expandido no se aplica: se
// dice en la pantalla.
const SERIES_DE_EXPANDIDO = /^(bw|xy|sm|swsh|sv|me)/i
export function esDeExpandido(carta) {
  return SERIES_DE_EXPANDIDO.test(String(carta?.set_id || ''))
}

// ── El orden dentro de cada sección ──
//
// Como los exports de TCG Live y como Limitless: Pokémon por líneas
// evolutivas (el que evoluciona va detrás de su preevolución), los
// entrenadores por subtipo (partidarios, objetos, herramientas,
// estadios) y las energías especiales antes que las básicas. Dentro de
// cada grupo, las que más copias llevan primero.
//
// `{ estable: true }` es para PINTAR el mazo mientras se construye: ahí
// ordenar por copias hace que una carta salte de sitio al pulsar «+» (la
// tercera copia la adelanta a las que tienen dos) y el siguiente clic cae
// en otra. Con `estable` se respetan los grupos y las líneas evolutivas,
// pero dentro de ellos manda el orden en que se añadió cada carta.
const ORDEN_ENTRENADOR = { partidario: 0, objeto: 1, herramienta: 2, estadio: 3, otro: 4 }

export function seccionesDelMazo(entradas, { estable = false } = {}) {
  const secciones = { P: [], T: [], E: [], X: [] }
  for (const e of entradas) secciones[categoriaDe(e.carta) || 'X'].push(e)

  const orden = new Map(entradas.map((e, i) => [e, i]))
  const porCopias = estable
    ? (a, b) => orden.get(a) - orden.get(b)
    : (a, b) => b.n - a.n || nombreVisible(a.carta).localeCompare(nombreVisible(b.carta), 'es')
  secciones.T.sort((a, b) => (ORDEN_ENTRENADOR[subtipoDeEntrenador(a.carta)] ?? 5) - (ORDEN_ENTRENADOR[subtipoDeEntrenador(b.carta)] ?? 5) || porCopias(a, b))
  secciones.E.sort((a, b) => Number(esEnergiaBasica(a.carta)) - Number(esEnergiaBasica(b.carta)) || porCopias(a, b))
  secciones.X.sort(porCopias)
  secciones.P = ordenarPorLineas(secciones.P, porCopias, estable)
  return secciones
}

// Una línea evolutiva junta: el básico, y detrás lo que evoluciona de él
// (por `evolve_from`, en cualquier idioma: se compara el nombre plano).
function ordenarPorLineas(pokemon, porCopias, estable = false) {
  const hijos = new Map()
  const raices = []
  // Por los DOS nombres: `evolve_from` puede venir en inglés o en español
  // según de dónde se engordó la carta.
  const porNombre = new Map()
  for (const e of pokemon) {
    porNombre.set(plano(e.carta.name), e)
    if (e.carta.name_es) porNombre.set(plano(e.carta.name_es), e)
  }
  for (const e of pokemon) {
    const padre = e.carta.evolve_from ? porNombre.get(plano(e.carta.evolve_from)) : null
    if (padre && padre !== e) {
      if (!hijos.has(padre)) hijos.set(padre, [])
      hijos.get(padre).push(e)
    } else raices.push(e)
  }
  // El peso de una línea es el total de copias de toda la línea: la
  // línea principal del mazo sale la primera.
  const peso = (e) => e.n + (hijos.get(e) || []).reduce((s, h) => s + peso(h), 0)
  const fuera = []
  const visitar = (e) => {
    fuera.push(e)
    ;(hijos.get(e) || []).sort(porCopias).forEach(visitar)
  }
  // A igualdad de peso, la fase más baja primero: si falta el paso
  // intermedio (Pidgey y Pidgeot ex sin Pidgeotto), el básico sigue
  // yendo delante de su evolución.
  const fase = (e) => (esBasico(e.carta) === true ? 0 : /2/.test(plano(e.carta.stage)) ? 2 : 1)
  // En modo estable, sin el peso: la línea que crece no adelanta a las
  // demás. La fase sí, que no cambia al pulsar «+».
  raices.sort((a, b) => (estable ? 0 : peso(b) - peso(a)) || fase(a) - fase(b) || porCopias(a, b)).forEach(visitar)
  return fuera
}

// ── Hacia fuera: el texto de TCG Live ──
//
// `codigoDeSet(set_id)` da el código de TCG Live de una colección («sv06»
// → «TWM»). Sin código, la línea sale con el identificador de TCGdex en
// mayúsculas: TCG Live no la encontrará, pero la lista no pierde la carta
// y quien la lee sabe cuál es.
export function numeroSinCeros(localId) {
  const s = String(localId ?? '')
  if (/^\d+$/.test(s)) return String(Number(s))
  // Las promos antiguas llevan la era delante en el espejo («SWSH251»,
  // «SM01»); fuera se escriben con el número a secas.
  const promo = s.match(/^(SWSH|SM|XY|BW)0*(\d+)$/)
  return promo ? promo[2] : s
}

export function lineaTcgLive(e, codigoDeSet) {
  const c = e.carta
  if (esEnergiaBasica(c)) {
    // Las básicas se escriben como las exporta TCG Live y como las lee
    // cualquier importador: «Basic {R} Energy SVE 2».
    const letra = letraDeEnergia(c.name) || (/^\d+$/.test(String(c.local_id)) ? LETRAS_ENERGIA[(Number(c.local_id) - 1) % 8] : null)
    if (letra) {
      const deSet = SETS_DE_ENERGIA_BASICA.includes(String(c.set_id).toLowerCase())
      const codigo = deSet ? codigoDeSet(c.set_id) || String(c.set_id).toUpperCase() : 'SVE'
      const numero = deSet ? numeroSinCeros(c.local_id) : String(LETRAS_ENERGIA.indexOf(letra) + 1)
      return `${e.n} Basic {${letra}} Energy ${codigo} ${numero}`
    }
  }
  const codigo = codigoDeSet(c.set_id) || String(c.set_id || '').toUpperCase()
  return `${e.n} ${c.name} ${codigo} ${numeroSinCeros(c.local_id)}`
}

export function textoTcgLive(entradas, codigoDeSet) {
  const s = seccionesDelMazo(entradas)
  const bloques = []
  const suma = (lista) => lista.reduce((t, e) => t + e.n, 0)
  if (s.P.length) bloques.push(`Pokémon: ${suma(s.P)}\n${s.P.map((e) => lineaTcgLive(e, codigoDeSet)).join('\n')}`)
  // Lo que aún no tiene categoría en el catálogo va con los entrenadores:
  // TCG Live coloca cada carta por su cuenta al importar, así que la
  // cabecera no decide nada y no se pierde ninguna línea.
  const entrenadores = [...s.T, ...s.X]
  if (entrenadores.length) bloques.push(`Trainer: ${suma(entrenadores)}\n${entrenadores.map((e) => lineaTcgLive(e, codigoDeSet)).join('\n')}`)
  if (s.E.length) bloques.push(`Energy: ${suma(s.E)}\n${s.E.map((e) => lineaTcgLive(e, codigoDeSet)).join('\n')}`)
  return `${bloques.join('\n\n')}\n\nTotal Cards: ${suma(entradas)}`
}

// El texto para ENTREGAR en un torneo de PokeDoc («Usar un mazo del
// constructor» en /torneo). Es el de TCG Live con una diferencia: el
// motor de torneos lee el código de colección con [A-Z0-9]{2,6}, y las
// promos de TCG Live llevan guion («PR-SV 92»): esa línea saldría como
// «no se entiende». Van con el código de Limitless, que sí casa.
// La tabla se mudó a js/escaneo-carta.js (tanda 370): la necesitaba
// gente que no quiere estas 26 KB de reglas de mazo encima. Se reexporta
// para no tocar a quien ya la pedía aquí.
export { PROMOS_SIN_GUION } from '../escaneo-carta.js'
import { PROMOS_SIN_GUION } from '../escaneo-carta.js'
export function textoParaTorneo(entradas, codigoDeSet) {
  return textoTcgLive(entradas, codigoDeSet).replace(/ (PR-[A-Z]{2,3}) (\S+)$/gm, (m, codigo, numero) => ` ${PROMOS_SIN_GUION[codigo] || codigo.replace('-', '')} ${numero}`)
}

// La misma lista en la forma que entiende el motor de torneos
// (`parseDecklist` de js/torneos/motor.js): sirve para reutilizar la
// imagen de decklist que ya se descarga desde /torneo.
export function comoDecklist(entradas, codigoDeSet) {
  const s = seccionesDelMazo(entradas)
  const linea = (e) => {
    const partes = lineaTcgLive(e, codigoDeSet).match(/^(\d+)\s+(.+?)\s+(\S+)\s+(\S+)$/)
    return { quantity: e.n, name: partes ? partes[2] : e.carta.name, set: partes ? partes[3] : '', number: partes ? partes[4] : '' }
  }
  return {
    pokemon: s.P.map(linea),
    trainer: [...s.T, ...s.X].map(linea),
    energy: s.E.map(linea),
    total: entradas.reduce((t, e) => t + e.n, 0),
  }
}

// ── Hacia fuera: el enlace de importación de Limitless ──
//
// El formato de «Copy Import Link» de my.limitlesstcg.com/builder, que
// no está documentado y se sacó a mano el 2026-09-28:
//
//   ?i=1 + por carta: [región][copias][long. set][long. número][SET][NÚMERO]
//
//   · región: 0 internacional, 1 japonesa (aquí siempre 0).
//   · copias: UN carácter en base 62 con el alfabeto 0-9 a-z A-Z (así
//     caben hasta 61 energías: «0A» son 36, no 10 — comprobado cargando
//     el enlace en el builder).
//   · long. set y long. número: un dígito cada una.
//   · SET es el código de TCG Live («TWM») y NÚMERO va sin ceros.
const BASE62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
// Solo se LEE (un enlace de Limitless pegado en «Importar»): exportar
// hacia su builder se quitó a petición de PINGU — para llevarse el mazo
// fuera ya están «Copiar para TCG Live» y el enlace propio. Devuelve
// líneas { n, set, numero } que se resuelven igual que las de un texto
// (las promos llegan con el código de Limitless, SVP, SP…, y datos.js
// los acepta como alias).
export function leerEnlaceLimitless(codigo) {
  const s = String(codigo || '').replace(/^.*[?&]i=/, '').replace(/[&#].*$/, '')
  if (!s.startsWith('1')) return []
  const fuera = []
  let i = 1
  while (i + 4 <= s.length) {
    const region = s[i]
    const n = BASE62.indexOf(s[i + 1])
    const ls = Number(s[i + 2])
    const ln = Number(s[i + 3])
    if (n < 1 || !ls || !ln || !/[01]/.test(region)) break
    const set = s.slice(i + 4, i + 4 + ls)
    const numero = s.slice(i + 4 + ls, i + 4 + ls + ln)
    if (set.length !== ls || numero.length !== ln) break
    fuera.push({ n, set: set.toUpperCase(), numero, japonesa: region === '1' })
    i += 4 + ls + ln
  }
  return fuera
}

// ── El enlace propio: /constructor?l=… ──
//
// Un mazo sin guardar también se tiene que poder compartir (así lo hace
// Limitless, y es lo que más se usa). Va con los identificadores de
// TCGdex, que son los nuestros: «3~sv06-130_4~sve-002». `~` y `_` no
// aparecen en ningún identificador del espejo y no hay que escaparlos en
// una URL, así que el enlace se lee tal cual.
export function codificarMazo(entradas) {
  return entradas
    .filter((e) => e.n > 0 && e.carta?.id)
    .map((e) => `${e.n}~${e.carta.id}`)
    .join('_')
}

export function decodificarMazo(texto) {
  return String(texto || '')
    .split('_')
    .map((t) => t.match(/^(\d{1,2})~(.+)$/))
    .filter(Boolean)
    .map((m) => ({ n: Math.min(60, Number(m[1])), id: m[2] }))
    .filter((x) => x.n > 0)
}

// ── Hacia dentro: leer una lista pegada ──
//
// Más permisivo que `parseDecklist` del motor de torneos, a propósito:
// aquel juzga una lista que se ENTREGA (y exige cabeceras), y este lee
// lo que alguien pega para empezar a construir. Acepta:
//   · el export de TCG Live en cualquier idioma («4 Charmander PAF 7»),
//   · el formato antiguo con asterisco («* 4 Charmander PAF 7»),
//   · «4x Charmander»,
//   · líneas sin código de set («3 Boss's Orders»), que se buscan por
//     nombre,
//   · y listas SIN cabeceras — la sección la decide la carta, no el
//     texto.
// Las cabeceras y el «Total Cards: 60» se saltan; lo que no se entiende
// se devuelve aparte para enseñarlo, nunca se pierde en silencio.
const LINEA = /^\*?\s*(\d{1,2})\s*x?\s+(.+?)\s*$/i
// El código de set va en mayúsculas o dígitos (2–6), o «PR-XX», o la
// palabra «Energy» con la que TCG Live exporta las básicas antiguas.
const COLA = /^(.*\S)\s+([A-Z0-9]{2,6}|PR-[A-Z]{2,5}|Energy)\s+([A-Za-z0-9]{1,6})$/

export function leerLista(texto) {
  const lineas = []
  const ilegibles = []
  for (const bruta of String(texto || '').split(/\r?\n/)) {
    const linea = bruta.trim()
    if (!linea || linea.startsWith('#') || linea.startsWith('//')) continue
    // «Pokémon: 12», «Entrenador: 36», «Total Cards: 60»…
    if (/^[^\d*][^:]*:\s*\d*\s*$/.test(linea)) continue
    const m = LINEA.exec(linea)
    if (!m) {
      ilegibles.push(linea)
      continue
    }
    const n = Number(m[1])
    if (!n) continue
    const cola = COLA.exec(m[2])
    if (cola) lineas.push({ n, nombre: cola[1], set: cola[2].toUpperCase(), numero: cola[3], original: linea })
    else lineas.push({ n, nombre: m[2], set: null, numero: null, original: linea })
  }
  return { lineas, ilegibles }
}

// ── La mano de prueba ──
//
// Siete cartas al azar del mazo, y seis de premio detrás. Con el azar
// inyectable para poder probarla.
export function robarMano(entradas, azar = Math.random) {
  const mazo = entradas.flatMap((e) => Array.from({ length: e.n }, () => e.carta))
  for (let i = mazo.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1))
    ;[mazo[i], mazo[j]] = [mazo[j], mazo[i]]
  }
  const mano = mazo.slice(0, 7)
  return { mano, premios: mazo.slice(7, 13), hayBasico: mano.some((c) => esBasico(c) === true), resto: mazo.length - 13 }
}

// La probabilidad de tener al menos una copia de una carta en la mano
// inicial de 7 (hipergeométrica). Es lo que más se consulta al ajustar
// un mazo: «¿meto la tercera?».
export function probabilidadEnMano(copias, total = 60, mano = 7) {
  if (copias <= 0 || total <= 0) return 0
  let ninguna = 1
  for (let i = 0; i < mano; i++) ninguna *= (total - copias - i) / (total - i)
  return Math.max(0, Math.min(1, 1 - ninguna))
}
