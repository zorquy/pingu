// Una lista de TCG Live contra NUESTRO espejo de cartas (tanda 413:
// sale de js/torneos/cartas-decklist.js sin cambiar nada de lo que hacía).
//
// POR QUÉ ES UN FICHERO APARTE. La imagen que se exporta de un mazo
// (js/torneos/decklist-imagen.js) tiene que enseñar las MISMAS cartas que
// la rejilla, y la usa también el constructor. Si la viniera a buscar a
// cartas-decklist.js, el constructor «usaría» todas las clases de la
// rejilla de torneos sin cargar su hoja (el barrido de la 299 sigue los
// imports). Aquí no hay ni una clase: solo resolver y elegir.
//
// La decklist con cartas de verdad: cada línea del export de TCG Live
// se busca en NUESTRO espejo de cartas (`tcg_cards`, el mismo que usa el
// buscador — a TCGdex no se le llama desde aquí) y se pinta con su
// imagen y su contador. Lo que el espejo no tenga se queda como línea de
// texto, que una lista nunca debe perder cartas por culpa del catálogo.
//
// La tabla de códigos de set de TCG Live vive en comun.js (sin DOM):
// con ella la carta se busca dentro de SU set y por su NÚMERO — sin
// pasar por el nombre, que el export viene en el idioma del jugador y
// el espejo guarda el español cuando existe: cruzar nombres entre
// idiomas era la causa de las cartas «sin imagen». Sin correspondencia
// de set, se cae a la búsqueda global por nombre de siempre.
//
// Además de la imagen, la carta trae su MARCA DE REGULACIÓN (D…J): con
// las marcas legales de la temporada (site_settings 'torneos_reglas',
// hoy H/I/J) la rejilla señala las cartas fuera del reglamento. Las
// energías básicas están exentas, como en el juego real. Una carta que
// el espejo aún no tenga marcada (columna a NULL) no se señala: sin
// dato no hay acusación.
//
// Y la REGLA DE LA REIMPRESIÓN, que es como lo hace el juego oficial (y
// Limitless): una impresión antigua VALE si existe una carta con el
// MISMO NOMBRE y una marca legal. Quien pega su lista con la
// «Investigación de Profesores» de hace tres temporadas no está haciendo
// trampas — está jugando la versión moderna con otra ilustración. Antes de acusar a una
// carta de marca vieja, se mira si tiene reimpresión legal; solo si NO
// la tiene se señala. Y señalar es AVISAR: el reglamento nunca impide
// guardar la lista — de eso se encarga el juez, no el formulario.
import { supabase } from './supabase.js'
import { searchCards, normalizeSearch } from './tcgdex.js'
import { nombreDeSetLive } from './torneos/comun.js'
// Las dos preguntas de legalidad viven fuera desde la tanda 335: las
// hace también la ficha de una carta, y una copia se habría separado el
// día que cambiara la temporada.
import { marcasLegales } from './carta-legalidad.js'
import { letraDeEnergiaBasica } from './imagen-carta.js'
import { canonizarEntradas } from './impresiones-del-set.js'

// Lo que se trae de cada carta de una lista. `name_key` y `category` son
// para elegir la impresión que se enseña (tanda 413): sin ellos no se
// sabe si dos líneas son la misma carta.
export const COLUMNAS_DE_LISTA = 'id, set_id, local_id, name, name_key, category, image_path,image_scrydex,image_tcggo, regulation_mark'

const cache = new Map()
const setsPorCodigo = new Map() // código Live → set_id del espejo (o null)

// Una energía básica nunca está fuera de reglamento, lleve la marca que
// lleve (regla del juego real). Por nombre y no por categoría: la
// importación básica del espejo deja category a null.
export function esEnergiaBasica(linea) {
  return /^basic\b|b[áa]sica/i.test(linea.name)
}

// Los códigos que un admin ha asignado a mano desde /admin, en
// site_settings. Existen porque la tabla de comun.js está escrita a mano
// y se queda corta CADA VEZ que sale un set: el 2026-09-01 una lista
// traía ASC, POR, CRI y MEE, y ninguno estaba — las cartas de esos
// cuatro sets salían sin imagen y nadie podía arreglarlo sin desplegar.
//
// Con esto se arregla desde el panel en un minuto y sin tocar código.
// Manda sobre la tabla del código: si algo está mal ahí, se corrige
// aquí sin esperar a nadie.
let codigosDeAdmin = null
async function overridesDeSets() {
  if (codigosDeAdmin) return codigosDeAdmin
  try {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'torneos_sets_live').maybeSingle()
    codigosDeAdmin = data?.value?.codigos || {}
  } catch {
    codigosDeAdmin = {}
  }
  return codigosDeAdmin
}

// De «TWM» al identificador de nuestro set. Tres intentos, en este
// orden y por este motivo:
//
//   1. Lo que un admin haya dicho a mano. Va primero para poder corregir
//      un error de TCGdex sin esperar a nadie. Casi siempre está vacío.
//   2. LA BASE: `tcg_sets.tcg_online_code`, que lo rellena la
//      importación con lo que dice TCGdex (tanda 233). Este es el camino
//      normal, y el que hace que un set nuevo funcione SOLO.
//   3. La tabla escrita a mano de comun.js, que busca por el nombre del
//      set. Iba a quedarse como red para los sets viejos y nada más,
//      pero TCGdex dejó de traer `tcgOnline` en la era ME (comprobado
//      el 2026-09-14: vacío en todos los sets me*), así que el paso 2
//      no tiene con qué trabajar y la tabla vuelve a ampliarse a mano
//      set a set. Si TCGdex retoma el campo, el paso 2 manda otra vez.
async function setDeCodigo(codigo) {
  if (setsPorCodigo.has(codigo)) return setsPorCodigo.get(codigo)
  const clave = String(codigo || '').toUpperCase()

  const overrides = await overridesDeSets()
  if (overrides[clave]) {
    setsPorCodigo.set(codigo, overrides[clave])
    return overrides[clave]
  }

  let setId = null
  try {
    const { data } = await supabase
      .from('tcg_sets')
      .select('id')
      .eq('market', 'WEST')
      .eq('tcg_online_code', clave)
      .limit(1)
    setId = data?.[0]?.id || null
  } catch {
    // Sin la columna (migración sin ejecutar) esto falla y se sigue por
    // la tabla de siempre, que es exactamente lo que hacía antes.
    setId = null
  }

  if (!setId) {
    const nombre = nombreDeSetLive(clave)
    if (nombre) {
      try {
        const { data } = await supabase.from('tcg_sets').select('id').eq('market', 'WEST').eq('name', nombre).limit(1)
        setId = data?.[0]?.id || null
      } catch {
        setId = null
      }
    }
  }

  setsPorCodigo.set(codigo, setId)
  return setId
}

// Los códigos de set que aparecen en una lista y que NO sabemos
// resolver. Es lo que el panel de /admin enseña para que se puedan
// asignar: sin esto, un set nuevo se queda sin imágenes en silencio y
// hay que descubrirlo mirando decklists a mano.
export async function codigosSinResolver(parsed) {
  const lineas = [...(parsed?.pokemon || []), ...(parsed?.trainer || []), ...(parsed?.energy || [])]
  const codigos = [...new Set(lineas.map((l) => String(l.set || '').toUpperCase()).filter(Boolean))]
  const sinResolver = []
  for (const c of codigos) {
    if (!(await setDeCodigo(c))) sinResolver.push(c)
  }
  return sinResolver
}

// Devuelve la carta Y CÓMO se ha encontrado, que es lo que faltaba
// (tanda 328).
//
// `exacta: true` = por su set y su número, o sea, ES la impresión que el
// jugador escribió. `exacta: false` = no hemos sabido cuál es y hemos
// cogido una gemela por el nombre, que sirve para poner una imagen y no
// sirve para NADA MÁS.
//
// La diferencia no era un matiz: el comprobador de reglamento juzgaba la
// gemela como si fuera la carta. PINGU jugó un torneo con un Mew ex de
// 30th Celebration y la lista se lo marcó en rojo como marca G, porque
// la gemela que encontramos por nombre era de 2022. Acusar a alguien de
// llevar una carta fuera de reglamento basándose en OTRA carta es lo
// peor que puede hacer esta pantalla.
export async function resolverCarta(linea) {
  const clave = `${normalizeSearch(linea.name)}|${linea.set}|${linea.number}`
  if (cache.has(clave)) return cache.get(clave)
  const nombreNorm = normalizeSearch(linea.name)
  let carta = null
  let exacta = false
  try {
    // Primero el tiro exacto: su set y su número de colección, SIN el
    // nombre (los sets nuevos numeran con ceros por delante — 057 — y
    // el export dice 57, así que se prueban las dos formas).
    const setId = await setDeCodigo(linea.set)
    if (setId) {
      const numero = String(linea.number)
      const { data } = await supabase
        .from('tcg_cards')
        .select(COLUMNAS_DE_LISTA)
        .eq('market', 'WEST')
        .eq('set_id', setId)
        .in('local_id', [numero, numero.padStart(3, '0')])
        .limit(1)
      carta = data?.[0] || null
      exacta = Boolean(carta)
    }
    // Sin set en el espejo (o carta que no aparece): por nombre, como antes.
    if (!carta) {
      const { cartas } = await searchCards(linea.name, { limite: 24 })
      const gemelas = cartas.filter((c) => normalizeSearch(c.name) === nombreNorm)
      // Si el número de colección coincide, esa ES la impresión que el
      // jugador escribió. Si no, la MÁS NUEVA — antes se cogía la primera
      // por orden alfabético, que entre diez gemelas era casi siempre una
      // impresión ANTIGUA: imagen vieja y marca fuera de reglamento para
      // una carta que el jugador puso bien.
      //
      // «Más nueva» se decide así: marca legal primero, luego marca más
      // alta (la marca ES cronológica: D 2019 … J 2026), luego la fecha
      // del set. Las SIN marca van al final a propósito: una gemela sin
      // marca es una carta anterior a 2019 o un promo raro (hay hasta
      // promos de Pocket en el espejo) — no es la que se está jugando.
      // La fecha del set va de último desempate porque HOY está a NULL en
      // todo el espejo (la importación de sets no la ha rellenado aún);
      // cuando se rellene, afinará sola.
      const legales = await marcasLegales()
      const fecha = (c) => String(c.tcg_sets?.release_date || '')
      const marca = (c) => String(c.regulation_mark || '')
      const mejor = [...gemelas].sort((a, b) => {
        const va = legales.includes(a.regulation_mark) ? 1 : 0
        const vb = legales.includes(b.regulation_mark) ? 1 : 0
        if (va !== vb) return vb - va
        if (marca(a) !== marca(b)) return marca(b).localeCompare(marca(a))
        return fecha(b).localeCompare(fecha(a))
      })
      // El número se busca sobre la lista YA ordenada: si dos sets
      // distintos coinciden en el número (pasa, con miles de cartas),
      // que gane la impresión nueva, no la primera del alfabeto.
      carta = mejor.find((c) => c.local_id === String(linea.number)) || mejor[0] || cartas[0] || null
    }
  } catch {
    carta = null
  }
  // La marca de la gemela NO se deja salir: quien la reciba no tiene
  // forma de saber que no es de esta carta, y ya sabemos en qué acaba
  // eso. Sin marca, el comprobador no puede juzgarla aunque quiera.
  const salida = carta ? { ...carta, exacta, regulation_mark: exacta ? carta.regulation_mark : null } : null
  cache.set(clave, salida)
  return salida
}


// ── Lo que se ENSEÑA de una lista (tanda 413) ──
//
// Las líneas resueltas contra el espejo, con la impresión que se enseña
// (js/impresion-canonica.js: rareza más baja de su colección, y una sola
// colección por carta) y las energías básicas de un mismo tipo en una
// sola casilla. Lo usan la rejilla y la imagen que se exporta, para que
// las dos enseñen las mismas cartas.
//
// Devuelve { porSeccion, sinIdentificar }: por sección, líneas
// { name, set, number, quantity, carta } en el orden de la lista (la
// casilla juntada va donde estaba la línea que la eligió), y cuántas
// cartas no se han podido identificar.
const SECCIONES_DE_LISTA = ['pokemon', 'trainer', 'energy']

export async function listaParaEnsenar(parsed) {
  const entradas = await Promise.all(
    SECCIONES_DE_LISTA.flatMap((seccion) =>
      (parsed?.[seccion] || []).map(async (linea) => ({ seccion, linea, n: linea.quantity, carta: await resolverCarta(linea) }))
    )
  )
  // Las que no hemos podido identificar. No son ilegales: son
  // desconocidas, y casi siempre quiere decir que el catálogo se ha
  // quedado viejo y le falta el set que salió la semana pasada. Una
  // energía básica no cuenta: esas se escriben de mil maneras y no se
  // identifican nunca.
  // Tampoco una «Fighting Energy MEE 14»: no empieza por «Basic», pero
  // tiene su tipo, va en la casilla de las de su tipo y no le falta nada.
  const sinIdentificar = entradas
    .filter((e) => (!e.carta || !e.carta.exacta) && !esEnergiaBasica(e.linea) && !letraDeEnergiaBasica(e.linea.name))
    .reduce((n, e) => n + e.n, 0)

  // Solo las EXACTAS entran a elegir impresión: una gemela encontrada por
  // el nombre no se sabe qué carta es, y no se junta con nada.
  const exactas = entradas.filter((e) => e.carta?.exacta)
  let elegidas = exactas
  try {
    elegidas = await canonizarEntradas(exactas, { columnas: COLUMNAS_DE_LISTA })
  } catch {
    elegidas = exactas
  }
  // Las energías básicas, una casilla por tipo: «Psychic Energy MEE 13» y
  // «Basic {P} Energy SVE 5» son la misma carta escrita de dos maneras, y
  // se enseñan con el mismo dibujo (js/imagen-carta.js). Da igual que una
  // se haya identificado y la otra no: si se identificó alguna, esa es la
  // que pone la cara.
  const finales = []
  for (const e of [...elegidas, ...entradas.filter((x) => !x.carta?.exacta)]) {
    const letra = letraDeEnergiaBasica(e.linea.name)
    const misma = letra && finales.find((o) => o.letra === letra)
    if (!misma) {
      finales.push({ ...e, letra })
      continue
    }
    misma.n += e.n
    if (!misma.carta?.exacta && e.carta?.exacta) Object.assign(misma, { carta: e.carta, linea: e.linea })
  }
  const porSeccion = {}
  for (const seccion of SECCIONES_DE_LISTA) {
    porSeccion[seccion] = []
    for (const e of entradas.filter((x) => x.seccion === seccion)) {
      const final = finales.find((f) => f.linea === e.linea)
      if (!final) continue
      // La carta que se enseña puede ser otra impresión: su número va a
      // la línea para la imagen de respaldo, y el código de set es el de
      // la línea que la ha traído.
      const carta = final.carta ? { ...final.carta, exacta: final.carta.exacta ?? true } : null
      porSeccion[seccion].push({
        ...final.linea,
        number: carta?.exacta && carta.local_id ? carta.local_id : final.linea.number,
        quantity: final.n,
        carta,
      })
    }
  }
  return { porSeccion, sinIdentificar }
}
