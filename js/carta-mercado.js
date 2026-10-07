// El precio y tu colección en la ficha pública de una carta (tanda 365,
// rehecho en la 677).
//
// DOS piezas, en dos sitios:
//
// · Las LOSETAS pegadas a la carta —Añadir, Editar (si la tienes) y
//   Avísame—, las mismas que la ficha de /mi-coleccion: icono arriba y
//   palabra debajo. Añadir abre el diálogo de la 650 (idioma con
//   banderas, estado, versión, copias, lo que pagaste) y guarda por
//   `datos.anadir`, que es el único camino de la casa para meter una
//   carta. Sin sesión, las dos losetas mandan al registro.
//
// · El bloque de PRECIO, al final de la página: el idioma se elige con
//   chips de bandera (el `<select>` sigue, sin verse: es quien manda y a
//   quien escuchan las pruebas), el estado con su desplegable, y la
//   versión pulsando una impresión. Lo pinta js/precio-vista.js, el
//   mismo que la ficha de /mi-coleccion; debajo, el histórico (643) y
//   quién la da (376).
//
// Lo que había —tres desplegables sueltos, un panel «Mi colección» con
// un campo de copias y dos enlaces— lo quitó PINGU: «horriblemente mal
// puesto». Ver SCHEMA 677.
import { escapeHtml, getSession, getInitial, avatarStyle, profileUrl } from './app.js'
import { icons } from './icons.js'
import { showToast } from './toast.js'
import { nombreDeCarta, nombreDeSet } from './catalogo-series.js'
import {
  IDIOMAS,
  ESTADOS,
  VARIANTES,
  IDIOMA_POR_DEFECTO,
  ESTADO_POR_DEFECTO,
  precioDe,
  idiomaDe,
  estadoDe,
  varianteDe,
} from './cardmarket.js'
import { bloqueDePrecio, banderaHtml } from './precio-vista.js'
import { preciosEnVivo, preciosGuardados, lineasDeCarta, anadir, tieneCifras } from './mi-coleccion/datos.js'
import { precioDeFila, precioParaIdioma } from './cardmarket.js'
import { engancharAvisos } from './avisos-precio.js'
import { supabase } from './supabase.js'
import { variantesDeCarta, TODAS } from './mi-coleccion/variantes.js'
import { especiesDeCarta, especiePorDex } from './pokedex-especies.js'
import { atributosDeRango } from './rangos.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'

const $ = (id) => document.getElementById(id)
const MERCADO = 'WEST'
// La misma memoria que /mi-coleccion (461): el idioma con el que añades
// se recuerda por catálogo, y el catálogo de /carta es el occidental.
const CLAVE_IDIOMA = 'mcTocarIdioma-es'

// Las versiones que existen de ESTA carta, del módulo común (384). Esta
// pantalla pide TODAS cuando no se sabe: aquí tienes la carta en la mano.
// Las impresiones que EXISTEN de la carta para el bloque de precio (688):
// si no se sabe, una sola y las chapas no salen. Las cuatro a la vez
// (`TODAS`) solo las ofrece el diálogo de añadir, donde la carta la tienes
// en la mano. PINGU: «no tiene sentido que tengas todas esas versiones y
// encima no puedes clicar en ellas porque no existen».
function variantesDe(v, siNoSeSabe = undefined) {
  return variantesDeCarta({ variants: v }, siNoSeSabe).map((x) => x.nuestro)
}

// Los idiomas de una carta occidental: la misma regla que la vista «es»
// de /mi-coleccion (no hay carta japonesa, coreana ni china en este
// catálogo a la que ponerle esa etiqueta).
const idiomasDeCarta = () => IDIOMAS.filter((i) => !['ja', 'ko', 'zh'].includes(i.id))

function idiomaRecordado(idiomas) {
  try {
    const guardado = localStorage.getItem(CLAVE_IDIOMA)
    if (guardado && idiomas.some((i) => i.id === guardado)) return guardado
  } catch {}
  return idiomas.some((i) => i.id === IDIOMA_POR_DEFECTO) ? IDIOMA_POR_DEFECTO : idiomas[0]?.id
}

function recordarIdioma(id) {
  try { localStorage.setItem(CLAVE_IDIOMA, id) } catch {}
}

function opciones(lista, activo) {
  return lista.map((o) => `<option value="${escapeHtml(o.id)}"${o.id === activo ? ' selected' : ''}>${escapeHtml(o.nombre)}</option>`).join('')
}

function chipsDeIdioma(idiomas, puesto) {
  return idiomas
    .map((i) => `<button type="button" class="mc-idioma-chip${i.id === puesto ? ' activo' : ''}" role="radio" aria-checked="${i.id === puesto ? 'true' : 'false'}" data-idioma="${escapeHtml(i.id)}">${banderaHtml(i.id)}<span>${escapeHtml(i.nombre)}</span></button>`)
    .join('')
}

function marcarChip(caja, id) {
  for (const x of caja.querySelectorAll('.mc-idioma-chip')) {
    const puesto = x.dataset.idioma === id
    x.classList.toggle('activo', puesto)
    x.setAttribute('aria-checked', puesto ? 'true' : 'false')
  }
}

// «Ver los 312 Pikachus» → la Pokédex, abierta en esa especie (384).
// Solo si la carta tiene UNA especie: en una TAG TEAM un enlace que
// elige por ti manda a medio sitio.
function enlaceDeEspecie(carta) {
  const dexes = especiesDeCarta(carta?.name || carta?.name_es)
  if (dexes.length !== 1) return ''
  const nombre = especiePorDex(dexes[0])
  if (!nombre) return ''
  return `<a class="link-btn carta-mercado-ir" href="/mi-coleccion?ver=pokedex&amp;dex=${dexes[0]}">Todas las cartas de ${escapeHtml(nombre)}</a>`
}

const senasDe = (l) => {
  const p = [idiomaDe(l.idioma).nombre, estadoDe(l.estado).id]
  if (l.variante && l.variante !== 'normal') p.push(varianteDe(l.variante).nombre)
  return p.join(' · ')
}

export async function pintarMercado(carta) {
  const caja = $('cartaMercado')
  if (!caja || !carta?.id) return
  const [vivo, guardadas] = await Promise.all([preciosEnVivo(carta.id), preciosGuardados([carta.id]).catch(() => new Map())])
  const guardada = guardadas.get(carta.id) || null
  // Las impresiones: lo que diga TCGdex en vivo y, si no contesta, lo que
  // guardamos de él en la carta (645).
  const variantes = variantesDe(vivo?.variants ?? carta.variants)
  const variantesParaAnadir = variantesDe(vivo?.variants ?? carta.variants, TODAS)
  const idiomas = idiomasDeCarta()
  const estado = { idioma: idiomaRecordado(idiomas), estado: ESTADO_POR_DEFECTO, variante: variantes[0] }
  let ultimoPrecio = null
  const nombre = nombreDeCarta(carta)

  caja.innerHTML = `
    <h2 class="section-title">Precio</h2>
    <div class="carta-mercado">
      <div class="carta-mercado-filtros">
        <div class="mc-idioma-chips" id="cmIdiomas" role="radiogroup" aria-label="Idioma del precio">${chipsDeIdioma(idiomas, estado.idioma)}</div>
        <label class="carta-mercado-estado">Estado <select id="cmEstado">${opciones(ESTADOS, estado.estado)}</select></label>
        <select id="cmIdioma" class="pv-select-oculto" aria-label="Idioma">${opciones(idiomas, estado.idioma)}</select>
        <select id="cmVariante" class="pv-select-oculto" aria-label="Versión">${opciones(VARIANTES.filter((v) => variantes.includes(v.id)), estado.variante)}</select>
      </div>
      <div id="cmPrecios"></div>
      <!-- El histórico (643): lo pinta js/carta-historial.js por import()
           al tener el precio; sin filas no se ve. -->
      <div class="carta-historial hidden" id="cmHistorial"></div>
      <!-- Quién da ESTA carta (376), sin cuenta también: es el escaparate. -->
      <div class="carta-cambios hidden" id="cmCambios"></div>
      <p class="carta-mercado-pie">${enlaceDeEspecie(carta)}</p>
    </div>`
  caja.classList.remove('hidden')

  const pintarPrecio = () => {
    const reverse = estado.variante === 'reverse'
    const enVivo = precioDe(vivo?.pricing, { reverse, variante: estado.variante })
    const guardado = precioDeFila(guardada, { reverse, variante: estado.variante })
    // El guardado manda (TCGGO, por idioma); el vivo de TCGdex solo si el
    // guardado no dice nada; y sin cifras, el que traiga el enlace (375).
    const precio = tieneCifras(guardado) ? guardado : tieneCifras(enVivo) ? enVivo : guardado || enVivo
    ultimoPrecio = precio
    $('cmPrecios').innerHTML = bloqueDePrecio(precio, {
      idioma: estado.idioma, estado: estado.estado, variante: estado.variante, nombre, tcgplayerId: carta.tp_id_product_propio || null,
      variantes: VARIANTES.filter((v) => variantes.includes(v.id)), impresionesPulsables: true, rotuloActivo: 'elegido',
    })
  }
  pintarPrecio()
  $('cmPrecios').addEventListener('click', (e) => {
    const b = e.target.closest('.pv-impresion[data-variante]')
    if (!b || !variantes.includes(b.dataset.variante)) return
    $('cmVariante').value = b.dataset.variante
    $('cmVariante').dispatchEvent(new Event('change'))
  })
  // Los chips mandan al desplegable, y el desplegable es quien pinta: así
  // hay UN camino, se cambie desde donde se cambie.
  $('cmIdiomas').addEventListener('click', (e) => {
    const chip = e.target.closest('.mc-idioma-chip')
    if (!chip) return
    $('cmIdioma').value = chip.dataset.idioma
    $('cmIdioma').dispatchEvent(new Event('change'))
  })

  let repintarHistorial = null
  import('./carta-historial.js')
    .then(({ montarHistorial, cargadorDeMarcas }) => montarHistorial($('cmHistorial'), carta.id, () => estado.idioma, { marcas: cargadorDeMarcas(supabase, carta.market || MERCADO) }))
    .then((r) => { repintarHistorial = r })
    .catch(() => {})

  for (const [id, campo] of [['cmIdioma', 'idioma'], ['cmEstado', 'estado'], ['cmVariante', 'variante']]) {
    $(id)?.addEventListener('change', (e) => {
      estado[campo] = e.target.value
      if (campo === 'idioma') {
        marcarChip($('cmIdiomas'), estado.idioma)
        recordarIdioma(estado.idioma)
      }
      pintarPrecio()
      if (campo === 'idioma') repintarHistorial?.()
    })
  }

  pintarQuienLaDa(carta)

  // ── Las losetas bajo la carta ──
  const sesion = await getSession().catch(() => null)
  montarAcciones(carta, sesion, { idiomas, variantes: variantesParaAnadir, estado, precioActual: () => precioParaIdioma(ultimoPrecio, estado.idioma)?.valor ?? null })
}

// Las tres losetas, pegadas al escaneo (donde las tiene la ficha de
// /mi-coleccion y donde las pone TCGGO). Van DENTRO del `figure` para
// que en escritorio acompañen a la carta, que es pegajosa.
function montarAcciones(carta, sesion, { idiomas, variantes, estado, precioActual }) {
  const figura = document.querySelector('#cartaNucleo .carta-scan')
  if (!figura || $('cartaAcciones')) return
  const volver = `/auth.html?volver=${encodeURIComponent(location.pathname)}`
  const buscarla = `/mi-coleccion?ver=buscar&q=${encodeURIComponent(nombreDeCarta(carta) || carta.name || '')}`
  figura.insertAdjacentHTML('beforeend', sesion
    ? `<div class="mc-ficha-acciones carta-acciones" id="cartaAcciones">
        <button type="button" class="mc-ficha-tile mc-ficha-mas" id="cmAnadir"><i aria-hidden="true">+</i><span>Añadir</span></button>
        <a class="mc-ficha-tile hidden" id="cmEditar" href="${escapeHtml(buscarla)}"><i aria-hidden="true">${icons.edit(16)}</i><span>Editar</span><small id="cmTienes"></small></a>
        <button type="button" class="mc-ficha-tile" id="cmAviso" data-aviso="${escapeHtml(carta.id)}"><i aria-hidden="true">${icons.bell(16)}</i><span>Avísame</span></button>
      </div>`
    : `<div class="mc-ficha-acciones carta-acciones" id="cartaAcciones">
        <a class="mc-ficha-tile mc-ficha-mas" href="${escapeHtml(volver)}"><i aria-hidden="true">+</i><span>Añadir</span></a>
        <a class="mc-ficha-tile" href="${escapeHtml(volver)}"><i aria-hidden="true">${icons.bell(16)}</i><span>Avísame</span></a>
      </div>`)
  if (!sesion) return

  engancharAvisos($('cartaAcciones'), () => ({ market: carta.market || MERCADO, idioma: estado.idioma, precio: precioActual() }))

  // Lo que tienes de ella, para la loseta de Editar y para la primera
  // cara del diálogo. Se vuelve a pedir al guardar.
  let mias = []
  const refrescarTengo = async () => {
    try {
      mias = await lineasDeCarta(sesion.user.id, carta.id)
    } catch {
      // Sin la migración no hay colección: el botón lo dirá al pulsarlo.
      mias = []
    }
    const n = mias.reduce((a, l) => a + (Number(l.cantidad) || 0), 0)
    $('cmEditar')?.classList.toggle('hidden', n === 0)
    const tienes = $('cmTienes')
    if (tienes) tienes.textContent = n ? `Tienes ${n}` : ''
  }
  const tengoListo = refrescarTengo()

  $('cmAnadir').addEventListener('click', () => abrirAnadir(carta, sesion, { idiomas, variantes, mias, alGuardar: refrescarTengo }))
  // Mayús+Intro en la paleta (718) llega con #anadir: el diálogo se abre
  // solo, ya sabiendo lo que tienes (si no, diría «añadir» de una que ya
  // es tuya). Se quita de la dirección para que recargar no lo reabra.
  if (location.hash === '#anadir') {
    history.replaceState(null, '', location.pathname + location.search)
    tengoListo.finally(() => $('cmAnadir')?.click())
  }
}

// ── El diálogo de añadir (la misma pieza que en /mi-coleccion, 650) ──
//
// Dos caras: «Ya en tu colección» (con «Añadir más») si la tienes, y el
// formulario. Se monta una vez y se rellena en cada apertura.
function dialogoDeAnadir() {
  let d = $('cmAdDialogo')
  if (d) return d
  document.body.insertAdjacentHTML('beforeend', `
    <dialog class="mc-bandeja mc-anadir-dialogo" id="cmAdDialogo" aria-labelledby="cmAdTitulo">
      <div class="mc-panel-cabecera">
        <h2 id="cmAdTitulo">Añadir a mi colección</h2>
        <button type="button" class="mc-panel-cerrar" id="cmAdCerrar" aria-label="Cerrar">✕</button>
      </div>
      <div class="mc-panel-cuerpo">
        <div class="mc-ad-carta" id="cmAdCarta"></div>
        <p class="mc-ad-nombre" id="cmAdNombre"></p>
        <div class="mc-ad-ya hidden" id="cmAdYa">
          <p class="mc-ad-ya-titulo">Ya en tu colección</p>
          <div class="mc-ad-ya-lista" id="cmAdYaLista"></div>
          <div class="mc-ad-botones">
            <button type="button" class="btn-secondary" id="cmAdYaCerrar">Cerrar</button>
            <button type="button" class="btn-primary" id="cmAdMas">Añadir más</button>
          </div>
        </div>
        <form class="mc-ad-form hidden" id="cmAdForm">
          <fieldset class="mc-ad-idiomas-caja">
            <legend>Idioma</legend>
            <div class="mc-idioma-chips" id="cmAdIdiomas" role="radiogroup" aria-label="Idioma de la copia"></div>
          </fieldset>
          <div class="mc-ad-campos">
            <label>Estado <select id="cmAdEstado"></select></label>
            <label id="cmAdVarianteLabel">Versión <select id="cmAdVariante"></select></label>
            <label>Copias
              <span class="mc-contador-mando">
                <button type="button" class="mc-contador-btn" data-paso="-1" aria-label="Una copia menos">−</button>
                <input type="number" id="cmAdCantidad" min="1" max="999" value="1" inputmode="numeric" />
                <button type="button" class="mc-contador-btn" data-paso="1" aria-label="Una copia más">+</button>
              </span>
            </label>
            <label>Lo que pagaste por unidad (€, opcional) <input type="text" id="cmAdCompra" inputmode="decimal" placeholder="0,00" /></label>
          </div>
          <div class="mc-ad-botones">
            <button type="button" class="btn-secondary" id="cmAdCancelar">Cancelar</button>
            <button type="submit" class="btn-primary" id="cmAdGuardar">Guardar</button>
          </div>
        </form>
      </div>
    </dialog>`)
  d = $('cmAdDialogo')
  for (const id of ['cmAdCerrar', 'cmAdYaCerrar', 'cmAdCancelar']) $(id).addEventListener('click', () => d.close())
  $('cmAdMas').addEventListener('click', () => caraDeAnadir('form'))
  $('cmAdIdiomas').addEventListener('click', (e) => {
    const chip = e.target.closest('.mc-idioma-chip')
    if (chip) marcarChip($('cmAdIdiomas'), chip.dataset.idioma)
  })
  // El contador: suma sobre lo escrito y no baja de una copia (396).
  for (const b of d.querySelectorAll('.mc-contador-btn')) {
    b.addEventListener('click', () => {
      const campo = $('cmAdCantidad')
      const n = Math.round(Number(campo.value) || 0) + Number(b.dataset.paso)
      campo.value = String(Math.max(1, Math.min(999, n)))
    })
  }
  return d
}

function caraDeAnadir(cara) {
  $('cmAdYa').classList.toggle('hidden', cara !== 'ya')
  $('cmAdForm').classList.toggle('hidden', cara !== 'form')
}

function abrirAnadir(carta, sesion, { idiomas, variantes, mias, alGuardar }) {
  const d = dialogoDeAnadir()
  const set = carta.tcg_sets || null
  const escaneo = atributosDeEscaneo(cadenaDeEscaneo(carta, set?.tcg_online_code))
  $('cmAdCarta').innerHTML = escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="eager" />` : ''
  $('cmAdNombre').innerHTML = `Añadiendo <b>${escapeHtml(nombreDeCarta(carta))}</b> · ${escapeHtml(nombreDeSet(set) || carta.set_id || '')} ${escapeHtml(carta.local_id || '')}`
  $('cmAdYaLista').innerHTML = mias
    .map((l) => `<div class="mc-ad-ya-linea"><span>${escapeHtml(senasDe(l))}</span><b>${l.cantidad} ${l.cantidad === 1 ? 'copia' : 'copias'}</b></div>`)
    .join('')
  // El formulario, preparado: el idioma que se recuerda, el estado por
  // defecto, las versiones de ESTA carta (con una sola no hay que elegir).
  $('cmAdIdiomas').innerHTML = chipsDeIdioma(idiomas, idiomaRecordado(idiomas))
  $('cmAdEstado').innerHTML = opciones(ESTADOS, ESTADO_POR_DEFECTO)
  const vs = VARIANTES.filter((v) => variantes.includes(v.id))
  $('cmAdVariante').innerHTML = opciones(vs, vs.some((v) => v.id === 'normal') ? 'normal' : vs[0]?.id)
  $('cmAdVarianteLabel').classList.toggle('hidden', vs.length < 2)
  $('cmAdCantidad').value = '1'
  $('cmAdCompra').value = ''
  $('cmAdGuardar').disabled = false
  caraDeAnadir(mias.length ? 'ya' : 'form')

  $('cmAdForm').onsubmit = async (e) => {
    e.preventDefault()
    const boton = $('cmAdGuardar')
    boton.disabled = true
    const idioma = $('cmAdIdiomas').querySelector('.mc-idioma-chip.activo')?.dataset.idioma || idiomas[0]?.id
    const linea = {
      card_id: carta.id,
      idioma,
      estado: $('cmAdEstado').value,
      variante: $('cmAdVariante').value || 'normal',
      cantidad: Math.max(1, Math.min(999, Math.round(Number($('cmAdCantidad').value) || 1))),
    }
    // Lo que pagaste, solo si lo has escrito: un cero no es «no lo sé».
    const pagado = Number(String($('cmAdCompra').value || '').replace(',', '.'))
    if (Number.isFinite(pagado) && pagado > 0) linea.precio_compra = pagado
    try {
      const nueva = await anadir(sesion.user.id, linea, carta.market || MERCADO)
      recordarIdioma(idioma)
      d.close()
      showToast(`${nombreDeCarta(carta)} añadida en ${idiomaDe(nueva.idioma).nombre.toLowerCase()}.`, 'success')
      await alGuardar()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      boton.disabled = false
    }
  }
  if (!d.open) d.showModal()
}

// Quién da esta carta, en la ficha (tanda 376).
//
// SE CALLA cuando no hay nadie: un «nadie la da» en cada una de las
// 23.000 fichas es ruido en 22.900 de ellas. Y se calla igual si la
// migración no está o la consulta falla — por eso el `catch` vacío, que
// aquí no esconde un fallo sino que decide no enseñar un bloque.
async function pintarQuienLaDa(carta) {
  const caja = $('cmCambios')
  if (!caja) return
  try {
    const { quienDaEsta } = await import('./mi-coleccion/cambios.js')
    const gente = await quienDaEsta(carta.id, 12)
    if (!gente.length) return
    caja.innerHTML = `
      <h3 class="carta-cambios-titulo">${icons.refreshCw(16)} ${gente.length} ${gente.length === 1 ? 'persona la da' : 'personas la dan'} para cambiar</h3>
      <ul class="carta-cambios-lista">
        ${gente
          .map((f) => {
            const nombre = f.display_name || f.username || 'Alguien'
            return `<li>
              <a class="mini-avatar" href="${escapeHtml(profileUrl(f))}" style="${avatarStyle(f)}">${f.avatar_url ? '' : escapeHtml(getInitial(nombre))}</a>
              <div>
                <a href="${escapeHtml(profileUrl(f))}"${atributosDeRango(f)}>${escapeHtml(nombre)}</a>
                <p class="subtext">${escapeHtml(senasDe(f))}${f.cambio > 1 ? ` · da ${f.cambio}` : ''}</p>
              </div>
              <a class="link-btn" href="/mensajes.html?with=${encodeURIComponent(f.user_id)}">${icons.mail(15)}Escribir</a>
            </li>`
          })
          .join('')}
      </ul>
      <p class="subtext">Apunta esta carta en tu <a href="/mi-coleccion?ver=resumen">lista de búsqueda</a> y te avisamos cuando alguien más la dé.</p>`
    caja.classList.remove('hidden')
  } catch {
    // Sin migración o sin red: la ficha se queda como estaba.
  }
}
