// Las consultas de «Mi colección» (tanda 365). Lo usan /mi-coleccion y
// el bloque de precio y colección de la ficha de una carta.
import { supabase } from '../supabase.js'
import { urlDePrecio, precioDe, precioDeFila, claveDeLinea } from '../cardmarket.js'
// El mercado por defecto NO se escribe aquí a mano (tanda 485): `market` es
// `not null default 'WEST'` en la base, así que una línea que no diga nada ES
// occidental, y una copia de ese valor que se separe dejaría el Panel
// buscando cartas con una clave que no existe.
import { MERCADO_POR_DEFECTO } from '../mercados.js'

export const FICHERO_MIGRACION = 'supabase-migration-mi-coleccion.sql'

// Se exporta desde la tanda 402: `carpetas.js` necesita la misma lectura
// de «esto es que la migración no está puesta», y copiarla sería tener
// dos ideas de cuándo callarse.
export function traducir(error) {
  if (!error) return null
  const sin = ['PGRST202', 'PGRST205', '42P01', '42703'].includes(error.code) || /does not exist|Could not find/i.test(error.message || '')
  // El CHECK del idioma, que es otra migración y otro mensaje (tanda 472).
  // Desde que el catálogo CHINO se puede mirar, añadir de él guarda la
  // carta con `idioma: 'zh'` — y hasta que
  // `supabase-migration-idioma-chino.sql` se ejecute, Postgres la rechaza
  // con un 23514. Sin esto la web ensañaba el texto crudo de Postgres
  // («violates check constraint "user_collection_idioma"»), que no le dice
  // nada a nadie y menos aún qué hacer.
  const idioma = error.code === '23514' && /_idioma\b/.test(error.message || '')
  const e = new Error(
    idioma
      ? 'Falta ejecutar supabase-migration-idioma-chino.sql en Supabase: todavía no se puede guardar una carta en chino.'
      : sin
        ? `Falta ejecutar ${FICHERO_MIGRACION} en Supabase.`
        : error.message || 'No se ha podido consultar.'
  )
  // `sinMigracion` NO se enciende aquí: esa marca la usan los caminos de
  // LECTURA para tragarse el error y devolver una lista vacía —«esto
  // todavía no está desplegado»—, y tragarse un fallo al ESCRIBIR dejaría
  // a alguien pulsando un botón que no hace nada. El del idioma tiene que
  // verse.
  e.sinMigracion = sin
  return e
}

const COLUMNAS_BASE = 'id,user_id,card_id,market,idioma,estado,variante,cantidad,gradeo,valor_manual,precio_compra,notas,created_at,updated_at'

// `cambio` (cuántas copias de esta línea das, tanda 376) llega con
// `supabase-migration-intercambios.sql`. Mientras no esté ejecutada,
// PEDIRLA REVIENTA LA PÁGINA ENTERA: PostgREST devuelve 42703 y la
// colección no se carga. Así que se pide, y si no está se deja de
// pedir — un PUENTE, como el `faltaLaRpc` de los torneos, y con la
// misma fecha de caducidad: cuando la migración lleve un tiempo
// puesta, esto se quita y `COLUMNAS_LINEA` vuelve a ser una constante.
let hayCambio = true
export let COLUMNAS_LINEA = `${COLUMNAS_BASE},cambio`

// Si el error es «no existe la columna cambio», se apunta y se avisa a
// quien llamó de que vuelva a intentarlo. Cualquier otro error no es
// esto y sube tal cual.
function faltaLaColumnaCambio(error) {
  if (!hayCambio || !error) return false
  const esto = error.code === '42703' || /column .*cambio.* does not exist|'cambio' column/i.test(error.message || '')
  if (!esto) return false
  hayCambio = false
  COLUMNAS_LINEA = COLUMNAS_BASE
  return true
}

// EL MERCADO ES DEL TODO, no solo del catálogo (tanda 437). Quien elige
// el japonés quiere ver SU colección japonesa, no sus cartas inglesas
// sobre un catálogo japonés. Y además hace falta que sea así: la clave de
// `tcg_cards` es (id, market) porque el japonés comparte cuatro
// identificadores de set con el inglés, de modo que un mapa de cartas en
// memoria con la id a secas mezclaría dos cartas DISTINTAS sin dar ningún
// error. Mientras cada pantalla mira un solo mercado, el choque no existe.
export async function lineasDe(userId, mercado = 'WEST') {
  const filas = []
  // Con paginación: una colección grande pasa de las 1.000 filas que
  // PostgREST devuelve de una vez, y cortar ahí sin avisar diría un valor
  // total más bajo del que es.
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase
      .from('user_collection')
      .select(COLUMNAS_LINEA)
      .eq('user_id', userId)
      .eq('market', mercado)
      .order('created_at', { ascending: false })
      .range(desde, desde + 999)
    if (error) {
      // El puente: si lo único que falta es la columna `cambio`, se
      // repite ESTA misma vuelta sin ella. Sin el `continue` la página
      // se quedaría con las filas a medias y diría un valor más bajo.
      if (faltaLaColumnaCambio(error)) {
        desde -= 1000
        continue
      }
      throw traducir(error)
    }
    filas.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return filas
}

// ── Y TODA la colección, de TODOS los catálogos (tanda 485) ──
//
// PINGU: «cambio el idioma y pongo japonés […] y seguido me vuelvo al panel
// y me sale solo mi colección en ese idioma. Está mal. Debería ser un
// overall de todas las cartas que tengas independientemente del idioma. El
// panel es general. Luego ya cuando tú vayas a mirar las cartas o
// colecciones o lo que sea y cambies el idioma, eso ya tiene que ser del
// idioma».
//
// O sea: el PANEL es una portada de lo que tienes y no de un catálogo, y
// las otras cuatro pestañas sí son del catálogo elegido. Son DOS
// colecciones en memoria, no una filtrada de dos formas.
//
// Y ESTA no se puede guardar con la id a secas. Es el aviso de arriba
// cobrado: la clave de `tcg_cards` es (id, market) porque el japonés
// comparte identificadores de set con el inglés, así que con todos los
// mercados juntos `sv1a-1` son DOS cartas distintas y un mapa por id se
// quedaría con una de ellas SIN DAR NINGÚN ERROR. De ahí `claveDeCarta`.
export const claveDeCarta = (id, market) => `${id}|${market || MERCADO_POR_DEFECTO}`
export const claveDeLineaEnMercado = (l) => claveDeCarta(l?.card_id, l?.market)

export async function lineasDeTodo(userId) {
  const filas = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase
      .from("user_collection")
      .select(COLUMNAS_LINEA)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(desde, desde + 999)
    if (error) {
      if (faltaLaColumnaCambio(error)) {
        desde -= 1000
        continue
      }
      throw traducir(error)
    }
    filas.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return filas
}

// Las cartas de esas líneas, UNA CONSULTA POR MERCADO y no una por carta:
// `market` es una columna sola, así que preguntar por los cuatro a la vez
// con un `in` de ids traería cruces (la `sv1a-1` inglesa al pedir la
// japonesa) y el mapa se quedaría con la que llegara después.
export async function cartasPorClaves(lineas) {
  const porMercado = new Map()
  for (const l of lineas || []) {
    if (!l?.card_id) continue
    const m = l.market || MERCADO_POR_DEFECTO
    if (!porMercado.has(m)) porMercado.set(m, new Set())
    porMercado.get(m).add(l.card_id)
  }
  const mapa = new Map()
  for (const [m, ids] of porMercado) {
    const unicos = [...ids]
    for (let i = 0; i < unicos.length; i += 150) {
      const { data, error } = await supabase
        .from("tcg_cards")
        .select(COLUMNAS_CARTA)
        .eq("market", m)
        .in("id", unicos.slice(i, i + 150))
      if (error) throw traducir(error)
      // La clave se monta con el mercado de la FILA, no con el del bucle:
      // si un día la columna trajera otra cosa, el mapa seguiría diciendo
      // la verdad en vez de rotular la fila con lo que yo esperaba.
      for (const c of data || []) mapa.set(claveDeCarta(c.id, c.market), c)
    }
  }
  return mapa
}

export async function lineasDeCarta(userId, cardId) {
  const { data, error } = await supabase.from('user_collection').select(COLUMNAS_LINEA).eq('user_id', userId).eq('card_id', cardId)
  if (error) throw traducir(error)
  return data || []
}

// Añadir: si ya hay una línea igual (misma carta, idioma, estado,
// versión y gradeo) se le suman copias en vez de crear otra. Dos filas
// iguales separadas solo harían la lista más larga.
export async function anadir(userId, linea, mercado = 'WEST') {
  const existentes = await lineasDeCarta(userId, linea.card_id)
  const igual = existentes.find((l) => claveDeLinea(l) === claveDeLinea(linea))
  if (igual) {
    return actualizar(igual.id, { cantidad: Math.min(999, igual.cantidad + (linea.cantidad || 1)) })
  }
  const { data, error } = await supabase.from('user_collection').insert({ market: mercado, ...linea }).select(COLUMNAS_LINEA).single()
  if (error) throw traducir(error)
  return data
}

// Marcar VARIAS de golpe (tanda 426).
//
// `anadir` hace un `select` por carta y luego su insert: marcar un sobre
// —diez cartas— son veinte peticiones y diez repintados de la rejilla.
// Aquí se lee UNA vez lo que ya tienes de todas ellas y se insertan las
// nuevas en UNA sola, que es lo que convierte «apuntar un sobre» en algo
// que se hace de un tirón.
//
// Las que YA tienes con la misma clave suben de copias, y esas sí van una
// a una: son `update` sobre ids distintos y PostgREST no sabe hacerlo de
// otra forma. Normalmente son pocas —marcas lo que te acaba de llegar—.
export async function anadirVarias(userId, nuevasLineas, mercado = 'WEST') {
  // Se reciben LÍNEAS y no ids sueltos: en «separar variantes» cada
  // casilla es una versión, así que dos casillas de la misma carta son
  // dos líneas distintas y un id no bastaría para decir cuál se marcó.
  const porMeter = (nuevasLineas || []).map((l) => ({ cantidad: 1, ...l }))
  const ids = [...new Set(porMeter.map((l) => l.card_id))]
  if (!ids.length) return []
  const { data, error } = await supabase
    .from('user_collection')
    .select(COLUMNAS_LINEA)
    .eq('user_id', userId)
    .in('card_id', ids)
  if (error) throw traducir(error)
  // Se mira contra lo que hay EN LA BASE y no contra lo que tiene el
  // navegador en memoria: entre que se cargó la página y se marca el
  // sobre, la misma carta puede haber entrado desde el móvil — y
  // entonces lo correcto es subirle una copia, no crearle una fila
  // gemela que la lista enseñaría dos veces.
  const porClave = new Map((data || []).map((l) => [claveDeLinea(l), l]))
  const nuevas = []
  const suben = []
  for (const linea of porMeter) {
    const ya = porClave.get(claveDeLinea(linea))
    if (ya) suben.push(ya)
    else nuevas.push({ market: mercado, ...linea })
  }
  const puestas = []
  if (nuevas.length) {
    const { data: creadas, error: fallo } = await supabase
      .from('user_collection')
      .insert(nuevas)
      .select(COLUMNAS_LINEA)
    if (fallo) throw traducir(fallo)
    // Una escritura que la política rechaza NO da error: vuelve vacía
    // (CLAUDE.md). Sin mirarlo, «marcadas 10» mentiría.
    if (!creadas?.length) throw new Error('No se ha podido guardar: revisa que has iniciado sesión.')
    puestas.push(...creadas)
  }
  for (const l of suben) {
    puestas.push(await actualizar(l.id, { cantidad: Math.min(999, (Number(l.cantidad) || 0) + 1) }))
  }
  return puestas
}

export async function actualizar(id, cambios) {
  // El puente otra vez, y aquí en el CUERPO y no en el `select`: sin la
  // migración, mandar `cambio` en el update devuelve 42703 y el
  // «Guardar» de la ficha de una línea dejaría de funcionar entero por
  // un campo que todavía no existe.
  const cuerpo = hayCambio ? cambios : { ...cambios, cambio: undefined }
  // Con `select`: una escritura que la política rechaza no da error,
  // vuelve vacía (CLAUDE.md). Sin mirar, «guardado» mentiría.
  const { data, error } = await supabase.from('user_collection').update(cuerpo).eq('id', id).select(COLUMNAS_LINEA)
  if (error) throw traducir(error)
  if (!data?.length) throw new Error('No se ha podido guardar: esa línea no es tuya o ya no existe.')
  return data[0]
}

export async function borrar(id) {
  const { data, error } = await supabase.from('user_collection').delete().eq('id', id).select('id')
  if (error) throw traducir(error)
  if (!data?.length) throw new Error('No se ha podido borrar: esa línea no es tuya o ya no existe.')
}

// ── Las cartas del espejo ──
// `tcg_online_code` va aquí desde la tanda 370: es lo que necesita el
// segundo sitio donde buscar un escaneo cuando TCGdex no tiene el de esa
// carta (ver js/escaneo-carta.js).
// `illustrator`, `types` y `dex_ids` entran en la tanda 393: son la
// tabla de detalles de la ficha. No es una petición más —son columnas de
// la misma consulta—, y además son por lo que luego se puede filtrar.
// `trainer_type` y `energy_type` entran en la tanda 449: son el filtro de
// «tipo de entrenador» que pidió PINGU (supporter, objeto, herramienta,
// estadio). Son dos textos cortos y el filtro no se puede hacer sin
// ellos; como son datos de DETALLE, las cartas que `cartas-detalle`
// todavía no ha engordado los traen a null, y el grupo de chips
// sencillamente no las ofrece.
const COLUMNAS_CARTA = 'id,market,set_id,local_id,name,name_es,image_path,image_scrydex,rarity,rarity_en,category,variants,illustrator,types,dex_ids,trainer_type,energy_type,tcg_sets(id,name,serie_id,release_date,card_count_official,card_count_total,logo_path,tcg_online_code)'

export async function cartasPorIds(ids, mercado = 'WEST') {
  const unicos = [...new Set(ids.filter(Boolean))]
  const mapa = new Map()
  for (let i = 0; i < unicos.length; i += 150) {
    const { data, error } = await supabase.from('tcg_cards').select(COLUMNAS_CARTA).eq('market', mercado).in('id', unicos.slice(i, i + 150))
    if (error) throw traducir(error)
    for (const c of data || []) mapa.set(c.id, c)
  }
  return mapa
}

export async function cartasDeSet(setId, mercado = 'WEST') {
  const { data, error } = await supabase
    .from('tcg_cards')
    // `category` desde la 382: sin ella el filtro de categoría del
    // álbum tendría un desplegable vacío y no filtraría nada — y no
    // daría ningún error, que es lo de siempre.
    // `serie_id` desde la 434: hace falta para montar a mano la ruta del
    // asset de TCGdex cuando `image_path` está a null.
    .select('id,market,set_id,local_id,name,name_es,image_path,image_scrydex,rarity,rarity_en,category,variants,tcg_sets(tcg_online_code,serie_id)')
    .eq('market', mercado)
    .eq('set_id', setId)
    .limit(1000)
  if (error) throw traducir(error)
  return data || []
}

// ── Los precios ──

// Los guardados por la función programada, de una vez.
export async function preciosGuardados(ids) {
  const unicos = [...new Set(ids.filter(Boolean))]
  const mapa = new Map()
  for (let i = 0; i < unicos.length; i += 150) {
    const { data, error } = await supabase.from('tcg_card_prices').select('*').in('card_id', unicos.slice(i, i + 150))
    if (error) {
      if (traducir(error).sinMigracion) return mapa
      throw traducir(error)
    }
    for (const f of data || []) mapa.set(f.card_id, f)
  }
  return mapa
}

// Uno en el momento, a TCGdex. Con caché por visita: la ficha y el
// formulario de añadir preguntan por la misma carta.
const enVivo = new Map()
export function preciosEnVivo(cardId) {
  if (!enVivo.has(cardId)) {
    enVivo.set(
      cardId,
      fetch(urlDePrecio(cardId), { headers: { Accept: 'application/json' } })
        .then((r) => (r.ok ? r.json() : null))
        .then((c) => (c ? { pricing: c.pricing || null, variants: c.variants || null } : null))
        .catch(() => null)
    )
  }
  return enVivo.get(cardId)
}

// El precio de una línea: el guardado si lo hay; si no, en vivo.
//
// «Si lo hay» es «si DICE algo» y no «si existe la fila» (tanda 375).
// La función programada guarda fila para toda carta que mira, tenga o
// no cifras — y una fila con los precios a null salía de aquí como una
// respuesta, tapando para siempre la consulta en vivo. Resultado: una
// carta que el día que le tocó la pasada no estaba en Cardmarket se
// quedaba en «Sin precio» aunque al día siguiente ya tuviera.
export function precioDeLinea(linea, guardados, vivos) {
  const reverse = linea.variante === 'reverse'
  const guardado = precioDeFila(guardados.get(linea.card_id), { reverse })
  if (tieneCifras(guardado)) return guardado
  const v = vivos.get(linea.card_id)
  const vivo = v ? precioDe(v.pricing, { reverse }) : null
  if (tieneCifras(vivo)) return vivo
  // Ninguno tiene cifras: vale el que al menos traiga el `idProduct`,
  // que es lo que hace que el enlace a Cardmarket lleve a la carta y no
  // a una búsqueda por nombre.
  return guardado || vivo
}

// Un precio con `idProduct` y nada más sirve para el ENLACE, no para
// sumar: `valorDe` devolvería null igual.
export const tieneCifras = (p) => Boolean(p && (p.tendencia || p.media30 || p.desde))

// ── La Pokédex (tanda 381) ──
//
// Cuántas cartas hay de cada Pokémon en el catálogo entero. NO depende
// de quién pregunte, así que se pide UNA vez por visita y se guarda.
//
// Lo que TIENE cada uno no se pregunta: la página ya lleva su colección
// en memoria y contar por especie sale gratis en el navegador. Una
// consulta que ya está hecha no se vuelve a hacer.
export async function pokedexResumen(mercado = 'WEST') {
  // UN PUENTE, como el de la columna `cambio`: `pokedex_resumen()` nació
  // sin parámetro y con 'WEST' escrito dentro. Para el catálogo de siempre
  // se la sigue llamando igual, así que la página funciona con la
  // migración puesta o sin ella; solo el japonés la necesita, y si no
  // está, `traducir` lo ve (PGRST202) y la pestaña lo dice en vez de
  // enseñar los totales del inglés haciéndolos pasar por japoneses.
  const { data, error } = mercado === 'WEST'
    ? await supabase.rpc('pokedex_resumen')
    : await supabase.rpc('pokedex_resumen', { p_market: mercado })
  if (error) {
    // Sin la migración no hay Pokédex, pero el resto de la página no
    // tiene por qué enterarse: se devuelve vacío y la pestaña lo dice.
    if (traducir(error).sinMigracion) return []
    throw traducir(error)
  }
  return data || []
}

// Todas las cartas de una especie, de todas las colecciones. Entra por
// el índice GIN de `dex_ids` (`cs` es el `@>` de Postgres).
//
// El tope es de verdad: de Pikachu hay más de 300 cartas y nadie las
// mira todas de una vez. Se piden las más nuevas primero, que es el
// orden en el que la gente busca.
export async function cartasDeEspecie(dex, limite = 300, mercado = 'WEST') {
  const { data, error } = await supabase
    .from('tcg_cards')
    .select(COLUMNAS_CARTA)
    .eq('market', mercado)
    .contains('dex_ids', [Number(dex)])
    .limit(limite)
  if (error) {
    if (traducir(error).sinMigracion) return []
    throw traducir(error)
  }
  return data || []
}

// ── El valor en el tiempo (tanda 377) ──
//
// La foto diaria la toma una función programada; aquí solo se lee. Y se
// lee desde una fecha y no entera: para una gráfica de tres meses no
// hacen falta tres años de días.
// DOS AÑOS Y NO NOVENTA DÍAS (tanda 464). Los 90 estaban bien mientras la
// gráfica enseñaba «todo lo que hay»: nadie notaba el tope. Desde que hay
// botones de 6M y MAX, un tope de 90 días hace que los dos enseñen lo
// mismo que 3M — un botón que miente sin dar ningún error.
//
// Y no cuesta nada: es UNA FILA POR DÍA Y POR PERSONA, así que dos años
// son 730 filas de cinco columnas. Lo que habría que pensarse es un tope
// por debajo, no por encima.
export async function valorHistorico(userId, dias = 730) {
  const desde = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('user_collection_value')
    .select('dia,valor,copias,distintas,sin_precio')
    .eq('user_id', userId)
    .gte('dia', desde)
    .order('dia', { ascending: true })
  if (error) {
    // Sin la migración no hay histórico, y eso NO es un error que deba
    // tumbar el resumen entero: se devuelve vacío y la gráfica dice que
    // la primera foto se toma esta noche.
    if (traducir(error).sinMigracion) return []
    throw traducir(error)
  }
  return data || []
}

// ── Perfil: colección pública o privada ──
export async function perfilPorUsuario(username) {
  // sin rango: igual que en mi-coleccion.js, el nombre del dueño es el
  // título de la pantalla y no un enlace (tanda 386).
  const { data, error } = await supabase.from('user_profiles').select('id,username,display_name,coleccion_publica').eq('username', username).maybeSingle()
  if (error) throw traducir(error)
  return data
}

export async function ponerPublica(userId, publica) {
  const { data, error } = await supabase.from('user_profiles').update({ coleccion_publica: publica }).eq('id', userId).select('coleccion_publica')
  if (error) throw traducir(error)
  if (!data?.length) throw new Error('No se ha podido cambiar.')
  return data[0].coleccion_publica
}

// Quién de los que sigues tiene esta carta (tanda 403).
//
// Va por una función de la base porque la colección de otra persona no se
// lee desde fuera: su política solo deja ver la tuya. La función contesta
// esa pregunta y ninguna otra, y respeta `coleccion_publica` — seguir a
// alguien no es permiso para mirarle los cajones.
export async function quienLaTiene(cardId) {
  const { data, error } = await supabase.rpc('coleccion_quien_la_tiene', { p_card_id: cardId })
  if (error) {
    // Sin la migración, el bloque no sale. No es un fallo que haya que
    // gritar en mitad de una ficha.
    if (traducir(error).sinMigracion) return []
    throw traducir(error)
  }
  return data || []
}


// ── Las expansiones favoritas (tanda 409) ──
//
// Sin la migración puesta, esto se comporta como si no tuvieras ninguna:
// la estantería se pinta igual —sin el grupo de arriba— y el botón de la
// estrella se esconde. Es mejor que un error en mitad de una pantalla que
// funciona, y mejor que guardarlos en el navegador «mientras tanto»: dos
// sitios donde viven los favoritos son dos listas que se separan.
export async function favoritosDeSets(userId) {
  const { data, error } = await supabase.from('collection_favorite_sets').select('set_id').eq('user_id', userId)
  if (error) {
    if (traducir(error).sinMigracion) return null
    throw traducir(error)
  }
  return new Set((data || []).map((f) => f.set_id))
}

export async function marcarFavorito(userId, setId, favorito) {
  const q = favorito
    ? supabase.from('collection_favorite_sets').upsert({ user_id: userId, set_id: setId })
    : supabase.from('collection_favorite_sets').delete().eq('user_id', userId).eq('set_id', setId)
  const { error } = await q
  if (error) throw traducir(error)
}
