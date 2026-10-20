// Vaciar una parte de la caché de la CDN por su etiqueta (tanda 908).
//
// PINGU: «en colecciones ordeno las eras, meto las expansiones o cambio
// cosas y luego en la web no se ha cambiado». La estantería sale de
// /.netlify/functions/sets (813), que la CDN guarda diez minutos y luego
// sigue sirviendo la vieja mientras pide la nueva. Así que un cambio desde
// /admin tardaba de diez minutos a lo que tardara alguien en abrirla dos
// veces. Esa respuesta lleva la etiqueta `sets`, y esto la tira.
//
// Es lo que hace `purgeCache` de @netlify/functions, sin meter la
// dependencia: Netlify pone en el entorno de cada función un token que solo
// sirve para vaciar la caché de su sitio (NETLIFY_PURGE_API_TOKEN) y el
// SITE_ID.
export async function purgarEtiquetas(etiquetas, { env = process.env, fetchImpl = fetch } = {}) {
  const token = env.NETLIFY_PURGE_API_TOKEN
  const sitio = env.SITE_ID
  if (!token || !sitio) return { ok: false, error: 'Esta función no tiene el permiso de Netlify para vaciar la caché (falta NETLIFY_PURGE_API_TOKEN o SITE_ID).' }
  try {
    const res = await fetchImpl('https://api.netlify.com/api/v1/purge', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ site_id: sitio, cache_tags: etiquetas }),
    })
    if (!res.ok) return { ok: false, estado: res.status, error: `Netlify contestó ${res.status}: ${(await res.text().catch(() => '')).slice(0, 160)}` }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e?.message || e) }
  }
}
