import { nivelDeXp, rangoDeColaborador } from '../../js/niveles.js'

// La insignia para firmas de otros foros: /insignia/<usuario> devuelve
// un SVG con el nombre, el nivel y el rango de esa persona, listo para
// pegar como imagen en una firma de otro foro o un Discord — cada firma
// ajena es un anuncio permanente de PokeDoc con enlace.
//
// Lee el perfil con la clave ANÓNIMA (la misma pública que usa la web:
// los perfiles ya son legibles para cualquiera por RLS), así que esta
// función no necesita ningún secreto.

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
// La misma clave PÚBLICA que usa la web en js/supabase.js.
const CLAVE_ANONIMA = 'sb_publishable_ohfCPNNVCoqcVBainTbDlg_04mJliQZ'

// Los niveles y los rangos, de js/niveles.js (1124): el mismo fichero que
// usa la web, sin dependencias, así que ya no hay copia que se quede vieja.
function nivelDe(xp) {
  const n = nivelDeXp(xp)
  return { min: n.min, nombre: n.level, color: n.color }
}

function rangoDe(aprobadas) {
  const r = rangoDeColaborador(aprobadas)
  return r.min > 0 ? r.title : null
}

// En un atributo o texto de XML no puede entrar nada sin escapar: el
// nombre lo escribe el usuario.
function xml(s) {
  return String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[c])
}

async function restReal(ruta) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    headers: { apikey: CLAVE_ANONIMA, authorization: `Bearer ${CLAVE_ANONIMA}` },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}`)
  return res.json()
}

export function dibujar({ nombre, xp, aprobadas }) {
  const nivel = nivelDe(xp || 0)
  const rango = rangoDe(aprobadas || 0)
  const inicial = (nombre || '?').trim().charAt(0).toUpperCase() || '?'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="340" height="84" viewBox="0 0 340 84" role="img" aria-label="${xml(nombre)} en PokeDoc">
  <rect width="340" height="84" rx="12" fill="#0d1b2a"/>
  <rect x="0.5" y="0.5" width="339" height="83" rx="11.5" fill="none" stroke="${nivel.color}" stroke-opacity="0.55"/>
  <circle cx="42" cy="42" r="22" fill="${nivel.color}" fill-opacity="0.2"/>
  <text x="42" y="49" text-anchor="middle" font-family="Verdana, sans-serif" font-size="20" font-weight="bold" fill="${nivel.color}">${xml(inicial)}</text>
  <text x="78" y="32" font-family="Verdana, sans-serif" font-size="15" font-weight="bold" fill="#f2f5f9">${xml(nombre)}</text>
  <text x="78" y="52" font-family="Verdana, sans-serif" font-size="12" font-weight="bold" fill="${nivel.color}">${xml(nivel.nombre)} · ${xp || 0} XP</text>
  ${rango ? `<text x="78" y="69" font-family="Verdana, sans-serif" font-size="11" fill="#9fb3c8">${xml(rango)}</text>` : ''}
  <text x="332" y="74" text-anchor="end" font-family="Verdana, sans-serif" font-size="10" font-weight="bold" fill="#7fc4ec">pokedoc.es</text>
</svg>`
}

// El trabajo, con la base inyectable para probarlo sin red.
export async function procesar(username, { rest = restReal } = {}) {
  const limpio = String(username || '').trim().toLowerCase()
  if (!/^[a-z0-9_-]{1,40}$/.test(limpio)) return null

  const perfiles = await rest(
    `user_profiles?username=ilike.${encodeURIComponent(limpio)}&select=id,username,display_name,total_xp&limit=1`
  )
  const perfil = perfiles?.[0]
  if (!perfil) return null

  const guias = await rest(
    `guides?author_id=eq.${perfil.id}&review_status=eq.approved&select=id&limit=100`
  )

  return dibujar({
    nombre: perfil.display_name || perfil.username,
    xp: perfil.total_xp || 0,
    aprobadas: (guias || []).length,
  })
}

export default async function handler(req) {
  const u = new URL(req.url).searchParams.get('u') || ''
  let svg = null
  try {
    svg = await procesar(u)
  } catch {
    svg = null
  }
  if (!svg) return new Response('No hay nadie con ese nombre en PokeDoc.', { status: 404 })
  return new Response(svg, {
    status: 200,
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      // Una hora de caché compartida: la insignia se pinta en firmas de
      // otros foros, que la piden mucho y no necesitan el XP al minuto.
      'cache-control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
