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
const fecha = (v) => {
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
export function emparejarSets(nuestros, suyos, campos = {}) {
  const deEllos = (suyos || []).map((s) => ({ set: s, h: huellaDeSet(s, campos.suyos) }))
  const pares = []
  const ambiguos = []
  const sueltos = []
  const yaUsados = new Set()

  for (const nuestro of nuestros || []) {
    const h = huellaDeSet(nuestro, campos.nuestros)
    if (!h.fecha) {
      sueltos.push({ nuestro, porque: 'no tenemos su fecha de salida' })
      continue
    }
    const candidatos = deEllos.filter((c) => !yaUsados.has(c.set) && casan(h, c.h))
    if (candidatos.length === 1) {
      yaUsados.add(candidatos[0].set)
      pares.push({ nuestro, suyo: candidatos[0].set, por: 'fecha+cuenta' })
      continue
    }
    if (candidatos.length === 0) {
      sueltos.push({ nuestro, porque: 'ninguno suyo con esa fecha y esa cuenta' })
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
const TIENE_CJK = /[\u3000-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef\uac00-\ud7af]/

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

function senalDeLaPokedex(nuestros, suyos) {
  const a = (nuestros || []).map(Number).filter(Number.isFinite)
  const b = (suyos || []).map(Number).filter(Number.isFinite)
  if (!a.length || !b.length) return 'muda'
  return a.some((n) => b.includes(n)) ? 'coincide' : 'discrepa'
}

export function senalesDelPar({ nuestra = {}, nuestroSet = {}, suya = {} }) {
  const exp = suya?.expansion || {}
  const deciden = [
    {
      que: 'el código del set', nuestro: nuestroSet.tcg_online_code, suyo: exp.code,
      estado: !clave(nuestroSet.tcg_online_code) || !clave(exp.code)
        ? 'muda'
        : (mismos(nuestroSet.tcg_online_code, exp.code) ? 'coincide' : 'discrepa'),
    },
    {
      que: 'los números de Pokédex', nuestro: nuestra.dex_ids, suyo: suya.national_pokedex_numbers,
      estado: senalDeLaPokedex(nuestra.dex_ids, suya.national_pokedex_numbers),
    },
  ]
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
    { que: 'el ilustrador', nuestro: nuestra.illustrator, suyo: suya.artist },
    { que: 'los PS', nuestro: nuestra.hp, suyo: suya.hp },
    { que: 'el nombre', nuestro: nuestra.name, suyo: suya.name },
  ].map((s) => ({
    ...s,
    decide: false,
    estado: !clave(s.nuestro) || !clave(s.suyo)
      ? 'muda'
      : (mismos(s.nuestro, s.suyo) ? 'coincide' : 'discrepa'),
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
