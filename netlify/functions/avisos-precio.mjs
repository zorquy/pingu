// Los avisos de precio (tanda 665): «avísame si esta carta baja de 20 €».
//
// Cada hora lee los avisos activos (`user_price_alerts`), mira el precio
// guardado de cada carta en el idioma del aviso (`tcg_card_prices`, el
// mínimo de Cardmarket que escribe `tcggo-precios` cada diez minutos) y,
// si se cumple, APAGA el aviso —uno se dispara una vez— y le deja a la
// persona una notificación (la campanita; `enviar-push` la empuja al
// móvil en su siguiente pasada) y un correo en la cola (`email_outbox`,
// salvo que tenga los de precio apagados). Cero peticiones a TCGGO: todo
// sale de nuestra base.
//
// Sin la tabla (falta la migración), no hace nada y lo dice.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY.
import { rutaDeCarta } from '../../js/carta-ruta.js'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
const TOPE_AVISOS = 2000
export const TIPO_NOTIFICACION = 'aviso_precio'

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

const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })
const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : typeof v === 'string' && Number(v) > 0 ? Number(v) : null)
const lista = (ids) => ids.map((s) => `"${encodeURIComponent(s)}"`).join(',')

// El precio que mira un aviso: el mínimo en SU idioma, y si ese idioma no
// tiene cifra, el general. Puro, para probarlo.
export function precioDeAviso(fila, idioma) {
  if (!fila) return null
  return num(fila[`cm_low_${idioma}`]) ?? num(fila.cm_low) ?? null
}

// ¿Se cumple? «baja» en o por debajo; «sube» en o por encima.
export function seCumple(aviso, valor) {
  if (valor === null || !Number.isFinite(Number(aviso?.umbral))) return false
  const umbral = Number(aviso.umbral)
  return aviso.tipo === 'baja' ? valor <= umbral : aviso.tipo === 'sube' ? valor >= umbral : false
}

export function textosDelAviso(aviso, carta, valor) {
  const nombre = (typeof carta?.name_es === 'string' && carta.name_es.trim()) || carta?.name || aviso.card_id
  const verbo = aviso.tipo === 'baja' ? 'ha bajado a' : 'ha subido a'
  const pediste = aviso.tipo === 'baja' ? 'bajara de' : 'subiera de'
  return {
    title: `${nombre} ${verbo} ${euros.format(valor)}`,
    body: `Pediste aviso si ${pediste} ${euros.format(Number(aviso.umbral))}. Mínimo en Cardmarket ahora: ${euros.format(valor)}.`,
    link: rutaDeCarta({ id: aviso.card_id, name: carta?.name, name_es: carta?.name_es }),
  }
}

export async function procesar({ env = process.env, rest = restReal, ahora = new Date() } = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }
  let avisos
  try {
    avisos = (await rest(`user_price_alerts?select=id,user_id,card_id,market,idioma,tipo,umbral&activo=is.true&order=created_at&limit=${TOPE_AVISOS}`, clave)) || []
  } catch (e) {
    const m = String(e?.message || e)
    if (/42P01|user_price_alerts/.test(m)) return { ok: true, saltado: 'falta ejecutar supabase-migration-avisos-precio.sql (user_price_alerts)' }
    return { ok: false, error: m.slice(0, 200) }
  }
  if (!avisos.length) return { ok: true, activos: 0, disparados: 0 }
  const ids = [...new Set(avisos.map((a) => a.card_id))]
  const precios = new Map()
  const cartas = new Map()
  for (let i = 0; i < ids.length; i += 150) {
    const tramo = ids.slice(i, i + 150)
    for (const f of (await rest(`tcg_card_prices?select=card_id,cm_low,cm_low_es,cm_low_en,cm_low_de,cm_low_fr,cm_low_it,cm_low_ja&card_id=in.(${lista(tramo)})`, clave)) || []) precios.set(f.card_id, f)
    for (const c of (await rest(`tcg_cards?select=id,market,name,name_es&id=in.(${lista(tramo)})`, clave)) || []) cartas.set(`${c.id}|${c.market}`, c)
  }
  // Quién tiene los correos de precio apagados.
  const usuarios = [...new Set(avisos.map((a) => a.user_id))]
  const sinCorreo = new Set()
  for (let i = 0; i < usuarios.length; i += 150) {
    for (const p of (await rest(`user_profiles?select=id,notification_email_disabled&id=in.(${lista(usuarios.slice(i, i + 150))})`, clave)) || []) {
      if ((p.notification_email_disabled || []).includes(TIPO_NOTIFICACION)) sinCorreo.add(p.id)
    }
  }
  const disparados = []
  for (const a of avisos) {
    const valor = precioDeAviso(precios.get(a.card_id), a.idioma)
    if (!seCumple(a, valor)) continue
    const carta = cartas.get(`${a.card_id}|${a.market || 'WEST'}`) || null
    const t = textosDelAviso(a, carta, valor)
    // Primero se apaga: si lo de después falla, no se repite el aviso en
    // la próxima hora. Mejor un aviso que no llegó que diez iguales.
    await rest(`user_price_alerts?id=eq.${encodeURIComponent(a.id)}`, clave, { method: 'PATCH', body: JSON.stringify({ activo: false, disparado_at: ahora.toISOString(), precio_disparo: valor }) })
    await rest('user_notifications', clave, { method: 'POST', body: JSON.stringify([{ recipient_id: a.user_id, type: TIPO_NOTIFICACION, title: t.title, body: t.body, link: t.link }]) })
    if (!sinCorreo.has(a.user_id)) {
      await rest('email_outbox', clave, { method: 'POST', body: JSON.stringify([{ recipient_id: a.user_id, type: TIPO_NOTIFICACION, subject: t.title, preview: t.body, link: t.link, thread_key: `aviso-${a.id}` }]) })
    }
    disparados.push({ id: a.id, card_id: a.card_id, valor, umbral: Number(a.umbral), tipo: a.tipo })
  }
  return { ok: true, activos: avisos.length, disparados: disparados.length, detalle: disparados.slice(0, 50) }
}

export default async () => {
  const r = await procesar()
  if (!r.ok) console.warn('avisos-precio:', JSON.stringify(r).slice(0, 600))
  return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } })
}

// Cada hora, a y 23: los precios cambian cada diez minutos, y un aviso
// de precio no necesita más que la hora.
export const config = { schedule: '23 * * * *' }
