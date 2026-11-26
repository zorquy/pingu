// Los arquetipos de Limitless, al día (tanda 1466).
//
// Ibai: «que PokeDoc mire cada día los arquetipos de Limitless para traerse
// los nuevos, y quitar los antiguos si hace falta». La 1460 llenó
// `tcg_archetypes` con 148 de una vez (el andamio de la rama `pruebas`); esto
// lo mantiene solo, con lo que ya trae `meta-limitless` a la base:
//
//   · NUEVOS: un arquetipo que Limitless juega (`meta_resumen`, 60 días) y que
//     el catálogo no ha tenido nunca entra con sus iconos y una regla sacada de
//     sus listas, como las de la 1460: las cartas de sus iconos y, si así se
//     acierta más, alguna más o un mínimo de copias. Solo entra si MEJORA lo
//     que la web acierta con esas listas (las suyas y las de los demás que
//     llevan lo mismo): un arquetipo que se comería los de otro se queda fuera,
//     apuntado en el estado, y se vuelve a mirar a la semana.
//   · RETIRADOS: el que lleva 60 días sin un solo mazo se APAGA
//     (`activo = false`), no se borra: las partidas apuntadas lo guardan por su
//     id (`a:<id>`) y con su nombre. Si vuelve a jugarse, se enciende.
//   · RENOMBRADOS: si Limitless le cambia el nombre, se cambia aquí.
//
// Y lo que alguien ha tocado en /admin no se toca: la pasada apunta la hora
// (`updated_at`) de cada fila que escribe, y una fila con otra hora es que la
// ha guardado una persona. Una que se BORRA en /admin no vuelve: los ids que
// el catálogo ha tenido alguna vez se recuerdan (`conocidos`).
//
// ── LOS FRENOS ──
//
// No paga nada (todo es nuestra base), pero se mide igual: dos pasadas al día
// y la segunda solo mira si la primera ya acabó. Nada se retira si el meta no
// está al día (el último torneo online de hace más de 3 días: si se para
// `meta-limitless`, todo parecería abandonado) o si hay pocos arquetipos
// vivos, y como mucho 10 al día. Y como mucho 6 nuevos por pasada.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY (obligatoria).

import { llevaLaCarta } from '../../js/torneos/arquetipos.js'
import { claveDeCarta } from '../../js/normalizar.js'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
export const CLAVE_ESTADO = 'arquetipos_limitless'
export const DIAS = 60
export const MIN_LISTAS = 3
// Lo que llevan casi todas sus listas: lo mismo que en la 1460.
export const UMBRAL = 0.85
export const MAX_REQUISITOS = 5
export const NUEVOS_POR_PASADA = 6
export const RETIROS_POR_PASADA = 10
export const MIN_ARQUETIPOS_VIVOS = 30
export const DIAS_SIN_TORNEOS = 3
export const DIAS_PARA_REINTENTAR = 7
const MAX_AJENAS = 2000
const MS_DE_TRABAJO = 20_000
const DIA = 86_400_000

// Lo que no es un arquetipo de verdad: el cajón de Limitless, sus Basic Box
// (la web los reconoce sola, 1443) y las jornadas de PokeDoc.
export const esDeFuera = (id) => !id || id === 'other' || /^basic-box/.test(id) || String(id).startsWith('pokedoc-')

// La clave con la que la web cruza un nombre (`llevaLaCarta`).
const claveReq = (n) => claveDeCarta(n).replace(/[‘’]/g, "'")
const copiasDe = (l) => Math.max(1, Number(l?.quantity ?? l?.count) || 1)
const mismaHora = (a, b) => Boolean(a && b) && Date.parse(a) === Date.parse(b)
const diaDe = (fecha) => new Date(fecha).toISOString().slice(0, 10)

// Una lista como la mira la web: sus Pokémon y entrenadores (las energías no
// cuentan en `arquetipoDelCatalogo`), con las copias por nombre.
export function prepararLista(arquetipo, lista) {
  const copias = new Map()
  const crudos = new Map()
  for (const seccion of ['pokemon', 'trainer']) {
    for (const c of lista?.[seccion] || []) {
      const k = claveReq(c?.name)
      if (!k) continue
      copias.set(k, (copias.get(k) || 0) + copiasDe(c))
      if (!crudos.has(k)) crudos.set(k, { nombre: String(c.name).trim(), seccion })
    }
  }
  return { a: arquetipo, lista, copias, crudos }
}

// El catálogo, listo para cruzarlo deprisa y con la MISMA regla que
// `arquetipoDelCatalogo`: solo los activos con requisitos, el de más
// requisitos primero y, a igualdad, el id alfabético.
export function prepararCatalogo(catalogo) {
  return (catalogo || [])
    .filter((a) => a?.activo !== false && Array.isArray(a?.requiere) && a.requiere.length > 0)
    .map((a) => ({
      id: a.id,
      n: a.requiere.length,
      reqs: a.requiere.map((r) => ({
        r,
        claves: [...new Set((r?.nombres || []).map(claveReq).filter(Boolean))],
        minimo: Math.max(1, Number(r?.minimo) || 1),
        porNumero: Boolean(r?.set && r?.numero),
      })),
    }))
    .sort((a, b) => b.n - a.n || String(a.id).localeCompare(String(b.id)))
}

// ¿Cumple la lista este requisito del catálogo? Por nombre, con el mapa de
// copias; uno que pide además set y número (los hechos a mano en /admin) va
// por `llevaLaCarta`, que es quien sabe juntar las dos cosas.
function cumpleReq(x, q) {
  if (q.porNumero) return llevaLaCarta([...(x.lista?.pokemon || []), ...(x.lista?.trainer || [])], q.r)
  let n = 0
  for (const k of q.claves) n += x.copias.get(k) || 0
  return n >= q.minimo
}

// El arquetipo que la web le pone hoy a una lista, o null.
export function ganadorDelCatalogo(x, reglas) {
  for (const a of reglas) if (a.reqs.every((q) => cumpleReq(x, q))) return { id: a.id, n: a.n }
  return null
}

// Las cartas que llevan casi todas sus listas, con las copias que llevan casi
// todas. Las que más se llevan, primero, y a igualdad los POKÉMON antes que
// los entrenadores: una regla que pide un «Boss's Orders» acierta igual en
// las listas de Limitless y se rompe con el primer mazo casero que no lo
// lleve (la lección de la 1460: las reglas, ancladas en sus Pokémon).
export function candidatas(propias) {
  const total = propias.length
  const cuenta = new Map()
  const seccion = new Map()
  for (const x of propias) {
    for (const [k, v] of x.copias) {
      if (!cuenta.has(k)) cuenta.set(k, [])
      cuenta.get(k).push(v)
      if (!seccion.has(k)) seccion.set(k, x.crudos.get(k)?.seccion)
    }
  }
  const fuera = []
  for (const [k, vs] of cuenta) {
    if (!total || vs.length / total < UMBRAL) continue
    const todos = [...vs, ...Array(total - vs.length).fill(0)].sort((p, q) => q - p)
    const corte = Math.max(1, todos[Math.max(0, Math.ceil(UMBRAL * total) - 1)])
    for (let m = 1; m <= Math.min(corte, 4); m++) fuera.push({ k, m, presencia: vs.length / total, pokemon: seccion.get(k) === 'pokemon' })
  }
  return fuera.sort((p, q) => q.presencia - p.presencia || Number(q.pokemon) - Number(p.pokemon) || p.m - q.m || p.k.localeCompare(q.k))
}

// La carta de un icono de Limitless («dragapult», «iron-thorns»): el Pokémon
// de sus listas cuyo nombre lleva esas palabras, el más llevado.
export function cartaDeIcono(slug, propias) {
  const tokens = String(slug || '').toLowerCase().split('-').filter(Boolean)
  if (!tokens.length) return null
  const mazos = new Map()
  for (const x of propias) for (const [k, c] of x.crudos) if (c.seccion === 'pokemon') mazos.set(k, (mazos.get(k) || 0) + 1)
  const casa = (k, ts) => {
    const ws = k.split(' ').map((w) => w.replace(/'s$/, ''))
    return ts.every((t) => ws.includes(t))
  }
  const mejor = (ts) => [...mazos].filter(([k]) => casa(k, ts)).sort((p, q) => q[1] - p[1] || p[0].localeCompare(q[0]))[0]?.[0] || null
  return mejor(tokens) || mejor(tokens.filter((t) => !['mega', 'ex', 'v', 'vmax', 'vstar'].includes(t)).slice(0, 1))
}

// Las cartas que anclan el arquetipo: las de sus iconos que llevan casi todas
// sus listas; sin ninguna, la más llevada.
export function anclaDe(iconos, propias, cands = candidatas(propias)) {
  const deUna = new Set(cands.filter((c) => c.m === 1).map((c) => c.k))
  const ancla = [...new Set((iconos || []).map((s) => cartaDeIcono(s, propias)).filter(Boolean))].filter((k) => deUna.has(k))
  if (ancla.length) return ancla
  const primera = cands.find((c) => c.m === 1)
  return primera ? [primera.k] : []
}

// La regla de un arquetipo nuevo. `propias`: sus listas; `ajenas`: las de los
// demás que llevan su ancla (las únicas a las que puede cambiarles el
// arquetipo). Se cuenta lo que la web acierta en todas, con él y sin él:
//   · una suya acierta si sale él;
//   · una de un arquetipo del catálogo, si sale el suyo;
//   · una de uno que no está en el catálogo, si no se la come él.
export function reglaDeArquetipo({ id, iconos = [], propias, ajenas = [], catalogo = [] }) {
  if (propias.length < MIN_LISTAS) return { motivo: `solo ${propias.length} listas` }
  const reglas = prepararCatalogo(catalogo)
  const enCatalogo = new Set(reglas.map((a) => a.id))
  const todas = [...propias, ...ajenas]
  for (const x of todas) x.antes = ganadorDelCatalogo(x, reglas)
  const cands = candidatas(propias)
  const ancla = anclaDe(iconos, propias, cands)
  if (!ancla.length) return { motivo: 'ninguna carta en el 85 % de sus listas' }

  const cumple = (x, regla) => regla.every((r) => (x.copias.get(r.k) || 0) >= r.m)
  const gana = (x, regla) => {
    const b = x.antes
    if (!cumple(x, regla)) return b?.id ?? null
    if (!b || regla.length > b.n || (regla.length === b.n && String(id).localeCompare(String(b.id)) < 0)) return id
    return b.id
  }
  const acierta = (x, w) => (x.a === id ? w === id : enCatalogo.has(x.a) ? w === x.a : w !== id)
  const puntos = (regla) => todas.reduce((s, x) => s + (acierta(x, gana(x, regla)) ? 1 : 0), 0)
  const antes = todas.reduce((s, x) => s + (acierta(x, x.antes?.id ?? null) ? 1 : 0), 0)

  let regla = ancla.map((k) => ({ k, m: 1 }))
  let actual = puntos(regla)
  // De una en una, la que más suba lo acertado.
  for (let vuelta = 0; vuelta < 8; vuelta++) {
    let mejor = null
    for (const c of cands) {
      if (regla.some((r) => r.k === c.k && r.m >= c.m)) continue
      const nueva = [...regla.filter((r) => r.k !== c.k), { k: c.k, m: c.m }]
      if (nueva.length > MAX_REQUISITOS) continue
      const p = puntos(nueva)
      if (p > actual && (!mejor || p > mejor.p)) mejor = { p, nueva }
    }
    if (!mejor) break
    regla = mejor.nueva
    actual = mejor.p
  }
  // Si sus listas se las sigue llevando uno con más requisitos, una carta más
  // no basta: le hacen falta las que le falten de una vez.
  for (let vuelta = 0; vuelta < 3; vuelta++) {
    const contra = new Map()
    for (const x of propias) {
      const w = gana(x, regla)
      if (w && w !== id) contra.set(w, (contra.get(w) || 0) + 1)
    }
    const b = [...contra].sort((p, q) => q[1] - p[1])[0]?.[0]
    if (!b) break
    const nB = reglas.find((a) => a.id === b)?.n || 0
    const falta = nB - regla.length + (String(id).localeCompare(String(b)) < 0 ? 0 : 1)
    if (falta <= 0 || regla.length + falta > MAX_REQUISITOS + 2) break
    const extra = cands
      .filter((c) => c.m === 1 && !regla.some((r) => r.k === c.k))
      .sort((p, q) => Number(q.pokemon) - Number(p.pokemon))
      .slice(0, falta)
    if (extra.length < falta) break
    const nueva = [...regla, ...extra.map((c) => ({ k: c.k, m: 1 }))]
    const p = puntos(nueva)
    if (p <= actual) break
    regla = nueva
    actual = p
  }

  const suyas = propias.filter((x) => gana(x, regla) === id).length
  const robadas = ajenas.filter((x) => acierta(x, x.antes?.id ?? null) && !acierta(x, gana(x, regla))).length
  const cuentas = { listas: propias.length, suyas, robadas, antes, despues: actual }
  if (actual <= antes) return { motivo: 'no mejora lo que la web acierta', ...cuentas }
  if (suyas / propias.length < 0.5) return { motivo: `solo reconoce ${suyas} de sus ${propias.length} listas`, ...cuentas }
  // Limitless renombra: un id nuevo con la MISMA regla que uno que ya está es
  // ese mismo mazo. Se espera a que el viejo se retire.
  const firma = (rs) => rs.map((r) => `${r.k}*${r.m}`).sort().join('~')
  const suya = firma(regla)
  const gemelo = reglas.find((a) => firma(a.reqs.map((q) => ({ k: q.claves[0], m: q.minimo }))) === suya)
  if (gemelo) return { motivo: `la misma regla que «${gemelo.id}»`, ...cuentas }

  // El nombre de cada carta tal como sale en las listas.
  const crudo = (k) => {
    for (const x of propias) if (x.crudos.has(k)) return x.crudos.get(k).nombre
    return k
  }
  // Los iconos, con la impresión más jugada de su carta.
  const impresion = (k) => {
    const n = new Map()
    for (const x of propias) {
      for (const c of x.lista?.pokemon || []) {
        if (claveReq(c?.name) !== k || !c.set || !c.number) continue
        const s = `${String(c.set).toUpperCase()}|${c.number}`
        n.set(s, (n.get(s) || 0) + 1)
      }
    }
    const [mejor] = [...n].sort((p, q) => q[1] - p[1] || p[0].localeCompare(q[0]))[0] || []
    return mejor ? mejor.split('|') : null
  }
  const deIconos = [...new Set((iconos || []).map((s) => cartaDeIcono(s, propias)).filter(Boolean))].slice(0, 2).map((k) => {
    const p = impresion(k)
    return p ? { set: p[0], numero: p[1], nombre: crudo(k) } : { nombre: crudo(k) }
  })
  return { regla: regla.map((r) => ({ nombre: crudo(r.k), minimo: r.m })), iconos: deIconos, ...cuentas }
}

// Los nombres en español de unas cartas, de las filas del catálogo (como la
// 1460: `name_es`, o `name` si es otro nombre, nunca de menos de 3 letras).
export function nombresEnEspanol(ingleses, filas) {
  const es = new Map()
  for (const c of filas || []) {
    const en = ingleses.find((n) => n === c.name_en) || ingleses.find((n) => n === c.name)
    if (!en) continue
    const s = es.get(en) || new Set()
    for (const o of [c.name_es, c.name]) {
      const limpio = String(o || '').trim().replace(/\.+$/, '')
      if (limpio.length >= 3 && claveReq(limpio) !== claveReq(en)) s.add(limpio)
    }
    es.set(en, s)
  }
  return es
}

// La fila de `tcg_archetypes` para un arquetipo nuevo.
export function filaNueva({ id, nombre, derivado, es = new Map(), ahora }) {
  return {
    id,
    nombre,
    iconos: derivado.iconos,
    requiere: derivado.regla.map((r) => ({ nombres: [r.nombre, ...(es.get(r.nombre) || [])], ...(r.minimo > 1 ? { minimo: r.minimo } : {}) })),
    activo: true,
    updated_at: ahora.toISOString(),
  }
}

// Qué toca hoy, sin pedir nada: lo que se renombra, se retira, se enciende y
// qué nuevos se miran. `vivos`: Map(id → { nombre, mazos, listas }) de los
// arquetipos de Limitless con algún mazo en 60 días.
export function planDelDia({ catalogo, vivos, propios = {}, conocidos = new Set(), retirados = {}, pendientes = {}, datosFrescos, ahora = new Date() }) {
  const intacta = (f) => mismaHora(f.updated_at, propios[f.id])
  const nuestras = (catalogo || []).filter(intacta)
  const renombrar = nuestras.filter((f) => vivos.get(f.id)?.nombre && vivos.get(f.id).nombre !== f.nombre).map((f) => ({ id: f.id, nombre: vivos.get(f.id).nombre }))
  const puedeRetirar = datosFrescos && vivos.size >= MIN_ARQUETIPOS_VIVOS
  const retirar = puedeRetirar ? nuestras.filter((f) => f.activo !== false && !vivos.has(f.id)).map((f) => f.id).slice(0, RETIROS_POR_PASADA) : []
  const encender = nuestras.filter((f) => f.activo === false && retirados[f.id] && vivos.has(f.id)).map((f) => f.id)
  const nuevos = [...vivos]
    .filter(([id, v]) => !esDeFuera(id) && !conocidos.has(id) && (v.listas || 0) >= MIN_LISTAS)
    .filter(([id]) => !pendientes[id] || ahora - new Date(pendientes[id].fecha) >= DIAS_PARA_REINTENTAR * DIA)
    .sort((p, q) => (q[1].mazos || 0) - (p[1].mazos || 0) || p[0].localeCompare(q[0]))
    .map(([id]) => id)
  return { renombrar, retirar, encender, nuevos, puedeRetirar }
}

async function restReal(ruta, clave, opciones = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...opciones,
    headers: {
      apikey: clave,
      authorization: `Bearer ${clave}`,
      'content-type': 'application/json',
      prefer: opciones.method === 'POST' ? 'resolution=merge-duplicates,return=minimal' : 'return=minimal',
      ...(opciones.headers || {}),
    },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const texto = await res.text()
  return texto ? JSON.parse(texto) : null
}

const enLista = (valores) => `(${valores.map((v) => `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',')})`
const id_ = (id) => encodeURIComponent(id)

export async function procesar({ env = process.env, rest = restReal, ahora = new Date(), reloj = () => Date.now() } = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }
  const inicio = reloj()
  const queda = () => reloj() - inicio < MS_DE_TRABAJO
  const hoy = diaDe(ahora)
  let estado
  try {
    estado = (await rest(`scrydex_estado?select=valor&clave=eq.${CLAVE_ESTADO}&limit=1`, clave))?.[0]?.valor || {}
  } catch (e) {
    return { ok: false, error: String(e?.message || e).slice(0, 200) }
  }
  const guardar = () => rest('scrydex_estado', clave, { method: 'POST', body: JSON.stringify([{ clave: CLAVE_ESTADO, valor: estado, updated_at: ahora.toISOString() }]) })
  // La segunda pasada del día solo dice que ha mirado (y el semáforo de
  // /admin sabe que sigue viva).
  if (estado.dia === hoy) {
    estado.ultimaMirada = ahora.toISOString()
    try { await guardar() } catch { /* se verá en la siguiente */ }
    return { ok: true, saltado: `hecha hoy (${hoy})` }
  }

  const hecho = { renombrados: [], retirados: [], encendidos: [], nuevos: [], descartados: [] }
  try {
    const [resumen, catalogo, metaIds, ultimo] = await Promise.all([
      rest('rpc/meta_resumen', clave, { method: 'POST', headers: { prefer: 'return=representation' }, body: JSON.stringify({ p_dias: DIAS, p_fuente: null }) }),
      rest('tcg_archetypes?select=id,nombre,iconos,requiere,activo,updated_at', clave, { headers: { prefer: 'return=representation' } }),
      rest('meta_arquetipos?select=id&limit=5000', clave, { headers: { prefer: 'return=representation' } }),
      rest('meta_torneos?select=fecha&fuente=eq.online&order=fecha.desc&limit=1', clave, { headers: { prefer: 'return=representation' } }),
    ])
    const vivos = new Map((resumen || []).filter((r) => !esDeFuera(r.arquetipo)).map((r) => [r.arquetipo, { nombre: r.nombre, iconos: r.iconos || [], mazos: r.mazos || 0, listas: r.listas || 0 }]))
    const deLimitless = new Set((metaIds || []).map((m) => m.id).filter((id) => !esDeFuera(id)))
    const datosFrescos = Boolean(ultimo?.[0]?.fecha) && ahora - new Date(ultimo[0].fecha) < DIAS_SIN_TORNEOS * DIA

    // La primera vez: son nuestras las filas que ya hay con id de Limitless
    // (las 148 de la 1460), tal como están.
    if (!estado.propios) {
      estado.propios = Object.fromEntries((catalogo || []).filter((f) => deLimitless.has(f.id)).map((f) => [f.id, f.updated_at]))
      estado.empezo = ahora.toISOString()
    }
    const conocidos = new Set([...(estado.conocidos || []), ...(catalogo || []).map((f) => f.id)])
    estado.retirados ||= {}
    estado.pendientes ||= {}
    const plan = planDelDia({ catalogo, vivos, propios: estado.propios, conocidos, retirados: estado.retirados, pendientes: estado.pendientes, datosFrescos, ahora })
    const sello = ahora.toISOString()
    const cambiar = async (id, cambio) => {
      await rest(`tcg_archetypes?id=eq.${id_(id)}`, clave, { method: 'PATCH', body: JSON.stringify({ ...cambio, updated_at: sello }) })
      estado.propios[id] = sello
    }
    for (const r of plan.renombrar) {
      await cambiar(r.id, { nombre: r.nombre })
      hecho.renombrados.push(r)
    }
    for (const id of plan.retirar) {
      await cambiar(id, { activo: false })
      estado.retirados[id] = hoy
      hecho.retirados.push(id)
    }
    for (const id of plan.encender) {
      await cambiar(id, { activo: true })
      delete estado.retirados[id]
      hecho.encendidos.push(id)
    }

    // Los nuevos, de uno en uno mientras quede reloj.
    for (const id of plan.nuevos.slice(0, NUEVOS_POR_PASADA)) {
      if (!queda()) break
      const v = vivos.get(id)
      const filas = (await rest(`meta_resultados?select=arquetipo,lista&arquetipo=eq.${id_(id)}&con_lista=eq.true&torneo_id=not.like.pokedoc-*&limit=400`, clave, { headers: { prefer: 'return=representation' } })) || []
      const propias = filas.filter((f) => f.lista).map((f) => prepararLista(id, f.lista))
      const ancla = anclaDe(v.iconos, propias)
      let ajenas = []
      if (ancla.length) {
        // Las listas de los DEMÁS que llevan su ancla: las únicas a las que
        // este arquetipo les puede cambiar el nombre.
        const contiene = {}
        for (const k of ancla) {
          const c = propias.find((x) => x.crudos.has(k))?.crudos.get(k)
          if (c) (contiene[c.seccion] ||= []).push({ name: c.nombre })
        }
        const otras = (await rest(`meta_resultados?select=arquetipo,lista&arquetipo=neq.${id_(id)}&con_lista=eq.true&torneo_id=not.like.pokedoc-*&lista=cs.${encodeURIComponent(JSON.stringify(contiene))}&limit=${MAX_AJENAS}`, clave, { headers: { prefer: 'return=representation' } })) || []
        ajenas = otras.filter((f) => f.lista).map((f) => prepararLista(f.arquetipo, f.lista))
      }
      const derivado = reglaDeArquetipo({ id, iconos: v.iconos, propias, ajenas, catalogo })
      if (!derivado.regla) {
        estado.pendientes[id] = { motivo: derivado.motivo, fecha: sello, listas: propias.length, ...(derivado.suyas != null ? { suyas: derivado.suyas, robadas: derivado.robadas } : {}) }
        hecho.descartados.push({ id, motivo: derivado.motivo })
        continue
      }
      const ingleses = [...new Set(derivado.regla.map((r) => r.nombre))]
      const [porEn, porNombre] = await Promise.all([
        rest(`tcg_cards?select=name,name_en,name_es&market=eq.WEST&name_en=in.${encodeURIComponent(enLista(ingleses))}&limit=1000`, clave, { headers: { prefer: 'return=representation' } }),
        rest(`tcg_cards?select=name,name_en,name_es&market=eq.WEST&name=in.${encodeURIComponent(enLista(ingleses))}&limit=1000`, clave, { headers: { prefer: 'return=representation' } }),
      ])
      const fila = filaNueva({ id, nombre: v.nombre || id, derivado, es: nombresEnEspanol(ingleses, [...(porEn || []), ...(porNombre || [])]), ahora })
      // Si alguien lo ha creado a mano mientras tanto, se queda el suyo.
      await rest('tcg_archetypes', clave, { method: 'POST', headers: { prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify([fila]) })
      estado.propios[id] = fila.updated_at
      delete estado.pendientes[id]
      conocidos.add(id)
      hecho.nuevos.push({ id, nombre: fila.nombre, suyas: derivado.suyas, listas: derivado.listas, robadas: derivado.robadas })
    }

    estado.conocidos = [...conocidos].sort()
    estado.anadidos = [...hecho.nuevos.map((n) => ({ ...n, dia: hoy })), ...(estado.anadidos || [])].slice(0, 50)
    estado.dia = plan.nuevos.length > NUEVOS_POR_PASADA || !queda() ? estado.dia : hoy
    estado.hecho = true
    estado.ultimaPasada = {
      cuando: sello,
      vivos: vivos.size,
      datosFrescos,
      retirarBloqueado: plan.puedeRetirar ? null : datosFrescos ? `solo ${vivos.size} arquetipos vivos` : 'el meta de Limitless no está al día',
      ...Object.fromEntries(Object.entries(hecho).map(([k, v]) => [k, v.length])),
      quedanNuevos: Math.max(0, plan.nuevos.length - hecho.nuevos.length - hecho.descartados.length),
    }
    estado.ultimoError = null
    await guardar()
    return { ok: true, ...hecho, datosFrescos }
  } catch (e) {
    const m = String(e?.message || e)
    estado.ultimoError = { fecha: ahora.toISOString(), motivo: m.slice(0, 300) }
    try { await guardar() } catch { /* el estado tampoco: ya se verá en la siguiente */ }
    return { ok: false, error: m.slice(0, 200), ...hecho }
  }
}

export default async () => {
  const r = await procesar()
  if (!r.ok) console.warn('arquetipos-limitless:', JSON.stringify(r).slice(0, 600))
  return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } })
}

// Dos veces al día (UTC): la primera hace el trabajo; la segunda solo mira.
export const config = { schedule: '23 5,17 * * *' }
