// LO QUE NO EXISTE, CON SALIDA (1149, C2 de «Cuatro pantallas más»). Una
// guía, una noticia, un tema o una persona que no existen eran una frase
// sobre negro («Guía no encontrada.»): quien llega de un enlace viejo se
// quedaba sin camino. Ahora llevan el molde de la página de error (la
// mascota, qué ha pasado y un buscador), con el buscador YA relleno con las
// palabras de la dirección y hasta tres cosas parecidas de esa sección.
// Entra por `import()`: solo lo baja quien se topa con algo que no existe.
import { escapeHtml } from './html.js'
import { hojaInyectada } from './hoja.js'

const TIPOS = {
  guia: { titulo: 'Esta guía ya no está', frase: 'Puede que la hayan retirado o que el enlace esté mal copiado.', grupo: 'guias', todo: ['/aprender.html', 'Ver todas las guías'] },
  noticia: { titulo: 'Esta noticia ya no está', frase: 'Puede que la hayan retirado o que el enlace esté mal copiado.', grupo: 'noticias', todo: ['/noticias', 'Ver todas las noticias'] },
  tema: { titulo: 'Este tema ya no está', frase: 'Puede que lo hayan retirado o que el enlace esté mal copiado.', grupo: 'temas', todo: ['/foro.html', 'Ir al foro'] },
  usuario: { titulo: 'No encontramos a esa persona', frase: 'Puede que haya cambiado de nombre o que el enlace esté mal copiado.', grupo: 'gente', todo: ['/usuarios.html', 'Ver la gente'] },
}

// Las palabras de una dirección: «mazo-charizard-ex» → «mazo charizard ex».
// Un id (un uuid, un número) no dice nada: entonces no se rellena.
export function palabrasDeDireccion(trozo) {
  let t = ''
  try { t = decodeURIComponent(String(trozo || '')) } catch { t = String(trozo || '') }
  t = t.replace(/\.html$/i, '').replace(/[-_+.]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!/[a-záéíóúñü]{3,}/i.test(t)) return ''
  if (/^[0-9a-f]{8} [0-9a-f]{4} /i.test(t)) return ''
  return t.slice(0, 60)
}

// Las búsquedas que se prueban, en orden: lo entero y luego hasta tres
// palabras con sentido, de la más larga a la más corta.
const SIN_SENTIDO = new Set(['guia', 'guias', 'noticia', 'noticias', 'tema', 'para', 'como', 'con', 'los', 'las', 'del', 'una', 'que', 'por'])
export function intentosDeBusqueda(q) {
  const palabras = [...new Set(String(q || '').toLowerCase().split(' '))]
    .filter((p) => p.length >= 4 && !SIN_SENTIDO.has(p.normalize('NFD').replace(/[\u0300-\u036f]/g, '')))
    .sort((a, b) => b.length - a.length)
    .slice(0, 3)
  return [...new Set([q, ...palabras])].filter(Boolean)
}

export async function pintarNoEncontrado(caja, { tipo, trozo = '' } = {}) {
  const c = TIPOS[tipo]
  if (!caja || !c) return
  await Promise.all([hojaInyectada('css/404.css'), hojaInyectada('css/buscador.css')])
  const q = palabrasDeDireccion(trozo)
  caja.innerHTML = `<div class="pagina-404 no-encontrado" data-no-encontrado="${tipo}">
    <img src="/assets/images/mascota.webp" class="mascota" alt="" width="523" height="791" loading="lazy" decoding="async" />
    <div>
      <h1>${escapeHtml(c.titulo)}</h1>
      <p class="subtext" id="noEncontradoFrase">${escapeHtml(c.frase)}</p>
      <form class="buscador-404" action="/buscar.html" method="get" role="search">
        <input type="search" enterkeyhint="search" name="q" value="${escapeHtml(q)}" placeholder="Buscar en PokeDoc…" aria-label="Buscar en PokeDoc" autocomplete="off" />
        <input type="hidden" name="en" value="${c.grupo}" />
        <button type="submit" class="btn-primary">Buscar</button>
      </form>
      <div class="no-encontrado-parecidas" id="noEncontradoParecidas" aria-live="polite"></div>
      <div class="hero-actions"><a href="${c.todo[0]}" class="btn-outline">${escapeHtml(c.todo[1])}</a><a href="/" class="btn-outline">Volver a la portada</a></div>
    </div>
  </div>`
  if (!q) return
  // Las parecidas, con el buscador de siempre; si falla o no hay, no sale nada.
  try {
    const [{ buscarTodo }, { destinoDe, interiorDe, engancharFotos }] = await Promise.all([import('./buscador.js'), import('./buscador-filas.js')])
    // Primero lo escrito entero y, si no da nada, palabra a palabra (las
    // largas antes): «guia charizard estandar» no casa con ningún título,
    // «charizard» sí.
    let filas = []
    for (const intento of intentosDeBusqueda(q)) {
      const r = await buscarTodo(intento, { limite: 3, grupos: [c.grupo] })
      filas = r?.[c.grupo]?.filas || []
      if (filas.length) break
    }
    const sitio = caja.querySelector('#noEncontradoParecidas')
    if (!filas.length || !sitio) return
    caja.querySelector('#noEncontradoFrase')?.insertAdjacentText('beforeend', ' A lo mejor es una de estas:')
    sitio.innerHTML = filas.map((f) => `<a class="bs-fila bs-${c.grupo}" href="${escapeHtml(destinoDe(c.grupo, f, q))}">${interiorDe(c.grupo, f)}</a>`).join('')
    engancharFotos(sitio)
    if (c.grupo === 'gente') import('./en-linea.js').then((m) => m.marcarEnLinea(sitio)).catch(() => {})
  } catch {}
}

// Cuando no es que no exista, sino que no se ha podido PREGUNTAR (la 510:
// son dos cosas): se dice y se ofrece reintentar.
export function pintarSinRespuesta(caja, que = 'esto') {
  if (!caja) return
  caja.innerHTML = `<div class="empty-state"><p>No hemos podido cargar ${escapeHtml(que)}. Puede ser la conexión.</p><button type="button" class="btn-primary" onclick="location.reload()">Reintentar</button></div>`
}
