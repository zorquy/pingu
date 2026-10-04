import { tieneCJK } from '../../js/texto.js'

// Scrydex: emparejar su catálogo con el nuestro, y no tragarse un relleno.
//
// Todo lo PURO de la integración. Sin red y sin base: se prueba en Node con
// respuestas guardadas. Lo que sí pide cosas vive en la función programada.
//
// ── POR QUÉ NO SE EMPAREJA POR IDENTIFICADOR ──
//
// Porque el suyo no se deriva del nuestro. Lo midió la sesión de COWORK con
// cuatro cartas de control, y tres de las cuatro siguen una regla y la
// cuarta no:
//
//   SM1M-001  → sm1m_ja-1     (minúsculas + `_ja`)
//   M4-001    → m4_ja-1       (igual)
//   SM12a-001 → sm12a_ja-1    (igual)
//   S8b-001   → swsh8b_ja-1   ← OTRO ESQUEMA
//
// La era Espada y Escudo la nombran con el prefijo INGLÉS (`swsh`) donde
// TCGdex usa el JAPONÉS (`S`). O sea que «minúsculas + _ja» acierta en la
// mayoría y falla en una era entera — que es la peor clase de regla: la que
// funciona lo bastante para que te la creas.
//
// Y una tabla de equivalencias a mano se queda vieja el día que salga un
// set (la lección de la 323, las megas de `FORMAS_TCG`). Así que esto
// empareja por HECHOS que no dependen de cómo llame nadie a las cosas: la
// FECHA de salida y CUÁNTAS cartas tiene. Dos sets del mismo catálogo que
// salgan el mismo día con el mismo número de cartas no existen; y si
// existieran, esto lo llama AMBIGUO y no elige — que es lo contrario de
// adivinar.

// ── El relleno de su servidor de imágenes ──
//
// `images.scrydex.com` devuelve **200 con una imagen de relleno** para
// cualquier identificador que no exista. O sea que un HEAD no prueba nada:
// preguntar «¿existe?» te dice que sí SIEMPRE.
//
// Sin esto, el relleno entraría en la base como si fuera un escaneo bueno y
// la pantalla saldría llena de la misma imagen gris repetida quince mil
// veces, sin un solo error en ninguna parte. Es el fallo favorito de esta
// casa: el que no avisa.
//
// Las huellas son el SHA-1 de los PRIMEROS 1.500 BYTES del fichero, medidas
// por COWORK el 2026-10-03. Se comparan los primeros bytes y no el fichero
// entero porque basta para distinguirlos y evita descargar la imagen.
export const HUELLAS_DE_RELLENO = {
  carta: 'ce9ae950ca',
  logo: '5422192d31',
}

// ¿Lo que ha contestado su servidor es el relleno?
//
// Se compara por PREFIJO para no atarse a cuántos caracteres de SHA-1
// apuntó quien lo midió. Un `huella` más corto que la nuestra no se da por
// bueno: eso sería decir «no es relleno» por no tener con qué comparar.
export function esRelleno(huella, tipo = 'carta') {
  const conocida = HUELLAS_DE_RELLENO[tipo]
  if (!conocida) return false
  const h = String(huella || '').toLowerCase()
  if (h.length < conocida.length) return false
  return h.startsWith(conocida)
}

// Normaliza un nombre de set para compararlo: sin tildes, sin signos y en
// minúsculas. Vale para desempatar, NUNCA para emparejar solo — los nombres
// de un set japonés y su versión inglesa no se parecen en nada.
export function clave(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

// Su fecha viene con BARRAS: `"release_date": "2026/09/16"`. La nuestra
// con guiones, que es lo que entiende Postgres.
//
// Esto no es cosmética: la primera versión validaba solo `AAAA-MM-DD`, así
// que TODOS sus sets habrían salido sin fecha y el emparejamiento —que casa
// por fecha— no habría casado NI UNO. Todo «suelto», y sin un solo error.
// No se vio hasta tener delante una respuesta de verdad: el fixture lo
// había escrito yo con guiones porque me lo imaginé.
// Se exporta desde la 540: la importación de sets japoneses necesita la
// MISMA conversión, y copiarla sería tener dos reglas para las fechas con
// barras — que es justo lo que costó la 501.
export const fecha = (v) => {
  const s = String(v || '').trim().slice(0, 10).replace(/\//g, '-')
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}
const entero = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : null)

// La huella de un set: su fecha y cuántas cartas tiene. Es lo único que
// las dos partes dicen igual.
//
// La cuenta se toma de `card_count_official` y, si no, de la total: un
// catálogo cuenta las secretas y el otro puede que no, así que se guardan
// las DOS y vale que coincida cualquiera (ver `casan`).
export function huellaDeSet(set, campos = {}) {
  const f = fecha(set?.[campos.fecha || 'release_date'])
  const oficial = entero(set?.[campos.oficial || 'card_count_official'])
  const total = entero(set?.[campos.total || 'card_count_total'])
  // EL CÓDIGO, que es la señal más fuerte que tienen (`"code": "30C"`).
  // Es el código corto del set —el que sale en las decklists— y nosotros
  // lo guardamos en `tcg_online_code`. Donde los dos lo tengan, casan sin
  // discusión; pero NO se puede emparejar solo por él, porque el nuestro
  // está vacío en los sets viejos (viene del set COMPLETO de TCGdex, y de
  // 2023 para atrás ni existe: la lección de la 345).
  const codigo = String(set?.[campos.codigo || 'tcg_online_code'] || '').trim().toUpperCase() || null
  return { fecha: f, oficial, total, codigo, nombre: clave(set?.[campos.nombre || 'name']) }
}

// Dos huellas casan si comparten la fecha Y alguna de las dos cuentas.
//
// La fecha sola no basta: en Japón salen tres o cuatro sets el mismo día
// —un set y sus dos mazos de ejemplo— y emparejar por fecha a secas los
// mezclaría. La cuenta sola tampoco: hay decenas de sets de 30 cartas.
export function casan(a, b) {
  if (!a?.fecha || !b?.fecha || a.fecha !== b.fecha) return false
  const cuentas = [a.oficial, a.total].filter(Boolean)
  const suyas = [b.oficial, b.total].filter(Boolean)
  if (!cuentas.length || !suyas.length) return false
  return cuentas.some((n) => suyas.includes(n))
}

// ── El emparejamiento ──
//
// Devuelve TRES listas, y las tres importan:
//
//   · `pares`     — los que casan sin duda.
//   · `ambiguos`  — los nuestros a los que les casan DOS o más suyos. No se
//                   elige ninguno: elegir a ojo aquí es escribir el
//                   escaneo de otro set encima del bueno, y no daría error.
//   · `sueltos`   — los nuestros que no casan con nada. Son los que habrá
//                   que mirar a mano, y saber CUÁNTOS son es la medida de
//                   si esto funciona.
//
// El nombre solo entra para DESEMPATAR entre varios candidatos que ya casan
// por fecha y cuenta, y solo si uno de ellos gana claramente.

// ── Rescatar un set que la fecha y la cuenta no encuentran (tanda 508) ──
//
// En la primera escritura de verdad quedaron 37 sets sin emparejar, los 37
// con el mismo motivo: «ninguno suyo con esa fecha y esa cuenta». Son todo
// promos (`svp`, `jumbo`, `miscp`, `ex9`, `ex10`…), donde los dos catálogos
// cuentan distinto porque no hay un «total» oficial que contar.
//
// Y la salida estaba a la vista en el propio informe: **muchos de nuestros
// ids SON los suyos** — `base1 → base1`, `sm10 → sm10`, `ex7 → ex7`. Un id
// idéntico es prueba de sobra; no siempre coinciden (`me02.5 → me2pt5`,
// `lc → base6`), pero cuando coinciden no hay duda.
//
// Esto solo PROPONE. Quien escribe vuelve a confirmar el par con una señal
// que el idioma no puede engañar, así que una propuesta mala no llega a la
// base: emparejar propone, verificar dispone.
// ── SU ID JAPONÉS LLEVA EL IDIOMA PEGADO (tanda 530) ──
//
// Lo enseñó su primera respuesta japonesa de verdad: `"id": "mf_ja"`, con
// `"code": "MF"`. O sea que su id ES el nuestro con el idioma detrás, y sin
// quitarlo el rescate por id no casaría NI UNO de los 231 sets japoneses —
// sin dar ningún error, porque «no casa» es una respuesta válida.
//
// Se quita solo el sufijo de idioma y nada más: un `_` en medio no se toca,
// que es la diferencia entre normalizar y recortar a ciegas.
export function idSinIdioma(id) {
  return String(id || '').replace(/_(ja|jp|en|es|fr|de|it|pt|ko|zh|tw|cn)$/i, '')
}

function rescate(nuestro, h, deEllos, yaUsados) {
  const libres = deEllos.filter((c) => !yaUsados.has(c.set))
  const miId = clave(nuestro?.id)
  const porId = miId ? libres.filter((c) => clave(idSinIdioma(c.set?.id)) === miId) : []
  if (porId.length === 1) return { suyo: porId[0].set, por: 'id idéntico' }
  const porCodigo = h.codigo ? libres.filter((c) => c.h.codigo && c.h.codigo === h.codigo) : []
  if (porCodigo.length === 1) return { suyo: porCodigo[0].set, por: 'código' }
  return null
}

// ── UN PAR YA GUARDADO NO SE VUELVE A CALCULAR (tanda 544) ──
//
// `scrydex_id` guarda el emparejamiento CONFIRMADO desde la 509, y el
// comentario de entonces decía por qué: «un emparejamiento verificado es
// un dato, no un cálculo que se repite». Pero el emparejamiento no lo
// leía: cada pasada volvía a deducir los 82 pares japoneses desde la
// fecha y la cuenta, y a confirmarlos otra vez A UNA PETICIÓN POR PAR.
//
// Eso cuesta dos cosas. Créditos —82 confirmaciones que ya estaban
// hechas—, y TIEMPO: Netlify mata a los 30 segundos, así que los pares
// nuevos se quedaban detrás de los viejos en la cola y salían como «sin
// tiempo» pasada tras pasada. Un par guardado entra confirmado, gratis, y
// deja el presupuesto entero para los que faltan.
export function parejasGuardadas(nuestros, deEllos) {
  const suyosPorId = new Map()
  for (const c of deEllos || []) {
    const k = clave(c?.set?.id)
    if (k) suyosPorId.set(k, c.set)
  }
  const salida = []
  for (const nuestro of nuestros || []) {
    const k = clave(nuestro?.scrydex_id)
    if (!k) continue
    const suyo = suyosPorId.get(k)
    // Un `scrydex_id` que ya no está en su catálogo no se da por bueno:
    // se deja caer al emparejamiento normal, que es quien sabe decir
    // «suelto».
    if (suyo) salida.push({ nuestro, suyo })
  }
  return salida
}

// ── UN ID IDÉNTICO SE REPARTE PRIMERO (tanda 544) ──
//
// El rescate por id existía desde la 508, pero corría DESPUÉS de la fecha
// y la cuenta — y en japonés eso lo deja sin nada que rescatar. En Japón
// salen tres o cuatro sets el mismo día con la misma cuenta (un set y sus
// dos mazos de ejemplo), así que el primero de los nuestros que pasa por
// el bucle se lleva por fecha+cuenta un set suyo que por ID era de otro.
// Cuando le toca al dueño del id, su pareja ya está en `yaUsados` y se
// queda SUELTO: sin nombre occidental y sin logo, en kanji para siempre.
//
// Y eso es exactamente lo que se midió después de limpiar los huecos: 118
// sets japoneses, **82 emparejados y 36 sueltos**, con sus 231 expansiones
// enfrente —o sea que la pareja existe casi siempre—. Un id que coincide
// no puede perder contra una fecha compartida por cuatro sets.
//
// Solo reparte un id que sea ÚNICO EN LOS DOS LADOS. Si dos de los
// nuestros se llaman igual una vez quitado el idioma, o dos de los suyos
// quedan en el mismo, no hay pareja que valga: eso se deja para la fecha y
// la cuenta, que es donde se desempata. Marcar de menos aquí solo cuesta
// un set sin emparejar; marcar de más escribe el logo de otro set.
export function parejasPorId(nuestros, deEllos) {
  const unicos = (cosas, llaveDe) => {
    const m = new Map()
    for (const c of cosas) {
      const k = llaveDe(c)
      if (!k) continue
      // El segundo que repite la llave la ENVENENA: queda a null y ya no
      // la reclama nadie.
      m.set(k, m.has(k) ? null : c)
    }
    return m
  }
  const mios = unicos(nuestros || [], (n) => clave(n?.id))
  const suyos = unicos(deEllos || [], (c) => clave(idSinIdioma(c?.set?.id)))
  const salida = []
  for (const [k, nuestro] of mios) {
    const suyo = nuestro ? suyos.get(k) : null
    if (suyo) salida.push({ nuestro, suyo: suyo.set })
  }
  return salida
}

export function emparejarSets(nuestros, suyos, campos = {}) {
  const deEllos = (suyos || []).map((s) => ({ set: s, h: huellaDeSet(s, campos.suyos) }))
  const pares = []
  const ambiguos = []
  const sueltos = []
  const yaUsados = new Set()
  const yaPareados = new Set()

  for (const { nuestro, suyo } of parejasGuardadas(nuestros, deEllos)) {
    yaUsados.add(suyo)
    yaPareados.add(nuestro)
    pares.push({ nuestro, suyo, por: nuestro.scrydex_por || 'ya estaba guardado', guardado: true })
  }

  const sueltosAun = (nuestros || []).filter((n) => !yaPareados.has(n))
  for (const { nuestro, suyo } of parejasPorId(sueltosAun, deEllos.filter((c) => !yaUsados.has(c.set)))) {
    yaUsados.add(suyo)
    yaPareados.add(nuestro)
    pares.push({ nuestro, suyo, por: 'id idéntico' })
  }

  for (const nuestro of nuestros || []) {
    if (yaPareados.has(nuestro)) continue
    const h = huellaDeSet(nuestro, campos.nuestros)
    if (!h.fecha) {
      // SIN NUESTRA FECHA QUEDA EL CÓDIGO (tanda 507), y es una llave
      // MEJOR: «DRI», «UNB», «30C» es corto, canónico y no depende del
      // idioma. Hasta ahora un set sin fecha se daba por perdido sin
      // más — y los sets sin fecha son exactamente los que la tanda 322
      // encontró vacíos, o sea los que más falta hace rellenar.
      //
      // Va solo en este caso y no antes de la fecha a propósito: así lo
      // que ya emparejaba sigue emparejando igual, y esto solo RESCATA.
      const r = rescate(nuestro, h, deEllos, yaUsados)
      if (r) {
        yaUsados.add(r.suyo)
        pares.push({ nuestro, suyo: r.suyo, por: r.por })
        continue
      }
      sueltos.push({ nuestro, porque: 'sin fecha nuestra, y ni el id ni el código casan con uno solo de los suyos' })
      continue
    }
    const candidatos = deEllos.filter((c) => !yaUsados.has(c.set) && casan(h, c.h))
    if (candidatos.length === 1) {
      yaUsados.add(candidatos[0].set)
      pares.push({ nuestro, suyo: candidatos[0].set, por: 'fecha+cuenta' })
      continue
    }
    if (candidatos.length === 0) {
      // Con fecha pero sin pareja: era el caso de los 37 de la primera
      // escritura, todo promos donde las dos cuentas no coinciden porque
      // no hay un total oficial que contar. El id y el código los rescatan.
      const r = rescate(nuestro, h, deEllos, yaUsados)
      if (r) {
        yaUsados.add(r.suyo)
        pares.push({ nuestro, suyo: r.suyo, por: r.por })
        continue
      }
      sueltos.push({ nuestro, porque: 'ninguno suyo con esa fecha y esa cuenta, ni con ese id ni con ese código' })
      continue
    }
    // Varios candidatos. Se desempata primero por el CÓDIGO —`30C`, `PBL`—,
    // que es un identificador corto y no una cadena que se parezca: si los
    // dos lo tienen y coincide, no hay duda. Y si no, por el nombre.
    const porCodigo = candidatos.filter((c) => h.codigo && c.h.codigo && c.h.codigo === h.codigo)
    if (porCodigo.length === 1) {
      yaUsados.add(porCodigo[0].set)
      pares.push({ nuestro, suyo: porCodigo[0].set, por: 'fecha+cuenta+código' })
      continue
    }
    const porNombre = candidatos.filter((c) => c.h.nombre && c.h.nombre === h.nombre)
    if (porNombre.length === 1) {
      yaUsados.add(porNombre[0].set)
      pares.push({ nuestro, suyo: porNombre[0].set, por: 'fecha+cuenta+nombre' })
      continue
    }
    ambiguos.push({ nuestro, candidatos: candidatos.map((c) => c.set) })
  }
  return { pares, ambiguos, sueltos }
}

// ── La petición: adónde se va y con qué ──

export const BASE = 'https://api.scrydex.com/pokemon/v1'

// Las dos cabeceras que pide su documentación. Devuelve `{ cabeceras }` o
// `{ faltan }` con los NOMBRES de las variables que no están — nunca sus
// valores, que esto se imprime en pantalla.
//
// Las dos son obligatorias y conviene saber por qué: según sus docs, una
// petición SIN autenticar **no falla**, pasa con el límite de peticiones
// «muy reducido». O sea que olvidarse de una no da un error que cante: da
// un relleno lento que parece que la API va mal. Mejor no salir de casa.
export function cabecerasDe(env = {}) {
  const faltan = ['SCRYDEX_API_KEY', 'SCRYDEX_TEAM_ID'].filter((n) => !env[n])
  if (faltan.length) return { faltan }
  return {
    cabeceras: {
      'X-Api-Key': env.SCRYDEX_API_KEY,
      'X-Team-ID': env.SCRYDEX_TEAM_ID,
      accept: 'application/json',
    },
  }
}

// La URL de una sonda, validada.
//
// LA VALIDACIÓN NO ES PAPELEO: a esta petición se le enganchan NUESTRAS
// DOS CLAVES. Una `ruta` sin acotar —un `https://…` entero, un `../..`, un
// `//otro-host`— mandaría las claves a donde diga quien llame. Que solo
// pueda llamar un admin reduce el riesgo, no lo quita: un admin con la
// sesión robada, o un enlace que alguien le pase, bastan.
//
// Así que la ruta es un trozo de camino y nada más, y los parámetros van
// por `URLSearchParams`, que escapa lo que haga falta.
const RUTA_BUENA = /^[a-z0-9][a-z0-9/_-]*$/i
export function urlDeSonda(ruta, params = {}) {
  const r = String(ruta || '').replace(/^\/+|\/+$/g, '')
  if (!r || !RUTA_BUENA.test(r) || r.includes('..') || r.includes('//')) return null
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null || v === '') continue
    qs.set(String(k), String(v))
  }
  const cola = qs.toString()
  return `${BASE}/${r}${cola ? `?${cola}` : ''}`
}

// ── Cómo se llaman SUS campos ──
//
// Medido el 2026-10-04 con la sonda, pidiendo `en/expansions?page_size=1`.
// La respuesta, tal cual, para que esto no sea una suposición:
//
//   {"id":"me55c","name":"30th Celebration: Classic Collection",
//    "series":"Mega Evolution","code":"30C","total":30,
//    "printed_total":null,"language":"English","language_code":"EN",
//    "release_date":"2026/09/16","is_online_only":false,
//    "logo":"https://images.scrydex.com/pokemon/me55c-logo/logo",
//    "symbol":"https://images.scrydex.com/pokemon/me55c-symbol/symbol"}
//
// Y `"total_count":224` expansiones inglesas, contra nuestras 210.
//
// Tres cosas que conviene no confundir:
//   · `printed_total` es el número IMPRESO (sin secretas) y puede ser null;
//     `total` es el de verdad. O sea `printed_total`→`card_count_official`
//     y `total`→`card_count_total`.
//   · `release_date` viene con BARRAS.
//   · Las URL de imagen NO llevan extensión, y su servidor contesta 200
//     con un relleno para cualquier id — ver `esRelleno`.
export const CAMPOS_SUYOS = {
  fecha: 'release_date',
  oficial: 'printed_total',
  total: 'total',
  codigo: 'code',
  nombre: 'name',
}

// ── Las CARTAS ──
//
// Su respuesta real, pedida con `cards?page_size=1` el 2026-10-04 (recortada
// a lo que importa, y pegada entera en `test-tanda-502.mjs`):
//
//   {"id":"me55c-58","name":"Pikachu","supertype":"Pokémon",
//    "number":"58","printed_number":"58/102","rarity":"Common",
//    "rarity_code":"C","artist":"Mitsuhiro Arita",
//    "national_pokedex_numbers":[25],"regulation_mark":null,
//    "images":[{"type":"front","small":"…/small","medium":"…","large":"…"}],
//    "expansion":{…la expansión ENTERA…},"language_code":"EN",
//    "variants":[{"name":"holofoil","marketplaces":[…],"prices":[]}]}
//
// con `"total_count":47481` cartas en total.
//
// Tres cosas que no se ven de un vistazo y deciden el diseño:
//
//   1. `images` es una LISTA de objetos con `type`, no una cadena. Hay que
//      coger la de `type: "front"` — dar por hecho que la primera es la
//      buena es una suposición que aguanta hasta que no.
//   2. La expansión viene ENTERA dentro de cada carta, así que pedir
//      cartas trae de paso con qué emparejar su set.
//   3. `national_pokedex_numbers` es nuestro `dex_ids` — el que la tanda
//      483 tuvo que ir a buscar carta a carta para que la Pokédex japonesa
//      no saliera vacía. Aquí viene de serie.

// EL NÚMERO, COMPARABLE. Es la trampa fina de todo esto.
//
// Nuestro `local_id` sale tal cual de TCGdex, que en el catálogo japonés
// escribe `"001"`. El suyo es `"58"`, sin rellenar. Cruzar las cartas por
// ese campo a pelo daría CERO coincidencias y ningún error: el set
// emparejado, las cartas dentro, y ni una casando.
//
// Así que para COMPARAR se quitan los ceros de delante de cada tramo de
// dígitos —`001`→`1`, `TG01`→`tg1`, `SV001`→`sv1`— y se compara eso. Lo
// que se GUARDA sigue siendo el original: el número impreso en la carta es
// `001` y así hay que enseñarlo.
export function numeroComparable(n) {
  const s = String(n ?? '').trim().toLowerCase()
  if (!s) return ''
  // Cada tramo de dígitos pierde sus ceros a la izquierda. Un número que
  // sea solo ceros se queda en «0» y no en nada, que es distinto.
  return s.replace(/\d+/g, (d) => String(Number(d)))
}

// La imagen de la CARA de una carta, en la calidad que se pida.
//
// Devuelve null si no hay: una URL que nos inventemos la contestaría su
// servidor con un relleno y 200 (ver `esRelleno`), así que aquí no se monta
// nada a mano.
export function imagenDeCarta(carta, calidad = 'large') {
  const lista = Array.isArray(carta?.images) ? carta.images : []
  // Por `type`, no por posición: que hoy la primera sea la cara no quiere
  // decir que mañana no venga primero un reverso.
  const cara = lista.find((i) => String(i?.type || '').toLowerCase() === 'front') || null
  const url = cara?.[calidad] || cara?.large || cara?.medium || cara?.small || null
  return typeof url === 'string' && /^https:\/\//.test(url) ? url : null
}

// Lo que de una carta suya nos sirve, con NUESTROS nombres de columna.
//
// Solo se devuelve lo que VIENE: una clave ausente no se toca al escribir
// (la lección de la 487), así que un campo que ellos no tengan no borra el
// que nosotros ya hubiéramos curado.
export function cartaDeScrydex(carta) {
  if (!carta || typeof carta !== 'object') return null
  const fila = {}
  const imagen = imagenDeCarta(carta)
  if (imagen) fila.imagen_url = imagen
  if (carta.rarity) fila.rarity = String(carta.rarity)
  if (carta.artist) fila.illustrator = String(carta.artist)
  if (carta.regulation_mark) fila.regulation_mark = String(carta.regulation_mark)
  // `supertype` viene con tilde («Pokémon») y nuestra `category` es la
  // canónica inglesa, que es con la que se cruza (tandas 334 y 335).
  if (carta.supertype) {
    const s = String(carta.supertype).normalize('NFD').replace(/[̀-ͯ]/g, '')
    fila.category = s
  }
  const dex = (Array.isArray(carta.national_pokedex_numbers) ? carta.national_pokedex_numbers : [])
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n > 0)
  if (dex.length) fila.dex_ids = dex
  return fila
}

// ── Sus imágenes, que NO gastan créditos ──
//
// La dirección es derivable: `images.scrydex.com/pokemon/<id>/<calidad>`,
// con `<id>` = `<expansión>-<número>` para una carta y `<expansión>-logo`
// para un logo. Y como las imágenes no cuentan como crédito, se puede
// MEDIR la cobertura entera sin gastar casi nada: un puñado de peticiones
// a la API para emparejar los sets, y lo demás gratis.
//
// Es el mismo método con el que COWORK midió TCGdex, y es el único que
// contesta la pregunta de verdad. «¿Lo lista la API?» y «¿existe el
// fichero?» son dos preguntas distintas, y aquí la que importa es la
// segunda.
const IMAGENES = 'https://images.scrydex.com/pokemon'

export function urlDeCartaScrydex(expansionId, numero, calidad = 'small') {
  const e = String(expansionId || '').trim()
  const n = numeroComparable(numero)
  if (!e || !n || /[^a-z0-9_-]/i.test(e)) return null
  return `${IMAGENES}/${e}-${n}/${calidad}`
}

export function urlDeLogoScrydex(expansionId) {
  const e = String(expansionId || '').trim()
  if (!e || /[^a-z0-9_-]/i.test(e)) return null
  return `${IMAGENES}/${e}-logo/logo`
}

// Lo que se concluye de un puñado de medidas. Se saca aparte porque es
// aritmética y porque la conclusión tiene que ser legible sin interpretar:
// «de 30 que nos faltan, tienen 24» se entiende; un porcentaje suelto, no.
//
// Y lleva el aviso que hace honesto el número: un identificador derivado
// que no acierte cuenta como «no la tienen», así que esto es un SUELO y no
// una medida exacta. Decirlo es parte del resultado.
export function conclusion({ pedidas, conEscaneo, relleno, fallos }) {
  const miradas = Number(pedidas) || 0
  const si = Number(conEscaneo) || 0
  const pct = miradas ? Math.round((si / miradas) * 100) : 0
  return {
    miradas,
    conEscaneo: si,
    relleno: Number(relleno) || 0,
    fallos: Number(fallos) || 0,
    porcentaje: pct,
    // El veredicto en una frase, que es lo que se lee.
    veredicto:
      miradas === 0
        ? 'No se ha podido mirar ninguna: mira los sueltos de abajo.'
        : pct >= 80
          ? `Las tienen: ${si} de ${miradas} (${pct} %). Merece la pena rellenar.`
          : pct >= 30
            ? `A medias: ${si} de ${miradas} (${pct} %). Rellena lo que haya, pero no lo tapa todo.`
            : `NO las tienen: ${si} de ${miradas} (${pct} %). Por aquí no se arregla el hueco.`,
    aviso: 'Es un SUELO: el identificador de cada carta se deriva del número, y uno que no acierte cuenta como «no la tienen».',
  }
}

// ── Verificar un emparejamiento por el NOMBRE de una carta ──
//
// El emparejamiento de sets casa por fecha y cuenta, y eso acierta mucho…
// pero no siempre. En la medida del inglés salió `ex5.5 → wb1`: comparten
// fecha y cuenta, no había segundo candidato, y mi regla los casó con
// confianza. Y como en `wb1-logo` HAY un logo de verdad, la sonda lo contó
// como acierto.
//
// Ahí está la diferencia que importa: medir «¿existe una imagen en la URL
// derivada?» vale para decidir si pagar. Para ESCRIBIR no vale, porque un
// emparejamiento falso mete el logo de otro set encima del nuestro **sin
// dar ningún error**.
//
// Un nombre de carta que COINCIDE lo zanja: si nuestra `swsh12.5tg-TG04`
// se llama «Jynx» y la suya también, el par está confirmado.
//
// Uno que NO coincide no zanja nada, y eso costó la tanda 505: un nombre
// puede no coincidir porque el par esté mal O porque nuestro `name` esté en
// español. De ahí que el veredicto se llame «discrepan» y no «rechazado».
//
// Se compara con `clave()` —sin tildes, sin signos, en minúsculas— porque
// «Pokémon GO» y «Pokemon GO» son la misma carta. Pero NO más tolerante
// que eso: «Pikachu» y «Pikachu V» tienen que seguir siendo distintas, que
// si no el verificador aprueba cualquier cosa y no sirve de nada.
//
// Y la trampa que ya picó en la 483: `clave()` tira todo lo que no es
// a-z0-9, así que 「ピカチュウ」 se queda en NADA. Comparar un nombre japonés
// con uno inglés no da «distinto», da una comparación que no existe — y lo
// peor es el caso mixto: 「ピカチュウV」 deja «v», «Pikachu V» deja «pikachuv»,
// y eso sí se parece a un RECHAZO. Sería un rechazo inventado por el
// alfabeto. Así que si los dos nombres no están en el mismo alfabeto, el
// veredicto es «no se puede» y se dice por qué.
// La prueba del alfabeto vive en `js/texto.js` desde la 532, que es el
// fichero sin dependencias que comparten las dos mitades. Aquí había una
// copia, y una copia se separa sin avisar (tanda 471).
const TIENE_CJK = { test: (s) => tieneCJK(s) }

export function verificarPar({ nuestroNombre, suyoNombre }) {
  const na = String(nuestroNombre ?? '').trim()
  const nb = String(suyoNombre ?? '').trim()
  if (!na || !nb) return { veredicto: 'no-se-puede', porque: 'falta uno de los dos nombres' }
  if (TIENE_CJK.test(na) !== TIENE_CJK.test(nb)) {
    return { veredicto: 'no-se-puede', porque: `no están en el mismo alfabeto: «${na}» vs «${nb}»` }
  }
  const a = clave(na)
  const b = clave(nb)
  if (!a || !b) return { veredicto: 'no-se-puede', porque: 'ninguno de los dos nombres deja nada que comparar' }
  if (a === b) return { veredicto: 'confirmado' }
  // «discrepan» y no «rechazado» a propósito (tanda 505): que dos nombres
  // no coincidan NO es una conclusión sobre el par mientras nuestro `name`
  // pueda estar traducido. Quien decide es `culpaDeLaDiscrepancia`.
  return { veredicto: 'discrepan', porque: `se llaman distinto: «${na}» vs «${nb}»` }
}

// Su respuesta de UNA carta trae `data` como OBJETO; la de una lista, como
// array. Confundirlos deja `undefined` y el verificador diría «no se puede»
// de todo, que es un fallo que se lee como un resultado.
export function laCarta(json) {
  const d = json?.data
  if (Array.isArray(d)) return d[0] || null
  return d && typeof d === 'object' ? d : null
}

// ── Las FORMAS en que se puede escribir el id de una carta suya (tanda 505) ──
//
// La 504 montaba el id con `numeroComparable`, que pasa a minúsculas y
// quita los ceros de delante — porque eso es lo que hace falta para que
// nuestro «001» japonés case con su «1». Y para los sets normales acierta.
//
// Pero de los 171 pares, TRECE contestaron 404, y los trece con la misma
// forma: `swsh12tg-tg1` donde nuestra carta es la `TG01`, `xyp-xy1` donde
// es la `XY01`, `swshp-swsh1` donde es la `SWSH001`. O sea que ellos
// guardan el número **tal como está impreso en la carta**, con sus
// mayúsculas y sus ceros, y mi normalización lo estropeaba.
//
// Así que se prueban las dos formas, y la literal PRIMERO: es la que lleva
// la información completa. Un 404 de las dos sí es un 404.
export function formasDeId(suSetId, localId) {
  const n = String(localId ?? '').trim()
  if (!suSetId || !n) return []
  // La cuarta forma la pidió la pasada de la 505: de los trece 404 quedaron
  // DOS, y uno era `cel25c` con nuestra carta `CC001`. Se probaron «CC001»
  // y «cc1» — y la que ellos guardan es **«CC1»**: sin los ceros, pero CON
  // las mayúsculas. `numeroComparable` quitaba las dos cosas a la vez.
  const formas = [n, n.toUpperCase(), numeroComparable(n), numeroComparable(n).toUpperCase()]
  return [...new Set(formas.filter(Boolean))].map((f) => `${suSetId}-${f}`)
}

// ── De quién es la culpa cuando los dos nombres no coinciden (tanda 505) ──
//
// La 504 llamó «rechazado» a un nombre que no coincide, y se equivocó en
// los OCHO casos: nuestro `name` del catálogo occidental está en ESPAÑOL en
// parte de las filas —«Pinsir de Eco» es *Ethan's Pinsir*, «Energía Planta»
// es *Basic Grass Energy*— y el suyo en inglés. Seis de los ocho pares
// tenían el id IDÉNTICO, así que eran el mismo set con toda seguridad.
//
// La guarda del alfabeto no lo vio porque esto no es otro alfabeto: es el
// MISMO alfabeto en otro IDIOMA. Y ahí no hay nada que detectar mirando las
// dos cadenas: «Energía Planta» y «Grass Energy» se parecen tanto a una
// traducción como a dos cartas distintas.
//
// Lo que sí hay es una prueba LOCAL y gratis de quién tiene la culpa. La
// migración de la 335 copió el nombre traducido a `name_es` antes de
// recuperar el inglés, así que una fila en la que `name` y `name_es` valen
// LO MISMO tiene el español metido en `name`: la discrepancia es NUESTRA y
// no dice absolutamente nada del emparejamiento.
export function culpaDeLaDiscrepancia({ name, nameEs }) {
  if (name && nameEs && clave(name) === clave(nameEs)) {
    return { culpa: 'nuestra', porque: 'nuestro `name` está en español (vale lo mismo que `name_es`), así que esto no dice nada del par' }
  }
  return { culpa: 'desconocida', porque: 'puede ser que el par esté mal, o que nuestro nombre esté traducido' }
}

// ── Verificar un par con señales que el IDIOMA NO PUEDE ENGAÑAR (tanda 506) ──
//
// La 504 verificó por el nombre y se equivocó en los ocho rechazos; la 505
// le quitó la palabra «rechazado» porque la comparación no la sostenía.
// Esto es lo que faltaba, y salió de tener delante su ficha de verdad
// (`cards/sm10-1`, sondeada el 2026-10-04) en vez de imaginármela:
//
//   "artist": "Mitsuhiro Arita",
//   "national_pokedex_numbers": [794, 795],
//   "hp": "260",
//   "expansion": { "id": "sm10", "code": "UNB", "total": 238, … }
//
// Y la mejor de las cuatro no es el ilustrador: es **`expansion.code`**.
// Porque la pregunta que se está contestando es sobre el SET, no sobre la
// carta — y ese código («UNB», «30C») es exactamente nuestro
// `tcg_online_code`, es corto, es canónico y viene GRATIS en la misma
// petición que ya hacíamos.
//
// Las señales van en DOS clases, y la diferencia es la lección de la 505:
//
//   · DECIDEN (pueden confirmar Y rechazar): el código del set y los
//     números de Pokédex. Un código distinto o dos listas de Pokédex sin
//     un número en común no se explican con una traducción.
//
//   · CONFIRMAN SOLO (nunca rechazan): el ilustrador, los PS y el nombre.
//     El ilustrador porque los catálogos lo acreditan de formas distintas
//     («Mitsuhiro Arita» / «Arita Mitsuhiro»), los PS porque cientos de
//     cartas comparten 260, y el nombre porque puede estar traducido.
//
// Un falso negativo aquí solo deja un par sin verificar. Un falso positivo
// mete el logo de otro set en la base. Así que se rechaza solo con lo que
// no admite otra explicación.

const mismos = (a, b) => clave(a) && clave(b) && clave(a) === clave(b)

// Rellenar solo lo que falta, y «faltar» no es lo mismo en un número que
// en un texto (tanda 508): para un NÚMERO el cero es un valor —pisé el
// `card_count_official` de `mep`, que valía 0, por usar `||`—; para un
// TEXTO la cadena vacía no es nada que nadie quisiera guardar.
export const rellenarNumero = (nuestro, suyo) => (nuestro ?? suyo ?? null)
export const rellenarTexto = (nuestro, suyo) => (
  (typeof nuestro === 'string' && nuestro.trim()) ? nuestro : (suyo ?? null)
)

function senalDeLaPokedex(nuestros, suyos) {
  const a = (nuestros || []).map(Number).filter(Number.isFinite)
  const b = (suyos || []).map(Number).filter(Number.isFinite)
  if (!a.length || !b.length) return 'muda'
  return a.some((n) => b.includes(n)) ? 'coincide' : 'discrepa'
}

export function senalesDelPar({ nuestra = {}, nuestroSet = {}, suya = {} }) {
  const exp = suya?.expansion || {}
  // ── EL CÓDIGO DEL SET YA NO RECHAZA (tanda 508) ──
  //
  // En la primera escritura de verdad rechazó `ex7 → ex7`: mismo id, mismo
  // set (*EX Team Rocket Returns*), y los códigos eran «RR» el nuestro y
  // «TRR» el suyo. Los dos están bien; lo que pasa es que cada catálogo lo
  // abrevia a su manera.
  //
  // Y ahí está la lección, que va un paso más allá de la 506: **una señal
  // que no depende del IDIOMA puede seguir dependiendo del FABRICANTE**.
  // Los números de Pokédex son canónicos —hay una sola Pokédex Nacional y
  // la publica quien hace los juegos—. Un código de TCG Live es una
  // CONVENCIÓN, y dos catálogos pueden abreviar bien y distinto.
  //
  // Así que confirma (acertó 126 veces de 167) y no rechaza: un código que
  // no cuadra se queda en «discrepa» sin `decide`, y sale en el informe
  // para mirarlo a mano.
  const deciden = [
    {
      que: 'los números de Pokédex', nuestro: nuestra.dex_ids, suyo: suya.national_pokedex_numbers,
      estado: senalDeLaPokedex(nuestra.dex_ids, suya.national_pokedex_numbers),
    },
  ]
  const codigo = {
    que: 'el código del set', nuestro: nuestroSet.tcg_online_code, suyo: exp.code,
    estado: !clave(nuestroSet.tcg_online_code) || !clave(exp.code)
      ? 'muda'
      : (mismos(nuestroSet.tcg_online_code, exp.code) ? 'coincide' : 'discrepa'),
  }
  // Estas dicen lo que VEN —«coincide» o «discrepa»—, y es la política de
  // `veredictoDelPar` la que sabe que un «discrepa» de aquí no rechaza.
  //
  // Antes mentían: devolvían «muda» cuando en realidad discrepaban, para
  // que no pudieran rechazar. Eso dejaba la regla escrita DOS VECES —aquí
  // y en la política— y por tanto ninguna de las dos se podía observar:
  // quitar cualquiera de ellas no cambiaba nada y el rigor lo apuntaba
  // como «sin detectar». Es la lección de la 314, y la salida es la de
  // siempre: **que cada uno diga la verdad y que decida UNO**. De paso, el
  // informe puede enseñar «el nombre discrepa pero el código confirma»,
  // que es información y no ruido.
  const confirman = [
    codigo,
    { que: 'el ilustrador', nuestro: nuestra.illustrator, suyo: suya.artist },
    { que: 'los PS', nuestro: nuestra.hp, suyo: suya.hp },
    { que: 'el nombre', nuestro: nuestra.name, suyo: suya.name },
    // ── EL NOMBRE DEL SET (tanda 530) ──
    //
    // En el catálogo japonés esta señal es gratis y fuerte: los DOS lo
    // publican en japonés, así que comparar no cruza idiomas —que es lo
    // que estropeaba el nombre de la carta en el occidental, donde el
    // nuestro está en español y el suyo en inglés (tanda 505)—.
    //
    // Confirma y no rechaza, como todas las de aquí: dos catálogos pueden
    // rotular el mismo set de maneras distintas, y un nombre que NO
    // coincide no concluye nada. Sin ella, confirmar un set japonés
    // costaría una petición por set: 231 créditos en vez de cero.
    { que: 'el nombre del set', nuestro: nuestroSet.name, suyo: exp.name },
  ].map((s) => ({
    ...s,
    decide: false,
    // El código ya trae su estado calculado arriba; los demás se comparan
    // aquí. `s.estado` manda si existe, para no recalcularlo de dos formas
    // —que es como se separan dos copias de la misma regla (tanda 471)—.
    estado: s.estado ?? (!clave(s.nuestro) || !clave(s.suyo)
      ? 'muda'
      : (mismos(s.nuestro, s.suyo) ? 'coincide' : 'discrepa')),
  }))
  return { deciden: deciden.map((s) => ({ ...s, decide: true })), confirman }
}

export function veredictoDelPar({ nuestra, nuestroSet, suya }) {
  const { deciden, confirman } = senalesDelPar({ nuestra, nuestroSet, suya })
  // LA POLÍTICA, en un solo sitio: solo rechaza lo que lleva `decide`.
  // Un «discrepa» del nombre o del ilustrador se ve en el informe y no
  // decide nada.
  const contra = [...deciden, ...confirman].find((s) => s.decide && s.estado === 'discrepa')
  if (contra) {
    return {
      veredicto: 'rechazado',
      por: contra.que,
      porque: `${contra.que} no cuadra: nuestro «${contra.nuestro}» contra su «${contra.suyo}»`,
    }
  }
  const aFavor = [...deciden, ...confirman].find((s) => s.estado === 'coincide')
  if (aFavor) return { veredicto: 'confirmado', por: aFavor.que }
  // Ninguna señal dice nada. No es un rechazo: es que no tenemos con qué.
  const mudas = [...deciden, ...confirman].filter((s) => s.estado === 'muda').map((s) => s.que)
  return { veredicto: 'sin-senal', porque: `no coincide ni contradice nada (mudas: ${mudas.join(', ')})` }
}

// ── La cuenta del informe tiene que cuadrar (tanda 506) ──
//
// En la pasada de la 505 el panel enseñó «160 confirmados + 2 sin
// comprobar» de 171 verificados. Faltaban NUEVE y nada dijo nada: el
// navegador tenía el panel viejo en caché y leía un campo que la respuesta
// ya no traía, así que una casilla entera se perdió EN SILENCIO.
//
// Un informe cuyas casillas no suman el total es un informe con un
// agujero, y quien lo lee no tiene forma de saberlo. Vive aquí y no dentro
// de la función para poder ejercitarla con un total que NO cuadra: una
// guarda que solo se prueba cuando no salta no se está probando.
export function cuentaDelInforme(verificadas, casillas) {
  const suma = (casillas || []).reduce((t, c) => t + (Array.isArray(c) ? c.length : Number(c) || 0), 0)
  if (suma === verificadas) return { suma, cuadra: true }
  return {
    suma,
    cuadra: false,
    aviso: `LAS CASILLAS NO SUMAN: ${suma} de ${verificadas}. Falta una casilla por enseñar.`,
  }
}

// ── La fila de un set, con Scrydex delante y TCGdex detrás (tanda 507) ──
//
// PINGU: «fíate del catálogo de Scrydex, y si falta algo en Scrydex
// cógelo de las otras cosas». Aquí está esa regla escrita UNA vez.
//
// Dos clases de columna, y la diferencia importa:
//
//   · Las de Scrydex (`logo_scrydex`, `symbol_scrydex`) son NUEVAS y se
//     escriben siempre que él las tenga. No pisan nada: lo de TCGdex se
//     queda donde está y sigue siendo el respaldo.
//
//   · Las NUESTRAS (`release_date`, `tcg_online_code`,
//     `card_count_official`) solo se rellenan si están vacías. Son las
//     que la tanda 322 encontró a null en los 220 sets porque el listado
//     de TCGdex es un «SetResume» y no las trae.
//
// Y devuelve SIEMPRE las mismas claves, con el valor nuestro cuando lo
// hay: PostgREST exige claves uniformes en todos los objetos de una
// misma sentencia, y una escritura que repite el valor que ya estaba no
// hace nada. Así se respeta «no pisar» sin partir el upsert en diez
// sentencias distintas.
export function filaDeSetConScrydex(nuestro, suyo, por = null) {
  const suLogo = typeof suyo?.logo === 'string' && /^https:\/\//.test(suyo.logo) ? suyo.logo : null
  const suSimbolo = typeof suyo?.symbol === 'string' && /^https:\/\//.test(suyo.symbol) ? suyo.symbol : null
  const suFecha = fecha(suyo?.release_date)
  const oficial = Number(suyo?.printed_total)
  return {
    id: nuestro.id,
    market: nuestro.market || 'WEST',
    // `name` es `not null`, así que va en el upsert — con EL NUESTRO. El
    // nombre de un set es lo que lee la gente y el nuestro está en
    // español a propósito.
    name: nuestro.name,
    // ── EL NOMBRE OCCIDENTAL (tanda 532) ──
    //
    // Viene en la MISMA respuesta que el logo, gratis: `translation.en.name`
    // y `series`. Para un set japonés es lo que se enseña —los kanji no los
    // lee quien lee español— y el japonés se queda en `name`, que es el
    // nombre de verdad del set.
    //
    // Con `rellenarTexto`, o sea sin pisar: si ya hay uno, se queda.
    name_en: rellenarTexto(nuestro.name_en, suyo?.translation?.en?.name),
    serie_name_en: rellenarTexto(nuestro.serie_name_en, suyo?.series),
    logo_scrydex: suLogo || nuestro.logo_scrydex || null,
    symbol_scrydex: suSimbolo || nuestro.symbol_scrydex || null,
    // `??` Y NO `||` (tanda 508). Lo escribí con `||` y en la primera
    // escritura de verdad pisé el `card_count_official` de `mep`, que
    // valía **0**: `||` trata el cero como «vacío», y un cero es un VALOR.
    // No hizo daño —`0` y `null` se pintan igual— pero la regla decía «no
    // se pisa nada nuestro» y se pisó. Es la misma familia que el
    // `progreso = {}` de la 319: confundir «no lo tengo» con «vale cero».
    release_date: rellenarTexto(nuestro.release_date, suFecha),
    tcg_online_code: rellenarTexto(nuestro.tcg_online_code, suyo?.code),
    card_count_official: rellenarNumero(
      nuestro.card_count_official,
      Number.isFinite(oficial) && oficial > 0 ? oficial : null,
    ),
    // EL EMPAREJAMIENTO, GUARDADO (tanda 509). La 507 lo verificaba y lo
    // tiraba, así que cada pasada de las cartas tendría que volver a
    // pedir sus 224 expansiones y a verificar los 210 pares — y podría
    // emparejar DISTINTO que la vez anterior sin que nada lo dijera. Un
    // emparejamiento verificado es un dato, no un cálculo que se repite.
    scrydex_id: suyo?.id ?? nuestro.scrydex_id ?? null,
    scrydex_por: por ?? nuestro.scrydex_por ?? null,
  }
}

// Qué cambia de verdad entre la fila que hay y la que se va a escribir.
// Existe para el ENSAYO EN SECO: una escritura contra producción que no
// se puede mirar antes es una escritura a ciegas, y esta rama la
// despliega Netlify en directo.
export function loQueCambia(antes, despues) {
  const cambios = {}
  for (const k of Object.keys(despues)) {
    if (k === 'id' || k === 'market' || k === 'name') continue
    const a = antes?.[k] ?? null
    const b = despues[k] ?? null
    if (String(a) !== String(b)) cambios[k] = { de: a, a: b }
  }
  return cambios
}

// ── Una carta suya pasada a nuestras columnas (tanda 509) ──
//
// PINGU: «quiero que me rellenes todas las cartas posibles […] y las
// rarezas tienen que ser muy exactas», con el caso que lo demuestra: en
// Lost Thunder las arcoíris salen como «Rara Híper» y **no lo son**.
//
// El motivo es que TCGdex COLAPSA esa rareza —le llama «Hyper rare» a la
// arcoíris y a la dorada— y Scrydex las distingue. Así que su inglés va a
// `rarity_en` y `rarity` se queda en español, que es lo que pintan los
// filtros: lo mismo que `name` y `name_es` (tanda 335).
//
// ── LO QUE NO SE TOCA, Y POR QUÉ ──
//
// `rarity`, `types` y `category` NO se escriben. Lo nuestro viene de
// TCGdex **en español** («Rara Doble», «Pokémon») y lo suyo en inglés.
// Sobrescribir mezclaría los dos idiomas dentro del MISMO filtro, y los
// desplegables de /mi-coleccion saldrían partidos por la mitad sin dar
// ningún error — que es exactamente la lección de la tanda 455.
//
// Y las claves son SIEMPRE las mismas, con el valor nuestro cuando lo hay:
// PostgREST exige claves uniformes en todos los objetos de una sentencia.
export function filaDeCartaConScrydex(nuestra, suya, ahora = new Date()) {
  const foto = imagenDeCarta(suya)
  // Su URL viene con la calidad pegada (`…/sm10-1/small`). Se guarda SIN
  // ella, porque quien pinta elige el tamaño — y guardar «small» dejaría
  // la ficha grande pintando una miniatura para siempre.
  const base = typeof foto === 'string' ? foto.replace(/\/(small|medium|large)$/, '') : null
  const dex = Array.isArray(suya?.national_pokedex_numbers)
    ? suya.national_pokedex_numbers.map(Number).filter(Number.isFinite)
    : null
  const ps = Number(String(suya?.hp ?? '').trim())
  return {
    id: nuestra.id,
    market: nuestra.market || 'WEST',
    set_id: nuestra.set_id,
    // ── LAS TRES COLUMNAS QUE NO SE ESCRIBEN: SE REPITEN (tanda 526) ──
    //
    // `local_id` y `name` son `not null` en `tcg_cards`, y esto es un
    // UPSERT: PostgREST manda `insert … on conflict do update`, así que
    // Postgres FORMA la fila que insertaría antes de ver que ya existe —
    // y una fila con `local_id` nulo no se puede formar. **Da 23502 y
    // rechaza la sentencia ENTERA**, las 250 cartas de la página, aunque
    // todas esas filas existieran ya y aquello fuera a ser un update.
    //
    // O sea que el relleno de la noche del 2026-10-03 corrió entero sin
    // escribir ni una carta: 0 de 21.476, con el panel diciendo que iba
    // por la página 42. No es un valor que se quiera cambiar — es el que
    // ya tiene la fila, repetido para que la fila se pueda formar.
    local_id: nuestra.local_id,
    name: nuestra.name,
    // EL NOMBRE OCCIDENTAL DE LA CARTA (tanda 537), que es lo que PINGU
    // pidió para el catálogo japonés: «además de los kanji, ponme los
    // nombres que tiene Scrydex». Viene donde en las expansiones, así que
    // si en las cartas no viniera, esto se queda a null y la pantalla
    // sigue enseñando el japonés — que es lo que hay hoy, no una pérdida.
    name_en: rellenarTexto(nuestra.name_en, suya?.translation?.en?.name),
    image_scrydex: base || nuestra.image_scrydex || null,
    rarity_en: rellenarTexto(nuestra.rarity_en, suya?.rarity),
    rarity_code: rellenarTexto(nuestra.rarity_code, suya?.rarity_code),
    illustrator: rellenarTexto(nuestra.illustrator, suya?.artist),
    dex_ids: (Array.isArray(nuestra.dex_ids) && nuestra.dex_ids.length) ? nuestra.dex_ids : (dex?.length ? dex : null),
    hp: rellenarNumero(nuestra.hp, Number.isFinite(ps) && ps > 0 ? ps : null),
    scrydex_at: ahora.toISOString(),
  }
}

// ── UNA CARTA SUYA QUE NO TENEMOS: LA FILA ENTERA (tanda 545) ──
//
// El relleno solo ENRIQUECE: `if (!nuestra) continue`. O sea que de los
// sets que trajimos de su catálogo —los que TCGdex no tiene— no se escribe
// NI UNA CARTA, y una colección vacía en la biblioteca es exactamente el
// hueco que acabamos de borrar 68 veces.
//
// Y no cuesta un crédito más: el barrido ya está pagando esas páginas y
// esas cartas van dentro. Lo único que hacía falta era dejar de tirarlas.
//
// `category` sale de su `supertype`, traducido a lo que la web espera.
// NO se escribe `types`: en su respuesta japonesa no he visto ese campo,
// y escribir en una columna que filtra algo que no sé en qué idioma viene
// es peor que dejarla vacía (la lección de la 484 — de Scrydex se afirma
// lo que Scrydex ha contestado).
export const CATEGORIA_DE_SUPERTIPO = {
  pokémon: 'Pokemon', pokemon: 'Pokemon', trainer: 'Trainer', energy: 'Energy',
}

// ── EL DETALLE ENTERO DE UNA CARTA SUYA (tanda 547) ──
//
// PINGU: «todo el catálogo japonés lo traemos directamente de Scrydex. Lo
// montamos así y ya está».
//
// Y se puede, porque su respuesta de cartas trae la ficha COMPLETA. Esto no
// es una suposición: está pegada byte a byte en `test-tanda-502.mjs`, de una
// petición de verdad, y lleva `subtypes`, `types`, `hp`, `evolves_from`,
// `abilities`, `attacks` con su texto y su daño, `weaknesses`,
// `resistances`, `converted_retreat_cost`, `rules`, `flavor_text`,
// `regulation_mark` y `variants`. O sea que para el japonés TCGdex no hace
// falta ni para el detalle.
//
// ── LOS ENUMS SE TRADUCEN A LO NUESTRO, Y LO QUE NO SE RECONOCE SE DEJA ──
//
// Nuestras columnas guardan la forma canónica inglesa (`Pokemon`, `Stage1`,
// `Supporter`), que es con la que compara todo el código desde la 334. Sus
// nombres son parecidos pero no iguales: «Pokémon» con tilde, «Stage 1» con
// espacio, «Pokémon Tool» por «Tool».
//
// Un valor que no esté en estas tablas **se queda a null**, y se CUENTA en
// el informe. No se inventa y no se escribe tal cual: una columna que
// decide si una carta es un Pokémon o un Entrenador, rellenada con algo que
// nadie reconoce, es una ficha rota sin un solo error. Y como el japonés no
// lo he visto contestar desde aquí —la red de este contenedor no llega a su
// API—, el contador es la única forma honesta de saber si sus enums vienen
// en inglés también en japonés, que es lo que doy por hecho.
export const FASE_DE_SUBTIPO = {
  basic: 'Basic', 'stage 1': 'Stage1', 'stage 2': 'Stage2', mega: 'MEGA',
  vmax: 'VMAX', vstar: 'VSTAR', restored: 'Restored', 'level-up': 'LEVEL-UP',
  'baby': 'Basic',
}
export const ENTRENADOR_DE_SUBTIPO = {
  supporter: 'Supporter', item: 'Item', stadium: 'Stadium',
  'pokémon tool': 'Tool', 'pokemon tool': 'Tool', tool: 'Tool',
}
// `Normal` y `Special` son los canónicos (ver `A_ENERGIA` en
// js/carta-detalle.js): una energía básica es la que vale `Normal`.
export const ENERGIA_DE_SUBTIPO = { basic: 'Normal', special: 'Special' }
export const VARIANTE_DE_SUYA = {
  normal: 'normal', holofoil: 'holo', 'reverse holofoil': 'reverse',
  'first edition': 'firstEdition', '1st edition': 'firstEdition',
}

const minus = (x) => String(x ?? '').trim().toLowerCase()

// Lo que de sus `subtypes` sabemos leer. Devuelve también los que NO, para
// que el informe los diga en vez de que se pierdan.
export function deSubtipos(suya) {
  const subtipos = Array.isArray(suya?.subtypes) ? suya.subtypes.map(minus).filter(Boolean) : []
  const cat = CATEGORIA_DE_SUPERTIPO[minus(suya?.supertype)] || null
  const fase = subtipos.map((x) => FASE_DE_SUBTIPO[x]).find(Boolean) || null
  const entrenador = subtipos.map((x) => ENTRENADOR_DE_SUBTIPO[x]).find(Boolean) || null
  const energia = subtipos.map((x) => ENERGIA_DE_SUBTIPO[x]).find(Boolean) || null
  // Un subtipo es «raro» solo si no lo reconoce NINGUNA de las tres tablas:
  // «ex», «Tera» o «Ancient» son etiquetas de verdad que no van a ninguna
  // de nuestras columnas, así que no cuentan como sorpresa… pero `basic` sí
  // significa dos cosas distintas según el supertipo, y de eso se encarga
  // la columna que se escribe más abajo.
  const raros = subtipos.filter((x) => !FASE_DE_SUBTIPO[x] && !ENTRENADOR_DE_SUBTIPO[x] && !ENERGIA_DE_SUBTIPO[x])
  return {
    category: cat,
    // La FASE es solo de un Pokémon, y el tipo de energía solo de una
    // energía: `basic` vale para los dos y escribirlo en la columna
    // equivocada haría que una Energía Básica saliera como «Básico».
    stage: cat === 'Pokemon' ? fase : null,
    trainer_type: cat === 'Trainer' ? entrenador : null,
    energy_type: cat === 'Energy' ? energia : null,
    raros,
    // Y si el supertipo no se reconoce, se dice: es el que decide las
    // otras tres.
    supertipoRaro: suya?.supertype && !cat ? String(suya.supertype) : null,
  }
}

const lista = (x) => (Array.isArray(x) && x.length ? x : null)

export function detalleDeCartaSuya(suya, { idioma = 'ja' } = {}) {
  const { category, stage, trainer_type, energy_type } = deSubtipos(suya)
  const ps = Number(String(suya?.hp ?? '').trim())
  const retirada = Number(suya?.converted_retreat_cost)
  // `evolves_from` es una LISTA en su respuesta («evolves_from": []») y
  // nuestra columna es un texto: se coge el primero, que es lo que hay.
  const deQuien = Array.isArray(suya?.evolves_from) ? suya.evolves_from.filter(Boolean)[0] : suya?.evolves_from
  // Su `text` es nuestro `effect`: el pintor lee `a.effect`, así que
  // guardarlo con su nombre dejaría los ataques SIN TEXTO y sin dar error.
  const ataques = (Array.isArray(suya?.attacks) ? suya.attacks : []).map((a) => ({
    name: a?.name || '', cost: Array.isArray(a?.cost) ? a.cost : [],
    damage: a?.damage ?? null, effect: a?.text ?? null,
  }))
  const habilidades = (Array.isArray(suya?.abilities) ? suya.abilities : []).map((h) => ({
    name: h?.name || '', type: h?.type || 'Habilidad', effect: h?.text ?? null,
  }))
  // Las versiones: de su lista de nombres a nuestro objeto de banderas. Lo
  // que no se reconoce no se marca — una versión inventada es un bolsillo
  // de álbum que no existe.
  const variantes = {}
  for (const v of Array.isArray(suya?.variants) ? suya.variants : []) {
    const k = VARIANTE_DE_SUYA[minus(v?.name)]
    if (k) variantes[k] = true
  }
  return {
    category,
    stage,
    trainer_type,
    energy_type,
    types: lista(Array.isArray(suya?.types) ? suya.types.filter(Boolean) : null),
    hp: Number.isFinite(ps) && ps > 0 ? ps : null,
    evolve_from: deQuien || null,
    retreat: Number.isFinite(retirada) ? retirada : null,
    attacks: lista(ataques),
    abilities: lista(habilidades),
    weaknesses: lista(suya?.weaknesses),
    resistances: lista(suya?.resistances),
    // El texto de debajo: un Entrenador lleva sus `rules` y un Pokémon su
    // texto de sabor. Son dos campos suyos y una sola columna nuestra.
    description: (Array.isArray(suya?.rules) && suya.rules.length ? suya.rules.join('\n\n') : null)
      || suya?.flavor_text || null,
    regulation_mark: suya?.regulation_mark || null,
    variants: Object.keys(variantes).length ? variantes : null,
    // DE QUÉ IDIOMA ES LA FICHA, que decide si una reimpresión puede
    // comparar los nombres de los ataques (tanda 333). Sin esto, una carta
    // japonesa compararía «かみつく» con «Gnaw» y no casaría nunca.
    detalle_lang: idioma,
    detalle_at: new Date().toISOString(),
  }
}

export function filaDeCartaSuya(suya, { setId, market, idioma = 'ja', ahora = new Date() } = {}) {
  const numero = String(suya?.number ?? '').trim()
  // `local_id` y `name` son `not null`: una carta suya sin número no deja
  // formar la fila, y aquí no se inventa un número (la lección de la 526,
  // que costó una noche a cero).
  if (!suya?.id || !setId || !numero) return null
  const nombre = String(suya?.name || suya?.translation?.en?.name || '').trim()
  if (!nombre) return null
  const foto = imagenDeCarta(suya)
  const base = typeof foto === 'string' ? foto.replace(/\/(small|medium|large)$/, '') : null
  const dex = Array.isArray(suya?.national_pokedex_numbers)
    ? suya.national_pokedex_numbers.map(Number).filter(Number.isFinite)
    : null
  return {
    // SU identificador, tal cual. Es lo que pidió PINGU —«calca su base»—
    // y además es lo único que garantiza que no choque con uno nuestro.
    id: suya.id,
    market: market || 'JP',
    set_id: setId,
    local_id: numero,
    name: nombre,
    name_en: suya?.translation?.en?.name || null,
    image_scrydex: base,
    rarity_en: suya?.rarity || null,
    rarity_code: suya?.rarity_code || null,
    illustrator: suya?.artist || null,
    dex_ids: dex?.length ? dex : null,
    // Y la ficha ENTERA (tanda 547): ataques, habilidades, debilidades,
    // fase, retirada, versiones. Su respuesta de cartas la trae toda, así
    // que una carta importada de aquí nace completa y no hay que volver a
    // pedirla — que es lo que `cartas-detalle` hace con las occidentales a
    // una petición por carta.
    ...detalleDeCartaSuya(suya, { idioma }),
    // La rareza va en las DOS columnas: `rarity_en` es la suya exacta
    // (tanda 509) y `rarity` es la que se enseña — en un catálogo que
    // viene entero de Scrydex son la misma, y el traductor de rarezas la
    // pinta en español al leerla.
    rarity: suya?.rarity || null,
    scrydex_at: ahora.toISOString(),
  }
}

// ── El nombre inglés, pero SOLO donde se puede demostrar que el nuestro
//    está en español (tanda 509) ──
//
// Es el arreglo del hallazgo de la 505: ~1.890 cartas occidentales llevan
// el español metido en `name`, que es la CLAVE con la que se cruzan
// `tcg_card_play`, el resolutor de decklists y la huella de las
// reimpresiones (tandas 334 y 335). No casan con nada, sin dar error.
//
// Y se arregla con cuidado, porque `name` se PISA: solo cuando nuestra
// fila demuestra que lleva el español —`name` vale lo mismo que
// `name_es`— y además el suyo dice otra cosa. Si no, no se toca.
export function nombreQueHayQueArreglar(nuestra, suya) {
  const suyo = typeof suya?.name === 'string' ? suya.name.trim() : ''
  if (!suyo) return null
  if (culpaDeLaDiscrepancia({ name: nuestra?.name, nameEs: nuestra?.name_es }).culpa !== 'nuestra') return null
  if (clave(nuestra?.name) === clave(suyo)) return null
  return suyo
}
