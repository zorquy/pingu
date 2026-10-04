import {
  cabecerasDe, urlDeSonda, filaDeCartaConScrydex, nombreQueHayQueArreglar,
  numeroComparable, laCarta,
} from '../lib/scrydex.mjs'

// Rellenar el catálogo occidental con Scrydex, SOLA y toda la noche (509).
//
// PINGU, antes de irse a la cama: «quiero que me rellenes todas las cartas
// posibles, todos los logos posibles […] mañana cuando me despierte quiero
// poder recomendar esta parte de la web a mis amigos».
//
// Por eso esto es una función PROGRAMADA y no un botón: un botón necesita
// a alguien delante. Las tandas 507 y 508 dejaron los 167 sets emparejados
// y verificados; esto baja sus cartas.
//
// ── POR QUÉ ESTO NO CUESTA 21.476 PETICIONES ──
//
// Porque su LISTADO trae la carta COMPLETA —imagen, ilustrador, Pokédex,
// PS, rareza y la expansión entera anidada—, así que el catálogo inglés
// son ~101 páginas de 250. Es lo CONTRARIO de TCGdex, donde el listado de
// un set es un «SetResume» y engordar cuesta una petición por carta
// (tandas 233 y 322). Son dos costes que no se parecen en nada y conviene
// no confundirlos.
//
// ── CÓMO SE REANUDA ──
//
// Una función programada de Netlify se mata a los 30 segundos, así que
// lleva su propio presupuesto de tiempo y lo que no da tiempo se queda
// para la pasada siguiente (la lección de la 322). La posición vive en
// `scrydex_estado`, que es lo ÚNICO que no se puede sacar de los datos:
// por qué página de las SUYAS iba.
//
// ── LO QUE NO HACE, A PROPÓSITO ──
//
// · No inserta cartas que no tengamos. Ellos tienen 25.209 y nosotros
//   21.476; sus ids son suyos y los nuestros vienen de TCGdex, así que
//   insertar dejaría un catálogo con dos nomenclaturas y las colecciones
//   de la gente apuntando a una de ellas. Las cuenta y las deja dichas.
// · No toca `rarity`, `types` ni `category`: lo nuestro está en español y
//   lo suyo en inglés (ver `filaDeCartaConScrydex`).
// · No toca un set cuyo emparejamiento no esté verificado.

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
const MERCADO = 'WEST'
const IDIOMA = 'en'
const PAGINA = 250
// Presupuesto de tiempo: Netlify mata a los 30 s. Se para en 20 para que
// dé tiempo a escribir lo que lleve y a guardar por dónde iba.
const MS_DE_MARGEN = 20_000
const CLAVE_ESTADO = 'cartas-west'

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

export async function procesar({
  env = process.env, fetchImpl = fetch, restImpl = null, escribirImpl = null,
  estadoImpl = null, guardarEstadoImpl = null, reloj = () => Date.now(),
  paginas = 60,
} = {}) {
  const { cabeceras, faltan } = cabecerasDe(env)
  if (faltan) return { estado: 500, cuerpo: { error: `Faltan en Netlify: ${faltan.join(' y ')}.` } }
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { estado: 500, cuerpo: { error: 'Falta SUPABASE_SERVICE_ROLE_KEY.' } }
  const arranque = reloj()
  const quedaTiempo = () => reloj() - arranque < MS_DE_MARGEN

  const pedir = restImpl || ((ruta) => rest(ruta, clave))
  const guardar = escribirImpl || ((tabla, filas) => rest(tabla, clave, { method: 'POST', body: JSON.stringify(filas) }))
  const leerEstado = estadoImpl || (async () => {
    const f = await pedir(`scrydex_estado?select=valor&clave=eq.${CLAVE_ESTADO}&limit=1`)
    return f?.[0]?.valor || {}
  })
  const guardarEstado = guardarEstadoImpl || ((valor) => rest('scrydex_estado', clave, {
    method: 'POST',
    body: JSON.stringify([{ clave: CLAVE_ESTADO, valor, updated_at: new Date().toISOString() }]),
  }))

  // ── Quién es quién: el emparejamiento ya verificado por la 507 ──
  //
  // Un set sin `scrydex_id` no está verificado y NO se toca: un par falso
  // metería las cartas de otro set dentro del nuestro sin dar error, que
  // es lo que costaron las tandas 504 y 505.
  const sets = await pedir(`tcg_sets?select=id,scrydex_id&market=eq.${MERCADO}&scrydex_id=not.is.null&limit=400`)
  const nuestroSetDe = new Map()
  for (const s of sets || []) nuestroSetDe.set(String(s.scrydex_id).toLowerCase(), s.id)
  if (!nuestroSetDe.size) {
    return { estado: 409, cuerpo: { error: 'Ningún set tiene `scrydex_id`: pasa antes «Traer los logos de Scrydex» en /admin.' } }
  }

  const estado = await leerEstado()
  let pagina = Number(estado?.pagina) > 0 ? Number(estado.pagina) : 1
  let total = Number(estado?.total) || 0

  let vistas = 0
  let escritas = 0
  let nombresArreglados = 0
  let sinSetNuestro = 0
  let sinCartaNuestra = 0
  let paginasHechas = 0
  const rarezas = new Map()
  const ejemplosDeNombre = []

  while (paginasHechas < paginas && quedaTiempo()) {
    const res = await fetchImpl(urlDeSonda(`${IDIOMA}/cards`, { page: pagina, page_size: PAGINA }), { headers: cabeceras })
    if (!res.ok) {
      await guardarEstado({ pagina, total, error: `Scrydex ${res.status}`, cuando: new Date().toISOString() })
      return { estado: 502, cuerpo: { error: `Scrydex ${res.status} en la página ${pagina}`, pagina } }
    }
    const j = await res.json()
    const lote = Array.isArray(j?.data) ? j.data : []
    // SU page_size MANDA, no el que pedí (tanda 509): la respuesta dice el
    // que de verdad aplicó, así que no hace falta inventarse el máximo —
    // que es justo el error que costó la 501.
    const suTam = Number(j?.page_size) || lote.length || PAGINA
    total = Number(j?.total_count) || total
    paginasHechas++
    if (!lote.length) {
      // Fin del catálogo: se vuelve a empezar, porque sacan cartas nuevas.
      await guardarEstado({ pagina: 1, total, vuelta: (Number(estado?.vuelta) || 0) + 1, cuando: new Date().toISOString() })
      break
    }

    // Las cartas NUESTRAS de los sets que salen en esta página.
    const susSets = [...new Set(lote.map((c) => String(c?.expansion?.id || '').toLowerCase()).filter(Boolean))]
    const nuestrosIds = susSets.map((s) => nuestroSetDe.get(s)).filter(Boolean)
    const nuestras = nuestrosIds.length
      ? await pedir(
        'tcg_cards?select=id,market,set_id,local_id,name,name_es,image_scrydex,rarity_en,rarity_code,illustrator,dex_ids,hp'
        + `&market=eq.${MERCADO}&set_id=in.(${nuestrosIds.map(encodeURIComponent).join(',')})&limit=20000`,
      )
      : []
    const porClave = new Map()
    for (const c of nuestras || []) porClave.set(`${c.set_id}|${numeroComparable(c.local_id)}`, c)

    const filas = []
    const nombres = []
    for (const suya of lote) {
      vistas++
      if (suya?.rarity) rarezas.set(suya.rarity, (rarezas.get(suya.rarity) || 0) + 1)
      const nuestroSet = nuestroSetDe.get(String(suya?.expansion?.id || '').toLowerCase())
      if (!nuestroSet) { sinSetNuestro++; continue }
      const nuestra = porClave.get(`${nuestroSet}|${numeroComparable(suya?.number)}`)
      if (!nuestra) { sinCartaNuestra++; continue }
      filas.push(filaDeCartaConScrydex(nuestra, suya))
      const bueno = nombreQueHayQueArreglar(nuestra, suya)
      if (bueno) {
        nombres.push({ id: nuestra.id, market: nuestra.market || MERCADO, set_id: nuestra.set_id, name: bueno })
        if (ejemplosDeNombre.length < 15) ejemplosDeNombre.push(`${nuestra.id}: «${nuestra.name}» → «${bueno}»`)
      }
    }

    if (filas.length) { await guardar('tcg_cards', filas); escritas += filas.length }
    // El nombre va en SU PROPIA sentencia: es la única columna que PISA
    // algo, y lleva claves distintas de las de arriba —PostgREST las
    // exige uniformes dentro de una misma sentencia—.
    if (nombres.length) { await guardar('tcg_cards', nombres); nombresArreglados += nombres.length }

    pagina++
    if (total && (pagina - 1) * suTam >= total) {
      await guardarEstado({ pagina: 1, total, vuelta: (Number(estado?.vuelta) || 0) + 1, cuando: new Date().toISOString() })
      break
    }
    await guardarEstado({ pagina, total, cuando: new Date().toISOString() })
  }

  return {
    estado: 200,
    cuerpo: {
      paginasHechas,
      siguientePagina: pagina,
      susCartas: total,
      vistas,
      escritas,
      // EL ARREGLO DEL HALLAZGO DE LA 505: ~1.890 cartas occidentales
      // llevan el español en `name`, que es la clave con la que se cruzan
      // `tcg_card_play`, el resolutor de decklists y la huella de las
      // reimpresiones. No casan con nada, sin dar error.
      nombresArreglados,
      ejemplosDeNombre,
      // Cartas suyas de sets que no tenemos emparejados o que no tenemos.
      // Se dicen, no se insertan.
      sinSetNuestro,
      sinCartaNuestra,
      // Su vocabulario de rarezas, aprendido de los datos: es como se
      // sabe qué hay que traducir sin inventarse la lista.
      rarezasVistas: Object.fromEntries([...rarezas.entries()].sort((a, b) => b[1] - a[1])),
    },
  }
}

export default async () => {
  try {
    const r = await procesar()
    return new Response(JSON.stringify(r.cuerpo), { status: r.estado, headers: { 'content-type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}

export const config = { schedule: '*/5 * * * *' }
