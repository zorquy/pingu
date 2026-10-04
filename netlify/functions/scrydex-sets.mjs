import { createHash } from 'node:crypto'
import { idDeAdmin, tokenDe } from '../lib/admin.mjs'
import {
  cabecerasDe, urlDeSonda, emparejarSets, CAMPOS_SUYOS,
  formasDeId, numeroComparable, laCarta, veredictoDelPar,
  filaDeSetConScrydex, loQueCambia, cuentaDelInforme, esRelleno,
} from '../lib/scrydex.mjs'

// Traer de Scrydex lo que falta de NUESTROS sets occidentales (tanda 507).
//
// PINGU: «estamos pagando Scrydex, de algo tiene que servir. Tráete
// cartas, logos, tráete todo. Empieza por el catálogo completo inglés».
// Esto es la primera mitad: los SETS. Las cartas van aparte porque son
// 21.476 filas y esto son 210.
//
// ── LAS TRES REGLAS DE SEGURIDAD ──
//
// 1. **ENSAYO EN SECO POR DEFECTO.** `escribir` es false mientras nadie
//    diga lo contrario, y entonces devuelve exactamente lo que escribiría,
//    fila a fila y con el valor de antes al lado. Netlify despliega esta
//    rama EN DIRECTO; una escritura contra producción que no se puede
//    mirar antes es una escritura a ciegas.
//
// 2. **SOLO SETS CON EL EMPAREJAMIENTO CONFIRMADO.** Lo que confirma es
//    una señal que el idioma no puede engañar (tanda 506): el código del
//    set, gratis, o los números de Pokédex de una carta, un crédito. Un
//    par sin confirmar NO SE ESCRIBE — y eso es lo que costaron las
//    tandas 504 y 505: un par falso mete el logo de otro set encima del
//    nuestro sin dar ningún error.
//
// 3. **NO SE PISA NADA NUESTRO.** Las columnas de Scrydex son nuevas; las
//    nuestras solo se rellenan si están vacías. Lo de TCGdex se queda
//    donde está y sigue siendo el respaldo del día que Scrydex no
//    conteste (lección de la 321).
//
// VARIABLES: SCRYDEX_API_KEY, SCRYDEX_TEAM_ID, SUPABASE_SERVICE_ROLE_KEY.
// Necesita la migración `supabase-migration-scrydex.sql` puesta.

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
const A_LA_VEZ = 4
const CANDIDATAS = 12
// Por si acaso: si de pronto hubiera que escribir más sets que esto, algo
// ha ido mal en el emparejamiento y mejor pararse que escribir 500 filas.
const TOPE_DE_ESCRITURA = 260
// Bastan para distinguir el relleno de un dibujo de verdad, y evitan
// bajarse 160 logos enteros para mirar diez bytes de cada uno.
const BYTES = 1500
// ── PRESUPUESTO DE TIEMPO (tanda 510) ──
//
// No lo tenía, y es un fallo serio en algo que corre solo cada hora: cada
// par cuyo código no cuadra pide una carta, y 210 pares a ~300 ms son 63
// segundos. **Netlify mata a los 30**, y como la escritura va AL FINAL, una
// pasada matada a mitad gasta los créditos y no escribe NADA — y la
// siguiente vuelve a empezar igual, para siempre.
//
// Con presupuesto, se confirma lo que dé tiempo y se escribe. Lo que
// quede sigue sin `scrydex_id`, así que la pasada siguiente lo coge: el
// progreso vive en los datos (la lección de la 322).
const MS_DE_MARGEN = 18_000

// ── El relleno (tanda 499), que aquí es OBLIGATORIO ──
//
// Su servidor de imágenes contesta **200 con una imagen de relleno** para
// cualquier id que no exista. Así que una URL suya que no se haya mirado
// puede ser un cuadro que diga «no image» — y eso se pinta exactamente
// igual que un logo bueno: la cadena de respaldo de /mi-coleccion solo
// pasa al siguiente dibujo cuando la imagen DA ERROR, y un relleno no da
// error. Sería una colección con el logo equivocado y sin un solo aviso.
const huellaSha1 = (buf) => createHash('sha1').update(buf.subarray(0, BYTES)).digest('hex')

async function dibujoDeVerdad(url, tipo, fetchImpl, huellaImpl = huellaSha1) {
  if (!url) return { vale: false, porque: 'no la tienen' }
  try {
    const res = await fetchImpl(url, { headers: { range: `bytes=0-${BYTES - 1}` } })
    if (!res.ok && res.status !== 206) return { vale: false, porque: `HTTP ${res.status}` }
    const buf = Buffer.from(await res.arrayBuffer())
    const huella = huellaImpl(buf)
    if (esRelleno(huella, tipo)) return { vale: false, porque: 'es la imagen de RELLENO' }
    return { vale: true }
  } catch (e) {
    return { vale: false, porque: String(e?.message || e).slice(0, 60) }
  }
}

async function rest(ruta, clave, opciones = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...(opciones || {}),
    headers: {
      apikey: clave,
      authorization: `Bearer ${clave}`,
      ...(opciones ? { 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal' } : {}),
      ...(opciones?.headers || {}),
    },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return opciones ? null : res.json()
}

async function enTandas(cosas, cuantas, hacer) {
  let i = 0
  await Promise.all(Array.from({ length: Math.min(cuantas, cosas.length) }, async () => {
    while (i < cosas.length) await hacer(cosas[i++])
  }))
}

export async function procesar({
  env = process.env, fetchImpl = fetch, restImpl = null, escribirImpl = null,
  huellaImpl = huellaSha1, reloj = () => Date.now(),
  mercado = 'WEST', idioma = 'en', escribir = false,
} = {}) {
  const { cabeceras, faltan } = cabecerasDe(env)
  if (faltan) return { estado: 500, cuerpo: { error: `Faltan en Netlify: ${faltan.join(' y ')}.` } }
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { estado: 500, cuerpo: { error: 'Falta SUPABASE_SERVICE_ROLE_KEY.' } }
  const arranque = reloj()
  const quedaTiempo = () => reloj() - arranque < MS_DE_MARGEN
  const pedir = restImpl || ((ruta) => rest(ruta, clave))
  const guardar = escribirImpl || ((filas) => rest('tcg_sets', clave, { method: 'POST', body: JSON.stringify(filas) }))

  const COLS = 'id,market,name,serie_id,release_date,card_count_official,card_count_total,'
    + 'tcg_online_code,logo_path,logo_scrydex,symbol_scrydex,scrydex_id,scrydex_por'
  let nuestros
  try {
    nuestros = await pedir(`tcg_sets?select=${COLS}&market=eq.${mercado}&limit=400`)
  } catch (e) {
    // Una columna que no existe da un 400 de PostgREST, y el mensaje lo
    // dice. Mejor eso que un «no se ha podido» que no explica nada.
    const m = String(e?.message || e)
    if (/column|42703/i.test(m)) {
      return { estado: 409, cuerpo: { error: 'Falta una migración: `supabase-migration-scrydex.sql` o `supabase-migration-scrydex-cartas.sql`. Ejecútalas en el SQL Editor y vuelve.', detalle: m.slice(0, 200) } }
    }
    throw e
  }

  const suyas = []
  for (let pagina = 1; pagina <= 6; pagina++) {
    const res = await fetchImpl(urlDeSonda(`${idioma}/expansions`, { page: pagina, page_size: 100 }), { headers: cabeceras })
    if (!res.ok) return { estado: 502, cuerpo: { error: `Scrydex ${res.status} al pedir sus expansiones` } }
    const j = await res.json()
    const lote = Array.isArray(j?.data) ? j.data : []
    suyas.push(...lote)
    if (lote.length === 0 || suyas.length >= (j?.total_count || 0)) break
  }
  // SI SU LISTADO NO TRAE EL LOGO, SE DICE Y NO SE INVENTA. Es la lección
  // de las tandas 233 y 322: el listado de un set puede ser un resumen al
  // que le faltan campos, y una columna vacía no dice de quién es la culpa.
  const conLogo = suyas.filter((s) => s?.logo).length
  const conSimbolo = suyas.filter((s) => s?.symbol).length

  const { pares, ambiguos, sueltos } = emparejarSets(nuestros, suyas, { suyos: CAMPOS_SUYOS })

  // ── Confirmar cada par, y NO escribir el que no se confirme ──
  const confirmados = []
  const rechazados = []
  const sinConfirmar = []
  let sinTiempo = 0
  await enTandas(pares, A_LA_VEZ, async (par) => {
    // Gratis: si los dos códigos coinciden, no hay nada que preguntar.
    const v0 = veredictoDelPar({ nuestra: {}, nuestroSet: par.nuestro, suya: { expansion: par.suyo } })
    if (v0.veredicto === 'confirmado') return confirmados.push({ ...par, por: v0.por })
    if (v0.veredicto === 'rechazado') return rechazados.push({ ...par, porque: v0.porque })
    // Lo que sigue cuesta una petición a su API, así que si no queda
    // tiempo se deja para la pasada siguiente en vez de gastarla y morir.
    if (!quedaTiempo()) { sinTiempo++; return }
    // Y si nuestro código está vacío, una carta lo zanja por un crédito.
    let filas = []
    let falloAlPedir = null
    try {
      filas = await pedir(
        `tcg_cards?select=local_id,name,dex_ids,illustrator,hp&market=eq.${mercado}`
        + `&set_id=eq.${encodeURIComponent(par.nuestro.id)}&order=local_id.asc&limit=${CANDIDATAS}`,
      )
    } catch (e) { falloAlPedir = String(e?.message || e).slice(0, 80) }
    // «No tenemos cartas» y «no he podido preguntar» NO son lo mismo: lo
    // primero es un dato del catálogo, lo segundo un fallo nuestro. El
    // `catch { filas = [] }` que había los juntaba, y un tropiezo de la
    // base se leía como un set vacío.
    if (falloAlPedir) return sinConfirmar.push({ par: `${par.nuestro.id} → ${par.suyo.id}`, porque: `no se ha podido preguntar a la base: ${falloAlPedir}` })
    const nuestra = (filas || []).find((c) => numeroComparable(c.local_id))
    if (!nuestra) return sinConfirmar.push({ par: `${par.nuestro.id} → ${par.suyo.id}`, porque: 'no tenemos ninguna carta de ese set' })
    for (const suId of formasDeId(par.suyo.id, nuestra.local_id)) {
      const res = await fetchImpl(urlDeSonda(`cards/${suId}`), { headers: cabeceras })
      if (!res.ok) continue
      const suya = laCarta(await res.json())
      const v = veredictoDelPar({ nuestra, nuestroSet: par.nuestro, suya })
      if (v.veredicto === 'confirmado') return confirmados.push({ ...par, por: v.por })
      if (v.veredicto === 'rechazado') return rechazados.push({ ...par, porque: v.porque })
      return sinConfirmar.push({ par: `${par.nuestro.id} → ${par.suyo.id}`, porque: v.porque })
    }
    sinConfirmar.push({ par: `${par.nuestro.id} → ${par.suyo.id}`, porque: 'su API no encuentra esa carta en ninguna de las formas del id' })
  })

  // ── Qué se escribiría ──
  //
  // Antes de guardar una URL de imagen SE MIRA, porque su servidor
  // contesta 200 con un relleno para cualquier id (ver `dibujoDeVerdad`).
  // Las imágenes no gastan créditos y solo se bajan 1.500 bytes.
  const rellenos = []
  await enTandas(confirmados, A_LA_VEZ, async (par) => {
    for (const [campo, tipo] of [['logo', 'logo'], ['symbol', 'logo']]) {
      const url = par.suyo?.[campo]
      if (!url) continue
      const r = await dibujoDeVerdad(url, tipo, fetchImpl, huellaImpl)
      if (!r.vale) {
        rellenos.push({ set: par.nuestro.id, campo, porque: r.porque })
        // Se tacha para que `filaDeSetConScrydex` no lo escriba.
        par.suyo = { ...par.suyo, [campo]: null }
      }
    }
  })

  const filas = []
  const cambios = []
  for (const par of confirmados) {
    const fila = filaDeSetConScrydex(par.nuestro, par.suyo, par.por)
    const c = loQueCambia(par.nuestro, fila)
    if (!Object.keys(c).length) continue
    filas.push(fila)
    cambios.push({ set: par.nuestro.id, suyo: par.suyo.id, confirmado: par.por, cambia: c })
  }

  if (filas.length > TOPE_DE_ESCRITURA) {
    return { estado: 409, cuerpo: { error: `Saldrían ${filas.length} sets, más del tope de ${TOPE_DE_ESCRITURA}. Algo ha ido mal en el emparejamiento: no se escribe nada.` } }
  }

  let escritas = 0
  if (escribir && filas.length) {
    await guardar(filas)
    escritas = filas.length
  }

  const cuenta = cuentaDelInforme(pares.length, [confirmados, rechazados, sinConfirmar, sinTiempo])
  return {
    estado: 200,
    cuerpo: {
      ensayoEnSeco: !escribir,
      ...(escribir ? {} : { COMO_ESCRIBIR: 'Vuelve a darle con «escribir» puesto. Esto de ahora no ha tocado la base.' }),
      mercado,
      creditos: `${Math.ceil(suyas.length / 100)} de sus expansiones + ${pares.length - confirmados.filter((c) => c.por === 'el código del set').length} de las cartas (como mucho)`,
      susExpansiones: suyas.length,
      // LO PRIMERO QUE HAY QUE MIRAR: si su listado trae los logos. Si
      // sale 0, no es que no los tengan: es que no vienen en el LISTADO.
      suListadoTraeLogos: `${conLogo} de ${suyas.length}`,
      suListadoTraeSimbolos: `${conSimbolo} de ${suyas.length}`,
      emparejados: pares.length,
      porQueSeEmparejan: pares.reduce((m, p) => ({ ...m, [p.por]: (m[p.por] || 0) + 1 }), {}),
      ambiguos: ambiguos.length,
      sinEmparejar: sueltos.length,
      // POR QUÉ no se empareja, agrupado. «Sin emparejar: 37» no dice
      // nada que se pueda arreglar; «31 porque no tenemos ni su fecha ni
      // su código» sí: esos salen del curador de TCGdex, no de aquí.
      porQueNoSeEmparejan: sueltos.reduce((m, x) => ({ ...m, [x.porque]: (m[x.porque] || 0) + 1 }), {}),
      ejemplosSinEmparejar: sueltos.slice(0, 12).map((x) => `${x.nuestro.id} — ${x.porque}`),
      confirmados: confirmados.length,
      // Los que se quedaron sin tiempo NO son un fallo: siguen sin
      // `scrydex_id`, así que la pasada de la hora siguiente los coge.
      sinTiempo,
      porQueSeConfirman: confirmados.reduce((m, c) => ({ ...m, [c.por]: (m[c.por] || 0) + 1 }), {}),
      rechazados: rechazados.map((r) => ({ par: `${r.nuestro.id} → ${r.suyo.id}`, porque: r.porque })),
      sinConfirmar,
      cuadraLaCuenta: cuenta.cuadra,
      ...(cuenta.cuadra ? {} : { AVISO: cuenta.aviso }),
      // Los que su servidor contesta con el RELLENO: no los tienen, y
      // escribir esa URL pintaría un cuadro de «no image» que nadie
      // distingue de un logo (tanda 499).
      descartadosPorRelleno: rellenos.length,
      ejemplosDeRelleno: rellenos.slice(0, 10),
      sinNadaQueCambiar: confirmados.length - filas.length,
      aEscribir: filas.length,
      escritas,
      // Y el detalle fila a fila, que es lo que hace que el ensayo sirva
      // de algo: con el valor de ANTES al lado de el de después.
      cambios: cambios.slice(0, 80),
      cambiosTotal: cambios.length,
    },
  }
}

export default async (req) => {
  const json = (e, c) => new Response(JSON.stringify(c), { status: e, headers: { 'content-type': 'application/json' } })
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido.' })
  if (!(await idDeAdmin(tokenDe(req)))) return json(401, { error: 'No autorizado.' })
  let cuerpo = {}
  try { cuerpo = await req.json() } catch { cuerpo = {} }
  const r = await procesar({
    mercado: cuerpo.mercado || 'WEST',
    idioma: cuerpo.idioma || 'en',
    // Hay que PEDIRLO a propósito. Un `escribir` que llegue a medias
    // (undefined, '', 0) no escribe.
    escribir: cuerpo.escribir === true,
  })
  return json(r.estado, r.cuerpo)
}
