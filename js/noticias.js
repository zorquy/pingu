// La portada de noticias (tanda 269).
//
// Una noticia es un artículo de `guides` con `kind = 'news'`: mismo
// editor, misma página de lectura, mismo índice. Lo que cambia es cómo
// se listan — por fecha, no por categoría — y que aquí la portada manda.
//
// POR QUÉ AQUÍ LA IMAGEN VA GRANDE Y EN LAS GUÍAS NO. En las tarjetas de
// guía se probó la portada grande arriba y se descartó, y está escrito en
// components.css: «la mayoría de las guías no tienen portada, quedaba una
// rejilla a parches». En noticias eso se da la vuelta — la carta
// revelada, el logo del set, el sobre: TODAS llevan imagen, y la imagen
// es media noticia. Así que aquí sí.
import { supabase } from './supabase.js'
import { escapeHtml } from './app.js'
import { icons } from './icons.js'
import { faltaElTipo, rutaDeArticulo, cuandoFue, fechaMaquina } from './articulos.js'

// Cuántas se piden de golpe. La primera es el titular grande, así que se
// piden de doce en doce: una arriba y once en la rejilla, que llena tres
// filas de cuatro y dos de seis sin dejar un hueco raro.
const POR_TANDA = 12

const enlaceDeNoticia = (slug) => rutaDeArticulo('news', slug)

function portadaHtml(n, tamano) {
  if (n.cover_image) {
    return `<div class="noticia-portada noticia-portada-${tamano}" style="background-image:url('${escapeHtml(n.cover_image)}')" role="presentation"></div>`
  }
  // Sin portada no se deja un hueco gris: se pinta el icono de la
  // noticia sobre el color de la casa. Pasará poco, pero cuando pase no
  // puede parecer que la imagen no ha cargado.
  return `<div class="noticia-portada noticia-portada-${tamano} noticia-portada-vacia">${icons.newspaper(38)}</div>`
}

function tarjetaHtml(n) {
  return `<a class="noticia-tarjeta" href="${enlaceDeNoticia(n.slug)}">
    ${portadaHtml(n, 'chica')}
    <div class="noticia-cuerpo">
      <time class="noticia-fecha" datetime="${fechaMaquina(n.published_at)}">${escapeHtml(cuandoFue(n.published_at))}</time>
      <h3>${escapeHtml(n.title)}</h3>
      <p>${escapeHtml(n.description || '')}</p>
    </div>
  </a>`
}

function titularHtml(n) {
  return `<a class="noticia-titular" href="${enlaceDeNoticia(n.slug)}">
    ${portadaHtml(n, 'grande')}
    <div class="noticia-cuerpo">
      <span class="noticia-ultima">Lo último</span>
      <time class="noticia-fecha" datetime="${fechaMaquina(n.published_at)}">${escapeHtml(cuandoFue(n.published_at))}</time>
      <h2>${escapeHtml(n.title)}</h2>
      <p>${escapeHtml(n.description || '')}</p>
    </div>
  </a>`
}

// Se pide UNA MÁS de las que se van a pintar. Es la forma de saber si
// queda alguna sin tener que contar la tabla entera en cada carga.
async function pedir(desde) {
  let q = supabase
    .from('guides')
    .select('id, slug, title, description, cover_image, published_at')
    .eq('kind', 'news')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(POR_TANDA + 1)
  if (desde) q = q.lt('published_at', desde)
  const { data, error } = await q
  // Mientras la migración no esté puesta, `kind` no existe y esto falla.
  // No es un error que enseñarle a nadie: es que todavía no hay noticias.
  if (faltaElTipo(error)) {
    console.warn('[noticias] Falta la columna `kind`. Ejecuta supabase-migration-noticias.sql en Supabase.')
    return { noticias: [], hayMas: false, error: null }
  }
  if (error) return { noticias: [], hayMas: false, error }
  const hayMas = (data?.length || 0) > POR_TANDA
  return { noticias: (data || []).slice(0, POR_TANDA), hayMas, error: null }
}

export async function pintarNoticias() {
  const titular = document.getElementById('noticiaTitular')
  const rejilla = document.getElementById('noticiasRejilla')
  const masCaja = document.getElementById('noticiasMasCaja')
  if (!rejilla) return

  const { noticias, hayMas, error } = await pedir(null)
  if (error) {
    rejilla.innerHTML = `<p class="empty-state">No se han podido cargar las noticias. Vuelve a intentarlo en un momento.</p>`
    return
  }
  if (noticias.length === 0) {
    rejilla.innerHTML = `<p class="empty-state">Todavía no hay noticias publicadas. Vuelve pronto.</p>`
    return
  }

  const [primera, ...resto] = noticias
  titular.innerHTML = titularHtml(primera)
  rejilla.innerHTML = resto.map(tarjetaHtml).join('')

  let ultima = noticias[noticias.length - 1]?.published_at || null
  let quedan = hayMas
  const pintarBoton = () => {
    masCaja.innerHTML = quedan
      ? `<button class="btn btn-secondary" id="btnMasNoticias">Ver más noticias</button>`
      : ''
    const btn = document.getElementById('btnMasNoticias')
    if (!btn) return
    btn.addEventListener('click', async () => {
      btn.disabled = true
      btn.textContent = 'Cargando…'
      const siguiente = await pedir(ultima)
      rejilla.insertAdjacentHTML('beforeend', siguiente.noticias.map(tarjetaHtml).join(''))
      ultima = siguiente.noticias[siguiente.noticias.length - 1]?.published_at || ultima
      quedan = siguiente.hayMas
      pintarBoton()
    })
  }
  pintarBoton()
}

pintarNoticias()
