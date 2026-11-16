// LA POKÉDEX DE MI COLECCIÓN, aparte (tanda 1011): la rejilla por regiones,
// una especie con sus filtros y los mandos de las dos. Entra por import() al
// abrir la pestaña (o una especie por su dirección); el estado que lee la
// dirección y el cambio de catálogo (`pokedex`, `especieAbierta`, las
// chapas) sigue en mi-coleccion.js y llega en `ctx` con getters y setters
// (895). Lo que la ficha necesita de aquí —las cartas de la especie abierta,
// que no son tuyas y no están en `cartas`— se lee con `cartasDeLaEspecieAhora`.
import { escapeHtml } from '../app.js'
import { normalizeSearch } from '../texto.js'
import { esDelTCG, nombreDeSet, nombresDeCartaParaBuscar } from '../catalogo-series.js'
import * as datos from './datos.js'
import { FILTROS_CATALOGO, filtrosCatalogoVacios, valoresDeCartas, pasaFiltrosDeCarta } from './filtros.js'
import { variantesDeCarta, pegarVersiones } from './variantes.js'
import { porNumero } from './orden.js'
import { rangoDeCarta } from '../rareza-escala.js'
import { hojaInyectada } from '../hoja.js'
import { meterEnLaHoja } from './hoja-filtros.js'

const $ = (id) => document.getElementById(id)

// Lo compartido con mi-coleccion.js llega aquí (ver `ctxPokedex` allí).
let ctx = null
// Su CSS (css/mc-pokedex.css, 1011) entra con el módulo, y lo que pinta
// espera a que esté para no salir un instante sin estilo (748).
let hojaLista = Promise.resolve()
export function montar(c) {
  ctx = c
  hojaLista = hojaInyectada('css/mc-pokedex.css')
  enganchar()
}

export const cartasDeLaEspecieAhora = () => cartasDeLaEspecie

// ── La Pokédex (tanda 381) ──
//
// Lo que TIENES no se consulta: tu colección ya está en memoria y de qué
// Pokémon es cada carta sale de su nombre. Lo único que se pregunta es
// cuántas hay en el catálogo de cada una, una vez por visita.
export async function abrirPokedex() {
  const caja = $('mcPokedexPanel')
  if (!caja) return
  await hojaLista
  if (!ctx.pokedexCargada) {
    caja.innerHTML = '<div class="skeleton" style="height:240px"></div>'
    try {
      const [modulo, totales] = await Promise.all([
        import('./pokedex.js'),
        datos.pokedexResumen(ctx.mercado).catch(() => []),
      ])
      ctx.pokedex = modulo
      ctx.totalesPokedex = new Map((totales || []).map((f) => [Number(f.dex), Number(f.cartas)]))
      ctx.pokedexCargada = true
    } catch (err) {
      caja.innerHTML = `<p class="empty-state">${escapeHtml(err.message)}</p>`
      return
    }
  }
  // `?dex=25` entra directa a una especie (tanda 384): es lo que hace
  // que el enlace desde la ficha de una carta lleve a algún sitio y no
  // a una rejilla de 1.025 donde hay que buscarla otra vez.
  const pedida = Number(ctx.params.get('dex'))
  if (!ctx.especieAbierta && pedida >= 1 && pedida <= 1025) ctx.especieAbierta = pedida
  if (ctx.especieAbierta) return pintarEspecie(ctx.especieAbierta)
  pintarPokedex()
}

// La región que se mira en la Pokédex (748): la primera, al entrar.
let pdxRegion = 0
// Lo de la hoja de Filtros de la lista (1370): Mostrar, Ordenar y Tipo.
let pdxMostrar = 'todos'
let pdxOrden = 'dex'
const pdxTipos = new Set()

export function pintarPokedex() {
  const caja = $('mcPokedexPanel')
  $('mcPdxMandos').classList.remove('hidden')
  const mio = ctx.pokedex.loMioPorEspecie(ctx.lineas, ctx.cartas)
  const tipos = ctx.pokedex.tiposPorEspecie(ctx.lineas, ctx.cartas)
  // Sin tu colección no hay «los que tengo»: Mostrar no sale y no filtra.
  const tuya = Boolean(ctx.esMia && ctx.sesion)
  const mostrar = tuya ? pdxMostrar : 'todos'
  const filas = ctx.pokedex.filasDePokedex({
    mio,
    totales: ctx.totalesPokedex,
    mostrar,
    texto: $('mcPdxBuscar').value,
    tipos,
    tiposPuestos: pdxTipos,
  })
  // La cabecera con las cuatro cifras (tanda 400), y debajo la rejilla.
  // Se pinta siempre, incluso filtrando: «llevas 701 de 1.025» no puede
  // cambiar porque estés buscando «char», igual que el progreso de un
  // set no cambia al filtrar por rareza.
  const resumen = ctx.pokedex.resumenDePokedex({ mio, totales: ctx.totalesPokedex })
  // Como en su maqueta (748): el título con la región y el anillo, las
  // pestañas por región y la rejilla de UNA región. Buscando o en «los que
  // casi completas», la lista de siempre: ahí la región no ayuda.
  const orden = !tuya && (pdxOrden === 'cerca' || pdxOrden === 'mas') ? 'dex' : pdxOrden
  const buscando = Boolean(String($('mcPdxBuscar').value || '').trim())
  const todas = ctx.pokedex.filasDePokedex({ mio, totales: ctx.totalesPokedex, tipos })
  const encabezado = $('mcPdxEncabezado')
  // La banda del PC (1217) lleva la hoja de las bandas.
  if (encabezado) import('../hoja.js').then((m) => m.hojaInyectada('css/seccion.css')).catch(() => {})
  if (encabezado) encabezado.innerHTML = ctx.pokedex.encabezadoHtml(todas, { region: pdxRegion, registrados: resumen.registrados })
  // Las regiones salieron de la página a su hoja (1370): la fila lleva
  // «Kanto ▾» con lo que llevas, y solo cuando la lista es por regiones.
  const porRegiones = !buscando && orden === 'dex'
  caja.innerHTML = porRegiones ? ctx.pokedex.rejillaDeRegionHtml(filas, pdxRegion) : ctx.pokedex.rejillaHtml(filas, orden)
  const region = ctx.pokedex.regionDe(pdxRegion, todas)
  const boton = $('mcPdxRegionAbrir')
  if (boton) {
    boton.classList.toggle('hidden', !porRegiones)
    boton.setAttribute('aria-label', `Región: ${region.nombre}, llevas ${region.tengo} de ${region.total}`)
    $('mcPdxRegionRotulo').textContent = region.nombre
    $('mcPdxRegionCuenta').textContent = region.total ? `${region.tengo}/${region.total}` : ''
  }
  if ($('mcPdxRegionLista')) $('mcPdxRegionLista').innerHTML = ctx.pokedex.regionesHtml(pdxRegion, todas)
  // La hoja de Filtros de la lista: la misma hoja que la de una especie, con
  // sus grupos; se cambian enteros al pintar una u otra (`meterEnLaHoja`).
  meterEnLaHoja($('mcPdxGrupos'), ctx.pokedex.gruposDeListaHtml({ mostrar, orden, tipos: pdxTipos, conMostrar: tuya }))
  if ($('mcPdxFiltrosVer')) $('mcPdxFiltrosVer').textContent = filas.length ? `Ver ${filas.length.toLocaleString('es-ES', { useGrouping: 'always' })} Pokémon` : 'Ningún Pokémon: afloja algún filtro'
  const puestos = (mostrar !== 'todos' ? 1 : 0) + pdxTipos.size
  const cuenta = $('mcPdxFiltrosCuenta')
  if (cuenta) {
    cuenta.textContent = puestos ? String(puestos) : ''
    cuenta.classList.toggle('hidden', !puestos)
  }
  $('mcPdxAbrirFiltros')?.classList.toggle('mc-filtros-puestos', puestos > 0)
  // El contador de arriba cuenta especies DISTINTAS, no cartas: es una
  // Pokédex, y lo que se llena son huecos de Pokémon.
  // Lo dice el anillo de arriba (748): aquí solo para quien lee en voz alta.
  $('mcPdxCuenta').textContent = `${resumen.registrados} de 1.025 Pokémon`
  $('mcPdxCuenta').classList.add('sr-only')
}

let cartasDeLaEspecie = []
// Los filtros de la especie abierta (tanda 453). Se vacían al abrir otra:
// las rarezas de un Pikachu no son las de un Charizard, así que arrastrar
// un filtro de una especie a la siguiente dejaría la pantalla vacía sin
// que nada dijera por qué.
const filtrosEspecie = filtrosCatalogoVacios()
let textoEspecie = ''
// Cómo se ordenan las cartas de una especie (1370): se queda al pasar de un
// Pokémon a otro, como el de una expansión.
let ordenEspecie = 'nuevas'
const fechaDe = (c) => String(c.tcg_sets?.release_date || '')
function ordenarEspecie(lista) {
  const l = [...lista]
  if (ordenEspecie === 'antiguas') return l.sort((a, b) => fechaDe(a).localeCompare(fechaDe(b)) || porNumero(a, b))
  if (ordenEspecie === 'rareza') {
    // Las que no se saben, al final (la regla de `ordenar`, 427).
    return l.sort((a, b) => {
      const ra = rangoDeCarta(a)
      const rb = rangoDeCarta(b)
      if (ra === null && rb === null) return porSetYNumero(a, b)
      if (ra === null) return 1
      if (rb === null) return -1
      return rb - ra || porSetYNumero(a, b)
    })
  }
  if (ordenEspecie === 'nombre') return l.sort((a, b) => ctx.nombreDe(a).localeCompare(ctx.nombreDe(b), 'es') || porSetYNumero(a, b))
  return l.sort(porSetYNumero)
}

// Repinta la especie abierta con los filtros puestos. Las cartas no se
// vuelven a pedir: están todas en memoria desde que se abrió, así que
// aquí se filtra en memoria —al revés que en Buscar, donde la consulta
// trae 120 de 21.000 y filtrar lo que vuelve sería filtrar la muestra.
// «Tengo» de la barra de una especie (1054); «Faltan» sigue en ctx.pdxSoloFaltan.
let soloTengo = false
function pintarEspecieFiltrada() {
  const caja = $('mcPokedexPanel')
  if (!caja || ctx.especieAbierta == null) return
  // «La tengo» en el idioma elegido, o en cualquiera (577). Y por versión
  // (692): con las variantes separadas cada casilla es UNA versión.
  const mias = ctx.lineas.filter((l) => !ctx.pdxIdioma || l.idioma === ctx.pdxIdioma)
  const tuyas = new Set(mias.map((l) => l.card_id))
  const tuyasPorVersion = new Map()
  for (const l of mias) tuyasPorVersion.set(l.card_id, (tuyasPorVersion.get(l.card_id) || new Map()).set(l.variante || 'normal', (tuyasPorVersion.get(l.card_id)?.get(l.variante || 'normal') || 0) + (Number(l.cantidad) || 1)))
  const versionesDe = (c) => variantesDeCarta(c).map((v) => ({ id: v.nuestro, nombre: v.nombre, corto: v.corto }))
  const tengoVersion = (c, id) => tuyasPorVersion.get(c.id)?.get(id) || 0
  const grupos = valoresDeCartas(cartasDeLaEspecie, ctx.AYUDAS)
  // Se compara por el RÓTULO traducido y no por el valor crudo: la columna
  // tiene las dos formas mezcladas porque TCGdex traduce los enums y el
  // catálogo se ha importado en varios idiomas (tanda 455).
  const texto = normalizeSearch(textoEspecie).trim()
  const lista = cartasDeLaEspecie.filter((c) => {
    // Con las versiones separadas, «me falta» es que falte ALGUNA versión;
    // y «la tengo» (1054), que tengas alguna.
    const laTengo = ctx.album.split ? versionesDe(c).some((v) => tengoVersion(c, v.id) > 0) : tuyas.has(c.id)
    if (ctx.pdxSoloFaltan && (ctx.album.split ? versionesDe(c).every((v) => tengoVersion(c, v.id) > 0) : tuyas.has(c.id))) return false
    if (soloTengo && !laTengo) return false
    if (!pasaFiltrosDeCarta(c, filtrosEspecie, ctx.AYUDAS)) return false
    // Por nombre, número o ilustrador, igual que el buscador de Buscar
    // (tanda 458). Aquí se hace en memoria porque las cartas de la especie
    // ya están todas cargadas; allí va en la consulta porque son 21.000.
    if (!texto) return true
    return normalizeSearch(`${nombresDeCartaParaBuscar(c)} ${c.local_id || ''} ${c.illustrator || ''} ${nombreDeSet(c.tcg_sets)}`).includes(texto)
  })
  // Los chips viven en el panel, que está FUERA de la caja que se repinta:
  // si se pintaran dentro, abrir el panel después de filtrar enseñaría los
  // de antes.
  const hueco = $('mcPdxGrupos')
  const tuya = ctx.esMia && ctx.sesion
  meterEnLaHoja(hueco, ctx.pokedex.gruposDeEspecieHtml(grupos, filtrosEspecie, { idioma: ctx.pdxIdioma, idiomas: tuya ? ctx.idiomasDeLaVista() : [], que: ctx.pdxSoloFaltan ? 'faltan' : soloTengo ? 'tengo' : 'todas', conMostrar: tuya, orden: ordenEspecie }))
  ctx.rotularVer('mcPdxFiltrosVer', lista.length)
  caja.innerHTML = ctx.pokedex.especieHtml({
    dex: ctx.especieAbierta,
    cartas: ordenarEspecie(lista),
    tuyas,
    sinCatalogo: cartasDeLaEspecie.length === 0,
    grupos,
    puestos: filtrosEspecie,
    deCuantas: cartasDeLaEspecie.length,
    texto: textoEspecie,
    que: ctx.pdxSoloFaltan ? 'faltan' : soloTengo ? 'tengo' : 'todas',
    puedeMarcar: Boolean(ctx.esMia && ctx.sesion),
    idioma: ctx.pdxIdioma,
    idiomas: ctx.esMia && ctx.sesion ? ctx.idiomasDeLaVista() : [],
    separadas: ctx.album.split,
    versionesDe,
    tengoVersion,
    masDe: (c, variante) => ctx.masHtml(c, ctx.nombreDe(c), variante),
    // Las marcas de la expansión, también aquí (943). PINGU: «en la Pokédex
    // no tenemos el corazoncito… debería estar en cualquier lado de la web».
    // Cuentan en el idioma del filtro de la especie, como el «la tengo».
    marcasDe: (c, variante) => {
      const enIdioma = (id, v = null) => ctx.tengoDe(id, v, ctx.pdxIdioma || null)
      const n = variante ? tengoVersion(c, variante) : enIdioma(c.id)
      const vs = n && !variante ? ctx.versionesQueTienes(c, enIdioma) : []
      return ctx.marcaDeTengoHtml(n, vs) + ctx.quieroHtml(c.id, n)
    },
    quiereDe: (c) => ctx.laQuieres(c.id),
  })
  // El selector de catálogo se repinta porque la cabecera entera es HTML
  // nuevo: sus `<option>` los pone `pintarVistas`, y sin esta llamada
  // saldría vacío — un desplegable sin opciones es peor que no tenerlo.
  ctx.pintarVistas()
  ctx.pintarIconos()
}

export async function pintarEspecie(dex, { push = true } = {}) {
  const caja = $('mcPokedexPanel')
  await hojaLista
  if (push) ctx.irA({ ver: 'pokedex', dex })
  ctx.especieAbierta = dex
  $('mcPdxMandos').classList.add('hidden')
  // El título de la Pokédex es de la rejilla, no de una especie (748).
  if ($('mcPdxEncabezado')) $('mcPdxEncabezado').innerHTML = ''
  caja.innerHTML = '<div class="skeleton" style="height:240px"></div>'
  let delCatalogo = []
  try {
    delCatalogo = await datos.cartasDeEspecie(dex, 300, ctx.mercado)
  } catch {
    // Que no se vea el catálogo no puede dejar la pantalla en blanco:
    // abajo se enseña lo tuyo igualmente.
  }
  const tuyas = new Set(ctx.lineas.map((l) => l.card_id))
  // Las TUYAS salen siempre, vengan o no del catálogo. Mientras la
  // columna `dex_ids` se esté rellenando, la consulta de arriba devuelve
  // poco o nada — y lo tuyo es justo lo que has venido a ver. Se saca
  // del NOMBRE, que ya está en memoria, así que no cuesta nada.
  // Sin TCG Pocket (694): la consulta va por `dex_ids` y los sets de
  // Pocket también los llevan. PINGU: «ya dijimos que eso fuera».
  const porId = new Map(delCatalogo.filter((c) => esDelTCG(c.tcg_sets || { id: c.set_id })).map((c) => [c.id, c]))
  for (const id of tuyas) {
    const c = ctx.cartas.get(id)
    if (c && !porId.has(id) && ctx.pokedex.esDeLaEspecie(c, dex)) porId.set(id, c)
  }
  const lista = [...porId.values()].sort(porSetYNumero)
  // Sus versiones de verdad (935): las de TCGGO, las de a mano (el Pikachu de
  // Pokémon Day) y las ediciones de Wizards. Sin ellas la especie solo sabía
  // lo que dice TCGdex, y PINGU veía la versión en la ficha y no aquí.
  pegarVersiones(lista, await datos.versionesDeCartas(lista.map((c) => c.id)).catch(() => []))
  ctx.corregirConVersiones(lista)
  // Otra especie abierta mientras llegaban: esta ya no se pinta.
  if (ctx.especieAbierta !== dex) return
  // Se guardan para la ficha (tanda 418): al pulsar una carta de aquí
  // hay que poder pintarla, y las que no son tuyas no están en `cartas`.
  cartasDeLaEspecie = lista
  for (const g of FILTROS_CATALOGO) filtrosEspecie[g.id].clear()
  textoEspecie = ''
  // Y los de la 577, por lo mismo: una especie no hereda lo de otra.
  ctx.pdxSoloFaltan = false
  soloTengo = false
  ctx.pdxIdioma = ''
  pintarEspecieFiltrada()
}

// Por colección y, dentro, por número impreso: es el orden del álbum, y
// así una especie se lee como se leería en el archivador.
function porSetYNumero(a, b) {
  const fa = a.tcg_sets?.release_date || ''
  const fb = b.tcg_sets?.release_date || ''
  return String(fb).localeCompare(String(fa)) || porNumero(a, b)
}

function enganchar() {
  // ── La Pokédex (tanda 381) ──
  //
  // Los dos mandos y la delegación del clic van AQUÍ y no dentro de la
  // pestaña: el panel se repinta entero en cada filtro, así que un
  // oyente puesto dentro se duplicaría en cada tecla. La caja de fuera
  // no se repinta nunca.
  $('mcPdxBuscar').addEventListener('input', () => {
    // Al filtrar se vuelve a la rejilla: filtrar con una especie
    // abierta no significa nada.
    ctx.especieAbierta = null
    if (ctx.pokedexCargada) pintarPokedex()
  })
  // La fila (1370): Filtros abre la hoja común y «Kanto ▾» la de regiones.
  // Las dos hojas se cierran tocando fuera, como las demás.
  $('mcPdxAbrirFiltros')?.addEventListener('click', () => $('mcPdxPanelFiltros').showModal())
  $('mcPdxRegionAbrir')?.addEventListener('click', () => {
    $('mcPdxRegionHoja').showModal()
    $('mcPdxRegionLista')?.querySelector('.activa')?.focus()
  })
  $('mcPdxRegionCerrar')?.addEventListener('click', () => $('mcPdxRegionHoja').close())
  $('mcPdxRegionHoja')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close() })
  $('mcPanelPokedex').addEventListener('click', (e) => {
    const region = e.target.closest('[data-pdx-region]')
    if (region) {
      pdxRegion = Number(region.dataset.pdxRegion) || 0
      $('mcPdxRegionHoja')?.close()
      pintarPokedex()
      $('mcPokedexPanel')?.querySelector('.pdx-regiones .activa')?.scrollIntoView({ block: 'nearest', inline: 'center' })
      return
    }
    const especie = e.target.closest('[data-dex]')
    if (especie) return pintarEspecie(Number(especie.dataset.dex))
    if (e.target.closest('#pdxVolver')) ctx.subirNivel()
  })
  $('mcPokedexPanel')?.addEventListener('click', (e) => {
    if (e.target.closest('#pdxAbrirFiltros')) $('mcPdxPanelFiltros').showModal()
    // Juntas / separadas, la MISMA memoria que en una expansión (692):
    // quien colecciona set maestro lo quiere igual en los dos sitios.
    if (e.target.closest('#pdxVariantes')) {
      ctx.album.split = !ctx.album.split
      try { localStorage.setItem('mc-split', ctx.album.split ? '1' : '0') } catch {}
      ctx.pintarVistaVariantes()
      pintarEspecieFiltrada()
    }
  })
  // En DELEGACIÓN, no en el campo: la cabecera de la especie se vuelve a
  // pintar entera con cada tecla, así que un oyente puesto sobre el
  // `<input>` se perdería con el primer repintado. Y el foco y el cursor
  // se devuelven a mano por lo mismo.
  $('mcPokedexPanel')?.addEventListener('input', (e) => {
    if (e.target.id !== 'pdxEspecieBuscar') return
    const donde = e.target.selectionStart
    textoEspecie = e.target.value
    pintarEspecieFiltrada()
    const campo = $('pdxEspecieBuscar')
    if (campo) {
      campo.focus()
      campo.setSelectionRange(donde, donde)
    }
  })
  $('mcPdxGrupos')?.addEventListener('click', (e) => {
    // La lista (1370): Mostrar, Ordenar y Tipo.
    const lista = e.target.closest('[data-pdxl-mostrar], [data-pdxl-orden], [data-pdxl-tipo]')
    if (lista) {
      if (lista.dataset.pdxlMostrar) {
        pdxMostrar = lista.dataset.pdxlMostrar
        ctx.pdxSoloMios = pdxMostrar === 'tengo'
      } else if (lista.dataset.pdxlOrden) pdxOrden = lista.dataset.pdxlOrden
      else if (pdxTipos.has(lista.dataset.pdxlTipo)) pdxTipos.delete(lista.dataset.pdxlTipo)
      else pdxTipos.add(lista.dataset.pdxlTipo)
      ctx.especieAbierta = null
      return pintarPokedex()
    }
    // El orden de una especie (1370).
    const ordenE = e.target.closest('[data-pdx-orden]')
    if (ordenE) {
      ordenEspecie = ordenE.dataset.pdxOrden
      return pintarEspecieFiltrada()
    }
    // Todas / Tengo / Faltan (1054; era «Solo las que me faltan», 577), en la
    // hoja desde la 1369, como en una expansión.
    const que = e.target.closest('[data-pdx-que]')
    if (que) {
      ctx.pdxSoloFaltan = que.dataset.pdxQue === 'faltan'
      soloTengo = que.dataset.pdxQue === 'tengo'
      return pintarEspecieFiltrada()
    }
    // El idioma de tus copias (577), en la hoja desde la 1055.
    const idioma = e.target.closest('[data-pdx-idioma]')
    if (idioma) {
      ctx.pdxIdioma = idioma.dataset.pdxIdioma
      return pintarEspecieFiltrada()
    }
    const chip = e.target.closest('[data-egrupo]')
    if (!chip) return
    const conjunto = filtrosEspecie[chip.dataset.egrupo]
    if (conjunto.has(chip.dataset.evalor)) conjunto.delete(chip.dataset.evalor)
    else conjunto.add(chip.dataset.evalor)
    pintarEspecieFiltrada()
  })
  $('mcPdxFiltrosCerrar')?.addEventListener('click', () => $('mcPdxPanelFiltros').close())
  $('mcPdxFiltrosVer')?.addEventListener('click', () => $('mcPdxPanelFiltros').close())
  $('mcPdxFiltrosLimpiar')?.addEventListener('click', () => {
    // En la lista, Mostrar y Tipo (el orden no es un filtro y se queda).
    if (!ctx.especieAbierta) {
      pdxMostrar = 'todos'
      ctx.pdxSoloMios = false
      pdxTipos.clear()
      return pintarPokedex()
    }
    for (const g of FILTROS_CATALOGO) filtrosEspecie[g.id].clear()
    ctx.pdxIdioma = ''
    ctx.pdxSoloFaltan = false
    soloTengo = false
    pintarEspecieFiltrada()
  })
  $('mcPdxPanelFiltros')?.addEventListener('click', (e) => {
    const c = e.currentTarget.getBoundingClientRect()
    const dentro = e.clientX >= c.left && e.clientX <= c.right && e.clientY >= c.top && e.clientY <= c.bottom
    if (!dentro) e.currentTarget.close()
  })
}
