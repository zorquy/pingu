import { createClient } from './vendor/supabase-js.js'
import { fetchQueEspera } from './espera-prerender.js'

export const supabase = createClient(
  'https://zqamujmfavwrsqlgbead.supabase.co',
  'sb_publishable_ohfCPNNVCoqcVBainTbDlg_04mJliQZ',
  // Lo que escribe espera a que la página se abra de verdad (985).
  { global: { fetch: fetchQueEspera() } }
)
