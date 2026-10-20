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
import { padreDeColeccion, registrarEpisodios, nombreDeSet } from '../catalogo-series.js'
import { euros, valorDeLinea } from '../cardmarket.js'
import { icons, icon } from '../icons.js'
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

export function pintarResumenPanel() {
  const caja = $('mcResumenPanel')
  if (!caja) return
  // Con la última vista pintada (894) y la colección aún por llegar, no se
  // pisa con el «todavía no has añadido ninguna carta» de antes de cargar:
  // los puentes de la 895 llegan en diferido, después de la caché.
  if (!ctx.panelFiable && caja.dataset.ultimaVista) return
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
  const rep = ctx.repetidas(ls, clave, busca)
  const sobran = rep.reduce((n, r) => n + r.sobran, 0)
  const valiosas = ctx.masValiosas(3, ls, clave, busca)
  const valiosasTira = ctx.masValiosas(DE_VISTAZO, ls, clave, busca)
  const porRareza = ctx.repartoPor((c) => rarezaDeCarta(c), ls, clave, busca)

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
      <h2 class="mc-cartera-etiqueta">Lo que vale ${ctx.esMia ? 'tu' : 'esta'} colección</h2>
      <p class="mc-cartera-cifra">${escapeHtml(ctx.eurosConMiles(ctx.valorDeAhora()))}</p>
      ${ctx.fichasDeCartera()}
      ${ctx.esMia ? '<div class="mc-cartera-reparto hidden" id="mcCarteraReparto"></div>' : ''}
      <div class="mc-cartera-grafica" id="mcCarteraGrafica" aria-busy="true">
        <p class="mc-valor-cambio igual"><span class="skeleton mc-cartera-esq-cambio"></span></p>
        <div class="skeleton mc-cartera-esq-lienzo"></div>
        <div class="mc-valor-rangos" aria-hidden="true">${'<span class="skeleton mc-cartera-esq-rango"></span>'.repeat(5)}</div>
      </div>
    </section>
    ${vistazoDeValiosas(valiosasTira)}
    ${ctx.esMia ? `<div id="mcMovidasSitio">${movidasHtml}</div>` : ''}
`
  if (ctx.esMia && ctx.sesion) void ctx.pintarRepartoProductos()
  // La cifra cuenta desde la de la última vez (783, MV2).
  const cifraPanel = document.querySelector('#mcValorCaja .mc-cartera-cifra')
  if (ctx.esMia && cifraPanel) import('../contar.js').then(({ contarCifra }) => contarCifra(cifraPanel, 'valor', ctx.valorDeAhora(), ctx.eurosConMiles)).catch(() => {})

  const mas = $('mcMasEstadisticas')
  if (mas) {
    mas.innerHTML = `
    <!-- CON LA MISMA CABECERA QUE LOS DEMÁS BLOQUES DEL PANEL (tanda
         451). Era un botón suelto detrás del último vistazo, y PINGU: «el
         botón de ver todas es un enlace pocho». Pegado debajo de la
         tarjeta de Cambios parecía además que era SUYO. Todo lo que hay en
         este panel es una tarjeta con su título y su enlace a la derecha;
         esto también, y así se sabe de qué es el botón sin leerlo entero.

         Y lo largo sigue sin enseñarse hasta que se pide: la gráfica del
         valor es una consulta, y sin abrir esto no se pide. -->
    <section class="mc-vistazo">
      <div class="mc-vistazo-cabecera">
        <h2 class="mc-subtitulo">Estadísticas</h2>
        <button type="button" class="link-btn" id="mcVerTodo" aria-expanded="false" aria-controls="mcEstadisticas">Ver todas</button>
      </div>
    </section>

    <div class="mc-estadisticas hidden" id="mcEstadisticas">
          <div class="mc-diapos">
      ${
        // AQUÍ VIVÍAN «Tu colección» y el total de «Lo que vale» (fuera en
        // la 439). Las cartas, las distintas, las colecciones y el valor ya
        // están en el listón de arriba, que además se ve desde CUALQUIER
        // pestaña: repetirlos aquí era decir cuatro números dos veces y
        // gastar en ello las dos primeras diapositivas, que son las únicas
        // que se ven sin deslizar. Lo que sí añadía la segunda —CUÁLES son
        // las que más valen— se queda, que es lo que no estaba en ningún
        // otro sitio.
        valiosas.length
          ? diapoHtml('Las que más valen', `<ul class="mc-diapo-lista">${valiosas
              .map((v) => `<li><span>${escapeHtml(ctx.nombreDe(v.carta))}</span><strong>${escapeHtml(euros(v.valor))}</strong></li>`)
              .join('')}</ul>`)
          : ''
      }
      ${ctx.esMia ? diapoDelBalance() : ''}
      ${diapoHtml('Lo que te sobra', `
        <p class="mc-diapo-cifra">${sobran.toLocaleString('es-ES', { useGrouping: 'always' })}</p>
        <p class="mc-diapo-pie">${sobran === 1 ? 'copia repetida' : 'copias repetidas'}${rep.length ? `, de ${rep.length} ${rep.length === 1 ? 'carta' : 'cartas'}` : ''}</p>
        ${
          rep.length
            ? `<ul class="mc-diapo-lista">${rep
                .slice(0, 3)
                .map((r) => `<li><span>${escapeHtml(ctx.nombreDe(r.carta))}</span><strong>+${r.sobran}</strong></li>`)
                .join('')}</ul>`
            : '<p class="subtext">No tienes ninguna repetida todavía.</p>'
        }`)}
      ${diapoHtml('Por rareza', porRareza.length
        ? ctx.barrasHtml(porRareza.slice(0, 5))
        : '<p class="subtext">Tus cartas todavía no tienen rareza guardada.</p>')}
    </div>
      <div class="mc-resumen-rejilla">
        <section class="mc-resumen-caja">
          <h3>Tus repetidas</h3>
          ${
            rep.length
              // El verbo concuerda también (tanda 485): «Te sobran 1 copia»
              // se leía con una sola repetida, y lo vi en lo que imprimía
              // la prueba al lado de un `ok`.
              ? `<p class="subtext">${sobran === 1 ? 'Te sobra' : 'Te sobran'} <strong>${sobran}</strong> ${sobran === 1 ? 'copia' : 'copias'} de ${rep.length} ${rep.length === 1 ? 'carta' : 'cartas'}. ${sobran === 1 ? 'Es la que puedes' : 'Son las que puedes'} cambiar.</p>
                 <ul class="mc-lista-cartas">${rep.slice(0, 12).map((r) => ctx.filaDeCartaHtml(r.carta, `tienes ${r.tengo} · <strong>te sobran ${r.sobran}</strong>`)).join('')}</ul>`
              : '<p class="subtext">No tienes ninguna repetida todavía.</p>'
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
      </div>
    </div>`
  }

  // AQUÍ SE LLAMABA A `engancharTira()` (fuera en la 440): el resumen ya no
  // es una tira. La del álbum tampoco desde la 459, así que la función se
  // ha ido con ella.
  $('mcVerTodo').addEventListener('click', () => {
    const abierto = !$('mcEstadisticas').classList.toggle('hidden')
    $('mcVerTodo').setAttribute('aria-expanded', abierto ? 'true' : 'false')
    $('mcVerTodo').textContent = abierto ? 'Ocultar' : 'Ver todas'
  })
  // La gráfica es una consulta y llega cuando llega: el resto del panel
  // sale de lo que ya está en memoria y no la espera.
  pintarValorEnElTiempo()
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
function vistazoHtml(titulo, pestana, dentro, rotulo = 'Ver todas') {
  return `<section class="mc-vistazo">
    <div class="mc-vistazo-cabecera">
      <h2 class="mc-subtitulo">${escapeHtml(titulo)}</h2>
      <button type="button" class="link-btn ver-todo" data-ir-a="${escapeHtml(pestana)}">${escapeHtml(rotulo)} <span class="ver-todo-flecha" aria-hidden="true">→</span></button>
    </div>
    ${dentro}
  </section>`
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
    return `<span class="mc-valiosa"><a class="mc-vistazo-carta" href="${escapeHtml(c ? rutaDeCarta(c) : '#')}"${c ? ` data-carta="${escapeHtml(c.id)}"` : ''} aria-label="${escapeHtml(`${nombre}: ${euros(v.valor)}`)}">${
      escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />`
        : `<span class="mc-carta-sinfoto">${escapeHtml(nombre)}</span>`
    }</a><b>${escapeHtml(euros(v.valor))}</b></span>`
  }).join('')
  return vistazoHtml('Las que más valen', 'cartas', `<div class="mc-vistazo-cartas mc-valiosas">${cuerpo}</div>`)
    .replace('<section class="mc-vistazo">', '<section class="mc-vistazo" id="mcValiosas">')
}

function vistazoDeCartas() {
  const [ls, , busca] = ctx.pTodo()
  const ultimas = [...ls]
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    .slice(0, DE_VISTAZO)
  if (!ultimas.length) {
    return vistazoHtml('Tus cartas', 'cartas', '<p class="empty-state">Todavía no has añadido ninguna carta.</p>')
  }
  const cuerpo = ultimas.map((l) => {
    const c = busca(l)
    const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
    const nombre = ctx.nombreDe(c)
    // `data-carta` es lo que hace que se abra la ficha EN LA MISMA PÁGINA
    // (tanda 562): el `href` se queda para el Ctrl+clic, para el «abrir en
    // otra pestaña» del móvil y para cuando no hay JavaScript.
    return `<a class="mc-vistazo-carta" href="${escapeHtml(c ? rutaDeCarta(c) : '#')}"${c ? ` data-carta="${escapeHtml(c.id)}"` : ''} aria-label="${escapeHtml(nombre)}">${
      escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />`
        : `<span class="mc-carta-sinfoto">${escapeHtml(nombre)}</span>`
    }</a>`
  }).join('')
  return vistazoHtml('Tus cartas', 'cartas', `<div class="mc-vistazo-cartas">${cuerpo}</div>`)
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
    .slice(0, 6)
  if (!conAlgo.length) {
    return vistazoHtml('Expansiones', 'album', '<p class="empty-state">Cuando añadas cartas, aquí verás por dónde vas en cada colección.</p>')
  }
  // «Ver todas» abre la estantería ENTERA (tanda 649; el filtro de «solo
  // las empezadas» se quita al llegar, en el manejador del vistazo).
  // PINGU: «cuando le des a ver todas, que no te lleve a solo las
  // empezadas, que te deje ver todas directamente».
  return vistazoHtml('Expansiones', 'album', `<div class="mc-estanteria mc-vistazo-sets">${conAlgo.map((x) => ctx.tarjetaDeSet(x.set, x.tengo)).join('')}</div>`)
}

// La tarjeta de Cambios del Panel: dos cifras y la puerta. Las dos salen
// de lo que YA está cargado —las líneas de tu colección—, así que no
// cuesta ni una consulta: el Panel es lo primero que se abre y no puede
// quedarse esperando a nadie.
// EN CIFRAS, NO EN PROSA (651). PINGU: «actualizar un poco el panel,
// que se ve demasiado texto, poco botón, poco visual». Dos números y la
// puerta; la explicación de cómo se marca una carta para cambiar vive en
// la pantalla de Cambios, que es donde se hace.
function vistazoDeCambios() {
  const doy = ctx.loQueDoy().length
  const busco = Array.isArray(ctx.deseos) ? ctx.deseos.length : null
  const dentro = `<div class="mc-panel-cifras">
    <button type="button" class="mc-panel-cifra" data-ir-a="cambios"><b>${doy}</b><span>${doy === 1 ? 'carta que das' : 'cartas que das'}</span></button>
    ${busco === null ? '' : `<button type="button" class="mc-panel-cifra" data-ir-a="quiero"><b>${busco}</b><span>${busco === 1 ? 'carta que quieres' : 'cartas que quieres'}</span></button>`}
  </div>`
  return vistazoHtml('Cambios', 'cambios', dentro, 'Abrir')
}

// El icono de descargar, aquí y no en js/icons.js: ese fichero lo baja la
// portada, que no tiene sitio (CLAUDE.md), y esto solo lo usa el Panel.
const ICONO_DESCARGAR = (size) => icon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>', size)

// LAS ACCIONES DEL PANEL, EN LOSETAS (651): la imagen para compartir,
// importar y exportar eran dos tarjetas con un párrafo cada una y un
// enlace pequeño. Son tres botones; se pintan como tres botones. Los ids
// se quedan (los manejadores y las pruebas cuelgan de ellos).
function vistazoDeAcciones() {
  const hay = ctx.lineasTodo.length || ctx.lineas.length
  const loseta = (id, dibujo, texto, extra = '') => `<button type="button" class="mc-accion-loseta" id="${id}"${extra}><span class="mc-accion-icono" aria-hidden="true">${dibujo}</span><span>${texto}</span></button>`
  return `<section class="mc-vistazo mc-vistazo-imagen mc-vistazo-importar">
      <div class="mc-vistazo-cabecera">
        <h2 class="mc-subtitulo">Compartir, importar y exportar</h2>
      </div>
      <div class="mc-acciones-rejilla">
        ${hay ? loseta('mcImagenCrear', icons.image(24), 'Mi colección en una imagen') : ''}
        ${loseta('mcImportarAbrir', icons.upload(24), 'Importar un CSV')}
        ${loseta('mcExportar', ICONO_DESCARGAR(24), 'Descargar mi colección (CSV)', hay ? '' : ' disabled')}
        <a class="mc-accion-loseta" id="mcModoFeria" href="/feria"><span class="mc-accion-icono" aria-hidden="true">${icons.scan(24)}</span><span>Modo feria</span></a>
      </div>
    </section>`
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
  const cambiosHechos = (await import('../cambios-hechos.js').then((m) => m.cambiosDe(ctx.sesion.user.id)).catch(() => null))?.hechos || 0
  const stats = statsDeColeccion({
    especies,
    cambiosHechos,
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
  // LA TARJETA DE CAMBIOS (tanda 451). Lo que estaba debajo —la pantalla
  // entera— se ha ido a la suya; aquí queda lo que el Panel sí tiene que
  // decir: cuántas das, cuántas buscas, y un sitio por donde entrar. Sin
  // esto, una pantalla que existe deja de tener puerta.
  caja.insertAdjacentHTML('beforeend', vistazoDeCambios())
  // MI COLECCIÓN EN UNA IMAGEN (571), IMPORTAR Y EXPORTAR (580): desde la
  // 651 son tres losetas en una tarjeta (`vistazoDeAcciones`). Importar
  // sale siempre: es justo quien NO tiene cartas aquí quien lo necesita.
  if (quiereImportar) {
    // Desde la bienvenida (581): «¿ya la tienes en otra app? Impórtala».
    quiereImportar = false
    setTimeout(() => $('mcImportarAbrir')?.click(), 0)
  }
  caja.insertAdjacentHTML('beforeend', vistazoDeAcciones())
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
    if (!movidasHtml) sitio.innerHTML = `<section class="mc-vistazo mc-movidas-esq" aria-hidden="true"><div class="mc-vistazo-cabecera"><h2 class="mc-subtitulo">Las que más se mueven</h2></div><ul class="mc-movidas">${'<li class="mc-movida"><span class="skeleton mc-movida-foto"></span><span class="skeleton mc-movida-esq"></span></li>'.repeat(3)}</ul></section>`
    const desde = new Date(Date.now() - 8 * 86_400_000).toISOString().slice(0, 10)
    const [filas, movidas] = await Promise.all([
      datos.historicoDeCartas(conPrecio.map((l) => l.card_id), desde),
      import('./movidas.js'),
    ])
    sitio = $('mcMovidasSitio')
    if (ctx.pestania !== 'resumen' || !sitio || version !== vistazosVersion) return
    const { suben, bajan } = movidas.extremos(movidas.movidasDe(conPrecio, filas, busca), 3)
    // Las tres que MÁS se mueven, suban o bajen, como en la maqueta: una
    // lista de tres filas y no dos tiras de seis fotos.
    const tres = [...suben, ...bajan]
      .sort((a, b) => Math.abs(b.pct ?? 0) - Math.abs(a.pct ?? 0) || Math.abs(b.cambio) - Math.abs(a.cambio))
      .slice(0, 3)
    if (!tres.length) { sitio.innerHTML = movidasHtml = ''; return }
    const fila = (m) => {
      const c = m.carta
      const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
      const signo = m.cambio > 0 ? '+' : '−'
      const pct = m.pct === null ? `${signo}${euros(Math.abs(m.cambio))}` : `${signo}${Math.abs(Math.round(m.pct))} %`
      const set = nombreDeSet(c.tcg_sets?.name ? c.tcg_sets : (ctx.todosLosSets || []).find((x) => x.id === c.set_id) || c.tcg_sets) || c.set_id || ''
      return `<li><a class="mc-movida ${m.cambio > 0 ? 'sube' : 'baja'}" href="${escapeHtml(rutaDeCarta(c))}" data-carta="${escapeHtml(c.id)}" aria-label="${escapeHtml(`${ctx.nombreDe(c)}: ${pct} esta semana, de ${euros(m.antes)} a ${euros(m.ahora)}`)}">
        <span class="mc-movida-foto">${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : ''}</span>
        <span class="mc-movida-nombre"><b>${escapeHtml(ctx.nombreDe(c))}</b><small>${escapeHtml(set)}</small></span>
        <span class="mc-movida-precio"><b>${escapeHtml(euros(m.ahora))}</b><small>${escapeHtml(pct)}</small></span>
      </a></li>`
    }
    sitio.innerHTML = movidasHtml = vistazoHtml('Las que más se mueven', 'cartas', `<ul class="mc-movidas">${tres.map(fila).join('')}</ul>`)
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
