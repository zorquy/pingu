// EL PANEL DE MI COLECCIÓN, aparte (tanda 895, R4 de «Rápida y limpia»).
//
// El resumen, los vistazos, las que más se mueven, el cambio del mes y el
// valor en el tiempo: solo los ve quien abre el Panel de SU colección, y
// /cartas (el catálogo público, la misma pantalla) los bajaba enteros.
// Entran por import() la primera vez que hacen falta. El estado de la
// pantalla llega en `ctx` (getters y setters de mi-coleccion.js: cambia
// mientras se usa) y se lee siempre a través de él.
import { escapeHtml } from '../app.js'
import { rutaDeCarta } from '../carta-ruta.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from '../escaneo-carta.js'
import { rarezaDeCarta } from '../carta-traducciones.js'
import { padreDeColeccion, registrarEpisodios, nombreDeSet, eraDeSet } from '../catalogo-series.js'
import { euros, valorDeLinea, idiomaDe, precioDeFila, valorDe } from '../cardmarket.js'
import { cabeceraDeVistaHtml, engancharVolver } from './movimientos.js'
import { icons, icon } from '../icons.js'
import { botonOcultarHtml } from './valor-oculto.js'
import * as datos from './datos.js'
import { diapoHtml, tiraHtml } from './diapos.js'
import { balanceDeCompra } from './balance.js'
import { porcentaje } from './progreso-set.js'

const $ = (id) => document.getElementById(id)

// Lo compartido con mi-coleccion.js llega aquí (ver `ctxPanel` allí).
let ctx = null
export function montar(c) {
  ctx = c
}

let quiereImportar = new URLSearchParams(location.search).get('importar') === '1'

// La entrada del Panel, una vez por bloque (1225, PINGU: «carga y después
// como que carga otra vez para pintar otra vez los números»). El Panel se
// pinta varias veces —lo de la última vez, lo de ahora, los productos al
// llegar— y cada vez los bloques entraban, la cifra se calculaba y la gráfica
// se dibujaba otra vez. Ahora entra solo lo que NO estaba ya en pantalla
// (`mc-sin-entrada` a lo que repite): lo nuevo sigue entrando, que es lo que
// hace que aparecer no se lea como un salto.
let graficaDibujada = false
const SIN_ENTRADA = 'mc-sin-entrada'

export function pintarResumenPanel() {
  const caja = $('mcResumenPanel')
  if (!caja) return
  // Con la última vista pintada (894) y la colección aún por llegar, no se
  // pisa con el «todavía no has añadido ninguna carta» de antes de cargar:
  // los puentes de la 895 llegan en diferido, después de la caché.
  if (!ctx.panelFiable && caja.dataset.ultimaVista) return
  // Ya se veía (la de la última vez o una pintada anterior): ni entra ni
  // vuelve a calcular la cifra (1225).
  const yaSeVeia = !!caja.querySelector('.mc-cartera')
  delete caja.dataset.ultimaVista
  const [ls, clave, busca] = ctx.pTodo()
  if (!ls.length) {
    // UN ESTADO VACÍO CON UNA ACCIÓN (tanda 581). Era una frase gris; es
    // la primera pantalla de quien se acaba de registrar, y una frase
    // gris no lleva a ninguna parte.
    caja.innerHTML = `<section class="mc-vacio">
      <span class="mc-vacio-icono" aria-hidden="true">${icons.cards(40)}</span>
      <h2 class="mc-vacio-titulo">Tu colección está vacía</h2>
      <p class="mc-vacio-texto">Apunta tus cartas y aquí verás cuántas tienes, cuánto valen y qué te falta de cada expansión.</p>
      <div class="mc-vacio-acciones">
        <a class="btn-primary" href="/mi-coleccion?ver=buscar">Buscar y añadir una carta</a>
        <button type="button" class="btn-secondary mc-importar-abrir">Importar un CSV</button>
      </div>
    </section>`
    return
  }
  const valiosasTira = ctx.masValiosas(DE_VISTAZO, ls, clave, busca)

  // Arriba, solo la gráfica: es la ÚNICA cifra que cambia sola y es a
  // lo que se entra (la lección de la 416). Las listas de números van
  // debajo de tus cartas y plegadas, en #mcMasEstadisticas.
  caja.innerHTML = `
    <!-- LA GRÁFICA, A LA VISTA (tanda 416). La 410 la metió detrás de
         «Ver todas las estadísticas» para que el panel no fuera tan
         largo, y PINGU: «¿y dónde está el gráfico de precios? No
         existe». Tenía razón: es la ÚNICA cifra que cambia sola, y es la
         que se viene a mirar. Escondida detrás de un botón, no existe.
         Lo que sigue detrás del botón es lo demás, que son listas. -->
    <!-- LA CARTERA (748, la C1 de su maqueta). La cifra grande sale YA,
         de lo que hay en memoria; la gráfica llega después a un hueco que
         mide lo mismo que ella, así que nada salta. Las tres fichas y lo
         que más se mueve van debajo, como en cualquier app de cartera. -->
    <section class="mc-cartera" id="mcValorCaja">
      <h2 class="mc-cartera-etiqueta">Lo que vale ${ctx.esMia ? 'tu' : 'esta'} colección ${botonOcultarHtml()}</h2>
      <p class="mc-cartera-cifra">${escapeHtml(ctx.eurosConMiles(ctx.valorDeAhora()))}</p>
      ${abanicoDeCartera(valiosasTira)}
      ${ctx.fichasDeCartera()}
      ${ctx.esMia ? '<div class="mc-cartera-reparto hidden" id="mcCarteraReparto"></div>' : ''}
      <div class="mc-cartera-grafica" id="mcCarteraGrafica" aria-busy="true">
        <p class="mc-valor-cambio igual"><span class="skeleton mc-cartera-esq-cambio"></span></p>
        <div class="skeleton mc-cartera-esq-lienzo"></div>
        <div class="mc-valor-rangos" aria-hidden="true">${'<span class="skeleton mc-cartera-esq-rango"></span>'.repeat(5)}</div>
      </div>
    </section>
    ${vistazoDeValiosas(valiosasTira)}
`
  if (ctx.esMia && ctx.sesion) void ctx.pintarRepartoProductos()
  // La cifra cuenta desde la de la última vez (783, MV2).
  const cifraPanel = document.querySelector('#mcValorCaja .mc-cartera-cifra')
  if (yaSeVeia) caja.querySelector('.mc-cartera')?.classList.add(SIN_ENTRADA)
  if (ctx.esMia && cifraPanel && !yaSeVeia) import('../contar.js').then(({ contarCifra, calcularCifra }) => {
    contarCifra(cifraPanel, 'valor', ctx.valorDeAhora(), ctx.eurosConMiles)
    // Las cuentas pequeñas de debajo también se calculan (1217).
    for (const b of document.querySelectorAll('#mcValorCaja .mc-cartera-sub b')) calcularCifra(b, b.textContent)
  }).catch(() => {})

  // Las estadísticas van en «Más» (1176): el hueco de antes queda vacío.
  const mas = $('mcMasEstadisticas')
  if (mas) mas.innerHTML = ''
  // La gráfica es una consulta y llega cuando llega: el resto del panel
  // sale de lo que ya está en memoria y no la espera.
  pintarValorEnElTiempo()
}

// ── LA VISTA ESTADÍSTICAS (1172, P4) ──
//
// Lo que desde la 440 vivía plegado detrás de «Ver todas» (las diapositivas
// y las cuatro cajas), con dirección propia (`?ver=estadisticas`) y dos
// repartos que faltaban: por IDIOMA y por ERA. Las expansiones se piden
// (`cargarSetsDeTodos`) porque la era está en el set y no en la carta.
export async function pintarEstadisticas() {
  const panel = $('mcPanelEstadisticas')
  if (!panel || !ctx.esMia) return
  const [ls, clave, busca] = ctx.pTodo()
  if (!ls.length) {
    panel.innerHTML = `${cabeceraDeVistaHtml('Estadísticas')}<p class="empty-state">Todavía no has añadido ninguna carta.</p>`
    engancharVolver(panel, ctx)
    return
  }
  // LO QUE DAS, y no «las repetidas» (propuesta de noviembre, PINGU: «tengo
  // una normal y una reverse y pone que está repetida. No está repetida»).
  // Contar copias por id llamaba repetida a dos versiones, dos idiomas o dos
  // estados; lo que de verdad te sobra es lo que TÚ marcas para cambio.
  const doy = loQueDas(busca)
  const dasCopias = doy.reduce((n, d) => n + d.das, 0)
  const valiosas = ctx.masValiosas(3, ls, clave, busca)
  const porRareza = ctx.repartoPor((c) => rarezaDeCarta(c), ls, clave, busca)
  panel.innerHTML = `${cabeceraDeVistaHtml('Estadísticas')}
    <div class="mc-estadisticas" id="mcEstadisticas">
      <div class="mc-diapos">
      ${
        valiosas.length
          ? diapoHtml('Las que más valen', `<ul class="mc-diapo-lista">${valiosas
              .map((v) => `<li><span>${escapeHtml(ctx.nombreDe(v.carta))}</span><strong>${escapeHtml(euros(v.valor))}</strong></li>`)
              .join('')}</ul>`)
          : ''
      }
      ${diapoDelBalance()}
      ${diapoHtml('Lo que das', `
        <p class="mc-diapo-cifra">${dasCopias.toLocaleString('es-ES', { useGrouping: 'always' })}</p>
        <p class="mc-diapo-pie">${dasCopias === 1 ? 'copia para cambio' : 'copias para cambio'}${doy.length ? `, de ${doy.length} ${doy.length === 1 ? 'carta' : 'cartas'}` : ''}</p>
        ${
          doy.length
            ? `<ul class="mc-diapo-lista">${doy
                .slice(0, 3)
                .map((d) => `<li><span>${escapeHtml(ctx.nombreDe(d.carta))}</span><strong>×${d.das}</strong></li>`)
                .join('')}</ul>`
            : '<p class="subtext">Todavía no das ninguna.</p>'
        }`)}
      ${diapoHtml('Por rareza', porRareza.length
        ? ctx.barrasHtml(porRareza.slice(0, 5))
        : '<p class="subtext">Tus cartas todavía no tienen rareza guardada.</p>')}
      </div>
      <div class="mc-resumen-rejilla">
        <section class="mc-resumen-caja">
          <h3>Lo que das</h3>
          ${
            doy.length
              ? `<p class="subtext">Das <strong>${dasCopias}</strong> ${dasCopias === 1 ? 'copia' : 'copias'} de ${doy.length} ${doy.length === 1 ? 'carta' : 'cartas'}. ${doy.length === 1 ? 'Sale' : 'Salen'} en el Mercado con tu nombre.</p>
                 <ul class="mc-lista-cartas">${doy.slice(0, 12).map((d) => ctx.filaDeCartaHtml(d.carta, `<strong>das ${d.das}</strong>`)).join('')}</ul>
                 <p><button type="button" class="link-btn" data-ir-a="cambios">Las que doy →</button></p>`
              : '<p class="subtext">Todavía no das ninguna. Lo que te sobra lo decides tú: marca una copia para cambio y di cuántas das.</p>'
          }
        </section>
        <section class="mc-resumen-caja">
          <h3>Lo más valioso</h3>
          ${
            ctx.masValiosas(10, ls, clave, busca).length
              ? `<ul class="mc-lista-cartas">${ctx.masValiosas(10, ls, clave, busca).map((v) => ctx.filaDeCartaHtml(v.carta, `<strong>${euros(v.valor)}</strong>`)).join('')}</ul>
                 <p class="subtext">Por lo que vale UNA copia, no la línea entera.</p>`
              : '<p class="subtext">Todavía no sabemos el precio de ninguna de tus cartas.</p>'
          }
        </section>
        <section class="mc-resumen-caja">
          <h3>Por colección</h3>
          ${ctx.barrasHtml(ctx.repartoPor((c) => nombreDeSet(c?.tcg_sets), ls, clave, busca).slice(0, 10)) || '<p class="subtext">—</p>'}
        </section>
        <section class="mc-resumen-caja">
          <h3>Por rareza</h3>
          ${ctx.barrasHtml(porRareza.slice(0, 10)) || '<p class="subtext">Tus cartas todavía no tienen rareza guardada.</p>'}
        </section>
        <section class="mc-resumen-caja" id="mcEstIdioma">
          <h3>Por idioma</h3>
          ${ctx.barrasHtml(repartoPorIdioma(ls, clave)) || '<p class="subtext">—</p>'}
        </section>
        <section class="mc-resumen-caja" id="mcEstEra">
          <h3>Por era</h3>
          <p class="subtext">Un momento…</p>
        </section>
      </div>
    </div>`
  engancharVolver(panel, ctx)
  // La era llega con las expansiones, que son una consulta (813: de la CDN).
  try {
    const sets = await ctx.cargarSetsDeTodos()
    const caja = $('mcEstEra')
    if (!caja || ctx.pestania !== 'estadisticas') return
    const porEra = ctx.repartoPor((c) => eraDeCarta(c, sets), ls, clave, busca).slice(0, 10)
    caja.innerHTML = `<h3>Por era</h3>${ctx.barrasHtml(porEra) || '<p class="subtext">Tus cartas todavía no tienen era: la estantería no ha llegado.</p>'}`
  } catch {
    const caja = $('mcEstEra')
    if (caja) caja.innerHTML = '<h3>Por era</h3><p class="subtext">No se ha podido leer la estantería.</p>'
  }
}

// Lo que das para cambio, agrupado por carta: las líneas con `cambio > 0`
// (`ctx.loQueDoy`), sumadas, con su carta, las que más das primero.
function loQueDas(busca) {
  const por = new Map()
  for (const l of ctx.loQueDoy()) {
    const c = busca(l)
    if (!c) continue
    const d = por.get(c.id) || { carta: c, das: 0 }
    d.das += Number(l.cambio) || 0
    por.set(c.id, d)
  }
  return [...por.values()].sort((a, b) => b.das - a.das)
}

// Cuántas cartas DISTINTAS en cada idioma (la misma cuenta que
// `repartoPor`, pero el idioma está en la LÍNEA, no en la carta).
export function repartoPorIdioma(ls, clave) {
  const vistas = new Map()
  for (const l of ls || []) {
    const k = `${l.idioma || 'es'}|${clave(l)}`
    if (!vistas.has(k)) vistas.set(k, l.idioma || 'es')
  }
  const cuenta = new Map()
  for (const idioma of vistas.values()) cuenta.set(idioma, (cuenta.get(idioma) || 0) + 1)
  return [...cuenta.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => [idiomaDe(id)?.nombre || id, n])
}

function eraDeCarta(c, sets) {
  if (!c) return ''
  const m = c.market || 'WEST'
  const s = (sets || []).find((x) => x.id === c.set_id && (x.market || 'WEST') === m) || c.tcg_sets
  return eraDeSet(s) || s?.serie_id || ''
}

// Una tarjeta de la tira. Todas iguales por fuera: lo que cambia es lo
// que llevan dentro, y así la tira se lee como una tira y no como cuatro
// cajas distintas puestas en fila.
// ── Lo que te costó (tanda 428) ──
//
// Un balance solo vale sobre las MISMAS cartas en los dos lados. Si se
// compara lo pagado —que solo se sabe de donde lo hayas apuntado— con el
// valor de la colección entera, sale una ganancia inventada.
//
// Y dice SOBRE CUÁNTAS es: «+12,40 €» sin saber si es de tres cartas o de
// trescientas no es un dato, es un número suelto.
function diapoDelBalance() {
  // De toda la colección (tanda 485): «si vas ganando» no es una pregunta
  // sobre un catálogo, y lo que pagaste por una carta japonesa lo pagaste.
  const b = balanceDeCompra(ctx.lineasTodo.length ? ctx.lineasTodo : ctx.lineas, (l) => valorDeLinea(l, ctx.precioDe(l)))
  if (!b.hayBalance) {
    return diapoHtml('Lo que te costó', `
      <p class="subtext">Apunta lo que pagaste por una carta —al editarla, «Lo que pagaste»— y aquí te decimos si vas ganando.</p>`)
  }
  // Redondeado a céntimos ANTES de decidir el signo: una diferencia de
  // 0,004 € es «ni ganas ni pierdes», y un «+0,00 €» con el signo puesto
  // se lee como una ganancia que no existe.
  const dif = Math.round(b.diferencia * 100) / 100
  // «en las 1 carta» no lo escribe nadie: con una se dice de otra manera.
  const cuantas = b.copias === 1
    ? 'la única carta en la que apuntaste lo que pagaste'
    : `las ${b.copias.toLocaleString('es-ES', { useGrouping: 'always' })} cartas en las que apuntaste lo que pagaste`
  const clase = dif === 0 ? '' : dif > 0 ? ' mc-gana' : ' mc-pierde'
  // El signo delante, que es lo que lee quien no distingue el verde del
  // rojo: el color nunca va solo.
  const signo = dif === 0 ? '' : dif > 0 ? '+' : '−'
  return diapoHtml('Lo que te costó', `
    <p class="mc-diapo-cifra${clase}">${signo}${escapeHtml(euros(Math.abs(dif)))}</p>
    <p class="mc-diapo-pie">${dif === 0 ? 'ni ganas ni pierdes, ' : ''}en ${escapeHtml(cuantas)}</p>
    <dl class="mc-diapo-datos">
      <div><dt>Pagaste</dt><dd>${escapeHtml(euros(b.pagado))}</dd></div>
      <div><dt>Valen</dt><dd>${escapeHtml(euros(b.valor))}</dd></div>
    </dl>
    ${
      // Las que tienen precio de compra pero no de mercado se dicen, no se
      // cuentan como cero: un cero diría que no valen nada, y lo que pasa
      // es que no se sabe.
      b.sinValorar
        ? `<p class="subtext">${b.sinValorar} ${b.sinValorar === 1 ? 'carta más tiene' : 'cartas más tienen'} precio de compra pero todavía no de mercado, así que ${b.sinValorar === 1 ? 'no entra' : 'no entran'} en la cuenta.</p>`
        : ''
    }`)
}

// `diapoHtml` y `tiraHtml` se mudaron a `js/mi-coleccion/diapos.js` en la
// tanda 476: la Pokédex tenía su propio molde de tarjeta de datos
// (`.mc-pdx-caja`) y dos moldes para el mismo objeto se separan.

// ── Los vistazos del panel (tanda 436) ──
//
// PINGU, con el panel de Dex delante: «que el panel se asemeje más a lo
// que existe en Dex, cogiendo la información de las otras pestañas». Eso
// es lo que son: un asomo de cada pestaña con su «ver todas», para que el
// panel sea una PORTADA de la colección y no una pestaña más.
//
// Lo que ya está en memoria se pinta al momento; lo que son consultas
// —las expansiones y las carpetas— llega después, igual que la gráfica. Y
// se piden una sola vez por visita.
const DE_VISTAZO = 8

// El rótulo del enlace se puede cambiar (tanda 451): «Ver todas» vale
// para cartas y para expansiones, pero debajo de «Cambios» suena a que
// hay una lista de cambios que ver, y lo que hay es una pantalla donde se
// hacen. Un enlace dice a dónde lleva o no sirve de nada.
// Cada bloque con su icono en el color de la sección (1214, «cabeceras con
// icono de color», como los bloques de la portada).
const ICONO_DE_BLOQUE = { Movimientos: 'trendingUp', Ranking: 'trophy', 'Últimas añadidas': 'clock', Expansiones: 'layers', Álbumes: 'folder' }

function vistazoHtml(titulo, pestana, dentro, rotulo = 'Ver todas') {
  const ico = ICONO_DE_BLOQUE[titulo] && icons[ICONO_DE_BLOQUE[titulo]] ? `<span class="cab-bloque-ico" aria-hidden="true">${icons[ICONO_DE_BLOQUE[titulo]](16)}</span>` : ''
  return `<section class="mc-vistazo">
    <div class="mc-vistazo-cabecera">
      <h2 class="mc-subtitulo">${ico}${escapeHtml(titulo)}</h2>
      <button type="button" class="link-btn ver-todo" data-ir-a="${escapeHtml(pestana)}">${escapeHtml(rotulo)} <span class="ver-todo-flecha" aria-hidden="true">→</span></button>
    </div>
    ${dentro}
  </section>`
}

// Tus tres cartas que más valen, en abanico a la derecha de la cartera
// (1215, de la propuesta del repaso: «la cartera como banda, con tres cartas
// tuyas en abanico»). Solo dibujo: lo que valen ya lo dice el Ranking de
// debajo. Con menos de tres con foto, nada (un abanico a medias parece un
// fallo). En el móvil no sale (mi-coleccion.css).
function abanicoDeCartera(valiosas) {
  const fotos = valiosas.map((v) => (v.carta ? atributosDeEscaneo(cadenaDeEscaneo(v.carta)) : '')).filter(Boolean).slice(0, 3)
  if (fotos.length < 3) return ''
  return `<span class="mc-cartera-abanico" aria-hidden="true">${fotos.map((f) => `<span><img ${f} alt="" width="245" height="342" loading="lazy" /></span>`).join('')}</span>`
}

// Las últimas que has metido, que es lo que se quiere ver al entrar: «¿qué
// añadí el otro día?». Por `created_at` y no por nombre — una lista
// alfabética no cambia nunca y deja de decir nada.
// Y DE TODA LA COLECCIÓN (tanda 485): «lo último que añadí» es la pregunta
// que contesta esta tira, y la carta que acabas de meter no deja de ser lo
// último porque ahora estés mirando otro catálogo. Era justo el caso de
// PINGU: añadir una japonesa, volver al Panel y no verla.
// LAS QUE MÁS VALEN (925, el Panel tipo cartera de Dex): una tira de
// cartas con lo que vale UNA copia debajo, justo bajo la gráfica. Sale de
// lo que ya está en memoria, así que se pinta con la cifra.
function vistazoDeValiosas(valiosas) {
  if (!valiosas.length) return ''
  const cuerpo = valiosas.map((v) => {
    const c = v.carta
    const escaneo = c ? atributosDeEscaneo(cadenaDeEscaneo(c)) : ''
    const nombre = ctx.nombreDe(c)
    // La misma ficha que «Últimas añadidas» (1175, V2): la carta, el dato
    // (lo que vale una copia) y el nombre.
    return `<span class="mc-vistazo-ficha mc-valiosa"><a class="mc-vistazo-carta" href="${escapeHtml(c ? rutaDeCarta(c) : '#')}"${c ? ` data-carta="${escapeHtml(c.id)}"` : ''} aria-label="${escapeHtml(`${nombre}: ${euros(v.valor)}`)}">${
      escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />`
        : `<span class="mc-carta-sinfoto">${escapeHtml(nombre)}</span>`
    }</a><b>${escapeHtml(euros(v.valor))}</b><small>${escapeHtml(nombre)}</small></span>`
  }).join('')
  // Su «Ver todas» abre el RANKING (1171), no la pestaña Cartas: lo que
  // promete el título.
  return vistazoHtml('Ranking', 'ranking', `<div class="mc-vistazo-cartas mc-valiosas">${cuerpo}</div>`)
    .replace('<section class="mc-vistazo">', '<section class="mc-vistazo" id="mcValiosas">')
}

// «hoy», «ayer», «hace 3 días» o el día (1175), para la tira de las
// últimas añadidas. Puro, con `ahora` para probarlo.
export function cuandoDe(iso, ahora = Date.now()) {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const medianoche = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime() }
  const dias = Math.round((medianoche(ahora) - medianoche(t)) / 86_400_000)
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 30) return `hace ${dias} días`
  const d = new Date(t)
  return d.getFullYear() === new Date(ahora).getFullYear()
    ? d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    : d.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
}

function vistazoDeCartas() {
  const [ls, , busca] = ctx.pTodo()
  const ultimas = [...ls]
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    .slice(0, DE_VISTAZO)
  if (!ultimas.length) {
    return vistazoHtml('Últimas añadidas', 'anadidas', '<p class="empty-state">Todavía no has añadido ninguna carta.</p>')
  }
  const cuerpo = ultimas.map((l) => {
    const c = busca(l)
    const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
    const nombre = ctx.nombreDe(c)
    // `data-carta` es lo que hace que se abra la ficha EN LA MISMA PÁGINA
    // (tanda 562): el `href` se queda para el Ctrl+clic, para el «abrir en
    // otra pestaña» del móvil y para cuando no hay JavaScript.
    // Con el dato que esta tira contesta (1175, V2): CUÁNDO la metiste.
    return `<span class="mc-vistazo-ficha"><a class="mc-vistazo-carta" href="${escapeHtml(c ? rutaDeCarta(c) : '#')}"${c ? ` data-carta="${escapeHtml(c.id)}"` : ''} aria-label="${escapeHtml(`${nombre}, ${cuandoDe(l.created_at)}`)}">${
      escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />`
        : `<span class="mc-carta-sinfoto">${escapeHtml(nombre)}</span>`
    }</a><b>${escapeHtml(cuandoDe(l.created_at))}</b><small>${escapeHtml(nombre)}</small></span>`
  }).join('')
  // «Últimas añadidas» y a la vista Añadidas (1172): «Tus cartas» no decía
  // nada que no dijera la pestaña Cartas, y su Ver todas abría esa pestaña.
  return vistazoHtml('Últimas añadidas', 'anadidas', `<div class="mc-vistazo-cartas">${cuerpo}</div>`).replace('<section class="mc-vistazo">', '<section class="mc-vistazo" id="mcUltimas">')
}

// Las expansiones en las que MÁS llevas. No las más nuevas: lo que se
// quiere ver de un vistazo es dónde estás cerca de algo, que es lo mismo
// que decidió la tanda 429 para la Pokédex.
// AQUÍ VIVIÓ «DÓNDE ESTÁS CERCA», de la tanda 440 a la 441, y se va por
// donde se fueron las dos diapositivas repetidas de la 439: PINGU, al
// verlo puesto, «no tiene sentido porque abajo ya están las expansiones».
// Y es el mismo argumento que se usó para quitar aquellas — una pantalla
// que dice lo mismo dos veces con dos formas distintas no dice más, dice
// lo mismo más largo. El vistazo de «Expansiones» de aquí abajo ya enseña
// por dónde vas en cada colección, con su barra y su cuenta.
//
// Queda escrito el criterio por si vuelve en otra parte: se ordenaba por
// CARTAS QUE FALTAN y no por porcentaje, porque un 96 % de un set de 100
// son 4 cartas y un 80 % de uno de 10 son 2 — el porcentaje dice que vas
// mejor en el primero y la verdad es que acabas antes el segundo.

function vistazoDeSets(sets) {
  // GLOBAL desde la 672: se cuentan TUS líneas de todos los catálogos
  // (`lineasTodo`, con su carta en `cartasTodo`), no las del catálogo
  // abierto. Las de los hijos cuentan en el padre (646).
  const lineasBase = ctx.lineasTodo.length ? ctx.lineasTodo : ctx.lineas
  const busca = ctx.lineasTodo.length ? ctx.cartaDeLineaTodo : ctx.cartaDeLinea
  const porSet = new Map()
  for (const l of lineasBase) {
    const c = busca(l)
    if (!c?.set_id || !(Number(l.cantidad) > 0)) continue
    const m = c.market || l.market || ctx.mercado
    const k = `${m}|${padreDeColeccion(c.set_id) || c.set_id}`
    if (!porSet.has(k)) porSet.set(k, new Set())
    porSet.get(k).add(l.card_id)
  }
  const conAlgo = [...porSet.entries()]
    .map(([k, ids]) => {
      const [m, id] = k.split('|')
      const s = (sets || []).find((x) => x.id === id && (x.market || 'WEST') === m)
      return s ? { set: s, tengo: ids.size } : null
    })
    .filter((x) => x && x.tengo > 0)
    // LAS MÁS NUEVAS PRIMERO (tanda 451), no las que tienes más llenas.
    // PINGU: «¿qué ha pasado con las expansiones? ¿Ya no están las más
    // nuevas? Escarlata y Púrpura se ha ido hacia abajo». Ordenaba por
    // CUÁNTAS TIENES, y eso en un vistazo de una sola fila esconde justo
    // lo que acabas de empezar — que es lo que uno viene a mirar. Y además
    // decía una cosa distinta de la pantalla de Expansiones, que ordena
    // por fecha: dos listas de lo mismo en dos órdenes distintos parecen
    // dos webs.
    //
    // Sin fecha va al final y no al principio: lo que no se sabe no puede
    // ser lo más nuevo.
    .sort((a, b) => {
      const fa = Date.parse(a.set?.release_date || '')
      const fb = Date.parse(b.set?.release_date || '')
      if (Number.isFinite(fa) && Number.isFinite(fb)) return fb - fa
      if (Number.isFinite(fa)) return -1
      if (Number.isFinite(fb)) return 1
      return b.tengo - a.tengo
    })
    // SEIS en el DOM, UNA FILA a la vista. PINGU: «muestra cuatro
    // expansiones y no tiene sentido porque son tres columnas máximo;
    // debería estar mostrando tres, igual que tus cartas».
    //
    // Y por eso no se corta a tres aquí: cuántas caben depende del ancho —
    // tres en un escritorio, una en un móvil—, así que un número fijo deja
    // una huérfana en cualquier otro ancho que no sea el que miraste. Se
    // pide UNA FILA en el CSS y las que sobren caen en filas de alto cero.
    // Es exactamente lo que ya hace «Tus cartas» desde la tanda 446.
    .slice(0, 4)
  if (!conAlgo.length) {
    return vistazoHtml('Expansiones', 'album', '<p class="empty-state">Cuando añadas cartas, aquí verás por dónde vas en cada colección.</p>')
  }
  // «Ver todas» abre la estantería ENTERA (tanda 649; el filtro de «solo
  // las empezadas» se quita al llegar, en el manejador del vistazo).
  // PINGU: «cuando le des a ver todas, que no te lleve a solo las
  // empezadas, que te deje ver todas directamente».
  // En FILAS (1175, V3): hasta cuatro, dos por fila en el PC.
  return vistazoHtml('Expansiones', 'album', `<div class="mc-set-filas">${conAlgo.map((x) => ctx.filaDeSetHtml(x.set, x.tengo)).join('')}</div>`).replace('<section class="mc-vistazo">', '<section class="mc-vistazo" id="mcVistazoSets">')
}

// La tarjeta de Cambios del Panel: dos cifras y la puerta. Las dos salen
// de lo que YA está cargado —las líneas de tu colección—, así que no
// cuesta ni una consulta: el Panel es lo primero que se abre y no puede
// quedarse esperando a nadie.
// EN CIFRAS, NO EN PROSA (651). PINGU: «actualizar un poco el panel,
// que se ve demasiado texto, poco botón, poco visual». Dos números y la
// puerta; la explicación de cómo se marca una carta para cambiar vive en
// la pantalla de Cambios, que es donde se hace.
// El icono de descargar, aquí y no en js/icons.js: ese fichero lo baja la
// portada, que no tiene sitio (CLAUDE.md), y esto solo lo usa el Panel.
const ICONO_DESCARGAR = (size) => icon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>', size)

// Desde la 1015 (L7) son CHIPS en una fila y no losetas de 90 px: son cosas
// que se hacen una vez al mes. Los ids se quedan.
// LAS ACCIONES DEL PANEL, EN LOSETAS (651): la imagen para compartir,
// importar y exportar eran dos tarjetas con un párrafo cada una y un
// enlace pequeño. Son tres botones; se pintan como tres botones. Los ids
// se quedan (los manejadores y las pruebas cuelgan de ellos).
// «MÁS» (651 → 1176, V4 de la propuesta de orden): una fila de chips para
// lo que no es un bloque: Estadísticas (su vista, 1172), Imagen, Importar
// CSV, Exportar CSV, Modo evento y la privacidad (el `#mcCompartir` de la
// plantilla, que se MUEVE aquí dentro con sus manejadores, 893). Eran tres
// bloques y 250 px al final del Panel; debajo, la línea de lo contado.
// La pantalla «Cartas» (toda tu colección en una lista) no está en el menú
// desde la 447: se llega desde aquí («Todas tus cartas», 1179) y por
// `?ver=cartas`. Sin este chip, el Panel A no tenía ninguna puerta a ella.
function vistazoDeAcciones() {
  const hay = ctx.lineasTodo.length || ctx.lineas.length
  const loseta = (id, dibujo, texto, extra = '') => `<button type="button" class="mc-accion-loseta" id="${id}"${extra}><span class="mc-accion-icono" aria-hidden="true">${dibujo}</span><span>${texto}</span></button>`
  return `<section class="mc-vistazo mc-vistazo-imagen mc-vistazo-importar" id="mcMas">
      <div class="mc-vistazo-cabecera">
        <h2 class="mc-subtitulo">Más</h2>
      </div>
      <div class="mc-acciones-rejilla">
        ${hay ? loseta('mcVerCartas', icons.cards(18), 'Todas tus cartas', ' data-ir-a="cartas"') : ''}
        ${hay ? loseta('mcVerTodo', icons.barChart(18), 'Estadísticas', ' data-ir-a="estadisticas"') : ''}
        ${hay ? loseta('mcImagenCrear', icons.image(18), 'Imagen') : ''}
        ${loseta('mcImportarAbrir', icons.upload(18), 'Importar CSV')}
        ${loseta('mcExportar', ICONO_DESCARGAR(18), 'Exportar CSV', hay ? '' : ' disabled')}
        <a class="mc-accion-loseta" id="mcModoEvento" href="/evento"><span class="mc-accion-icono" aria-hidden="true">${icons.scan(18)}</span><span>Modo evento</span></a>
      </div>
    </section>`
}

// UNA PILA DE TIRAS (propuesta de noviembre; antes 1177/1178): las tarjetas
// de reojo del móvil y la fila 2 × 2 del PC se fueron. Movimientos y Alertas
// son tiras de cartas con el molde de Ranking y Últimas añadidas
// (`fichaDeTiraHtml`); Cambios y Tu mes, una línea de cifras.
function fichaDeTiraHtml({ carta, dato, cambio = '', nombre, clase = '', etiqueta = '' }) {
  const escaneo = carta ? atributosDeEscaneo(cadenaDeEscaneo(carta)) : ''
  return `<span class="mc-vistazo-ficha${clase ? ` ${clase}` : ''}"><a class="mc-vistazo-carta" href="${escapeHtml(carta ? rutaDeCarta(carta) : '#')}"${carta ? ` data-carta="${escapeHtml(carta.id)}"` : ''} aria-label="${escapeHtml(etiqueta || nombre)}">${
    escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />`
      : `<span class="mc-carta-sinfoto">${escapeHtml(nombre)}</span>`
  }</a><b>${dato}</b>${cambio ? `<em class="mc-ficha-cambio">${cambio}</em>` : ''}<small>${escapeHtml(nombre)}</small></span>`
}

// Cuántas veces se ha pintado el Panel (663): lo que llega tarde de una
// pintada anterior —las movidas, que son una consulta— no se mete en la
// siguiente. Sin esto el bloque salía dos veces.
let vistazosVersion = 0
// Los logros de coleccionista (793, NU9): una vez por visita, con la
// colección que ya está en memoria.
let logrosMirados = false
async function mirarLogrosDeColeccion() {
  if (logrosMirados || !ctx.sesion?.user?.id || !ctx.lineas.length || ctx.modoCatalogo) return
  logrosMirados = true
  const sets = await ctx.cargarSetsDeTodos().catch(() => [])
  const porId = new Map((sets || []).filter((x) => (x.market || 'WEST') === ctx.mercado).map((x) => [x.id, x]))
  const { statsDeColeccion, comprobarLogrosDeColeccion } = await import('../logros-coleccion.js')
  // Las especies que tienes (para las regiones) y tus cambios hechos (798).
  const { especiesDeLaCarta } = await import('./pokedex.js')
  const especies = new Set()
  for (const id of new Set(ctx.lineas.map((l) => l.card_id))) for (const n of especiesDeLaCarta(ctx.cartas.get(id)) || []) especies.add(Number(n))
  // Tus tratos hechos y si ya eres «Muy de fiar» (1224).
  const ch = await import('../cambios-hechos.js').catch(() => null)
  const rep = ch ? await ch.reputacionDe(ctx.sesion.user.id).catch(() => null) : null
  const cambiosHechos = Number(rep?.hechos) || 0
  const muyDeFiar = ch && rep ? ch.nivelDe(rep) === 'muy' : false
  const stats = statsDeColeccion({
    especies,
    cambiosHechos,
    muyDeFiar,
    lineas: ctx.lineas,
    cartaDe: (id) => ctx.cartas.get(id),
    cuantasPorSet: ctx.cuantasPorSet(),
    totalDeSet: (id) => ctx.totalDe(porId.get(id)),
    unidad: (l) => { const v = valorDeLinea(l, ctx.precioDe(l)); return v ? v / (Number(l.cantidad) || 1) : 0 },
  })
  await comprobarLogrosDeColeccion(ctx.sesion.user.id, stats).catch(() => {})
}

export async function pintarVistazos() {
  // Con unos segundos de margen: los precios llegan después de las líneas.
  if (!logrosMirados) setTimeout(() => void mirarLogrosDeColeccion(), 4000)
  const caja = $('mcVistazos')
  if (!caja || !ctx.esMia) return
  // Lo de la última vez (894) se queda hasta que la colección esté cargada.
  if (!ctx.panelFiable && caja.dataset.ultimaVista) return
  // Lo que ya estaba en pantalla no vuelve a entrar (1225): se apunta por id
  // (el esqueleto de Expansiones cuenta como su bloque) y se marca al llegar.
  const habia = new Set([...caja.children].map((c) => c.id.replace(/Esq$/, '')).filter(Boolean))
  if (habia.size) {
    const marcar = (n) => { if (n.id && habia.has(n.id.replace(/Esq$/, ''))) n.classList.add(SIN_ENTRADA) }
    const obs = new MutationObserver((ms) => { for (const m of ms) m.addedNodes.forEach(marcar) })
    obs.observe(caja, { childList: true })
    setTimeout(() => obs.disconnect(), 8000)
  }
  delete caja.dataset.ultimaVista
  const version = ++vistazosVersion
  // Lo de memoria, ya. Lo demás, cuando llegue: el panel es lo primero que
  // se abre y no puede quedarse en blanco esperando a dos consultas.
  caja.innerHTML = vistazoDeCartas()
  // LAS QUE MÁS SE MUEVEN (663), por su cuenta y en su hueco de debajo de
  // las fichas (748): es una consulta al histórico y el Panel no la espera.
  void pintarMovidas(version)
  // El hueco de las expansiones, en esqueleto hasta que lleguen (675).
  caja.insertAdjacentHTML('beforeend', `<section class="mc-vistazo" id="mcVistazoSetsEsq"><div class="mc-vistazo-cabecera"><h2 class="mc-subtitulo">Expansiones</h2></div>${ctx.esqueletoDeSets(2)}</section>`)
  // Los sets y su valor de TODOS los catálogos (672), y el registro de qué
  // set cuelga de cuál con todos ellos en la mano (646).
  const [sets] = await Promise.all([ctx.cargarSetsDeTodos().catch(() => null), ctx.cargarValoresDeSets({ todos: true })])
  if (ctx.pestania !== 'resumen') return
  if (version !== vistazosVersion) return
  registrarEpisodios(sets || [])
  $('mcVistazoSetsEsq')?.remove()
  caja.insertAdjacentHTML('beforeend', vistazoDeSets(sets))
  // Cambios, Tu mes y las alertas ya no son bloques del Panel (propuesta A,
  // noviembre; PINGU: «muy visuales y que no tengan mucho texto»): cada cosa
  // vive en su pestaña, y las alertas avisan por la campana.
  // «MÁS», la última fila (1176 → 1177).
  const masSitio = $('mcMasSitio')
  if (masSitio) {
    // La privacidad («Colección privada · Ajustes») es el elemento de la
    // plantilla, con sus manejadores: se MUEVE (893), no se copia. Y antes
    // de repintar la caja se saca, que un `innerHTML` se lo llevaría.
    const privacidad = $('mcCompartir')
    if (privacidad && masSitio.contains(privacidad)) $('mcPanelResumen')?.append(privacidad)
    masSitio.innerHTML = vistazoDeAcciones()
    const rejilla = masSitio.querySelector('#mcMas .mc-acciones-rejilla')
    if (privacidad && rejilla) rejilla.append(privacidad)
  }
  // MI COLECCIÓN EN UNA IMAGEN (571), IMPORTAR Y EXPORTAR (580): desde la
  // 651 son tres losetas en una tarjeta (`vistazoDeAcciones`). Importar
  // sale siempre: es justo quien NO tiene cartas aquí quien lo necesita.
  if (quiereImportar) {
    // Desde la bienvenida (581): «¿ya la tienes en otra app? Impórtala».
    quiereImportar = false
    setTimeout(() => $('mcImportarAbrir')?.click(), 0)
  }
  if (ctx.carpetasLista.length) {
    caja.insertAdjacentHTML('beforeend', vistazoHtml('Álbumes', 'carpetas',
      ctx.carpetas.rejillaHtml(ctx.carpetas.arbolDeCarpetas(ctx.carpetasLista), ctx.carpetasResumen)))
  }
  ctx.guardarPanel()
}

// ── LAS QUE MÁS SE MUEVEN ESTA SEMANA (663) ──
//
// De la foto diaria del histórico (643) de TUS cartas: las tres que más
// han subido y las tres que más han bajado en los últimos ocho días, en el
// idioma de tu copia, con su foto y su porcentaje. Solo las que tienen
// precio, y como mucho las 600 más valiosas: es lo que cabe en cuatro
// consultas sin hacer esperar al Panel. Sin dos fotos de ninguna, no sale.
const TOPE_MOVIDAS = 600
// Lo último que se pintó (925): el Panel se repinta entero cuando llegan
// los precios, DESPUÉS de que esto haya pedido el histórico, y el hueco
// nuevo nacía vacío — «Las que más se mueven» se perdía casi siempre, sin
// error. Se repone al repintar, y lo que llega busca el hueco de AHORA.
let movidasHtml = ''
// ── TUS ALERTAS (1173, P6) ──
//
// Desde la 665 se pide «avísame si baja de X» en la ficha de una carta y
// después no se ve en ningún sitio hasta que salta. Aquí, las activas: la
// carta, el umbral y a cuánto está HOY, las que están cerca de saltar
// primero. Las cartas que no tienes (un aviso puesto desde /carta) se piden
// por id, y el precio de hoy de todas sale de `tcg_card_prices`.
export function ordenarAlertas(alertas, precioDe) {
  return (alertas || []).map((a) => {
    const hoy = precioDe(a)
    const umbral = Number(a.umbral)
    const falta = hoy === null ? null : a.tipo === 'baja' ? hoy - umbral : umbral - hoy
    return { ...a, hoy, umbral, falta, cerca: falta !== null && falta <= Math.max(0.5, umbral * 0.1) }
  }).sort((x, y) => (x.falta === null) - (y.falta === null) || (x.falta ?? 0) - (y.falta ?? 0))
}

// ── TU MES (1173, P7) ──
let mesDatos = null
export async function compartirMes() {
  if (!mesDatos) return
  const m = await import('../mes-imagen.js')
  return m.compartirMes(mesDatos)
}

async function pintarMovidas(version) {
  if (!ctx.esMia || !$('mcMovidasSitio')) return
  let sitio = $('mcMovidasSitio')
  try {
    const [ls, , busca] = ctx.pTodo()
    const conPrecio = ls
      .map((l) => ({ l, v: valorDeLinea(l, ctx.precioDe(l)) || 0 }))
      .filter((x) => x.v > 0)
      .sort((a, b) => b.v - a.v)
      .slice(0, TOPE_MOVIDAS)
      .map((x) => x.l)
    if (!conPrecio.length) return
    // El hueco, en esqueleto mientras llega (748): tres filas del alto de
    // las de verdad, para que lo de debajo no salte al llegar.
    if (!movidasHtml) sitio.innerHTML = `<section class="mc-vistazo mc-movidas-esq" aria-hidden="true"><div class="mc-vistazo-cabecera"><h2 class="mc-subtitulo">Movimientos</h2></div><div class="mc-vistazo-cartas">${'<span class="mc-vistazo-ficha"><span class="mc-vistazo-carta skeleton"></span><b class="skeleton mc-ficha-esq"></b><small class="skeleton mc-ficha-esq"></small></span>'.repeat(DE_VISTAZO)}</div></section>`
    const desde = new Date(Date.now() - 8 * 86_400_000).toISOString().slice(0, 10)
    // Solo los extremos del periodo (1171): la semana entera de 150 cartas
    // pasaba de las 1.000 filas que Supabase devuelve (la 808).
    const [filas, movidas] = await Promise.all([
      datos.historicoDeExtremos(conPrecio.map((l) => l.card_id), desde),
      import('./movidas.js'),
    ])
    sitio = $('mcMovidasSitio')
    if (ctx.pestania !== 'resumen' || !sitio || version !== vistazosVersion) return
    const todas = movidas.movidasDe(conPrecio, filas, busca)
    const { suben, bajan } = movidas.extremos(todas, DE_VISTAZO)
    // Las que MÁS se mueven, suban o bajen, en una tira de cartas con el
    // molde de Ranking (propuesta de noviembre): el precio de hoy, el tanto
    // por ciento en verde o rojo y el nombre. Ocho en el PC, tres en el móvil
    // (lo decide la rejilla, como en las otras tiras).
    const masMovidas = [...suben, ...bajan]
      .sort((a, b) => Math.abs(b.pct ?? 0) - Math.abs(a.pct ?? 0) || Math.abs(b.cambio) - Math.abs(a.cambio))
      .slice(0, DE_VISTAZO)
    if (!masMovidas.length) { sitio.innerHTML = movidasHtml = ''; return }
    const ficha = (m) => {
      const c = m.carta
      const signo = m.cambio > 0 ? '+' : '−'
      const pct = m.pct === null ? `${signo}${euros(Math.abs(m.cambio))}` : `${signo}${Math.abs(Math.round(m.pct))} %`
      return fichaDeTiraHtml({
        carta: c, nombre: ctx.nombreDe(c), clase: m.cambio > 0 ? 'sube' : 'baja',
        dato: escapeHtml(euros(m.ahora)), cambio: escapeHtml(pct),
        etiqueta: `${ctx.nombreDe(c)}: ${pct} esta semana, de ${euros(m.antes)} a ${euros(m.ahora)}`,
      })
    }
    // Y «Ver todas» abre MOVIMIENTOS (1171), la lista entera por periodo.
    sitio.innerHTML = movidasHtml = vistazoHtml('Movimientos', 'movimientos', `<div class="mc-vistazo-cartas mc-movidas-tira">${masMovidas.map(ficha).join('')}</div>`)
      .replace('<section class="mc-vistazo">', '<section class="mc-vistazo" id="mcMovidas">')
  } catch {
    // Sin histórico (o sin red), el hueco se va y el Panel sigue.
    const s = $('mcMovidasSitio')
    if (s) s.innerHTML = movidasHtml = ''
  }
  ctx.guardarPanel()
}

// La gráfica llega DESPUÉS y por su cuenta: el resto del resumen sale de
// lo que ya está en memoria y no tiene por qué esperar a una consulta.
// Se pide una sola vez por visita.


// EN CUÁNTOS DÍAS SE MIRA (tanda 464). PINGU, con Collectr delante:
// «quiero que pongas en cuántos días quieres ver el gráfico». Se recuerda
// en el navegador, como el color de la tapa y la vista de variantes: es
// gusto de quien mira, no un dato de la colección.
let rangoDelValor = '1M'
try {
  const guardado = localStorage.getItem('mc-valor-rango')
  if (guardado) rangoDelValor = guardado
} catch {
  // En una ventana privada `localStorage` LANZA, no devuelve null.
}

// «+12,50 € este mes» debajo del valor de la cabecera (tanda 582). La
// gráfica existe desde la 377, pero vive en el Panel; la cabecera —que se
// ve en todas las pestañas— decía el valor de hoy y nada más. Un número
// solo no cuenta nada; el cambio es lo que hace volver a mirar.
function cambioDelMes() {
  if (!ctx.historico) return null
  const { resumenDeValor, diasDelRango } = ctx.historico.grafica
  const todo = resumenDeValor(ctx.historico.filas, { ahora: ctx.valorDeAhora() })
  if (!todo.bastante) return null
  const mes = resumenDeValor(diasDelRango(todo.dias, '1M'))
  if (!mes.bastante) return null
  return { cambio: mes.cambio, pct: mes.pct, desde: mes.primero.dia }
}

function textoDelCambio(c) {
  if (!c) return ''
  const signo = c.cambio > 0 ? '+' : c.cambio < 0 ? '−' : ''
  const pct = typeof c.pct === 'number' && Number.isFinite(c.pct) ? ` (${signo}${Math.abs(c.pct).toFixed(1).replace('.', ',')} %)` : ''
  return `${signo}${euros(Math.abs(c.cambio))}${pct} este mes`
}

export function pintarCambioDelMes() {
  const sitio = $('mcCifraCambio')
  const c = cambioDelMes()
  if (ctx.resumenHero) ctx.resumenHero.cambioMes = c ? textoDelCambio(c) : null
  if (!sitio) return
  sitio.textContent = textoDelCambio(c)
  sitio.classList.toggle('hidden', !c)
  sitio.classList.toggle('sube', !!c && c.cambio > 0)
  sitio.classList.toggle('baja', !!c && c.cambio < 0)
}

export async function pintarValorEnElTiempo() {
  const caja = $('mcValorCaja')
  if (!caja) return
  try {
    if (!ctx.historico) {
      const [grafica, filas] = await Promise.all([
        import('./grafica-valor.js'),
        datos.valorHistorico(ctx.dueno.id),
      ])
      ctx.historico = { grafica, filas }
    }
    // Con el valor de AHORA, que es el mismo que enseña la cifra de
    // arriba: la foto diaria es de las 4:07 y sin esto la pantalla
    // enseñaría dos totales distintos de lo mismo.
    const sitio = $('mcCarteraGrafica')
    if (!sitio) return
    sitio.innerHTML = ctx.historico.grafica.carteraHtml(ctx.historico.filas, { ahora: ctx.valorDeAhora(), rango: rangoDelValor, nombre: ctx.esMia ? 'tu colección' : 'esta colección' })
    sitio.removeAttribute('aria-busy')
    // La gráfica se dibuja de izquierda a derecha (1217, PINGU: «que aparezca
    // la gráfica como de izquierda a derecha generándose»).
    // Una vez por visita (1225): repintar no la vuelve a dibujar.
    if (!graficaDibujada) sitio.querySelector('.mc-valor-lienzo')?.setAttribute('data-dibujando', '')
    graficaDibujada = true
    engancharRangosDelValor()
    // Y la lectura al pasar el dedo (653), sobre el lienzo recién pintado.
    ctx.historico.grafica.engancharLectura(sitio.querySelector('.mc-valor-lienzo'))
    pintarCambioDelMes()
  } catch {
    // Una gráfica que no llega no puede tumbar el resumen: se quita el
    // hueco de la gráfica y la cifra de ahora sigue ahí.
    $('mcCarteraGrafica')?.remove()
  }
}

// Los botones de rango. Delegado en la CAJA y enganchado una sola vez: la
// gráfica se repinta entera en cada cambio, así que un oyente por botón
// se quedaría colgando de un botón que ya no está.
function engancharRangosDelValor() {
  const caja = $('mcValorCaja')
  if (!caja || caja.dataset.enganchada) return
  caja.dataset.enganchada = '1'
  caja.addEventListener('click', (e2) => {
    const b2 = e2.target.closest('[data-rango]')
    if (!b2 || b2.disabled) return
    rangoDelValor = b2.dataset.rango
    try { localStorage.setItem('mc-valor-rango', rangoDelValor) } catch {}
    void pintarValorEnElTiempo()
  })
}
