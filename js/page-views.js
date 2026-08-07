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

// Una misma página se puede alcanzar por varias URLs: "/" e "/index.html"
// son la misma, y también "/aprender" y "/aprender.html" (Netlify sirve
// las dos). Guardando `location.pathname` en crudo, las visitas de una
// misma página se repartían entre dos o tres filas distintas y el ranking
// mentía.
//
// Además, la parte interesante estaba en la query: "/categoria.html"
// juntaba TODAS las categorías en una sola fila, así que no se podía
// saber cuál se usa más — que es justo para lo que sirve esta tabla. Se
// mete el slug en la ruta normalizada.
const SLUG_MAX = 60

function limpiarSlug(valor) {
  // Cualquiera puede escribir lo que quiera en la query, y esto acaba en
  // una tabla y luego en una pantalla: se limita a lo que un slug puede
  // ser de verdad.
  return String(valor || '')
    .slice(0, SLUG_MAX)
    .replace(/[^a-zA-Z0-9_-]/g, '')
}

// Páginas cuya identidad real está en la query. El resto se quedan como
// están.
const POR_SLUG = { '/categoria': 'slug', '/guia': 'slug', '/curso': 'slug' }

export function normalizePath(pathname, search = '') {
  let ruta = String(pathname || '/').replace(/\/+$/, '') || '/'
  ruta = ruta.replace(/\.html$/i, '')
  ruta = ruta.replace(/\/index$/i, '') || '/'

  // Los perfiles se ven por /usuario/<nombre> y por /usuario.html?u=...
  // Se juntan todos en "/usuario" A PROPÓSITO: guardar a quién ha mirado
  // cada persona sería un registro de quién vigila a quién, y para saber
  // si la gente usa los perfiles basta con el total.
  if (ruta === '/usuario' || ruta.startsWith('/usuario/')) return '/usuario'

  // Los temas del foro se juntan todos en "/tema", y aquí la razón es
  // otra: la ruta es un uuid. Una tabla con cincuenta filas de
  // "/tema/8f3a1c…" no le dice nada a nadie, y para saber qué temas se
  // leen ya está el contador de visitas de cada tema.
  if (ruta === '/tema' || ruta.startsWith('/tema/')) return '/tema'

  const clave = POR_SLUG[ruta]
  if (clave) {
    const slug = limpiarSlug(new URLSearchParams(search || '').get(clave))
    if (slug) return `${ruta}/${slug}`
  }
  return ruta
}

const NOMBRES = {
  '/': 'Inicio',
  '/aprender': 'Aprender',
  '/foro': 'Foro · portada',
  '/tema': 'Foro · temas',
  '/usuarios': 'Comunidad',
  '/perfil': 'Mi perfil',
  '/usuario': 'Perfiles de usuario',
  '/buscar': 'Buscador',
  '/guardados': 'Guardados',
  '/mensajes': 'Mensajes',
  '/auth': 'Entrar y registro',
  '/onboarding': 'Bienvenida',
  '/reset-password': 'Recuperar contraseña',
  '/terminos': 'Términos de uso',
  '/privacidad': 'Privacidad',
  '/editor-guia': 'Editor de guías',
  '/admin': 'Panel de admin',
  '/admin/editor-guia': 'Panel · editor de guías',
  // Las visitas guardadas antes de meter el slug en la ruta no se pueden
  // repartir por categoría/guía a posteriori: el dato nunca se guardó.
  // Se dicen tal cual en vez de mezclarlas con las nuevas.
  '/categoria': 'Categoría · sin detalle (visitas antiguas)',
  '/guia': 'Guía · sin detalle (visitas antiguas)',
  '/curso': 'Curso · sin detalle (visitas antiguas)',
}

const PREFIJOS = [
  ['/categoria/', 'Categoría'],
  ['/guia/', 'Guía'],
  ['/curso/', 'Curso'],
  // /foro/<slug> sí se guarda entero: el slug se lee, a diferencia del
  // uuid de un tema, y saber qué foro se usa es justo lo interesante.
  ['/foro/', 'Foro'],
]

// Nombre legible para la tabla del panel. "/" no le dice nada a nadie.
export function pageLabel(ruta) {
  if (NOMBRES[ruta]) return NOMBRES[ruta]
  for (const [prefijo, titulo] of PREFIJOS) {
    if (ruta.startsWith(prefijo)) return `${titulo} · ${ruta.slice(prefijo.length)}`
  }
  return ruta
}

export async function logPageView(session) {
  try {
    await supabase.from('page_views').insert({
      path: normalizePath(window.location.pathname, window.location.search),
      user_id: session?.user?.id || null,
    })
  } catch {
    // Si falla el registro de la visita, no debe romper nada más de la
    // página — no hay nada más que hacer aquí.
  }
}
