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
// ── EL FRENO, que es lo que impide que esto se coma el plan ──
//
// Sin él: un barrido completo son 101 páginas = 101 créditos, y a 60
// páginas por pasada cada cinco minutos son **48 barridos en una noche =
// 4.848 créditos**, con 5.000 al MES. Se habría comido el plan entero
// antes de que nadie se despertara, y encima para reescribir lo mismo.
//
// Así que para por DOS sitios, y hacen falta los dos:
//
//   1. **Si no queda ninguna carta por marcar, no gasta ni un crédito.**
//      El trabajo está hecho y la función se calla sola.
//   2. **Y un tope de barridos completos**, porque lo primero no basta:
//      hay cartas nuestras que NO EXISTEN en su catálogo —ellos tienen
//      25.209 y nosotros 21.476, pero no son el mismo conjunto—, así que
//      esas no se marcan nunca y «quedan pendientes» sería verdad para
//      siempre. Sin el tope, el freno de arriba no frena.
// UNO, no dos. Cada carta suya sale EXACTAMENTE UNA VEZ en la
// paginación, así que un barrido completo las ve todas: el segundo
// reescribiría las mismas 21.476 filas por 101 créditos más. Y si una
// pasada se muere a medias no se pierde nada, porque se reanuda por la
// página guardada y no volviendo a empezar.
//
// PINGU: «gástame los créditos mínimos, que acabo de pagar el plan y
// seguramente tengamos que hacer más peticiones estos días para corregir
// cosas». Con esto el catálogo entero cuesta ~101 de los 5.000.
const BARRIDOS_MAXIMOS = 1
// Pasado ese tope se vuelve a mirar de vez en cuando, porque salen cartas
// nuevas: una vez por semana, que son 101 créditos y no 4.848.
const DIAS_ENTRE_REPASOS = 7

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

// Cuántas cartas nuestras no ha tocado todavía Scrydex. Sale de un
// `count` de PostgREST, que no baja ni una fila.
// ¿Queda alguna carta nuestra sin tocar por Scrydex? No hace falta el
// número exacto —la decisión es «sí o no»— y una fila es más barato que
// un `count` sobre 21.476. Si la consulta falla se contesta que SÍ: el
// tope de barridos protege igual, y pararse por un fallo de red sería
// dejar el trabajo a medias por el motivo equivocado.
async function quedanPendientes(pedir) {
  try {
    const r = await pedir(`tcg_cards?select=id&market=eq.${MERCADO}&scrydex_at=is.null&limit=1`)
    return Array.isArray(r) ? r.length > 0 : true
  } catch {
    return true
  }
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
  const barridos = Number(estado?.barridos) || 0

  // ── ¿Hay algo que hacer? ──
  //
  // Se pregunta ANTES de gastar un crédito, y la respuesta sale de
  // nuestra propia base, que es gratis. Si no queda nada por marcar, o si
  // ya se han dado los barridos que tocaban y no toca repaso, se calla.
  const pendientes = await quedanPendientes(pedir)
  const enMitadDeUnBarrido = pagina > 1
  const diasDesdeElUltimo = estado?.completadoEn
    ? (Date.now() - Date.parse(estado.completadoEn)) / 86_400_000
    : Infinity
  const tocaRepaso = barridos >= BARRIDOS_MAXIMOS && diasDesdeElUltimo >= DIAS_ENTRE_REPASOS
  if (!enMitadDeUnBarrido && !tocaRepaso && (!pendientes || barridos >= BARRIDOS_MAXIMOS)) {
    return {
      estado: 200,
      cuerpo: {
        hecho: true,
        creditos: 0,
        porque: !pendientes
          ? 'no queda ninguna carta por marcar'
          : `ya se han dado ${barridos} barridos completos; lo que queda son cartas que su catálogo no tiene`,
        quedanPendientes: pendientes,
        barridos,
        proximoRepasoEnDias: Math.max(0, Math.ceil(DIAS_ENTRE_REPASOS - diasDesdeElUltimo)),
      },
    }
  }

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
      await guardarEstado({ pagina, total, barridos, error: `Scrydex ${res.status}`, cuando: new Date().toISOString() })
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
      await guardarEstado({ pagina: 1, total, barridos: barridos + 1, completadoEn: new Date().toISOString() })
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
      await guardarEstado({ pagina: 1, total, barridos: barridos + 1, completadoEn: new Date().toISOString() })
      break
    }
    await guardarEstado({ pagina, total, barridos, cuando: new Date().toISOString() })
  }

  return {
    estado: 200,
    cuerpo: {
      paginasHechas,
      creditos: paginasHechas,
      barridos,
      quedabanPendientes: pendientes,
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
