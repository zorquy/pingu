// El timbre (tanda 1310, C2 del plan): la base mira cada minuto, gratis, si
// hay trabajo de torneos, correos o avisos push, y solo entonces llama aquí
// (`timbre_tocar`, migración 1310, por `pg_net`). Esta función comprueba la
// clave y ejecuta la que toca: la misma función de siempre, sin cambiarla.
//
// Va aparte porque una función con `schedule` no admite llamadas por HTTP
// (Netlify da 403). Importar las otras aquí no las programa: Netlify solo mira
// el `config` del fichero de entrada.
//
// La clave es TIMBRE_SECRETO en Netlify y `timbre_secreto` en el Vault de
// Supabase: la misma en los dos. Sin ella, nadie puede despertar nada.
import barredor from './torneos-barredor.mjs'
import correos from './send-emails.mjs'
import push from './enviar-push.mjs'

export const TRABAJOS = { torneos: barredor, correos, push }

// Comparar sin dar pistas por el tiempo que tarda (la clave se compara entera).
export function claveBuena(dada, buena) {
  if (typeof dada !== 'string' || typeof buena !== 'string' || !buena) return false
  if (dada.length !== buena.length) return false
  let d = 0
  for (let i = 0; i < buena.length; i++) d |= dada.charCodeAt(i) ^ buena.charCodeAt(i)
  return d === 0
}

export default async function timbre(req) {
  if (req.method !== 'POST') return new Response('Solo POST', { status: 405 })
  if (!claveBuena(req.headers.get('x-timbre'), process.env.TIMBRE_SECRETO)) return new Response('No', { status: 401 })
  const que = new URL(req.url).searchParams.get('que')
  const trabajo = TRABAJOS[que]
  if (!trabajo) return new Response('¿Qué?', { status: 404 })
  return trabajo(req)
}
