import { supabase } from './supabase.js'

// Analítica mínima y propia, sin cookies ni servicio externo: solo
// registra qué ruta se ha cargado (y el usuario, si hay sesión). No hay
// identificador de visitante ni nada persistido en el navegador — cada
// carga de página es una fila suelta, pensada solo para ver qué páginas
// se usan más, no para perfilar a nadie.
export async function logPageView(session) {
  try {
    await supabase.from('page_views').insert({
      path: window.location.pathname,
      user_id: session?.user?.id || null,
    })
  } catch {
    // Si falla el registro de la visita, no debe romper nada más de la
    // página — no hay nada más que hacer aquí.
  }
}
