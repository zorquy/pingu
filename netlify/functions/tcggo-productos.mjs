// Los PRODUCTOS SELLADOS de TCGGO, por expansión (tanda 762, PR1).
//
// Programada cada hora. Cada pasada coge las expansiones nuestras con
// `tcggo_id` que toca mirar —las que salen pronto o acaban de salir, cada
// día; las demás, cada semana— y le pide a TCGGO sus productos (20 por
// página), que se escriben en `tcg_products` (supabase-migration-
// productos.sql). Lo que cuesta, multiplicado antes de poner el `schedule`
// (la 509): como mucho MAX_EXPANSIONES × MAX_PAGINAS = 18 peticiones por
// pasada × 24 = 432 al día, y con el tope diario (`TCGGO_TOPE_PRODUCTOS`,
// 400) delante; el plan da 15.000.
//
// LA RUTA NO LA SABEMOS SEGURO: PINGU pegó la respuesta (con `paging`) pero
// no la dirección. Se prueban por orden `/episodes/{id}/products` y
// `/products?episode_id={id}`, y la primera que no da 404 se apunta en el
// estado y se usa desde entonces. `TCGGO_RUTA_PRODUCTOS` en Netlify la fija
// sin desplegar ({id} y {pagina}).
//
// Los frenos de la casa: lo que falla del OTRO (un 404 de una expansión)
// se salta y se cuenta; lo que falla de NUESTRA base se PARA (`parado` en
// el estado, y lo quita un humano: la 526); 429/403 del plan, hasta mañana.
// Y antes de gastar una petición se mira, gratis, que la tabla exista.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY, TCGGO_API_KEY;
// opcionales TCGGO_BASE, TCGGO_TOPE_PRODUCTOS, TCGGO_RUTA_PRODUCTOS.
import { cabeceras, baseDe, hayMasPaginas, esLimiteDelPlan } from '../lib/tcggo.mjs'
import { filaDeProducto, COLUMNAS_POR_PAIS } from '../../js/productos.js'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
export const CLAVE_ESTADO = 'tcggo_productos'
export const TOPE_DIARIO = 400
export const MAX_EXPANSIONES = 6
export const MAX_PAGINAS = 3
// Cada cuánto se vuelve a mirar una expansión (días): las de cerca de su
// salida cambian cada día (precios de preventa, productos nuevos).
export const DIAS_CERCA = 1
export const DIAS_LEJOS = 7
const CERCA = 60 // días alrededor de su salida
export const RUTAS = ['/episodes/{id}/products?page={pagina}', '/products?episode_id={id}&page={pagina}']

async function rest(ruta, clave, opciones = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...(opciones || {}),
    headers: {
      apikey: clave,
      authorization: `Bearer ${clave}`,
      ...(opciones ? { 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal' } : {}),
    },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const texto = await res.text()
  return texto ? JSON.parse(texto) : null
}

const diasEntre = (a, b) => Math.abs(new Date(`${a}T00:00:00Z`) - new Date(`${b}T00:00:00Z`)) / 86_400_000

// Qué expansiones tocan hoy, de las más cercanas a su salida a las más
// lejanas, una por `tcggo_id` (un set plegado y su hermano son UNA: la 646).
export function expansionesQueTocan(sets, hechos = {}, hoy) {
  const porId = new Map()
  for (const s of sets || []) {
    const id = Number(s.tcggo_id)
    if (!Number.isInteger(id) || id <= 0) continue
    const fecha = /^\d{4}-\d{2}-\d{2}/.test(String(s.release_date || '')) ? String(s.release_date).slice(0, 10) : null
    const ya = porId.get(id)
    if (!ya || (fecha && (!ya.fecha || fecha > ya.fecha))) porId.set(id, { id, fecha })
  }
  const lista = [...porId.values()].filter((e) => {
    const ultima = hechos[e.id]
    if (!ultima) return true
    const cada = e.fecha && diasEntre(e.fecha, hoy) <= CERCA ? DIAS_CERCA : DIAS_LEJOS
    return diasEntre(ultima, hoy) >= cada
  })
  const distancia = (e) => (e.fecha ? diasEntre(e.fecha, hoy) : 1e6)
  return lista.sort((a, b) => distancia(a) - distancia(b) || b.id - a.id)
}

export const urlDeProductos = (plantilla, id, pagina, base) => `${base}${plantilla.replace('{id}', encodeURIComponent(id)).replace('{pagina}', pagina)}`

export async function procesar({ env = process.env, fetchImpl = fetch, restImpl = null, ahora = new Date() } = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { error: 'Falta SUPABASE_SERVICE_ROLE_KEY.' }
  if (!env.TCGGO_API_KEY) return { saltado: 'sin TCGGO_API_KEY' }
  const pedir = restImpl || ((ruta, o) => rest(ruta, clave, o))
  const hoy = ahora.toISOString().slice(0, 10)

  // La tabla, primero y gratis: sin la migración no se gasta nada.
  try {
    await pedir('tcg_products?select=id&limit=1')
  } catch (e) {
    return { saltado: `falta supabase-migration-productos.sql (${String(e?.message || e).slice(0, 80)})` }
  }
  // Las columnas por país (769): si su migración no está, no se mandan.
  let porPais = true
  try { await pedir(`tcg_products?select=${COLUMNAS_POR_PAIS.join(',')}&limit=1`) } catch { porPais = false }
  let estado = {}
  try { estado = (await pedir(`scrydex_estado?select=valor&clave=eq.${CLAVE_ESTADO}&limit=1`))?.[0]?.valor || {} } catch { estado = {} }
  estado = { hechos: {}, fallidos: {}, ...estado }
  const guardarEstado = () => pedir('scrydex_estado', { method: 'POST', body: JSON.stringify([{ clave: CLAVE_ESTADO, valor: estado, updated_at: ahora.toISOString() }]) }).catch(() => null)
  if (estado.parado) return { saltado: `parado: ${estado.parado}` }
  if (estado.dia !== hoy) Object.assign(estado, { dia: hoy, peticiones: 0, sinPlanHasta: estado.sinPlanHasta === hoy ? hoy : null })
  if (estado.sinPlanHasta === hoy) return { saltado: 'el plan de TCGGO no da más por hoy' }
  const tope = Math.max(1, Number(env.TCGGO_TOPE_PRODUCTOS) || TOPE_DIARIO)

  let sets
  try {
    sets = await pedir('tcg_sets?select=id,market,tcggo_id,release_date&tcggo_id=not.is.null&limit=2000')
  } catch (e) {
    estado.parado = `no se han podido leer los sets: ${String(e?.message || e).slice(0, 120)}`
    await guardarEstado()
    return { error: estado.parado }
  }
  const toca = expansionesQueTocan(sets, estado.hechos, hoy).slice(0, MAX_EXPANSIONES)
  const { base, host } = baseDe(env)
  const rutas = env.TCGGO_RUTA_PRODUCTOS ? [String(env.TCGGO_RUTA_PRODUCTOS)] : estado.ruta ? [estado.ruta] : RUTAS
  const resumen = { expansiones: 0, productos: 0, peticiones: 0 }

  for (const e of toca) {
    if (estado.peticiones >= tope) break
    const filas = []
    let pagina = 1
    let ok = false
    for (; pagina <= MAX_PAGINAS && estado.peticiones < tope; pagina++) {
      let respuesta = null
      let todas404 = true
      for (const plantilla of rutas) {
        // El tope se mira ANTES de cada petición, también al probar la
        // segunda ruta: si no, un tope de 1 gastaba 2.
        if (estado.peticiones >= tope) break
        estado.peticiones++
        resumen.peticiones++
        const res = await fetchImpl(urlDeProductos(plantilla, e.id, pagina, base), { headers: cabeceras(env.TCGGO_API_KEY, host) })
        const texto = await res.text()
        if (esLimiteDelPlan(res.status, texto)) {
          estado.sinPlanHasta = hoy
          await guardarEstado()
          return { ...resumen, parado: 'el plan de TCGGO no da más por hoy' }
        }
        if (res.status === 404) continue
        todas404 = false
        if (!res.ok) { estado.ultimoError = `TCGGO ${res.status} en la expansión ${e.id}`; break }
        try { respuesta = JSON.parse(texto) } catch { estado.ultimoError = `TCGGO contestó algo que no es JSON (${e.id})`; break }
        if (!estado.ruta && !env.TCGGO_RUTA_PRODUCTOS) estado.ruta = plantilla
        break
      }
      if (!respuesta) {
        // Sin ruta apuntada y con 404 en todas: puede que la ruta sea otra.
        // A la sexta expansión así se PARA, que si no cada pasada pagaría
        // dos peticiones por expansión para nada (la 510: un freno que
        // pregunta «¿queda algo?» no frena).
        if (todas404 && !estado.ruta && !env.TCGGO_RUTA_PRODUCTOS && pagina === 1) {
          estado.sinRuta = (estado.sinRuta || 0) + 1
          if (estado.sinRuta >= 6) {
            estado.parado = 'ninguna ruta de productos contesta: pon la buena en TCGGO_RUTA_PRODUCTOS ({id} y {pagina})'
            await guardarEstado()
            return { ...resumen, error: estado.parado }
          }
        }
        break
      }
      ok = true
      estado.sinRuta = 0
      for (const p of Array.isArray(respuesta.data) ? respuesta.data : []) {
        const f = filaDeProducto(p, { ahora })
        if (!f) continue
        if (!porPais) for (const c of COLUMNAS_POR_PAIS) delete f[c]
        filas.push({ ...f, episode_id: f.episode_id ?? e.id })
      }
      if (!hayMasPaginas(respuesta)) break
    }
    if (!ok) {
      // Lo del OTRO se salta: a la tercera, se da por mirada hasta la próxima vuelta.
      estado.fallidos[e.id] = (estado.fallidos[e.id] || 0) + 1
      if (estado.fallidos[e.id] >= 3) { estado.hechos[e.id] = hoy; delete estado.fallidos[e.id] }
      continue
    }
    if (filas.length) {
      try {
        await pedir('tcg_products', { method: 'POST', body: JSON.stringify(filas) })
      } catch (err) {
        // Lo NUESTRO para: seguir sería pagar peticiones para no escribir nada.
        estado.parado = `no se han podido escribir los productos: ${String(err?.message || err).slice(0, 160)}`
        await guardarEstado()
        return { ...resumen, error: estado.parado }
      }
    }
    estado.hechos[e.id] = hoy
    delete estado.fallidos[e.id]
    resumen.expansiones++
    resumen.productos += filas.length
  }
  estado.ultimaPasada = { ...resumen, at: ahora.toISOString() }
  await guardarEstado()
  return resumen
}

export default async () => {
  try {
    const r = await procesar()
    return new Response(JSON.stringify(r), { headers: { 'content-type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e).slice(0, 300) }), { status: 500 })
  }
}

export const config = { schedule: '23 * * * *' }
