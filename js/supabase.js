import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Sustituye por las credenciales de tu proyecto Supabase (las mismas que
// EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY del proyecto anterior).
export const supabase = createClient('TU_URL', 'TU_KEY')
