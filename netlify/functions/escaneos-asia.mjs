import { MERCADOS_A_IMPORTAR, idiomaDeMercado, esDeTcggo } from '../../js/mercados.js'
import { caminoPorPartes, urlDeEscaneo, veredicto, nombreParaBuscar } from '../lib/escaneos-asia.mjs'

// Los escaneos y los nombres que TCGdex TIENE y su API no dice (tanda 488).
//
// ── DE DÓNDE SALE ESTO ──
//
// Lo escribió y lo midió la sesión de COWORK de PINGU, que es una TERCERA
// sesión en este repo y SÍ tiene salida a TCGdex (el navegador de su
// ordenador). Llegó numerado como 485 y pasa a 488 porque la 485 y la 486
// ya estaban comiteadas aquí con sus pruebas empujadas — es el OCTAVO
// choque de números, y el primero con tres sesiones en danza.
//
// Su medición es la que desmiente dos notas mías: la 484 escribió que «la
// ficha de cada carta sí trae la imagen» y la 486 que «cuando el escaneo
// existe, viene en el listado». Las dos son falsas, y las dos salieron de
// deducir el catálogo entero de una muestra de UNO (SV1a, de 2023, que es
// justo el caso bueno). Ver `CLAUDE.md`.
//
// Y esta función no puede correr sin la 487: `cardToRow` manda
// `image_path: null` cuando la API calla, y las dos importaciones escriben
// con `merge-duplicates`, así que una reimportación BORRARÍA lo que esto
// encuentre. Lo arregla `porImagen`.
//
// ── El fallo, medido y no deducido ──
//
// PINGU: «hay un apartado donde coge las cartas de un sitio, coge los
// símbolos de otro, entonces deberíamos tenerlo todo. No sé qué se está
// haciendo mal para no traer ni las imágenes de las cartas ni los
// nombres».
//
// Tenía razón en las cartas. La API y el servidor de imágenes son DOS
// sitios (tcgdex.dev/assets), y nosotros solo guardábamos el escaneo
// cuando la API mandaba el campo `image`. Medido el 2026-10-03 desde un
// navegador, carta a carta, con un HEAD a cada fichero:
//
//   JP   13.006 cartas · la API dice 3.882 con imagen · EXISTEN 7.365
//   TW    7.436 cartas · la API dice 2.146           · existen 2.242
//   CN      877 cartas · la API dice 0               · existen 0
//
// Son 3.483 cartas japonesas con su foto publicada y sin enseñar: todo
// Sol y Luna (SM1 a SM12a), media Espada y Escudo, SV5M, SV8, SV10, M1S y
// M4. Y el campo falta TAMBIÉN en la ficha de la carta — la tanda 484
// escribió que «la ficha sí trae la imagen» y no es verdad, así que el
// engorde de la 483 no las iba a rellenar nunca.
//
// En los LOGOS no: se probó el fichero a mano en los 341 sets asiáticos y
// existe UNO (el de M4). Símbolos, ninguno. Eso no es nuestro.
//
// ── Qué hace ──
//
//   1. ESCANEOS. A cada carta asiática sin `image_path` le monta el
//      camino por partes (serie/set/número), le pregunta al servidor de
//      imágenes si existe, y solo entonces lo guarda. No se guarda sin
//      preguntar: un camino inventado en la base es una foto rota que
//      nadie distingue de una buena.
//   2. NOMBRES. A cada carta asiática con especie y sin `name_es` le
//      escribe el nombre con letras de aquí (ver `nombreLatino`).
//
// ── Por qué una función aparte y no una fase más de `catalogo-asia` ──
//
// Porque aquella ya reparte 22 segundos entre tres fases, y la tercera
// es una cola de 21.000 que no puede perder turno. Y porque esto NO le
// habla a la API de TCGdex: le habla a su servidor de ficheros, con un
// HEAD que no descarga nada. Son presupuestos distintos.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY (obligatoria).

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'

// Y fuera los que calca Scrydex (tanda 547): el japonés lo trae entero
// `scrydex-importar-jp` + `scrydex-relleno-jp`, con SUS identificadores.
// Si esto siguiera importando el japonés de TCGdex, cada seis minutos
// volverían a aparecer sus 186 sets al lado de los 231 buenos — la misma
// colección dos veces en la biblioteca, que es el único error de aquí que
// se ve en la cara.
const MERCADOS = MERCADOS_A_IMPORTAR.filter((m) => m !== 'WEST' && !esDeTcggo(m))

// Netlify mata una función programada a los 30 segundos.
const PRESUPUESTO_MS = 20000
// Los escaneos van primero y se quedan con este trozo; lo que sobre es de
// los nombres, que no piden nada fuera y son baratos.
const PRESUPUESTO_ESCANEOS_MS = 12000

// Cuántas cartas por pasada y cuántas preguntas a la vez. Un HEAD no
// descarga la imagen, pero sigue siendo un servidor comunitario: ocho a
// la vez y 160 por pasada son ~2.400 a la hora, y el trabajo es FINITO
// (~15.000 cartas sin foto: unas seis horas y se acaba).
const ESCANEOS_POR_PASADA = 160
const A_LA_VEZ = 8
const ESPERA_HEAD_MS = 6000

// Una carta que no tenía foto se vuelve a mirar al mes: TCGdex va
// recibiendo escaneos (los sets Mega están casi vacíos hoy), y «no está»
// no es para siempre.
const REPASO_MS = 30 * 24 * 60 * 60 * 1000

const NOMBRES_POR_PASADA = 150

function servicio(clave) {
  return { apikey: clave, authorization: `Bearer ${clave}`, 'content-type': 'application/json' }
}

async function rest(ruta, clave, opciones = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...opciones,
    headers: { ...servicio(clave), ...(opciones.headers || {}) },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.status === 204 ? null : res.json()
}

// El estado HTTP del fichero, o 0 si no contestó nadie.
async function estadoDe(url) {
  const corte = new AbortController()
  const t = setTimeout(() => corte.abort(), ESPERA_HEAD_MS)
  try {
    const res = await fetch(url, { method: 'HEAD', signal: corte.signal })
    return res.status
  } catch {
    return 0
  } finally {
    clearTimeout(t)
  }
}

async function enTandas(cosas, cuantas, hacer) {
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(cuantas, cosas.length) }, async () => {
      while (i < cosas.length) await hacer(cosas[i++])
    })
  )
}

const entreComillas = (id) => `"${String(id).replace(/"/g, '')}"`

// ── Fase 1: los escaneos ──
export async function buscarEscaneos(pedir, mirar, reloj, hasta) {
  const antes = new Date(reloj() - REPASO_MS).toISOString()
  // Las que no se han mirado nunca primero (`nullsfirst`), y después las
  // que se miraron hace más de un mes. `escaneo_buscado_at` es columna
  // PROPIA de `tcg_cards`, así que el `nullsfirst` sí funciona: lo que
  // PostgREST se come es el de una tabla embebida (tanda 322).
  const filas =
    (await pedir(
      'tcg_cards?select=id,market,set_id,local_id,tcg_sets(serie_id)' +
        `&market=in.(${MERCADOS.join(',')})&image_path=is.null` +
        `&or=(escaneo_buscado_at.is.null,escaneo_buscado_at.lt.${antes})` +
        `&order=escaneo_buscado_at.asc.nullsfirst&limit=${ESCANEOS_POR_PASADA}`
    )) || []

  const encontradas = []
  const sinFoto = []
  let dudosas = 0
  await enTandas(filas, A_LA_VEZ, async (carta) => {
    if (reloj() > hasta) return
    const camino = caminoPorPartes(carta.tcg_sets?.serie_id, carta.set_id, carta.local_id)
    // Sin serie o con un número que no se puede montar no hay a quién
    // preguntar. Se apunta como mirada igualmente: si no, volvería en
    // cada pasada (el cerrojo de la 333). Al mes se vuelve a intentar, y
    // para entonces la visita al set le habrá puesto la serie.
    if (!camino) return void sinFoto.push(carta)
    const v = veredicto(await mirar(urlDeEscaneo(camino, idiomaDeMercado(carta.market))))
    if (v === 'esta') encontradas.push({ ...carta, camino })
    else if (v === 'no-esta') sinFoto.push(carta)
    else dudosas++
  })

  const ahora = new Date(reloj()).toISOString()
  // La foto y la marca en la MISMA sentencia: si fueran dos, un corte
  // entre ellas dejaría la carta marcada y sin foto durante un mes.
  for (const carta of encontradas) {
    await pedir(`tcg_cards?id=eq.${encodeURIComponent(carta.id)}&market=eq.${carta.market}&image_path=is.null`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ image_path: carta.camino, escaneo_buscado_at: ahora }),
    })
  }
  // Las que no tienen, de una vez por mercado: el identificador NO es
  // único entre mercados (`CS1a-1` existe en tres), así que el mercado va
  // SIEMPRE en el filtro.
  for (const market of MERCADOS) {
    const ids = sinFoto.filter((c) => c.market === market).map((c) => c.id)
    for (let i = 0; i < ids.length; i += 80) {
      const lista = ids.slice(i, i + 80).map(entreComillas).join(',')
      await pedir(`tcg_cards?market=eq.${market}&id=in.(${encodeURIComponent(lista)})`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ escaneo_buscado_at: ahora }),
      })
    }
  }
  return { miradas: filas.length, encontradas: encontradas.length, sinFoto: sinFoto.length, dudosas }
}

// ── Fase 2: los nombres ──
//
// Va DETRÁS del engorde de `catalogo-asia`, que es quien trae `dex_ids`:
// aquí solo entran las cartas que ya lo tienen. Mientras aquella cola no
// se acabe, esta va a su paso.
export async function escribirNombres(pedir, reloj, hasta) {
  const filas =
    (await pedir(
      'tcg_cards?select=id,market,name,dex_ids' +
        `&market=in.(${MERCADOS.join(',')})&name_es=is.null&dex_ids=not.is.null&limit=${NOMBRES_POR_PASADA}`
    )) || []
  let escritos = 0
  let traducidos = 0
  for (const carta of filas) {
    if (reloj() > hasta) break
    const nombre = nombreParaBuscar(carta)
    if (!nombre) continue
    await pedir(`tcg_cards?id=eq.${encodeURIComponent(carta.id)}&market=eq.${carta.market}&name_es=is.null`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ name_es: nombre }),
    })
    escritos++
    if (nombre !== carta.name) traducidos++
  }
  return { pedidos: filas.length, escritos, traducidos }
}

const faltaMigracion = (e) => /PGRST|does not exist|Could not find|42703/.test(String(e?.message || e))

export async function procesar({ env = process.env, fetchImpl = null, mirarImpl = null, reloj = () => Date.now() } = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }
  const pedir = fetchImpl ? (ruta, o) => fetchImpl(ruta, o) : (ruta, o) => rest(ruta, clave, o)
  const mirar = mirarImpl || estadoDe
  const empezo = reloj()
  const cuenta = {}
  if (!MERCADOS.length) return { ok: true, nota: 'no hay mercados asiáticos en MERCADOS_A_IMPORTAR' }

  // Las dos fases fallan POR SEPARADO: los escaneos necesitan una columna
  // nueva (`escaneo_buscado_at`) y los nombres no. Sin la migración
  // puesta, los nombres tienen que seguir saliendo.
  try {
    cuenta.escaneos = await buscarEscaneos(pedir, mirar, reloj, empezo + PRESUPUESTO_ESCANEOS_MS)
  } catch (e) {
    cuenta.escaneos = faltaMigracion(e)
      ? { saltado: 'falta ejecutar supabase-migration-escaneo-buscado.sql' }
      : { error: String(e?.message || e).slice(0, 200) }
  }
  try {
    cuenta.nombres = await escribirNombres(pedir, reloj, empezo + PRESUPUESTO_MS)
  } catch (e) {
    cuenta.nombres = { error: String(e?.message || e).slice(0, 200) }
  }
  const ok = !cuenta.escaneos?.error && !cuenta.nombres?.error
  return { ok, ...cuenta }
}

export default async function handler() {
  const r = await procesar()
  if (!r.ok) console.warn('escaneos-asia:', JSON.stringify(r).slice(0, 400))
  return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } })
}

// Cada cuatro minutos y empezando en el 2, para no coincidir siempre con
// `catalogo-asia` (*/3) ni con `cartas-detalle` (*/5).
export const config = { schedule: '2-59/4 * * * *' }
