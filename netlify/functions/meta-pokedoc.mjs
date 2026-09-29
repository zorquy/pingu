// Los torneos de PokeDoc en /meta (tanda 366).
//
// Cada pasada busca los torneos TERMINADOS y públicos de Estándar que aún
// no estén en `meta_torneos`, calcula el resultado de cada jugador con
// sus mesas, encaja su mazo en el arquetipo de Limitless que le toca
// (netlify/lib/meta-pokedoc.mjs) y lo ingiere con `fuente: 'pokedoc'`.
//
// ── LA CLAVE PÚBLICA NO ES UN DESCUIDO ──
// Como en cartas-juego (tanda 325): las listas se leen con la clave
// PUBLICABLE, así que entra exactamente lo que la política de
// `tournament_decklists` deja ver a cualquiera. La de servicio solo se
// usa para escribir el resultado. Y los privados se filtran A MANO: su
// gracia es no anunciarse, y el meta es un escaparate.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY (obligatoria).
import { clasificacionDeTorneo } from '../lib/meta-pokedoc.mjs'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
const CLAVE_PUBLICA = 'sb_publishable_ohfCPNNVCoqcVBainTbDlg_04mJliQZ'
const POR_PASADA = 5
const DIAS_ATRAS = 365

export async function procesar({ env = process.env, fetchImpl = fetch, ahora = new Date() } = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }

  async function leer(ruta, conServicio = false) {
    const k = conServicio ? clave : CLAVE_PUBLICA
    const res = await fetchImpl(`${SUPABASE_URL}/rest/v1/${ruta}`, { headers: { apikey: k, authorization: `Bearer ${k}`, accept: 'application/json' } })
    const texto = await res.text()
    if (!res.ok) {
      const e = new Error(`Supabase ${res.status}: ${texto.slice(0, 200)}`)
      e.sinMigracion = /PGRST20[25]|column .* does not exist|Could not find/.test(texto)
      throw e
    }
    return texto ? JSON.parse(texto) : []
  }
  async function rpc(nombre, cuerpo) {
    const res = await fetchImpl(`${SUPABASE_URL}/rest/v1/rpc/${nombre}`, {
      method: 'POST',
      headers: { apikey: clave, authorization: `Bearer ${clave}`, 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    })
    const texto = await res.text()
    if (!res.ok) {
      const e = new Error(`Supabase ${res.status}: ${texto.slice(0, 200)}`)
      e.sinMigracion = /PGRST20[25]|Could not find/.test(texto)
      throw e
    }
    return texto ? JSON.parse(texto) : null
  }
  const lista = (ids) => ids.map((id) => `"${encodeURIComponent(id)}"`).join(',')

  try {
    const desde = new Date(ahora.getTime() - DIAS_ATRAS * 864e5).toISOString()
    const torneos = await leer(
      `tournaments?status=eq.finished&format=eq.standard&or=(is_private.is.null,is_private.is.false)` +
        `&start_at=gte.${encodeURIComponent(desde)}&select=id,slug,name,start_at&order=start_at.desc&limit=100`
    )
    if (!torneos.length) return { ok: true, leidos: 0, motivo: 'no hay torneos terminados' }
    const ya = new Set((await leer(`meta_torneos?select=id&id=in.(${lista(torneos.map((t) => `pokedoc-${t.id}`))})`, true)).map((f) => f.id))
    const pendientes = torneos.filter((t) => !ya.has(`pokedoc-${t.id}`)).slice(0, POR_PASADA)
    if (!pendientes.length) return { ok: true, leidos: 0 }

    // Los arquetipos de Limitless con cuántos mazos llevan en 60 días:
    // el más jugado gana los empates al encajar.
    const resumen = await rpc('meta_resumen', { p_dias: 60, p_fuente: null })
    const arquetipos = (resumen || [])
      .filter((a) => a.arquetipo !== 'other' && !String(a.arquetipo).startsWith('pokedoc-'))
      .map((a) => ({ id: a.arquetipo, nombre: a.nombre, iconos: a.iconos || [], mazos: a.mazos }))
    let catalogo = []
    try {
      catalogo = await leer('tcg_archetypes?select=id,nombre,iconos,requiere,activo')
    } catch {
      catalogo = []
    }

    const hechos = []
    for (const t of pendientes) {
      const listas = await leer(`tournament_decklists?tournament_id=eq.${t.id}&select=user_id,parsed_cards`)
      const rondas = await leer(`rounds?tournament_id=eq.${t.id}&select=id`)
      const mesas = rondas.length ? await leer(`tournament_matches?round_id=in.(${lista(rondas.map((r) => r.id))})&select=id,player_a_id,player_b_id,is_bye,status`) : []
      const res = mesas.length ? await leer(`match_results?match_id=in.(${lista(mesas.map((m) => m.id))})&select=match_id,result`) : []
      const ids = [...new Set(listas.map((l) => l.user_id))]
      const perfiles = ids.length ? await leer(`user_profiles?id=in.(${lista(ids)})&select=id,username,display_name`) : []
      const clasificacion = clasificacionDeTorneo({
        torneo: t,
        listas,
        mesas,
        resultadosPorMesa: new Map(res.map((r) => [r.match_id, r])),
        perfiles: new Map(perfiles.map((p) => [p.id, p])),
        arquetipos,
        catalogo,
      })
      const r = await rpc('meta_ingerir_torneo', {
        p_torneo: {
          id: `pokedoc-${t.id}`,
          name: t.name,
          date: t.start_at,
          players: clasificacion.length,
          fuente: 'pokedoc',
          tipo: 'PokeDoc',
          enlace: `/torneo?slug=${encodeURIComponent(t.slug)}`,
          // El export de TCG Live viene en el idioma de cada uno: sumar
          // sus cartas partiría la lista media en dos idiomas.
          contar_cartas: false,
        },
        p_clasificacion: clasificacion,
        p_top: 64,
      })
      hechos.push({ torneo: t.slug, jugadores: clasificacion.length, resultado: r })
    }
    return { ok: true, leidos: hechos.length, torneos: hechos }
  } catch (e) {
    if (e.sinMigracion) return { ok: false, saltado: 'falta ejecutar supabase-migration-meta-fuentes.sql', error: e.message }
    return { ok: false, error: String(e?.message || e) }
  }
}

export default async function handler() {
  const r = await procesar()
  if (!r.ok) console.warn('meta-pokedoc:', JSON.stringify(r).slice(0, 800))
  return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } })
}

// Cada hora: un torneo de PokeDoc termina como mucho unas pocas veces al
// día, y entrar en el meta una hora después es de sobra.
export const config = { schedule: '17 * * * *' }
