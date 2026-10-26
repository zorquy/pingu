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
// Y LO QUE NO ES DE NINGUNA EXPANSIÓN (968): TCGGO cuelga las latas de Mega
// Charizard X e Y (y más) de su episodio 226, «Pokémon», que no es ningún
// set nuestro, así que no se pedía nunca. Va en `EPISODIOS_SUELTOS`, se mira
// cada día y por tandas de MAX_PAGINAS (`sigue` apunta por dónde va), con un
// tope de MAX_PAGINAS_SUELTOS por vuelta: si su paginación no acabara nunca,
// la vuelta acaba igual (la 510).
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY, TCGGO_API_KEY;
// opcionales TCGGO_BASE, TCGGO_TOPE_PRODUCTOS, TCGGO_RUTA_PRODUCTOS y
// TCGGO_EPISODIOS_SUELTOS («226,JP:12»: sustituye a la lista).
import { cabeceras, baseDe, baseJpDe, hayMasPaginas, esLimiteDelPlan } from '../lib/tcggo.mjs'
import { filaDeProducto, COLUMNAS_POR_PAIS, COLUMNAS_1026, filasDeContenido } from '../../js/productos.js'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
export const CLAVE_ESTADO = 'tcggo_productos'
// 808: el tope pasa de 400 a 800 y las páginas de 3 a 6 (una expansión
// nueva tiene más de 60 productos). Como mucho 6 × 6 = 36 por pasada × 24 =
// 864 al día, con el tope delante; el plan da 15.000 para todo.
export const TOPE_DIARIO = 800
export const MAX_EXPANSIONES = 6
export const MAX_PAGINAS = 6
// Los ids de producto del catálogo japonés de TCGGO son de OTRA numeración
// que los del occidental, y `tcg_products.id` es la llave (y la de
// `user_products`): un japonés se guarda con este desplazamiento para que
// no pise nunca a un occidental con el mismo número.
export const ID_JP = 1_000_000_000
// Al subirla se vuelve a mirar todo una vez (808: con más páginas y el japonés).
export const REVISION = 808
// Si el catálogo japonés no contesta en ninguna ruta, no se vuelve a probar
// hasta pasados estos días (y lo occidental sigue: no es una parada).
const DIAS_SIN_JP = 7
// Cada cuánto se vuelve a mirar una expansión (días): las de cerca de su
// salida cambian cada día (precios de preventa, productos nuevos).
export const DIAS_CERCA = 1
export const DIAS_LEJOS = 7
const CERCA = 60 // días alrededor de su salida
export const EPISODIOS_SUELTOS = ['226']
export const MAX_PAGINAS_SUELTOS = 30
export function episodiosSueltos(env = {}) {
  const texto = env.TCGGO_EPISODIOS_SUELTOS
  const lista = texto != null ? String(texto).split(',') : EPISODIOS_SUELTOS
  const salida = []
  for (const trozo of lista) {
    const m = /^\s*(?:(JP):)?(\d+)\s*$/i.exec(trozo)
    if (m) salida.push({ id: Number(m[2]), mercado: m[1] ? 'JP' : 'WEST' })
  }
  return salida
}
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

// La clave de una expansión en `hechos`: la occidental, su id a secas (como
// antes de la 808); la japonesa, «JP:id» — los dos catálogos numeran sus
// expansiones por separado y un 93 japonés no es el 93 occidental.
export const claveDe = (mercado, id) => (mercado === 'JP' ? `JP:${id}` : String(id))

// Qué expansiones tocan hoy, de las más cercanas a su salida a las más
// lejanas, una por `tcggo_id` y catálogo (un set plegado y su hermano son
// UNA: la 646).
export function expansionesQueTocan(sets, hechos = {}, hoy) {
  const porId = new Map()
  for (const s of sets || []) {
    const id = Number(s.tcggo_id)
    if (!Number.isInteger(id) || id <= 0) continue
    const mercado = s.market === 'JP' ? 'JP' : 'WEST'
    const clave = claveDe(mercado, id)
    const fecha = /^\d{4}-\d{2}-\d{2}/.test(String(s.release_date || '')) ? String(s.release_date).slice(0, 10) : null
    const ya = porId.get(clave)
    if (!ya || (fecha && (!ya.fecha || fecha > ya.fecha))) porId.set(clave, { id, mercado, clave, fecha })
  }
  const lista = [...porId.values()].filter((e) => {
    const ultima = hechos[e.clave]
    if (!ultima) return true
    const cada = e.fecha && diasEntre(e.fecha, hoy) <= CERCA ? DIAS_CERCA : DIAS_LEJOS
    return diasEntre(ultima, hoy) >= cada
  })
  const distancia = (e) => (e.fecha ? diasEntre(e.fecha, hoy) : 1e6)
  return lista.sort((a, b) => distancia(a) - distancia(b) || b.id - a.id)
}

// Con `contenido`, lo que lleva dentro cada producto viene en la misma
// petición (1026, `include_contained_items=1`): no cuesta una más.
export const urlDeProductos = (plantilla, id, pagina, base, { contenido = false } = {}) => `${base}${plantilla.replace('{id}', encodeURIComponent(id)).replace('{pagina}', pagina)}${contenido ? '&include_contained_items=1' : ''}`

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
  // El catálogo de cada producto (808). Sin la columna, todo lo que se
  // escribe es occidental, así que el japonés NO se pide: escribirlo sin
  // decir de qué catálogo es lo mezclaría con el occidental.
  let conMercado = true
  try { await pedir('tcg_products?select=market&limit=1') } catch { conMercado = false }
  // La 1026: el PVP (columna) y lo que lleva dentro (tabla). Sin su
  // migración, ni se manda la columna ni se pide el contenido a TCGGO.
  let conPvp = true
  try { await pedir(`tcg_products?select=${COLUMNAS_1026.join(',')}&limit=1`) } catch { conPvp = false }
  let conContenido = true
  try { await pedir('tcg_product_contenido?select=product_id&limit=1') } catch { conContenido = false }
  let estado = {}
  try { estado = (await pedir(`scrydex_estado?select=valor&clave=eq.${CLAVE_ESTADO}&limit=1`))?.[0]?.valor || {} } catch { estado = {} }
  estado = { hechos: {}, fallidos: {}, ...estado }
  const guardarEstado = () => pedir('scrydex_estado', { method: 'POST', body: JSON.stringify([{ clave: CLAVE_ESTADO, valor: estado, updated_at: ahora.toISOString() }]) }).catch(() => null)
  if (estado.parado) return { saltado: `parado: ${estado.parado}` }
  // Una vuelta entera otra vez (808): con seis páginas por expansión, y el
  // japonés por su puerta. Solo cuando ya se puede escribir el catálogo.
  if (conMercado && estado.revision !== REVISION) Object.assign(estado, { hechos: {}, fallidos: {}, revision: REVISION })
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
  const jpEnPausa = estado.jpSinRuta?.hasta && estado.jpSinRuta.hasta > hoy
  const sirve = (s) => (s.market === 'JP' ? conMercado && !jpEnPausa : s.market === 'WEST' || !s.market)
  // Los sueltos van como una expansión que sale hoy: cada día y primero.
  const claves = new Set((sets || []).map((s) => claveDe(s.market === 'JP' ? 'JP' : 'WEST', Number(s.tcggo_id))))
  const sueltos = episodiosSueltos(env).filter((e) => !claves.has(claveDe(e.mercado, e.id)))
  const sueltas = new Set(sueltos.map((e) => claveDe(e.mercado, e.id)))
  const comoSets = sueltos.map((e) => ({ market: e.mercado, tcggo_id: e.id, release_date: hoy }))
  estado.sigue = estado.sigue || {}
  const toca = expansionesQueTocan([...comoSets, ...(sets || [])].filter(sirve), estado.hechos, hoy).slice(0, MAX_EXPANSIONES)
  const { base, host } = baseDe(env)
  const bases = { WEST: base, JP: baseJpDe(base) }
  // La ruta de cada catálogo, apuntada por separado: que la occidental
  // conteste no dice nada de la japonesa.
  const campoRuta = (m) => (m === 'JP' ? 'rutaJp' : 'ruta')
  const campoSinRuta = (m) => (m === 'JP' ? 'sinRutaJp' : 'sinRuta')
  const rutasDe = (m) => (env.TCGGO_RUTA_PRODUCTOS && m === 'WEST' ? [String(env.TCGGO_RUTA_PRODUCTOS)] : estado[campoRuta(m)] ? [estado[campoRuta(m)]] : RUTAS)
  const resumen = { expansiones: 0, productos: 0, peticiones: 0, porCatalogo: { WEST: 0, JP: 0 } }

  for (const e of toca) {
    if (estado.peticiones >= tope) break
    if (e.mercado === 'JP' && estado.jpSinRuta?.hasta > hoy) continue
    const filas = []
    const contenidos = []
    const suelta = sueltas.has(e.clave)
    // Un suelto sigue por donde lo dejó la pasada anterior.
    const desde = suelta ? Math.max(1, Number(estado.sigue[e.clave]) || 1) : 1
    let pagina = desde
    let ok = false
    let acabada = true
    const rutas = rutasDe(e.mercado)
    const fija = e.mercado === 'WEST' && env.TCGGO_RUTA_PRODUCTOS
    for (; pagina < desde + MAX_PAGINAS && estado.peticiones < tope; pagina++) {
      let respuesta = null
      let todas404 = true
      for (const plantilla of rutas) {
        // El tope se mira ANTES de cada petición, también al probar la
        // segunda ruta: si no, un tope de 1 gastaba 2.
        if (estado.peticiones >= tope) break
        estado.peticiones++
        resumen.peticiones++
        const res = await fetchImpl(urlDeProductos(plantilla, e.id, pagina, bases[e.mercado], { contenido: conContenido }), { headers: cabeceras(env.TCGGO_API_KEY, host) })
        const texto = await res.text()
        if (esLimiteDelPlan(res.status, texto)) {
          estado.sinPlanHasta = hoy
          await guardarEstado()
          return { ...resumen, parado: 'el plan de TCGGO no da más por hoy' }
        }
        if (res.status === 404) continue
        todas404 = false
        if (!res.ok) { estado.ultimoError = `TCGGO ${res.status} en la expansión ${e.clave}`; break }
        try { respuesta = JSON.parse(texto) } catch { estado.ultimoError = `TCGGO contestó algo que no es JSON (${e.clave})`; break }
        if (!estado[campoRuta(e.mercado)] && !fija) estado[campoRuta(e.mercado)] = plantilla
        break
      }
      if (!respuesta) {
        // Sin ruta apuntada y con 404 en todas: puede que la ruta sea otra.
        // A la sexta expansión así se para ESE catálogo (la 510: un freno
        // que pregunta «¿queda algo?» no frena). El occidental, del todo,
        // hasta que un humano ponga la ruta; el japonés, una semana, y lo
        // occidental sigue (808): que TCGGO no tenga productos japoneses no
        // es un fallo de nadie.
        if (todas404 && !estado[campoRuta(e.mercado)] && !fija && pagina === 1 && !suelta) {
          const k = campoSinRuta(e.mercado)
          estado[k] = (estado[k] || 0) + 1
          if (estado[k] >= 6) {
            if (e.mercado === 'JP') {
              const hasta = new Date(ahora.getTime() + DIAS_SIN_JP * 86_400_000).toISOString().slice(0, 10)
              estado.jpSinRuta = { desde: hoy, hasta, porque: 'ninguna ruta de productos contesta en el catálogo japonés de TCGGO' }
              estado[k] = 0
            } else {
              estado.parado = 'ninguna ruta de productos contesta: pon la buena en TCGGO_RUTA_PRODUCTOS ({id} y {pagina})'
              await guardarEstado()
              return { ...resumen, error: estado.parado }
            }
          }
        }
        break
      }
      ok = true
      estado[campoSinRuta(e.mercado)] = 0
      for (const p of Array.isArray(respuesta.data) ? respuesta.data : []) {
        const f = filaDeProducto(p, { ahora })
        if (!f) continue
        if (!porPais) for (const c of COLUMNAS_POR_PAIS) delete f[c]
        if (!conPvp) for (const c of COLUMNAS_1026) delete f[c]
        const fila = { ...f, episode_id: f.episode_id ?? e.id }
        if (conMercado) fila.market = e.mercado
        if (e.mercado === 'JP') fila.id = ID_JP + f.id
        filas.push(fila)
        // Lo que lleva dentro (1026), colgado de NUESTRO id del producto; un
        // producto contenido japonés va desplazado igual que su padre.
        if (conContenido) contenidos.push(...filasDeContenido(p, { productId: fila.id, ahora, idDe: (id) => (e.mercado === 'JP' ? ID_JP + id : id) }))
      }
      if (!hayMasPaginas(respuesta)) { acabada = true; break }
      acabada = false
    }
    if (!ok) {
      // Lo del OTRO se salta: a la tercera, se da por mirada hasta la próxima vuelta.
      estado.fallidos[e.clave] = (estado.fallidos[e.clave] || 0) + 1
      if (estado.fallidos[e.clave] >= 3) { estado.hechos[e.clave] = hoy; delete estado.fallidos[e.clave] }
      continue
    }
    if (filas.length) {
      try {
        await pedir('tcg_products', { method: 'POST', body: JSON.stringify(filas) })
        // El contenido se reescribe entero por producto (1026): lo de antes
        // fuera y lo de ahora dentro, que un sobre que TCGGO quite de un pack
        // no puede seguir contado. Los productos van primero: la tabla cuelga
        // de ellos por clave ajena.
        if (conContenido) {
          const ids = filas.map((f) => f.id)
          for (let i = 0; i < ids.length; i += 100) await pedir(`tcg_product_contenido?product_id=in.(${ids.slice(i, i + 100).join(',')})`, { method: 'DELETE' })
          if (contenidos.length) await pedir('tcg_product_contenido', { method: 'POST', body: JSON.stringify(contenidos) })
        }
      } catch (err) {
        // Lo NUESTRO para: seguir sería pagar peticiones para no escribir nada.
        estado.parado = `no se han podido escribir los productos: ${String(err?.message || err).slice(0, 160)}`
        await guardarEstado()
        return { ...resumen, error: estado.parado }
      }
    }
    // Un suelto a medias no está hecho: la pasada siguiente sigue (hasta el
    // tope de la vuelta, que lo da por hecho igual).
    if (suelta && !acabada && pagina <= MAX_PAGINAS_SUELTOS) estado.sigue[e.clave] = pagina
    else {
      delete estado.sigue[e.clave]
      estado.hechos[e.clave] = hoy
    }
    delete estado.fallidos[e.clave]
    resumen.expansiones++
    resumen.productos += filas.length
    resumen.contenidos = (resumen.contenidos || 0) + contenidos.length
    resumen.porCatalogo[e.mercado] += filas.length
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
