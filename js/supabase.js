import { createClient } from './vendor/supabase-js.js'
import { fetchQueEspera } from './espera-prerender.js'

// «Ver como un desconocido» (1306): sin tu sesión, en memoria; la de verdad
// ni se lee ni se toca. Es lo que ve alguien sin cuenta, no una imitación.
export const comoDesconocido = typeof location !== 'undefined' && new URLSearchParams(location.search).get('como') === 'desconocido'

// Un registro o una entrada que falla vuelve con el motivo en la dirección
// (1360): se guarda antes de que el cliente la lea. Lo trata auth-vuelta.js.
export const vueltaConError = typeof location !== 'undefined' && /error_description=|error_code=|[#&?]error=/.test(location.hash + location.search) ? location.hash + location.search : ''

export const supabase = createClient(
  'https://zqamujmfavwrsqlgbead.supabase.co',
  'sb_publishable_ohfCPNNVCoqcVBainTbDlg_04mJliQZ',
  // Lo que escribe espera a que la página se abra de verdad (985).
  { global: { fetch: fetchQueEspera() }, ...(comoDesconocido ? { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } } : {}) }
)
if (comoDesconocido) import('./como-desconocido.js').catch(() => {})
