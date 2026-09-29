// /meta/<arquetipo>: la ficha de un mazo del meta (tanda 364).
//
// Cuatro cosas, en el orden en que se usan: cómo le va (cifras), cómo
// aprender a llevarlo (guías de PokeDoc vinculadas), qué lleva (la lista
// media) y listas de verdad para copiar (las del top 8).
import { escapeHtml, getSession, getProfile } from './app.js'
import { showToast } from './toast.js'
import { rutaDeCarta } from './carta-ruta.js'
import { cardImageUrl } from './tcgdex.js'
import { tarjetaDeGuia } from './guia-tarjeta.js'
import { resolverCarta, pintarDecklistVisual } from './torneos/cartas-decklist.js'
import { copiarDecklist, descargarImagenDecklist } from './torneos/decklist-export.js'
import { cadenaDeImagenes, atributosDeImagen, letraDeEnergiaBasica } from './imagen-carta.js'
import * as datos from './meta/datos.js'
import { iconosHtml, periodoHtml, engancharPeriodo, fuenteHtml, engancharFuente, fechaCorta } from './meta/pintar.js'
import {
  SECCIONES,
  periodoDe,
  fuenteDe,
  NOMBRE_DE_FUENTE,
  porcentaje,
  copiasMedias,
  entero,
  tendencia,
  textoTendencia,
  puestoOrdinal,
  resultado,
  comoDecklist,
  textoTcgLive,
  enlaceConstructor,
  enlaceLimitless,
  partirListaMedia,
  totalDeLista,
  MIN_MAZOS_CON_MUESTRA,
} from './meta/nucleo.js'

const $ = (id) => document.getElementById(id)

// La dirección bonita es /meta/<id> (netlify.toml la reescribe a esta
// página sin cambiar la barra); ?a=<id> vale igual por si alguien llega
// a mazo-meta.html a pelo.
function idDeLaUrl() {
  const m = location.pathname.match(/^\/meta\/([^/?#]+)/)
  if (m) return decodeURIComponent(m[1])
  return new URLSearchParams(location.search).get('a') || ''
}

const ID = idDeLaUrl()
let dias = periodoDe(new URLSearchParams(location.search).get('dias'))
let fuente = fuenteDe(new URLSearchParams(location.search).get('fuente'))
let turno = 0
let nombreMazo = ID
let listas = []
let sesion = null
let perfil = null

function aviso(html) {
  $('mmAviso').innerHTML = html
  $('mmAviso').classList.toggle('hidden', !html)
}

// ── La cabecera ──
function pintarCabecera(arq, fila) {
  nombreMazo = arq?.nombre || fila?.nombre || ID
  $('mmNombre').textContent = nombreMazo
  $('mmIconos').innerHTML = iconosHtml(arq?.iconos || fila?.iconos || [], { grande: true })
  document.title = `${nombreMazo}: lista, guías y resultados — PokeDoc`
  const desc = fila
    ? `${nombreMazo} en el meta de Pokémon TCG: ${porcentaje(fila.cuota)} de uso y ${porcentaje(fila.porcentaje_victorias)} de victorias en los últimos ${dias} días. Lista media, listas del top 8 para copiar a TCG Live y guías en español.`
    : `${nombreMazo}: lista media, listas del top 8 para copiar y guías en español.`
  document.querySelector('meta[name="description"]')?.setAttribute('content', desc)
  // Una ficha con cuatro mazos detrás no tiene nada que no tenga la de
  // al lado: nace en noindex (tanda 322). El umbral es el mismo con el
  // que el sitemap decide ofrecerla.
  let robots = document.querySelector('meta[name="robots"]')
  const indexable = fila && fila.mazos >= MIN_MAZOS_CON_MUESTRA
  if (!indexable) {
    if (!robots) {
      robots = document.createElement('meta')
      robots.name = 'robots'
      document.head.appendChild(robots)
    }
    robots.content = 'noindex'
  } else robots?.remove()
}

function pintarCifras(fila) {
  if (!fila) {
    $('mmCifras').innerHTML = ''
    $('mmSub').textContent = `No se ha jugado en ${fuente === 'oficial' ? 'torneos oficiales' : fuente === 'pokedoc' ? 'torneos de PokeDoc' : 'los torneos que contamos'} en los últimos ${dias} días.`
    return
  }
  const t = tendencia(fila.cuota, fila.cuota_anterior)
  $('mmSub').textContent = `${entero(fila.mazos)} mazos en ${entero(fila.torneos)} torneos · últimos ${dias} días`
  $('mmCifras').innerHTML = `
    <div class="meta-cifra"><dt>Uso</dt><dd>${porcentaje(fila.cuota)}${t && t.tipo !== 'nuevo' ? ` <span class="meta-tend meta-tend-${t.tipo}">${escapeHtml(textoTendencia(t))}</span>` : ''}</dd></div>
    <div class="meta-cifra"><dt>Victorias</dt><dd>${porcentaje(fila.porcentaje_victorias)}</dd></div>
    <div class="meta-cifra"><dt>Resultado total</dt><dd>${fila.victorias + fila.derrotas + fila.empates > 0 ? `${entero(fila.victorias)}-${entero(fila.derrotas)}-${entero(fila.empates)}` : '—'}</dd></div>
    <div class="meta-cifra"><dt>Top 8</dt><dd>${entero(fila.top8)}</dd></div>`
}

// ── Las acciones de arriba: la MEJOR lista, a un clic ──
function pintarAcciones() {
  const mejor = listas[0]
  $('mmAcciones').classList.toggle('hidden', !mejor)
  if (!mejor) return
  const r = resultadoDe(mejor)
  $('mmAccionesTexto').textContent = `La del ${puestoOrdinal(mejor.puesto)} puesto de ${mejor.torneo}${r ? ` (${r})` : ''}.`
  $('mmAbrirMejor').href = enlaceConstructor(mejor.lista, nombreMazo)
}

// ── La lista media ──
//
// Con la rejilla de cartas de las decklists de torneo (misma pinta,
// mismas clases de torneos.css) y dos datos encima de cada carta: en qué
// % de listas sale y cuántas copias lleva de media.
function cartaMediaHtml(f, i) {
  return `
    <figure class="torneo-carta meta-carta" data-media="${i}">
      <span class="torneo-carta-cuantas">${copiasMedias(f.media)}</span>
      <span class="meta-carta-pct">${porcentaje(f.porcentaje)}</span>
      <figcaption>${escapeHtml(f.nombre)}</figcaption>
    </figure>`
}

async function rellenarImagen(hueco, f) {
  const linea = { name: f.nombre, set: f.set_codigo, number: f.numero }
  // Las básicas, con las nuestras y sin preguntar a nadie (tanda 366).
  if (letraDeEnergiaBasica(f.nombre)) {
    const attrs = atributosDeImagen(cadenaDeImagenes(linea, null, cardImageUrl))
    if (attrs) hueco.insertAdjacentHTML('afterbegin', `<span class="torneo-carta-foto"><img ${attrs} alt="${escapeHtml(f.nombre)}" width="245" height="342" loading="lazy" /></span>`)
    return
  }
  const carta = await resolverCarta(linea).catch(() => null)
  const attrs = atributosDeImagen(cadenaDeImagenes(linea, carta, (r) => cardImageUrl(r, 'low')))
  if (!attrs) return
  const img = `<img ${attrs} alt="${escapeHtml(f.nombre)}" width="245" height="342" loading="lazy" />`
  if (!carta) {
    hueco.insertAdjacentHTML('afterbegin', `<span class="torneo-carta-foto">${img}</span>`)
    return
  }
  const ruta = escapeHtml(rutaDeCarta(carta))
  hueco.insertAdjacentHTML('afterbegin', `<a class="torneo-carta-foto" href="${ruta}" tabindex="-1" aria-hidden="true">${img}</a>`)
  const pie = hueco.querySelector('figcaption')
  if (pie) pie.innerHTML = `<a class="torneo-carta-enlace" href="${ruta}">${escapeHtml(f.nombre)}</a>`
}

function pintarListaMedia(filas) {
  const caja = $('mmMedia')
  const total = filas[0]?.listas || 0
  $('mmMediaSub').textContent = total
    ? `Sale de ${entero(total)} ${total === 1 ? 'lista' : 'listas'}. El porcentaje es cuántas listas llevan la carta; «×», cuántas copias de media lleva la que la lleva.`
    : ''
  if (!filas.length) {
    caja.innerHTML = '<p class="subtext">No hay listas de este mazo en el periodo elegido.</p>'
    return
  }
  const partes = partirListaMedia(filas)
  const todas = []
  const bloque = (titulo, grupo) => {
    if (!grupo.length) return ''
    const desde = todas.length
    todas.push(...grupo)
    return `
      <h3 class="torneo-cartas-titulo">${titulo}</h3>
      <div class="torneo-cartas-rejilla">${grupo.map((f, j) => cartaMediaHtml(f, desde + j)).join('')}</div>`
  }
  let html = ''
  for (const { campo, titulo } of SECCIONES) {
    html += bloque(titulo, partes[campo].nucleo)
  }
  const opciones = SECCIONES.flatMap(({ campo }) => partes[campo].opciones)
  if (opciones.length) {
    html += `
      <details class="meta-opciones">
        <summary>Opciones y techs: ${opciones.length} ${opciones.length === 1 ? 'carta' : 'cartas'} que lleva menos de la mitad</summary>
        ${SECCIONES.map(({ campo, titulo }) => bloque(titulo, partes[campo].opciones)).join('')}
      </details>`
  }
  caja.innerHTML = html
  for (const hueco of caja.querySelectorAll('[data-media]')) {
    rellenarImagen(hueco, todas[Number(hueco.dataset.media)])
  }
}

// ── Las listas del top 8 ──
// Los oficiales no traen el resultado (solo el puesto): un «0-0-0» ahí
// diría que no jugó ninguna partida.
const resultadoDe = (l) => (l.victorias + l.derrotas + l.empates > 0 ? resultado(l.victorias, l.derrotas, l.empates) : '')

function enlaceDeLista(l) {
  if (l.enlace) return { url: l.enlace, texto: l.fuente === 'pokedoc' ? 'Ver el torneo' : 'Ver en Limitless', fuera: /^https?:/.test(l.enlace) }
  const url = enlaceLimitless(l.torneo_id, l.jugador)
  return url ? { url, texto: 'Ver en Limitless', fuera: true } : null
}

function listaHtml(l, i) {
  const quien = l.nombre_jugador ? escapeHtml(l.nombre_jugador) : 'Jugador'
  const pais = l.pais ? ` <span class="meta-pais">${escapeHtml(l.pais)}</span>` : ''
  const chapa = l.fuente && l.fuente !== 'online' ? ` <span class="meta-chapa-fuente${l.fuente === 'oficial' ? ' meta-chapa-oficial' : ''}">${escapeHtml(l.tipo || NOMBRE_DE_FUENTE[l.fuente])}</span>` : ''
  const ver = enlaceDeLista(l)
  return `
    <li>
      <details class="meta-lista" data-lista="${i}">
        <summary>
          <span class="meta-lista-puesto">${puestoOrdinal(l.puesto)}</span>
          <span class="meta-lista-quien"><strong>${quien}</strong>${pais}${chapa}
            <span class="meta-sub">${escapeHtml(l.torneo)} · ${fechaCorta(l.fecha)} · ${entero(l.jugadores)} jugadores</span>
          </span>
          <span class="meta-lista-resultado">${resultadoDe(l)}</span>
        </summary>
        <div class="meta-lista-cuerpo">
          <div class="meta-lista-acciones">
            <button type="button" class="btn-primary" data-copiar>Copiar para TCG Live</button>
            <a class="btn-secondary" href="${escapeHtml(enlaceConstructor(l.lista, nombreMazo))}">Abrir en el constructor</a>
            <button type="button" class="btn-secondary" data-imagen>Descargar imagen</button>
            ${ver ? `<a class="link-btn" href="${escapeHtml(ver.url)}"${ver.fuera ? ' target="_blank" rel="noopener"' : ''}>${ver.texto}</a>` : ''}
          </div>
          <p class="subtext">${totalDeLista(l.lista)} cartas.</p>
          <div class="meta-lista-cartas"></div>
        </div>
      </details>
    </li>`
}

function pintarListas() {
  const caja = $('mmListas')
  if (!listas.length) {
    caja.innerHTML = '<li class="subtext">No hay listas del top 8 de este mazo en el periodo elegido.</li>'
    return
  }
  caja.innerHTML = listas.map(listaHtml).join('')
}

function engancharListas() {
  const caja = $('mmListas')
  // La rejilla con imágenes se pinta al ABRIR cada lista: son 30 cartas
  // y 30 consultas, y casi nadie abre más de dos.
  caja.addEventListener(
    'toggle',
    (e) => {
      const d = e.target
      if (!d.matches?.('details[data-lista]') || !d.open || d.dataset.pintada) return
      d.dataset.pintada = '1'
      const l = listas[Number(d.dataset.lista)]
      if (l) pintarDecklistVisual(d.querySelector('.meta-lista-cartas'), comoDecklist(l.lista))
    },
    true
  )
  caja.addEventListener('click', (e) => {
    const d = e.target.closest('details[data-lista]')
    const l = d && listas[Number(d.dataset.lista)]
    if (!l) return
    if (e.target.closest('[data-copiar]')) copiarDecklist(textoTcgLive(l.lista))
    else if (e.target.closest('[data-imagen]')) descargarImagenDecklist(`${nombreMazo} — ${l.nombre_jugador || 'lista'}`, comoDecklist(l.lista))
  })
  $('mmCopiarMejor').addEventListener('click', () => {
    if (listas[0]) copiarDecklist(textoTcgLive(listas[0].lista))
  })
}

// ── Las guías ──
function puedeQuitar(f) {
  if (!sesion) return false
  const yo = sesion.user.id
  return perfil?.is_admin || f.added_by === yo || f.guides?.author_id === yo
}

async function pintarGuias() {
  let filas = []
  try {
    filas = await datos.guiasDe(ID)
  } catch (err) {
    $('mmGuiasLista').innerHTML = `<p class="subtext">${escapeHtml(err.message)}</p>`
    return
  }
  $('mmGuiasVacio').classList.toggle('hidden', filas.length > 0)
  $('mmGuiasLista').innerHTML = filas
    .map(
      (f) => `
      <div class="meta-guia" data-guia="${escapeHtml(f.guide_id)}">
        ${tarjetaDeGuia(f.guides)}
        ${puedeQuitar(f) ? '<button type="button" class="link-btn meta-guia-quitar" data-quitar>Quitar de este mazo</button>' : ''}
      </div>`
    )
    .join('')
  return filas
}

async function prepararVincular(yaVinculadas) {
  const zona = $('mmGuiasAcciones')
  if (!sesion) {
    zona.innerHTML = `<a class="link-btn" href="/auth.html?volver=${encodeURIComponent(location.pathname + location.search)}">Entra para vincular una guía tuya</a>`
    return
  }
  let mias = []
  try {
    mias = await datos.guiasVinculables(sesion.user.id, Boolean(perfil?.is_admin))
  } catch {
    mias = []
  }
  const ya = new Set((yaVinculadas || []).map((f) => f.guide_id))
  const libres = mias.filter((g) => !ya.has(g.id))
  zona.innerHTML = `
    <a class="link-btn" href="/editor-guia.html">Escribir una guía</a>
    ${libres.length ? '<button type="button" class="btn-secondary" id="mmVincularAbrir">Vincular una guía</button>' : ''}`
  const form = $('mmVincular')
  $('mmVincularGuia').innerHTML = libres.map((g) => `<option value="${escapeHtml(g.id)}">${escapeHtml(g.title)}</option>`).join('')
  $('mmVincularAbrir')?.addEventListener('click', () => {
    form.classList.remove('hidden')
    $('mmVincularGuia').focus()
  })
  if (!mias.length) {
    $('mmGuiasVacio').innerHTML = `Todavía no hay guías de este mazo. Si lo juegas, <a class="link-btn" href="/editor-guia.html">escribe una</a>: cuando esté publicada podrás vincularla aquí.`
  }
}

function engancharGuias() {
  $('mmVincular').addEventListener('submit', async (e) => {
    e.preventDefault()
    const id = $('mmVincularGuia').value
    if (!id) return
    const boton = $('mmVincularBoton')
    boton.disabled = true
    try {
      await datos.vincularGuia(ID, id)
      showToast('Guía vinculada a este mazo.', 'success')
      $('mmVincular').classList.add('hidden')
      const filas = await pintarGuias()
      await prepararVincular(filas)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      boton.disabled = false
    }
  })
  $('mmVincularCancelar').addEventListener('click', () => $('mmVincular').classList.add('hidden'))
  $('mmGuiasLista').addEventListener('click', async (e) => {
    if (!e.target.closest('[data-quitar]')) return
    const caja = e.target.closest('[data-guia]')
    // confirm() a propósito, como en /mazos: quitarla la saca de aquí
    // para todo el mundo (la guía en sí no se toca).
    if (!window.confirm('¿Quitar esta guía de este mazo? La guía no se borra.')) return
    try {
      await datos.desvincularGuia(ID, caja.dataset.guia)
      showToast('Guía quitada de este mazo.', 'success')
      const filas = await pintarGuias()
      await prepararVincular(filas)
    } catch (err) {
      showToast(err.message, 'error')
    }
  })
}

// ── Todo junto ──
async function cargar() {
  const mio = ++turno
  $('mmContenido').classList.add('meta-cargando')
  try {
    const [arq, ranking, media, destacadas] = await Promise.all([
      datos.arquetipo(ID),
      datos.resumen(dias, fuente),
      datos.listaMedia(ID, dias, fuente),
      datos.listasDestacadas(ID, dias, 12, fuente),
    ])
    if (mio !== turno) return
    if (!arq) {
      aviso(`<p>No conocemos ningún mazo con ese nombre. <a class="link-btn" href="/meta">Ver todos los mazos del meta</a>.</p>`)
      $('mmNombre').textContent = 'Mazo no encontrado'
      $('mmContenido').classList.add('hidden')
      return
    }
    aviso('')
    const fila = ranking.find((r) => r.arquetipo === ID) || null
    listas = destacadas
    pintarCabecera(arq, fila)
    pintarCifras(fila)
    pintarAcciones()
    pintarListaMedia(media)
    pintarListas()
  } catch (err) {
    if (mio !== turno) return
    aviso(`<p>${escapeHtml(err.message)}</p>`)
  } finally {
    if (mio === turno) $('mmContenido').classList.remove('meta-cargando')
  }
}

async function iniciar() {
  if (!ID) {
    location.replace('/meta')
    return
  }
  $('mmFuente').innerHTML = fuenteHtml(fuente)
  engancharFuente($('mmFuente'), (f) => {
    fuente = f
    cargar()
  })
  const caja = $('mmPeriodo')
  caja.innerHTML = periodoHtml(dias)
  engancharPeriodo(caja, (d) => {
    dias = d
    cargar()
  })
  engancharListas()
  engancharGuias()
  const carga = cargar()
  sesion = await getSession().catch(() => null)
  if (sesion) perfil = await getProfile(sesion.user.id).catch(() => null)
  const filas = await pintarGuias()
  await prepararVincular(filas)
  await carga
}

iniciar()
