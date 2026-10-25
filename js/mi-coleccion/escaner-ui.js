// EL ESCÁNER DE MI COLECCIÓN, aparte (tanda 1011). La cámara, la ráfaga y
// «desde tus fotos» solo los abre quien tiene cuenta y pulsa «Escanear»; el
// catálogo público (/cartas, la misma pantalla) los bajaba enteros. Entra por
// import() la primera vez (ver los puentes en mi-coleccion.js); el estado de
// la pantalla llega en `ctx` (getters: cambia mientras se usa), como en el
// Panel de la 895.
import { escapeHtml } from '../app.js'
import { showToast } from '../toast.js'
import { icons } from '../icons.js'
import { atributosDeEscaneo, cadenaDeEscaneo } from '../escaneo-carta.js'
import { nombreDeSet } from '../catalogo-series.js'
import { ESTADO_POR_DEFECTO } from '../cardmarket.js'
import { tieneCJK, variantesDeMarcas } from '../texto.js'
import * as datos from './datos.js'
import { comoDeshacer } from './deshacer.js'
import { hojaInyectada } from '../hoja.js'

const $ = (id) => document.getElementById(id)

// Lo compartido con mi-coleccion.js llega aquí (ver `ctxEscaner` allí).
let ctx = null
// Su CSS (css/mc-escaner.css, 1011) entra con el módulo: la cámara no se
// enseña hasta que la hoja está, o saldría un instante sin marco.
let hojaLista = Promise.resolve()
export function montar(c) {
  ctx = c
  hojaLista = hojaInyectada('css/mc-escaner.css')
  enganchar()
}

// ── EL ESCÁNER (tanda 447) ──
//
// El módulo con las cuentas entra por un `import()` dinámico: quien no
// abra el escáner no se baja ni una línea de él, igual que la pestaña del
// foro de los perfiles. Y la cámara no se pide hasta que se abre — pedirla
// al cargar la página saca el aviso del navegador sin que nadie lo haya
// pedido, que es la forma más rápida de que te digan que no para siempre.
let escaner = null
let camara = null

export async function abrirEscaner() {
  const caja = $('mcEscanerCaja')
  if (!caja) return
  await hojaLista
  const ayuda = $('mcEscanerAyuda')
  try {
    escaner = escaner || (await import('./escaner.js'))
  } catch {
    showToast('No se ha podido cargar el escáner.', 'error')
    return
  }
  const sel = $('mcEscanerIdioma')
  if (sel) {
    // Se repinta CADA VEZ que se abre el escáner, y no solo la primera
    // (tanda 472). El idioma por defecto sale del catálogo que miras, y el
    // catálogo cambia sin recargar la página: con el `!sel.options.length`
    // de antes, quien abría el escáner una vez en español se lo llevaba
    // en español al catálogo japonés el resto de la visita.
    sel.innerHTML = escaner.IDIOMAS_ESCANER
      .map((i) => `<option value="${i.id}">${escapeHtml(i.nombre)}</option>`)
      .join('')
    // El idioma de la carta se recuerda —quien colecciona japonés escanea
    // japonés veinte veces seguidas— y se recuerda POR CATÁLOGO, por lo
    // mismo que los otros dos desplegables.
    //
    // La lista del escáner es la suya y no `IDIOMAS`: aquí el idioma dice
    // en qué está ESCRITA la carta que tienes delante, que es otra pregunta.
    const clave = ctx.claveDeIdioma('mc-escaner-idioma')
    const porDefecto = escaner.IDIOMAS_ESCANER.some((i) => i.id === ctx.idiomaDeLaVista())
      ? ctx.idiomaDeLaVista()
      : sel.value
    sel.value = porDefecto
    try {
      const guardado = localStorage.getItem(clave)
      if (guardado && escaner.IDIOMAS_ESCANER.some((i) => i.id === guardado)) sel.value = guardado
    } catch {
      // Ventana privada: se queda el del catálogo y ya está.
    }
    // `onchange` y no `addEventListener`: esto corre cada vez que se abre
    // el escáner, y con `addEventListener` se apilaría un oyente por
    // apertura, cada uno escribiendo en la clave de otro catálogo.
    sel.onchange = () => {
      try {
        localStorage.setItem(clave, sel.value)
      } catch {
        // Lo mismo: no poder recordarlo no impide escanear.
      }
    }
  }
  if (!caja.open) caja.showModal()
  if (ayuda) ayuda.textContent = 'Pidiendo permiso para la cámara…'
  try {
    // `environment` es la cámara de atrás. Y se PIDE, no se exige: un
    // portátil solo tiene la de delante y con `exact` fallaría del todo.
    camara = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    })
  } catch (err) {
    // Aquí hay que distinguir: que digas que NO es distinto de que el
    // aparato no tenga cámara, y un mensaje que no distingue deja a la
    // gente dándole al botón sin saber qué pasa.
    const nombre = String(err?.name || '')
    if (ayuda) {
      ayuda.textContent = nombre === 'NotAllowedError'
        ? 'Has dicho que no a la cámara. Dale permiso en el candado de la barra de direcciones, o elige una foto con «Desde tus fotos».'
        : nombre === 'NotFoundError'
          ? 'Este aparato no tiene cámara: elige una foto con «Desde tus fotos».'
          : 'No se ha podido abrir la cámara. Puedes elegir una foto con «Desde tus fotos».'
    }
    $('mcEscanerDisparo')?.setAttribute('disabled', '')
    return
  }
  const video = $('mcEscanerVideo')
  video.srcObject = camara
  await video.play().catch(() => null)
  $('mcEscanerDisparo')?.removeAttribute('disabled')
  if (ayuda) ayuda.textContent = 'Encuadra la carta dentro del marco'
}

// APAGAR LA CÁMARA AL CERRAR, y esto no es limpieza opcional: una pista de
// vídeo que se queda viva deja el piloto del móvil encendido y se come la
// batería hasta que recargas la página.
export function cerrarEscaner() {
  const caja = $('mcEscanerCaja')
  const video = $('mcEscanerVideo')
  if (camara) {
    for (const pista of camara.getTracks()) pista.stop()
    camara = null
  }
  if (video) video.srcObject = null
  if (caja?.open) caja.close()
  $('mcEscanerBandeja')?.classList.add('hidden')
  caja?.classList.remove('con-bandeja')
  enRafaga = { cartas: new Map(), hechas: 0 }
}

// ── LA BANDEJA DE LA RÁFAGA (719) ──
//
// Las tres primeras de lo que encontró la búsqueda, cada una con su «+».
// El «+» añade UNA copia con lo que el escáner ya sabe —el idioma en el
// que está escrita, si el catálogo lo admite— y el estado por defecto: es
// el camino rápido, y por eso lleva su Deshacer al lado. Para elegir
// estado, versión o copias, la carta se toca y abre el diálogo de siempre.
// Las dos van por `datos.anadir` (la 650).
let enRafaga = { cartas: new Map(), hechas: 0 }

function pintarBandejaEscaner(lista) {
  const bandeja = $('mcEscanerBandeja')
  if (!bandeja) return
  bandeja.classList.remove('hidden')
  // Con la bandeja puesta el marco sube y encoge: la bandeja no puede tapar
  // la franja de abajo, que es la que hay que encuadrar para la siguiente.
  $('mcEscanerCaja')?.classList.add('con-bandeja')
  enRafaga.cartas = new Map(lista.map((c) => [c.id, c]))
  $('mcEscanerCandidatas').innerHTML = lista.length
    ? lista.map((c) => {
        const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
        const tengo = ctx.misLineasDe(c.id).reduce((n, l) => n + (Number(l.cantidad) || 0), 0)
        return `<div class="mc-escaner-candidata" data-carta="${escapeHtml(c.id)}">
          <button type="button" class="mc-escaner-cand-carta" data-escaner-abrir="${escapeHtml(c.id)}">
            <span class="mc-escaner-cand-foto">${escaneo ? `<img ${escaneo} alt="" width="40" height="56" loading="lazy" />` : ''}</span>
            <span class="mc-escaner-cand-texto"><b>${escapeHtml(ctx.nombreDe(c))}</b><small>${escapeHtml(nombreDeSet(c.tcg_sets) || c.set_id)} · ${escapeHtml(c.local_id)}${tengo ? ` · tienes ${tengo}` : ''}</small></span>
          </button>
          <button type="button" class="mc-escaner-mas" data-escaner-anadir="${escapeHtml(c.id)}" aria-label="Añadir ${escapeHtml(ctx.nombreDe(c))} a tu colección">+</button>
        </div>`
      }).join('')
    : '<p class="mc-escaner-nada">No la encuentro en el catálogo. Encuádrala otra vez, o cierra y búscala a mano.</p>'
}

function idiomaDeRafaga() {
  const leido = $('mcEscanerIdioma')?.value
  const vale = ctx.idiomasDeLaVista()
  if (vale.some((i) => i.id === leido)) return leido
  const recordado = $('mcTocarIdioma')?.value || ctx.idiomaDeLaVista()
  return vale.some((i) => i.id === recordado) ? recordado : vale[0]?.id || ctx.idiomaDeLaVista()
}

async function anadirDesdeEscaner(id, boton) {
  const c = enRafaga.cartas.get(id)
  if (!c || !ctx.sesion || !ctx.esMia) return
  const vs = ctx.variantesParaEditar(c, null)
  const linea = {
    card_id: c.id,
    idioma: idiomaDeRafaga(),
    estado: $('mcTocarEstado')?.value || ESTADO_POR_DEFECTO,
    variante: vs.some((v) => v.id === 'normal') ? 'normal' : vs[0]?.id || 'normal',
    cantidad: 1,
  }
  boton.disabled = true
  try {
    const nueva = await datos.anadir(ctx.sesion.user.id, linea, ctx.mercado)
    ctx.meterLinea(nueva, c)
    ctx.repintar()
    enRafaga.hechas++
    const plan = comoDeshacer(linea, nueva)
    const fila = boton.closest('.mc-escaner-candidata')
    const total = ctx.misLineasDe(c.id).reduce((n, l) => n + (Number(l.cantidad) || 0), 0)
    fila.querySelector('small').textContent = `${nombreDeSet(c.tcg_sets) || c.set_id} · ${c.local_id} · tienes ${total}`
    const hecho = document.createElement('button')
    hecho.type = 'button'
    hecho.className = 'mc-escaner-hecha'
    hecho.textContent = 'Deshacer'
    hecho.setAttribute('aria-label', `Deshacer: quitar la copia de ${ctx.nombreDe(c)} que acabas de añadir`)
    hecho.addEventListener('click', async () => {
      hecho.disabled = true
      if (await ctx.deshacerAnadida(plan, c)) {
        enRafaga.hechas = Math.max(0, enRafaga.hechas - 1)
        hecho.replaceWith(boton)
        boton.disabled = false
        const resto = ctx.misLineasDe(c.id).reduce((n, l) => n + (Number(l.cantidad) || 0), 0)
        fila.querySelector('small').textContent = `${nombreDeSet(c.tcg_sets) || c.set_id} · ${c.local_id}${resto ? ` · tienes ${resto}` : ''}`
        $('mcEscanerAyuda').textContent = `Deshecho: ${ctx.nombreDe(c)} vuelve a como estaba.`
      } else hecho.disabled = false
    })
    boton.replaceWith(hecho)
    $('mcEscanerAyuda').textContent = `${ctx.nombreDe(c)} añadida · ${enRafaga.hechas === 1 ? 'una en esta ráfaga' : `${enRafaga.hechas} en esta ráfaga`}. Encuadra la siguiente.`
  } catch (err) {
    $('mcEscanerAyuda').textContent = err.message
    boton.disabled = false
  }
}

// DISPARAR. Se recortan las dos franjas en el navegador y se mandan a
// leer. No se manda la foto: una foto de cámara son dos o tres megas para
// leer cuatro palabras, y el dibujo de la carta es justo donde un OCR se
// inventa texto.
let leyendo = false

async function dispararEscaner() {
  if (leyendo || !escaner) return
  const video = $('mcEscanerVideo')
  const marco = $('mcEscanerMarco')
  const lienzo = $('mcEscanerLienzo')
  const ayuda = $('mcEscanerAyuda')
  const boton = $('mcEscanerDisparo')
  const franjas = escaner.recortarFranjas(video, marco, lienzo)
  if (!franjas) {
    if (ayuda) ayuda.textContent = 'No he podido leer la imagen. Inténtalo otra vez.'
    return
  }
  leyendo = true
  boton?.setAttribute('disabled', '')
  if (ayuda) ayuda.textContent = 'Leyendo la carta…'
  try {
    const r = await leerYBuscar(franjas)
    if (r.aviso) {
      if (ayuda) ayuda.textContent = r.aviso
      return
    }
    showToast(`He leído: ${r.nombreLeido}${r.aflojado}`)
    // El aviso se queda DEBAJO de la cámara (la capa de arriba es suya),
    // así que lo leído se dice también aquí.
    if (ayuda) ayuda.textContent = `He leído: ${r.nombreLeido}${r.aflojado}`
    pintarBandejaEscaner(r.lista)
  } catch {
    if (ayuda) ayuda.textContent = 'No he podido conectar. Mira tu conexión.'
  } finally {
    leyendo = false
    boton?.removeAttribute('disabled')
  }
}


// DESDE TUS FOTOS (754, K5). Cada foto se lee como un disparo: se da por
// hecho que la carta está en el centro y la llena (`marcoEnLaFoto`), se
// recortan sus dos franjas y pasan por la misma lectura y la misma
// búsqueda que la cámara. De cada foto sale su primera carta a la bandeja,
// con su «+», como en la ráfaga. Doce como mucho: cada foto es una lectura
// del servidor.
const MAX_FOTOS = 12

function imagenDeFichero(f) {
  if (typeof createImageBitmap === 'function') return createImageBitmap(f).catch(() => imagenPorUrl(f))
  return imagenPorUrl(f)
}
function imagenPorUrl(f) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(f)
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    img.src = url
  })
}

async function leerFotos(ficheros) {
  const lista = [...(ficheros || [])].filter((f) => /^image\//.test(f.type || 'image/')).slice(0, MAX_FOTOS)
  if (leyendo || !lista.length) return
  try {
    escaner = escaner || (await import('./escaner.js'))
  } catch {
    showToast('No se ha podido cargar el escáner.', 'error')
    return
  }
  const lienzo = $('mcEscanerLienzo')
  const ayuda = $('mcEscanerAyuda')
  const botones = [$('mcEscanerDisparo'), $('mcEscanerFotos')]
  leyendo = true
  for (const b of botones) b?.setAttribute('disabled', '')
  const encontradas = []
  let sinCarta = 0
  let sinRed = false
  try {
    for (const [i, f] of lista.entries()) {
      if (ayuda) ayuda.textContent = lista.length > 1 ? `Leyendo la foto ${i + 1} de ${lista.length}…` : 'Leyendo la foto…'
      const img = await imagenDeFichero(f)
      const ancho = img?.naturalWidth || img?.width
      const alto = img?.naturalHeight || img?.height
      const marco = img && escaner.marcoEnLaFoto(ancho, alto)
      const franjas = marco && escaner.recortarFranjasDe(img, marco, lienzo)
      img?.close?.()
      if (!franjas) { sinCarta++; continue }
      const r = await leerYBuscar(franjas).catch(() => { sinRed = true; return null })
      if (!r || r.aviso || !r.lista.length) { sinCarta++; continue }
      encontradas.push(r.lista[0])
    }
  } finally {
    leyendo = false
    for (const b of botones) b?.removeAttribute('disabled')
    if (!camara) $('mcEscanerDisparo')?.setAttribute('disabled', '')
  }
  const unicas = [...new Map(encontradas.map((c) => [c.id, c])).values()]
  pintarBandejaEscaner(unicas)
  const n = lista.length
  const texto = sinRed && !encontradas.length
    ? 'No he podido conectar. Mira tu conexión.'
    : `${n === 1 ? (encontradas.length ? 'He leído la foto' : 'No he reconocido ninguna carta en la foto') : `${encontradas.length} de ${n} fotos con su carta`}${sinCarta && n > 1 ? ` · en ${sinCarta} no la he reconocido (mejor la carta sola, de frente)` : ''}${encontradas.length ? '. Toca «+» para añadir cada una.' : ''}`
  if (ayuda) ayuda.textContent = texto
  showToast(texto)
}

// LEER DOS FRANJAS Y BUSCAR LA CARTA (suelto en la 754: lo usan la cámara
// y las fotos de la galería). Devuelve { aviso } si no hay carta que
// buscar, o lo leído con lo que encontró la búsqueda.
async function leerYBuscar(franjas) {
  const res = await fetch('/.netlify/functions/leer-carta', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nombre: franjas.nombre, codigo: franjas.codigo, idioma: $('mcEscanerIdioma')?.value || 'es' }),
  })
  const datos = await res.json().catch(() => ({}))
  if (!res.ok) {
    // El mensaje del servidor tal cual: distingue «no está montado» de
    // «no se te ha leído la carta», y quien lo prueba necesita saber
    // cuál de las dos es.
    //
    // Y con `sinConfigurar` se enseña ADEMÁS el detalle, que dice POR QUÉ
    // no llega la clave (otro nombre, o sin el ámbito «Functions»). No es
    // un secreto: ahí van NOMBRES de variables, nunca valores. Y es un
    // estado pasajero que desaparece en cuanto el escáner funciona —
    // mientras dura, es la diferencia entre arreglarlo en un minuto y
    // mirar el panel de Netlify a ciegas desde el móvil.
    return { aviso: datos.sinConfigurar && datos.detalle ? `${datos.error} ${datos.detalle}` : datos.error || 'No he podido leer la carta.' }
  }
  // CÓMO SE USA LO LEÍDO, que no es «meterlo todo en el buscador».
  //
  // El buscador cruza contra `name_search`, o sea contra el NOMBRE. Si
  // se le echa el texto entero —«Charizard ex SSP 125»— exige que «SSP»
  // y «125» estén también en el nombre, y no lo están: salen CERO
  // resultados con la carta correcta delante. Lo descubrió la primera
  // prueba del camino completo.
  //
  // Así que cada franja hace su trabajo: la de arriba BUSCA y la de
  // abajo AFINA. El número de la franja del código se usa para quedarse
  // con la carta que lo lleva, que es lo que distingue una Charizard de
  // las otras veinte.
  // LA FRANJA DE ARRIBA NO ES EL NOMBRE (tanda 451). Lleva la fase a la
  // izquierda, el nombre en medio y los puntos de vida con su símbolo a
  // la derecha, y el OCR las lee las tres porque las tres están ahí.
  // PINGU escaneó un Reshiram y en el buscador le quedó «BÁSICO Reshiram
  // EX pv180·»: cero resultados.
  const nombreLeido = escaner.nombreDeLaFranja(datos?.textos?.nombre)
  if (!nombreLeido) return { aviso: 'No he reconocido el nombre. Acerca más la carta.' }
  // ── SI ESO NO PUEDE SER UNA CARTA, SE DICE AQUÍ (tanda 560) ──
  //
  // PINGU escaneó y el aviso dijo «He leído: 19:054 Card Trader 111 5G»:
  // el reloj, el nombre de la app y la cobertura. El marco pilló la
  // PANTALLA del móvil que tenía delante, no la carta de dentro.
  //
  // Hasta ahora eso cerraba el escáner, saltaba a Buscar y enseñaba «no
  // encuentro ninguna carta así» — la MISMA pantalla que cuando la carta
  // no está en el catálogo. Dos cosas muy distintas con la misma cara, y
  // la que toca es «vuelve a encuadrar». Así que el escáner se queda
  // ABIERTO y lo dice: volver a abrirlo para repetir el tiro es la parte
  // que convierte un fallo de encuadre en abandonar.
  const idiomaCarta = $('mcEscanerIdioma')?.value || 'es'
  const juicio = escaner.pareceNombreDeCarta(nombreLeido, idiomaCarta)
  if (!juicio.vale) {
    return {
      aviso: juicio.porque === 'pantalla'
        ? `He leído «${nombreLeido}»: eso es una pantalla, no una carta. Encuadra solo la carta dentro del marco.`
        : `He leído «${nombreLeido}», que no parece el nombre de una carta japonesa. Encuadra solo la carta, o cambia el idioma si no es japonesa.`,
    }
  }
  // El número impreso viene como «22/99»: lo de delante de la barra es
  // la carta, lo de detrás cuántas tiene el set.
  const numero = escaner.numeroDeLaFranja(datos?.textos?.codigo)
  // EN RÁFAGA (719, N4): leer ya NO cierra la cámara. La búsqueda de
  // siempre —con sus cuatro aflojes— rellena Buscar por detrás, y lo
  // primero de lo que encuentre sale en la bandeja con su «+»: se añade
  // y se sigue encuadrando la siguiente. Cerrar deja ver la lista entera.
  ctx.cambiarPestania('buscar')
  // PRIMERO CON EL NÚMERO, Y SI NO SALE NADA, SIN ÉL. Desde la tanda 450
  // el buscador entiende «Mewtwo 64», así que la búsqueda más fina es
  // nombre + número; pero el número lo ha leído un OCR de una foto a
  // pulso, y un 8 donde hay un 6 dejaría cero resultados con la carta
  // delante. Así que se intenta lo preciso y se afloja si no hay nada:
  // nunca se acaba en una pantalla vacía por culpa de una cifra.
  const campo = $('mcBuscarTodo')
  campo.value = numero ? `${nombreLeido} ${numero}` : nombreLeido
  await ctx.buscarEnTodo()
  // ── LO QUE SE HA LEÍDO, DICHO (tanda 558b) ──
  //
  // Sin esto, «no he podido leer el número» y «lo he leído y no casaba»
  // se ven EXACTAMENTE IGUAL: una lista larga de cartas parecidas. Es la
  // familia de siempre —un vacío que se lee como una respuesta— y aquí
  // además deja a quien lo usa sin saber si acercar más la carta o si es
  // que esa carta no está. PINGU vio 23 Charizards y tuvo que
  // adivinar cuál de las dos cosas era.
  let aflojado = numero ? '' : ' · no he podido leer el número'
  if (numero && !$('mcBuscarResultados').querySelector('.mc-resultado')) {
    // Y al aflojar, el número SE TIRA. Aquí vivía `afinarPorNumero`, que
    // lo usaba para subir la carta probable; se quitó al ver que en este
    // punto ese número YA HA FALLADO —si casara con algo, la búsqueda de
    // arriba habría encontrado esa carta—. Volver a confiarle el orden
    // es confiar en una lectura que acaba de demostrarse mala, y lo que
    // haría es poner PRIMERA una carta equivocada: peor que no ordenar.
    campo.value = nombreLeido
    await ctx.buscarEnTodo()
    aflojado = ` · el nº ${numero} no casaba con ninguna`
  }
  // ── Y UN ÚLTIMO INTENTO CON UNA SOLA PALABRA (tanda 558) ──
  //
  // La búsqueda exige TODAS las palabras: un `like` por cada una. Así
  // que basta con que el OCR cuele una basura para que no case nada
  // aunque el nombre esté perfecto — que es exactamente lo que le pasó a
  // PINGU con una リザードンex: en el buscador quedó «己進化 リザードン ex
  // シダードか テ テキス…» y cero resultados.
  //
  // La limpieza de la franja ya quita lo que SE SABE que no es el
  // nombre; esto es la red de debajo, para lo que no se sabe. Se queda
  // con la palabra más larga, que es la que más se parece a un nombre, y
  // afloja todo lo demás. Es el mismo criterio que con el número: lo
  // preciso primero, y si no hay nada, menos exigente.
  if (!$('mcBuscarResultados').querySelector('.mc-resultado')) {
    const palabras = nombreLeido.split(/\s+/).filter((p) => p.length >= 2)
    const masLarga = palabras.length > 1 ? palabras.reduce((a, b) => (b.length > a.length ? b : a)) : null
    if (masLarga) {
      campo.value = masLarga
      await ctx.buscarEnTodo()
      aflojado += ' · he buscado solo por la palabra más larga'
    }
  }
  // ── Y LO ÚLTIMO: LAS MARCAS QUE EL OCR SE COME (tanda 561) ──
  //
  // PINGU escaneó una リザードン y el aviso dijo «He leído: リサードン»:
  // el dakuten de ザ —dos comillitas de dos píxeles— se perdió en la
  // foto. Con un carácter cambiado el `like` se va a cero, y hasta aquí
  // eso se veía como «esa carta no está».
  //
  // Es el error más común leyendo japonés, así que se prueban las
  // variantes del nombre con una marca puesta o quitada, todas en UNA
  // consulta. Va al final porque es lo más flojo que se hace: si algo
  // casó antes, esto ni se pregunta.
  if (!$('mcBuscarResultados').querySelector('.mc-resultado') && tieneCJK(nombreLeido)) {
    const variantes = variantesDeMarcas(nombreLeido)
    if (variantes.length > 1) {
      campo.value = nombreLeido
      await ctx.buscarEnTodo({ variantes })
      if ($('mcBuscarResultados').querySelector('.mc-resultado')) {
        aflojado += ' · puede que se perdiera algún dakuten, he probado las variantes'
      }
    }
  }
  const hay = $('mcBuscarResultados').querySelector('.mc-resultado')
  return { nombreLeido, aflojado, lista: hay ? ctx.ultimaBusqueda.slice(0, 3) : [] }
}

// Lo que antes vivía en `enganchar()` de mi-coleccion.js: se engancha al
// cargar el módulo, que es justo antes de abrir la cámara.
function enganchar() {
  $('mcEscanerVer')?.addEventListener('click', () => cerrarEscaner())
  $('mcEscanerCandidatas')?.addEventListener('click', (e) => {
    const mas = e.target.closest('[data-escaner-anadir]')
    if (mas) return void anadirDesdeEscaner(mas.dataset.escanerAnadir, mas)
    // Tocar la carta abre el diálogo de añadir de siempre, ENCIMA de la
    // cámara (la capa de arriba admite dos): al guardar o cerrar, se
    // vuelve a encuadrar.
    const abrir = e.target.closest('[data-escaner-abrir]')
    const c = abrir && enRafaga.cartas.get(abrir.dataset.escanerAbrir)
    if (c) ctx.abrirAnadir(c.id)
  })
  $('mcEscanerCerrar')?.addEventListener('click', cerrarEscaner)
  $('mcEscanerDisparo')?.addEventListener('click', () => void dispararEscaner())
  // Desde tus fotos (754): el botón abre el selector de la galería.
  for (const i of document.querySelectorAll('[data-icono-escaner]')) i.innerHTML = icons[i.dataset.iconoEscaner]?.(20) || ''
  $('mcEscanerFotos')?.addEventListener('click', () => $('mcEscanerFicheros')?.click())
  $('mcEscanerFicheros')?.addEventListener('change', (e) => {
    const ficheros = [...(e.target.files || [])]
    e.target.value = ''
    void leerFotos(ficheros)
  })
  // Y con la tecla de escape, que es como se cierra un diálogo. El evento
  // `close` lo cubre todo: lo dispara tanto el botón como el escape, así
  // que la cámara se apaga por los dos caminos sin escribirlo dos veces.
  $('mcEscanerCaja')?.addEventListener('close', cerrarEscaner)
}
