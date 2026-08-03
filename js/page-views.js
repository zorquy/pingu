import { supabase } from './supabase.js'

// Este fichero se llamaba analytics.js. Se renombró porque los
// bloqueadores de anuncios y de rastreo (uBlock, los escudos de Brave,
// los bloqueadores de contenido de Safari) bloquean por norma cualquier
// URL cuya ruta contenga "analytics". Con el nombre viejo, el import
// dinámico fallaba con "Failed to fetch" en el navegador de cualquiera
// que use uno — que son muchos — y eso llenaba el registro de errores.
//
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
