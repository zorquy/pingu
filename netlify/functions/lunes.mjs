// El lunes de PokeDoc (tanda 794, NU7): UN aviso por persona el lunes por
// la mañana en vez de muchos sueltos. «Tu colección: +42 € esta semana. 3
// cartas de tu lista han bajado. 2 personas dan algo que buscas. Esta
// semana sale Mega Evolución.» Lo deja en la campanita (`user_notifications`,
// que `enviar-push` empuja sola) y solo si hay algo que contar.
//
// Cuesta poco: todo sale de nuestra base (la foto diaria del valor, los
// precios que ya escribe tcggo-precios, lo que la gente da y busca y el
// calendario). Cero peticiones a APIs de pago. Se apaga en Ajustes
// (`notification_prefs_disabled` con 'resumen_lunes'), y no se repite: si
// la función corre dos veces el mismo lunes, la segunda ve la primera.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY.

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
export const TIPO_NOTIFICACION = 'resumen_lunes'
const TOPE = 20000
const TROZO = 150

function servicio(clave) {
  return { apikey: clave, authorization: `Bearer ${clave}`, 'content-type': 'application/json' }
}
async function restReal(ruta, clave, opciones = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...opciones,
    headers: { ...servicio(clave), prefer: 'return=minimal', ...(opciones.headers || {}) },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const texto = await res.text()
  return texto ? JSON.parse(texto) : null
}

const lista = (ids) => ids.map((s) => `"${encodeURIComponent(s)}"`).join(',')
const dia = (d) => d.toISOString().slice(0, 10)
const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

async function enTrozos(ids, pedir) {
  const filas = []
  for (let i = 0; i < ids.length; i += TROZO) filas.push(...((await pedir(ids.slice(i, i + TROZO))) || []))
  return filas
}

// Cuánto ha cambiado el valor de cada colección en la semana: la última foto
// menos la más vieja de la ventana, solo si las separan al menos cinco días
// (con dos fotos seguidas no hay «semana» que contar, la 653). Pura.
export function cambiosDeValor(fotos) {
  const porUsuario = new Map()
  for (const f of fotos) {
    const l = porUsuario.get(f.user_id) || []
    l.push(f)
    porUsuario.set(f.user_id, l)
  }
  const fuera = new Map()
  for (const [u, l] of porUsuario) {
    l.sort((a, b) => String(a.dia).localeCompare(String(b.dia)))
    const primera = l[0], ultima = l.at(-1)
    if ((new Date(ultima.dia) - new Date(primera.dia)) / 86400e3 < 5) continue
    fuera.set(u, Math.round(Number(ultima.valor) - Number(primera.valor)))
  }
  return fuera
}

// Una carta «ha bajado» si su media de la semana está un 10 % o más por
// debajo de la del mes. Pura.
export function haBajado(p) {
  const a7 = Number(p?.cm_avg7), a30 = Number(p?.cm_avg30)
  return a7 > 0 && a30 > 0 && a7 <= a30 * 0.9
}

// El texto, con lo que haya y en el orden de la propuesta. null si no hay
// nada: un aviso vacío es la forma más rápida de que lo apaguen. Pura.
export function textoDelLunes({ valor = null, bajadas = 0, personas = 0, salen = [] }) {
  const trozos = []
  if (valor) trozos.push(`Tu colección: ${valor > 0 ? '+' : '−'}${euros.format(Math.abs(valor))} esta semana.`)
  if (bajadas) trozos.push(bajadas === 1 ? 'Una carta de tu lista ha bajado.' : `${bajadas} cartas de tu lista han bajado.`)
  if (personas) trozos.push(personas === 1 ? 'Una persona da algo que buscas.' : `${personas} personas dan algo que buscas.`)
  if (salen.length) trozos.push(`Esta semana sale ${salen.slice(0, 2).join(' y ')}.`)
  if (!trozos.length || (trozos.length === 1 && salen.length && !valor && !bajadas && !personas)) return null
  return { title: 'Tu semana en PokeDoc', body: trozos.join(' ') }
}

export async function procesar({ env = process.env, rest = restReal, ahora = new Date() } = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }
  const hace8 = dia(new Date(ahora - 8 * 86400e3))
  const hace6 = new Date(ahora - 6 * 86400e3).toISOString()
  const hoy = dia(ahora)
  const en7 = dia(new Date(+ahora + 7 * 86400e3))
  const leer = (ruta) => rest(ruta, clave).catch((e) => { if (/42P01|42703|PGRST20/.test(String(e?.message))) return []; throw e })

  const [fotos, deseos, sets, yaAvisados] = await Promise.all([
    leer(`user_collection_value?select=user_id,dia,valor&dia=gte.${hace8}&order=dia&limit=${TOPE}`),
    leer(`user_wants?select=user_id,card_id&limit=${TOPE}`),
    leer(`tcg_sets?select=name,release_date&market=eq.WEST&release_date=gte.${hoy}&release_date=lte.${en7}&order=release_date&limit=5`),
    leer(`user_notifications?select=recipient_id&type=eq.${TIPO_NOTIFICACION}&created_at=gte.${encodeURIComponent(hace6)}&limit=${TOPE}`),
  ])
  const valor = cambiosDeValor(fotos || [])
  const deseados = [...new Set((deseos || []).map((d) => d.card_id))]
  const [precios, dan] = await Promise.all([
    enTrozos(deseados, (t) => leer(`tcg_card_prices?select=card_id,cm_avg7,cm_avg30&card_id=in.(${lista(t)})`)),
    enTrozos(deseados, (t) => leer(`user_collection?select=user_id,card_id&cambio=gt.0&card_id=in.(${lista(t)})`)),
  ])
  const bajo = new Set(precios.filter(haBajado).map((p) => p.card_id))
  const quienDa = new Map()
  for (const f of dan) quienDa.set(f.card_id, [...(quienDa.get(f.card_id) || []), f.user_id])
  const porUsuario = new Map()
  for (const d of deseos || []) {
    const u = porUsuario.get(d.user_id) || { bajadas: new Set(), personas: new Set() }
    if (bajo.has(d.card_id)) u.bajadas.add(d.card_id)
    for (const otro of quienDa.get(d.card_id) || []) if (otro !== d.user_id) u.personas.add(otro)
    porUsuario.set(d.user_id, u)
  }
  const salen = (sets || []).map((s) => s.name)
  const avisados = new Set((yaAvisados || []).map((n) => n.recipient_id))
  const usuarios = [...new Set([...valor.keys(), ...porUsuario.keys()])].filter((u) => !avisados.has(u))
  const apagado = new Set()
  for (const p of await enTrozos(usuarios, (t) => leer(`user_profiles?select=id,notification_prefs_disabled&id=in.(${lista(t)})`))) {
    if ((p.notification_prefs_disabled || []).includes(TIPO_NOTIFICACION)) apagado.add(p.id)
  }
  const filas = []
  for (const u of usuarios) {
    if (apagado.has(u)) continue
    const d = porUsuario.get(u)
    const t = textoDelLunes({ valor: valor.get(u) || null, bajadas: d?.bajadas.size || 0, personas: d?.personas.size || 0, salen })
    if (t) filas.push({ recipient_id: u, type: TIPO_NOTIFICACION, title: t.title, body: t.body, link: '/mi-coleccion' })
  }
  for (let i = 0; i < filas.length; i += 500) await rest('user_notifications', clave, { method: 'POST', body: JSON.stringify(filas.slice(i, i + 500)) })
  return { ok: true, candidatos: usuarios.length, avisos: filas.length, apagados: apagado.size, salen }
}

export default async () => {
  const r = await procesar()
  if (!r.ok) console.warn('lunes:', JSON.stringify(r).slice(0, 600))
  return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } })
}

// Los lunes a las 06:47 UTC (las 8:47 en la península en verano): una vez a
// la semana. Coste: unas pocas consultas a nuestra base, ninguna de pago.
export const config = { schedule: '47 6 * * 1' }
