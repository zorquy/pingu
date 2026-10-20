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
import { tarjetasDePrecio, chapasDeImpresiones, chipDeIdiomaHtml } from './precio-vista.js'
import { preciosEnVivo, preciosGuardados, lineasDeCarta, anadir, actualizar, borrar, tieneCifras } from './mi-coleccion/datos.js'
import { precioDeFila, precioParaIdioma, idiomasParaAnadirEn } from './cardmarket.js'
import { idiomasDeSet } from './idiomas-de-set.js'
import { engancharAvisos } from './avisos-precio.js'
import * as laQuiero from './la-quiero.js'
import { deseosDeCarta } from './mi-coleccion/cambios.js'
import { supabase } from './supabase.js'
import { variantesDeCarta, versionDeVariante, TODAS, seSabenVariantes } from './mi-coleccion/variantes.js'
import { montarEleccion } from './mi-coleccion/elegir-version.js'
import { versionesDe as versionesDeTcggo } from './carta-versiones.js'
import { especiesPorNombres, especiePorDex } from './pokedex-especies.js'
import { atributosDeRango } from './rangos.js'
import { segmentar } from './mi-coleccion/segmentado.js'
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
// Y con las versiones de TCGGO pegadas (862): la Quick Ball es una
// impresión más, con su precio.
// Con la carta entera y no solo `variants`: lo que no dice se deduce de
// su expansión y su rareza (922).
function variantesDe(carta, v, siNoSeSabe = undefined, versiones = []) {
  return variantesDeCarta({ ...carta, variants: v, versiones }, siNoSeSabe).map((x) => ({ id: x.nuestro, nombre: x.nombre }))
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

// «Ver los 312 Pikachus» → la Pokédex, abierta en esa especie (384).
// Solo si la carta tiene UNA especie: en una TAG TEAM un enlace que
// elige por ti manda a medio sitio.
function enlaceDeEspecie(carta) {
  const dexes = especiesPorNombres(carta?.name, carta?.name_es, carta?.name_en)
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

// EL PRECIO, AL LADO EN EL PC (788, PA7). Es lo que más se mira, y en el
// ordenador quedaba debajo de «Dónde se habla». Ahí la sección se muda a la
// columna de la derecha, encima de los datos; en el móvil se queda al final
// (677). Se MUEVE, no se copia: es la misma con sus escuchas. Una marca en
// su sitio de siempre sabe adónde volver si la ventana se estrecha.
function colocarPrecioAlLado(caja) {
  if (caja.dataset.colocado) return
  caja.dataset.colocado = '1'
  const pc = window.matchMedia('(min-width: 1100px)')
  const sitio = document.createComment(' el precio, en el móvil ')
  caja.after(sitio)
  const colocar = () => {
    const datos = document.querySelector('#cartaNucleo .carta-datos')
    if (pc.matches && datos) datos.prepend(caja)
    else sitio.before(caja)
    caja.classList.toggle('carta-mercado-al-lado', pc.matches && Boolean(datos))
  }
  colocar()
  pc.addEventListener('change', colocar)
}

export async function pintarMercado(carta) {
  const caja = $('cartaMercado')
  if (!caja || !carta?.id) return
  const [vivo, guardadas, versiones] = await Promise.all([preciosEnVivo(carta.id), preciosGuardados([carta.id]).catch(() => new Map()), versionesDeTcggo(carta).catch(() => [])])
  const guardada = guardadas.get(carta.id) || null
  // Las impresiones: lo que diga TCGdex en vivo y, si no contesta, lo que
  // guardamos de él en la carta (645); y las versiones de TCGGO (862).
  const listaDeVariantes = variantesDe(carta, vivo?.variants ?? carta.variants, undefined, versiones)
  const variantes = listaDeVariantes.map((v) => v.id)
  const variantesParaAnadir = variantesDe(carta, vivo?.variants ?? carta.variants, TODAS, versiones).map((v) => v.id)
  const seSabe = seSabenVariantes({ ...carta, variants: vivo?.variants ?? carta.variants, versiones })
  const idiomas = idiomasDeCarta()
  const estado = { idioma: idiomaRecordado(idiomas), estado: ESTADO_POR_DEFECTO, variante: variantes[0] }
  let ultimoPrecio = null
  const nombre = nombreDeCarta(carta)

  // 916: el precio como en el pop-up (915) — una tarjeta por idioma del
  // set, la del tuyo primero, y sin los chips de idioma ni el estado: las
  // tarjetas ya dicen cada idioma. El idioma «tuyo» es el de tu copia o el
  // recordado; los desplegables escondidos siguen siendo el único camino
  // para cambiarlo (la gráfica y el aviso lo leen de ahí).
  caja.innerHTML = `
    <h2 class="section-title">Precio <small>Cardmarket · mínimo Near Mint</small></h2>
    <div class="carta-mercado">
      <select id="cmIdioma" class="pv-select-oculto" aria-label="Idioma" tabindex="-1">${opciones(idiomas, estado.idioma)}</select>
      <select id="cmVariante" class="pv-select-oculto" aria-label="Versión" tabindex="-1">${opciones(listaDeVariantes, estado.variante)}</select>
      <div id="cmPrecios"></div>
      <p class="carta-mercado-aviso" id="cmAvisoSitio"></p>
      <!-- Comparar con otra (735): un diálogo, js/carta-comparar.js. -->
      <button type="button" class="link-btn carta-comparar-abrir" id="cmComparar">${icons.layers(16)}<span>Comparar con otra carta</span></button>
      <!-- El histórico (643): lo pinta js/carta-historial.js por import()
           al tener el precio; sin filas no se ve. -->
      <div class="carta-historial hidden" id="cmHistorial"></div>
      <!-- Quién da ESTA carta (376), sin cuenta también: es el escaparate. -->
      <div class="carta-cambios hidden" id="cmCambios"></div>
      <!-- Las otras versiones de TCGGO (822): js/carta-versiones.js. -->
      <div class="carta-versiones hidden" id="cmVersiones"></div>
      <div class="carta-mercado-pie">${enlaceDeEspecie(carta)}</div>
    </div>`
  caja.classList.remove('hidden')
  colocarPrecioAlLado(caja)
  import('./carta-versiones.js').then((m) => m.pintarVersiones(carta, $('cmVersiones'), { precio: guardada, variants: vivo?.variants ?? carta.variants ?? null, filas: versiones })).catch(() => {})

  const pintarPrecio = () => {
    const reverse = estado.variante === 'reverse'
    const enVivo = precioDe(vivo?.pricing, { reverse, variante: estado.variante })
    // Una versión de TCGGO (862) tiene su propia fila de precio.
    const version = versionDeVariante({ versiones }, estado.variante)
    const guardado = version ? precioDeFila(version, { reverse: false, variante: 'normal' }) : precioDeFila(guardada, { reverse, variante: estado.variante })
    // El guardado manda (TCGGO, por idioma); el vivo de TCGdex solo si el
    // guardado no dice nada; y sin cifras, el que traiga el enlace (375).
    const precio = tieneCifras(guardado) ? guardado : tieneCifras(enVivo) ? enVivo : guardado || enVivo
    ultimoPrecio = precio
    $('cmPrecios').innerHTML = chapasDeImpresiones(listaDeVariantes, estado.variante, { pulsables: true, precio, idioma: estado.idioma }) + tarjetasDePrecio(precio, {
      idioma: estado.idioma, estado: estado.estado, variante: estado.variante, nombre, tcgplayerId: carta.tp_id_product_propio || null,
      rotuloActivo: estado.deTuCopia ? 'tu copia' : 'tu idioma', idiomasDelSet,
    })
  }
  // Los idiomas en los que salió su set (911): llegan después y repintan.
  let idiomasDelSet = null
  pintarPrecio()
  void idiomasDeSet(carta.set_id, carta.market || MERCADO).then((lista) => {
    if (!lista?.length) return
    idiomasDelSet = lista
    pintarPrecio()
  }).catch(() => {})
  $('cmPrecios').addEventListener('click', (e) => {
    const b = e.target.closest('.pv-impresion[data-variante]')
    if (!b || !variantes.includes(b.dataset.variante)) return
    $('cmVariante').value = b.dataset.variante
    $('cmVariante').dispatchEvent(new Event('change'))
  })

  $('cmComparar').addEventListener('click', () => {
    import('./carta-comparar.js').then((m) => m.abrirComparar(carta, { idioma: estado.idioma })).catch(() => showToast('No se ha podido abrir la comparación.', 'error'))
  })

  let repintarHistorial = null
  import('./carta-historial.js')
    .then(({ montarHistorial, cargadorDeMarcas }) => montarHistorial($('cmHistorial'), carta.id, () => estado.idioma, { marcas: cargadorDeMarcas(supabase, carta.market || MERCADO), ...(window.matchMedia?.('(min-width: 1100px)').matches ? { alto: 120 } : {}) }))
    .then((r) => { repintarHistorial = r })
    .catch(() => {})

  for (const [id, campo] of [['cmIdioma', 'idioma'], ['cmVariante', 'variante']]) {
    $(id)?.addEventListener('change', (e) => {
      estado[campo] = e.target.value
      if (campo === 'idioma') {
        // Elegido a mano, ya no es «el de tu copia» (lo pone montarAcciones).
        if (!e.detail?.deTuCopia) {
          estado.deTuCopia = false
          recordarIdioma(estado.idioma)
        }
      }
      pintarPrecio()
      if (campo === 'idioma') repintarHistorial?.()
    })
  }

  pintarQuienLaDa(carta)

  // ── Las acciones bajo la carta ──
  const sesion = await getSession().catch(() => null)
  montarAcciones(carta, sesion, { idiomas, variantes: variantesParaAnadir, seSabe, estado, precioActual: () => precioParaIdioma(ultimoPrecio, estado.idioma)?.valor ?? null })
}

// LAS ACCIONES, COMO EN EL POP-UP (916, la ficha de Dex de la 915): bajo la
// carta, «− Tienes N +» —el «+» suma otra igual con Deshacer; sin copias es
// el botón grande «Añadir a mi colección»— y a su lado el corazón y
// compartir, en redondo. Van DENTRO del `figure` para que en escritorio
// acompañen a la carta, que es pegajosa; en el móvil son la barra de abajo.
// «Avísame si baja» va con el precio, que es de lo que avisa.
function montarAcciones(carta, sesion, { idiomas, variantes, seSabe = true, estado, precioActual }) {
  const figura = document.querySelector('#cartaNucleo .carta-scan')
  if (!figura || $('cartaAcciones')) return
  const volver = `/auth.html?volver=${encodeURIComponent(location.pathname)}`
  const buscarla = `/mi-coleccion?ver=buscar&q=${encodeURIComponent(nombreDeCarta(carta) || carta.name || '')}`
  const redondos = `<span class="carta-redondos">${sesion ? `<button type="button" class="mc-ficha-redondo mc-ficha-quiero hidden" id="cmQuiero" aria-pressed="false" title="La quiero"><i aria-hidden="true">${laQuiero.corazon(20)}</i><span class="sr-only">La quiero</span></button>` : ''}<button type="button" class="mc-ficha-redondo" id="cmCompartir" title="Compartir" aria-label="Compartir la carta"><i aria-hidden="true">${icons.share(20)}</i></button></span>`
  figura.insertAdjacentHTML('beforeend', sesion
    ? `<div class="carta-acciones mc-sin-copias" id="cartaAcciones">
        <span class="carta-pasos">
          <button type="button" class="mc-paso hidden" id="cmMenos" aria-label="Una copia menos">−</button>
          <a class="mc-paso-centro hidden" id="cmEditar" href="${escapeHtml(buscarla)}"><b id="cmTienes"></b><span>Editar</span></a>
          <button type="button" class="mc-paso mc-ficha-mas" id="cmAnadir" aria-label="Añadir a mi colección"><i aria-hidden="true">+</i><span class="mc-mas-texto">Añadir a mi colección</span></button>
        </span>
        ${redondos}
      </div><button type="button" class="mc-enlace-chico carta-anadir-otra hidden" id="cmAnadirOtra"><i aria-hidden="true">+</i><span>Añadir otra copia<span class="carta-otra-largo"> (otro idioma, estado…)</span></span></button>`
    : `<div class="carta-acciones mc-sin-copias" id="cartaAcciones">
        <span class="carta-pasos"><a class="mc-paso mc-ficha-mas" href="${escapeHtml(volver)}"><i aria-hidden="true">+</i><span class="mc-mas-texto">Añadir a mi colección</span></a></span>
        ${redondos}
      </div>`)
  $('cmAvisoSitio')?.insertAdjacentHTML('beforeend', sesion
    ? `<button type="button" class="mc-enlace-chico" id="cmAviso" data-aviso="${escapeHtml(carta.id)}"><i aria-hidden="true">${icons.bell(16)}</i><span>Avísame si baja</span></button>`
    : `<a class="mc-enlace-chico" href="${escapeHtml(volver)}"><i aria-hidden="true">${icons.bell(16)}</i><span>Avísame si baja</span></a>`)
  // Compartir la carta en una imagen (733, X7): con su precio y, si es
  // tuya, «La tengo». El módulo del lienzo entra al pulsar.
  $('cmCompartir')?.addEventListener('click', async () => {
    const boton = $('cmCompartir')
    boton.disabled = true
    try {
      const { compartirCarta } = await import('./carta-imagen.js')
      // Sin cuenta, `mias` ni existe (se declara más abajo, tras el
      // `return`): no se lee.
      const tengo = sesion ? mias.reduce((n, l) => n + (Number(l.cantidad) || 0), 0) : null
      await compartirCarta({ carta, valor: precioActual(), tengo })
    } finally {
      boton.disabled = false
    }
  })
  if (!sesion) return

  engancharAvisos($('cmAvisoSitio'), () => ({ market: carta.market || MERCADO, idioma: estado.idioma, precio: precioActual() }))

  // «La quiero» (751): el corazón sale cuando se sabe si la quieres; sin
  // poder preguntarlo (sin la migración de los cambios) no sale.
  let deseos = null
  deseosDeCarta(sesion.user.id, carta.id).then((filas) => {
    deseos = filas
    laQuiero.pintarLoseta($('cmQuiero'), carta.id, deseos)
  }).catch(() => {})
  $('cmQuiero')?.addEventListener('click', async () => {
    const b = $('cmQuiero')
    if (!Array.isArray(deseos)) return
    // El corazón cambia ya (899); si la base dice que no, vuelve.
    try {
      deseos = await laQuiero.alternar({ userId: sesion.user.id, cardId: carta.id, deseos, carta, alCambiar: (d) => laQuiero.pintarLoseta(b, carta.id, d) })
    } catch (err) {
      showToast(err.message, err.yaEstaba ? 'info' : 'error')
    }
    laQuiero.pintarLoseta(b, carta.id, deseos)
  })

  // Lo que tienes de ella: «Tienes N», la copia que suma el «+» y el idioma
  // de la primera tarjeta de precio. Se vuelve a pedir al guardar.
  let mias = []
  let idiomaPuesto = false
  const refrescarTengo = async () => {
    try {
      mias = await lineasDeCarta(sesion.user.id, carta.id)
    } catch {
      // Sin la migración no hay colección: el botón lo dirá al pulsarlo.
      mias = []
    }
    const n = mias.reduce((a, l) => a + (Number(l.cantidad) || 0), 0)
    const con = n > 0
    $('cartaAcciones').classList.toggle('mc-sin-copias', !con)
    $('cmEditar')?.classList.toggle('hidden', !con)
    $('cmMenos')?.classList.toggle('hidden', !con)
    $('cmAnadirOtra')?.classList.toggle('hidden', !con)
    const tienes = $('cmTienes')
    if (tienes) tienes.textContent = con ? `Tienes ${n}` : ''
    const mas = $('cmAnadir')
    mas.setAttribute('aria-label', con ? 'Una copia más, igual que la tuya' : 'Añadir a mi colección')
    mas.title = con ? 'Una copia más, igual que la tuya' : 'Añadir a mi colección'
    // La primera tarjeta es la de TU copia (915), una vez: si luego eliges
    // otro idioma, manda lo elegido.
    const primera = laQueSuma()
    if (primera && !idiomaPuesto && idiomas.some((i) => i.id === primera.idioma)) {
      idiomaPuesto = true
      estado.deTuCopia = true
      const sel = $('cmIdioma')
      if (sel) {
        sel.value = primera.idioma
        sel.dispatchEvent(new CustomEvent('change', { detail: { deTuCopia: true } }))
      }
    }
  }
  // La copia que suma o resta el «− +»: la de la versión que miras, o la
  // primera. Con varias distintas, «Tienes N» lleva a todas.
  const laQueSuma = () => mias.find((l) => (l.variante || 'normal') === estado.variante && l.idioma === estado.idioma) || mias.find((l) => (l.variante || 'normal') === estado.variante) || mias[0] || null
  const tengoListo = refrescarTengo()

  const pasar = async (paso) => {
    const l = laQueSuma()
    if (!l) return
    const antes = Number(l.cantidad) || 0
    const total = mias.reduce((a, x) => a + (Number(x.cantidad) || 0), 0)
    if (antes + paso <= 0) {
      if (!window.confirm('¿Quitar esta carta de tu colección? No se puede deshacer.')) return
    }
    // Cambia ya (896) y se confirma después; si la base dice que no, vuelve.
    $('cmTienes').textContent = `Tienes ${Math.max(0, total + paso)}`
    try {
      if (antes + paso <= 0) await borrar(l.id)
      else await actualizar(l.id, { cantidad: antes + paso })
    } catch (err) {
      showToast(err.message || 'No se ha podido guardar.', 'error')
      await refrescarTengo()
      return
    }
    await refrescarTengo()
    if (paso < 0) return
    const { avisoConDeshacer } = await import('./mi-coleccion/deshacer.js')
    avisoConDeshacer({
      html: `<span><b>${escapeHtml(nombreDeCarta(carta) || carta.name || '')}</b>: una más · ya tienes ${total + paso}</span>`,
      alDeshacer: async () => {
        try {
          await actualizar(l.id, { cantidad: antes })
          showToast(`Deshecho: ${nombreDeCarta(carta)} vuelve a como estaba.`, 'success')
        } catch (err) {
          showToast(err.message || 'No se ha podido deshacer.', 'error')
        }
        await refrescarTengo()
      },
    })
  }
  const abrir = () => abrirAnadir(carta, sesion, { idiomas, variantes, seSabe, mias, alGuardar: refrescarTengo })
  $('cmAnadir').addEventListener('click', () => (laQueSuma() ? pasar(1) : abrir()))
  $('cmMenos').addEventListener('click', () => pasar(-1))
  $('cmAnadirOtra').addEventListener('click', abrir)
  // Mayús+Intro en la paleta (718) llega con #anadir: el diálogo se abre
  // solo, ya sabiendo lo que tienes (si no, diría «añadir» de una que ya
  // es tuya). Se quita de la dirección para que recargar no lo reabra.
  if (location.hash === '#anadir') {
    history.replaceState(null, '', location.pathname + location.search)
    tengoListo.finally(abrir)
  }
}

// ── El diálogo de añadir (la misma pieza que en /mi-coleccion, 650) ──
//
// La hoja corta de añadir (748, la C5 de su maqueta): LA MISMA que la de
// Mi colección —mismas clases, misma forma—, para que añadir una carta se
// vea igual vengas de donde vengas. Sin paso de «Ya en tu colección»: lo
// que ya tienes lo dice la cabecera. Se monta una vez y se rellena en cada
// apertura.
let idiomasDeLaHoja = []
// La lista «¿Cuál tienes?» de la hoja (922), montada con la hoja.
let eleccionDeVersion = null
function chipsDeAnadir(idiomas, puesto) {
  return idiomas.map((i) => chipDeIdiomaHtml(i, i.id === puesto)).join('')
}
function rotularGuardarCarta() {
  const n = Math.max(1, Math.min(999, Math.round(Number($('cmAdCantidad')?.value) || 1)))
  $('cmAdGuardar').textContent = `Añadir ${n} ${n === 1 ? 'copia' : 'copias'}`
}
function dialogoDeAnadir() {
  let d = $('cmAdDialogo')
  if (d) return d
  document.body.insertAdjacentHTML('beforeend', `
    <dialog class="mc-bandeja mc-anadir-dialogo" id="cmAdDialogo" aria-labelledby="cmAdNombre">
      <form class="mc-ad-form" id="cmAdForm">
        <button type="button" class="mc-ad-tirador" id="cmAdCerrar" aria-label="Cerrar"></button>
        <div class="mc-ad-cabeza">
          <div class="mc-ad-carta" id="cmAdCarta"></div>
          <div class="mc-ad-cabeza-texto">
            <h2 class="mc-ad-nombre" id="cmAdNombre"></h2>
            <p class="mc-ad-set" id="cmAdSet"></p>
            <p class="mc-ad-tienes hidden" id="cmAdTienes"></p>
          </div>
        </div>
        <fieldset class="mc-ad-idiomas-caja">
          <legend>Idioma</legend>
          <div class="mc-idioma-chips" id="cmAdIdiomas" role="radiogroup" aria-label="Idioma de la copia"></div>
        </fieldset>
        <div class="vp-lista" id="cmAdElegir" hidden></div>
        <div class="vp-fija" id="cmAdVersionFija" hidden></div>
        <div class="mc-ad-campo"><span class="mc-ad-rotulo">Estado</span> <select id="cmAdEstado"></select></div>
        <div class="mc-ad-campo hidden" id="cmAdVarianteLabel"><span class="mc-ad-rotulo">Versión</span> <select id="cmAdVariante"></select></div>
        <div class="mc-ad-fila">
          <span class="mc-contador-mando">
            <button type="button" class="mc-contador-btn" data-paso="-1" aria-label="Una copia menos">−</button>
            <input type="number" id="cmAdCantidad" min="1" max="999" value="1" inputmode="numeric" aria-label="Copias" />
            <button type="button" class="mc-contador-btn" data-paso="1" aria-label="Una copia más">+</button>
          </span>
          <input type="text" id="cmAdCompra" inputmode="decimal" placeholder="Lo que pagaste (€)" aria-label="Lo que pagaste por copia (€), opcional" />
        </div>
        <button type="submit" class="btn-primary mc-ad-guardar" id="cmAdGuardar">Añadir 1 copia</button>
      </form>
    </dialog>`)
  d = $('cmAdDialogo')
  $('cmAdCerrar').addEventListener('click', () => d.close())
  d.addEventListener('click', (e) => { if (e.target === d) d.close() })
  $('cmAdIdiomas').addEventListener('click', (e) => {
    const chip = e.target.closest('.mc-idioma-chip')
    if (chip) $('cmAdIdiomas').innerHTML = chipsDeAnadir(idiomasDeLaHoja, chip.dataset.idioma)
  })
  segmentar($('cmAdEstado'), { etiqueta: 'Estado de la copia', corto: (o) => o.value })
  segmentar($('cmAdVariante'), { etiqueta: 'Versión de la copia' })
  // La versión se elige antes (922): la lista o la fila, encima del resto.
  eleccionDeVersion = montarEleccion({ form: $('cmAdForm'), select: $('cmAdVariante'), lista: $('cmAdElegir'), fija: $('cmAdVersionFija') })
  // El contador: suma sobre lo escrito y no baja de una copia (396).
  for (const b of d.querySelectorAll('.mc-contador-btn')) {
    b.addEventListener('click', () => {
      const campo = $('cmAdCantidad')
      const n = Math.round(Number(campo.value) || 0) + Number(b.dataset.paso)
      campo.value = String(Math.max(1, Math.min(999, n)))
      rotularGuardarCarta()
    })
  }
  $('cmAdCantidad').addEventListener('input', rotularGuardarCarta)
  return d
}

function abrirAnadir(carta, sesion, { idiomas, variantes, seSabe = true, mias, alGuardar }) {
  const d = dialogoDeAnadir()
  const set = carta.tcg_sets || null
  const escaneo = atributosDeEscaneo(cadenaDeEscaneo(carta, set?.tcg_online_code))
  $('cmAdCarta').innerHTML = escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="eager" />` : ''
  $('cmAdNombre').textContent = nombreDeCarta(carta)
  $('cmAdSet').textContent = [nombreDeSet(set) || carta.set_id, carta.local_id].filter(Boolean).join(' · ')
  const copias = mias.reduce((n, l) => n + (Number(l.cantidad) || 0), 0)
  $('cmAdTienes').textContent = copias ? `Ya tienes ${copias}` : ''
  $('cmAdTienes').classList.toggle('hidden', !copias)
  // El formulario, preparado: el idioma que se recuerda, el estado por
  // defecto, las versiones de ESTA carta (con una sola no hay que elegir).
  // Los idiomas: los del catálogo de la carta —una japonesa no se apunta en
  // español— y, cuando la base lo diga, los de su set (911).
  const market = carta.market || MERCADO
  const base = idiomasParaAnadirEn(market, idiomas, null)
  idiomasDeLaHoja = base
  $('cmAdIdiomas').innerHTML = chipsDeAnadir(base, idiomaRecordado(base))
  void idiomasDeSet(carta.set_id, market).then((delSet) => {
    if (!delSet || !d.open) return
    const lista = idiomasParaAnadirEn(market, idiomas, delSet)
    const puesto = $('cmAdIdiomas').querySelector('.mc-idioma-chip.activo')?.dataset.idioma
    idiomasDeLaHoja = lista
    $('cmAdIdiomas').innerHTML = chipsDeAnadir(lista, lista.some((i) => i.id === puesto) ? puesto : idiomaRecordado(lista))
  })
  $('cmAdEstado').innerHTML = opciones(ESTADOS, ESTADO_POR_DEFECTO)
  // `varianteDe` sabe también de las versiones de TCGGO (862).
  const vs = variantes.map((id) => varianteDe(id))
  $('cmAdVariante').innerHTML = opciones(vs, vs.some((v) => v.id === 'normal') ? 'normal' : vs[0]?.id)
  const deEsa = (id) => mias.filter((l) => (l.variante || 'normal') === id).reduce((n, l) => n + (Number(l.cantidad) || 0), 0)
  eleccionDeVersion?.abrir({ versiones: vs, seSabe, tienes: deEsa })
  $('cmAdCantidad').value = '1'
  $('cmAdCompra').value = ''
  $('cmAdGuardar').disabled = false
  rotularGuardarCarta()

  $('cmAdForm').onsubmit = async (e) => {
    e.preventDefault()
    const boton = $('cmAdGuardar')
    boton.disabled = true
    const idioma = $('cmAdIdiomas').querySelector('.mc-idioma-chip.activo')?.dataset.idioma || idiomasDeLaHoja[0]?.id
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
      <p class="subtext">Apunta esta carta en tu <a href="/mi-coleccion?ver=quiero">lista de búsqueda</a> y te avisamos cuando alguien más la dé. Lo que da todo el mundo, en el <a href="/mi-coleccion?ver=mercado">Mercado</a>.</p>`
    caja.classList.remove('hidden')
  } catch {
    // Sin migración o sin red: la ficha se queda como estaba.
  }
}
