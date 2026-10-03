import { idDeAdmin, tokenDe } from '../lib/admin.mjs'
import {
  cabecerasDe, urlDeSonda, emparejarSets, CAMPOS_SUYOS,
  numeroComparable, verificarPar, laCarta, formasDeId, culpaDeLaDiscrepancia,
} from '../lib/scrydex.mjs'

// Comprobar que cada emparejamiento de set es el que creemos (tanda 504).
//
// ── POR QUÉ HACE FALTA ──
//
// El emparejamiento casa por fecha y cuenta de cartas, y acierta mucho.
// Pero en la medida del inglés (tanda 503) salió **`ex5.5 → wb1`**:
// comparten fecha y cuenta, no había un segundo candidato, y la regla los
// casó con confianza. Y como en `wb1-logo` hay un logo DE VERDAD, aquella
// sonda lo contó como acierto.
//
// Para decidir si pagar, eso daba igual: la pregunta era «¿tienen fotos?».
// Para ESCRIBIR no da igual, porque un emparejamiento falso mete el logo
// de otro set encima del nuestro y las cartas de otro set dentro del
// nuestro, **sin dar ningún error**.
//
// Un nombre de carta lo zanja, y cuesta un crédito por set.
//
// NO ESCRIBE NADA. Solo dice qué pares están confirmados, cuáles hay que
// tirar y cuáles no se han podido comprobar.
//
// VARIABLES: SCRYDEX_API_KEY, SCRYDEX_TEAM_ID, SUPABASE_SERVICE_ROLE_KEY.

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
const POR_PASADA = 60
const A_LA_VEZ = 4
// De cada set se piden unas pocas cartas y se elige la de número más bajo
// DE VERDAD: `order=local_id.asc` es un orden de TEXTO, así que «10» va
// antes que «2» y la primera fila no es la carta 1.
const CANDIDATAS = 12

async function rest(ruta, clave) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    headers: { apikey: clave, authorization: `Bearer ${clave}` },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 160)}`)
  return res.json()
}

async function enTandas(cosas, cuantas, hacer) {
  let i = 0
  await Promise.all(Array.from({ length: Math.min(cuantas, cosas.length) }, async () => {
    while (i < cosas.length) await hacer(cosas[i++])
  }))
}

// La carta de número más bajo con nombre. Se compara el número con la
// misma normalización con la que luego se monta su id, para no elegir una
// que no se va a poder pedir.
function laMasBaja(cartas) {
  const conNombre = (cartas || []).filter((c) => c.name && numeroComparable(c.local_id))
  if (!conNombre.length) return null
  const peso = (c) => {
    const n = numeroComparable(c.local_id)
    const d = n.match(/\d+/)
    // Las que son un número puro van primero; una «TG01» o una «SV045»
    // sirven igual, pero son menos seguras y se dejan detrás.
    return [/^\d+$/.test(n) ? 0 : 1, d ? Number(d[0]) : 1e9]
  }
  return conNombre.slice().sort((a, b) => {
    const [pa, na] = peso(a)
    const [pb, nb] = peso(b)
    return pa - pb || na - nb
  })[0]
}

export async function procesar({
  env = process.env, fetchImpl = fetch, restImpl = null,
  mercado = 'WEST', idioma = 'en', desde = 0,
} = {}) {
  const { cabeceras, faltan } = cabecerasDe(env)
  if (faltan) return { estado: 500, cuerpo: { error: `Faltan en Netlify: ${faltan.join(' y ')}.` } }
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { estado: 500, cuerpo: { error: 'Falta SUPABASE_SERVICE_ROLE_KEY.' } }
  const pedir = restImpl || ((ruta) => rest(ruta, clave))

  const COLS = 'id,name,release_date,card_count_official,card_count_total,tcg_online_code'
  const nuestros = await pedir(`tcg_sets?select=${COLS}&market=eq.${mercado}&limit=400`)

  // Sus expansiones del idioma que toque.
  const suyas = []
  for (let pagina = 1; pagina <= 6; pagina++) {
    const res = await fetchImpl(urlDeSonda(`${idioma}/expansions`, { page: pagina, page_size: 100 }), { headers: cabeceras })
    if (!res.ok) return { estado: 502, cuerpo: { error: `Scrydex ${res.status} al pedir sus expansiones` } }
    const j = await res.json()
    const lote = Array.isArray(j?.data) ? j.data : []
    suyas.push(...lote)
    if (lote.length === 0 || suyas.length >= (j?.total_count || 0)) break
  }

  const { pares, ambiguos, sueltos } = emparejarSets(nuestros, suyas, { suyos: CAMPOS_SUYOS })

  // `desde` existe para que los pares que no caben en una pasada se puedan
  // ALCANZAR. Sin él, «quedan 111 por verificar» es un número que no lleva
  // a ninguna parte: el que lo lee no tiene forma de pedir los siguientes.
  const arranque = Math.max(0, Math.min(Number(desde) || 0, pares.length))
  const aVerificar = pares.slice(arranque, arranque + POR_PASADA)

  // UNA CARTA NUESTRA POR SET, pedida set a set. Con una sola consulta y un
  // `limit` global, los últimos sets se quedaban fuera por truncado y el
  // informe decía «no tenemos ninguna carta suya» de sets llenos de cartas
  // — un fallo de la consulta leído como un dato del catálogo.
  const unaDe = new Map()
  await enTandas(aVerificar, A_LA_VEZ, async (par) => {
    const filas = await pedir(
      `tcg_cards?select=local_id,name,name_es&market=eq.${mercado}`
      + `&set_id=eq.${encodeURIComponent(par.nuestro.id)}`
      + `&order=local_id.asc&limit=${CANDIDATAS}`,
    )
    const c = laMasBaja(filas)
    if (c) unaDe.set(par.nuestro.id, c)
  })

  const confirmados = []
  // «Discrepan» y no «rechazados» (tanda 505): la 504 llamó rechazo a un
  // nombre que no coincide y se equivocó en los OCHO casos, porque nuestro
  // `name` occidental está en español en parte de las filas. Ahora se
  // separan por CULPA: las nuestras, que no dicen nada del par, y las que
  // de verdad hay que mirar a mano.
  const culpaNuestra = []
  const porMirar = []
  const sinComprobar = []
  const anotar = (par, porque) => sinComprobar.push({ par: `${par.nuestro.id} → ${par.suyo.id}`, porque })

  await enTandas(aVerificar, A_LA_VEZ, async (par) => {
    const nuestra = unaDe.get(par.nuestro.id)
    if (!nuestra) return anotar(par, 'no tenemos ninguna carta de ese set con nombre y número')
    // Las dos formas del id, la LITERAL primero: ellos guardan el número
    // tal como está impreso («TG01», «XY01», «SWSH001»), y normalizarlo
    // dejó trece pares en 404 en la 504.
    const formas = formasDeId(par.suyo.id, nuestra.local_id)
    try {
      let suya = null
      const probados = []
      for (const suId of formas) {
        probados.push(suId)
        const res = await fetchImpl(urlDeSonda(`cards/${suId}`), { headers: cabeceras })
        if (res.ok) { suya = laCarta(await res.json()); break }
        if (res.status !== 404) return anotar(par, `su API devolvió ${res.status} para ${suId}`)
      }
      if (!suya) {
        // Un 404 de TODAS las formas NO es «el par está mal»: puede que esa
        // carta nuestra no exista en su set. Contarlo como rechazo sería
        // tirar un emparejamiento bueno por un fallo nuestro.
        return anotar(par, `404 en todas las formas: ${probados.join(', ')}`)
      }
      const v = verificarPar({ nuestroNombre: nuestra.name, suyoNombre: suya?.name })
      const linea = {
        nuestro: par.nuestro.id, suyo: par.suyo.id, por: par.por,
        carta: `${nuestra.local_id} «${nuestra.name}»`, suya: suya?.name || '(sin nombre)',
      }
      if (v.veredicto === 'confirmado') return confirmados.push(linea)
      if (v.veredicto !== 'discrepan') return anotar(par, v.porque)
      const c = culpaDeLaDiscrepancia({ name: nuestra.name, nameEs: nuestra.name_es })
      ;(c.culpa === 'nuestra' ? culpaNuestra : porMirar).push({ ...linea, porque: c.porque })
    } catch (e) {
      anotar(par, String(e?.message || e).slice(0, 90))
    }
  })

  const siguiente = arranque + aVerificar.length
  return {
    estado: 200,
    cuerpo: {
      mercado,
      idioma,
      creditos: `${Math.ceil(suyas.length / 100)} de sus expansiones + ${aVerificar.length} de las cartas`,
      emparejados: pares.length,
      verificadosEnEstaPasada: aVerificar.length
        ? `${arranque + 1}–${siguiente} de ${pares.length}`
        : `ninguno: ya estaban los ${pares.length}`,
      // El número aparte del rótulo: el panel suma pasadas, y sacar una
      // cifra de una cadena con guion largo dentro es un número que se
      // rompe el día que se reescriba la frase.
      verificadas: aVerificar.length,
      // Si quedan, se dice CON el número que hay que meter para seguir.
      siguienteDesde: siguiente < pares.length ? siguiente : null,
      ambiguos: ambiguos.length,
      sinEmparejar: sueltos.length,
      confirmados: confirmados.length,
      // LO QUE HAY QUE MIRAR A MANO, y solo esto: los nombres que no
      // coinciden y de los que NO se puede demostrar que la culpa sea
      // nuestra. Con los dos nombres, para no fiarse de un número.
      porMirar,
      // Y aparte, los que discrepan porque nuestro `name` está en español.
      // Esos no dicen nada del par — pero sí son un fallo NUESTRO, que es
      // justo lo que la 335 dejó a medias.
      nuestroNombreEnEspanol: culpaNuestra.length,
      ejemplosEnEspanol: culpaNuestra.slice(0, 10),
      sinComprobar: sinComprobar.slice(0, 20),
      sinComprobarTotal: sinComprobar.length,
      ejemplosConfirmados: confirmados.slice(0, 5),
    },
  }
}

export default async (req) => {
  const json = (e, c) => new Response(JSON.stringify(c), { status: e, headers: { 'content-type': 'application/json' } })
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido.' })
  if (!(await idDeAdmin(tokenDe(req)))) return json(401, { error: 'No autorizado.' })
  let cuerpo = {}
  try { cuerpo = await req.json() } catch { cuerpo = {} }
  const r = await procesar({ mercado: cuerpo.mercado || 'WEST', idioma: cuerpo.idioma || 'en', desde: cuerpo.desde || 0 })
  return json(r.estado, r.cuerpo)
}
