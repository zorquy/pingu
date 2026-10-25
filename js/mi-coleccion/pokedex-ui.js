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
import { hojaInyectada } from '../hoja.js'

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

export function pintarPokedex() {
  const caja = $('mcPokedexPanel')
  $('mcPdxMandos').classList.remove('hidden')
  const mio = ctx.pokedex.loMioPorEspecie(ctx.lineas, ctx.cartas)
  const filas = ctx.pokedex.filasDePokedex({
    mio,
    totales: ctx.totalesPokedex,
    soloMios: ctx.pdxSoloMios,
    texto: $('mcPdxBuscar').value,
    tipos: ctx.pokedex.tiposPorEspecie(ctx.lineas, ctx.cartas),
  })
  // La cabecera con las cuatro cifras (tanda 400), y debajo la rejilla.
  // Se pinta siempre, incluso filtrando: «llevas 701 de 1.025» no puede
  // cambiar porque estés buscando «char», igual que el progreso de un
  // set no cambia al filtrar por rareza.
  const resumen = ctx.pokedex.resumenDePokedex({ mio, totales: ctx.totalesPokedex })
  // Como en su maqueta (748): el título con la región y el anillo, las
  // pestañas por región y la rejilla de UNA región. Buscando o en «los que
  // casi completas», la lista de siempre: ahí la región no ayuda.
  const orden = $('mcPdxOrden')?.value || 'dex'
  const buscando = Boolean(String($('mcPdxBuscar').value || '').trim())
  const todas = ctx.pokedex.filasDePokedex({ mio, totales: ctx.totalesPokedex, soloMios: ctx.pdxSoloMios, tipos: ctx.pokedex.tiposPorEspecie(ctx.lineas, ctx.cartas) })
  const encabezado = $('mcPdxEncabezado')
  if (encabezado) encabezado.innerHTML = ctx.pokedex.encabezadoHtml(todas, { region: pdxRegion, registrados: resumen.registrados })
  caja.innerHTML = buscando || orden !== 'dex'
    ? ctx.pokedex.rejillaHtml(filas, orden)
    : ctx.pokedex.regionesHtml(pdxRegion, ctx.pdxSoloMios ? ctx.pokedex.filasDePokedex({ mio, totales: ctx.totalesPokedex, soloMios: false, tipos: ctx.pokedex.tiposPorEspecie(ctx.lineas, ctx.cartas) }) : todas) + ctx.pokedex.rejillaDeRegionHtml(filas, pdxRegion)
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

// Repinta la especie abierta con los filtros puestos. Las cartas no se
// vuelven a pedir: están todas en memoria desde que se abrió, así que
// aquí se filtra en memoria —al revés que en Buscar, donde la consulta
// trae 120 de 21.000 y filtrar lo que vuelve sería filtrar la muestra.
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
    // Con las versiones separadas, «me falta» es que falte ALGUNA versión.
    if (ctx.pdxSoloFaltan && (ctx.album.split ? versionesDe(c).every((v) => tengoVersion(c, v.id) > 0) : tuyas.has(c.id))) return false
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
  if (hueco) hueco.innerHTML = ctx.pokedex.gruposDeEspecieHtml(grupos, filtrosEspecie)
  ctx.rotularVer('mcPdxFiltrosVer', lista.length)
  caja.innerHTML = ctx.pokedex.especieHtml({
    dex: ctx.especieAbierta,
    cartas: lista,
    tuyas,
    sinCatalogo: cartasDeLaEspecie.length === 0,
    grupos,
    puestos: filtrosEspecie,
    deCuantas: cartasDeLaEspecie.length,
    texto: textoEspecie,
    soloFaltan: ctx.pdxSoloFaltan,
    idioma: ctx.pdxIdioma,
    idiomas: ctx.idiomasDeLaVista(),
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
  for (const id of ['mcPdxBuscar', 'mcPdxOrden']) {
    $(id).addEventListener(id === 'mcPdxBuscar' ? 'input' : 'change', () => {
      // Al filtrar se vuelve a la rejilla: filtrar con una especie
      // abierta no significa nada.
      ctx.especieAbierta = null
      if (ctx.pokedexCargada) pintarPokedex()
    })
  }
  // «Solo los que tengo» es una CHAPA desde la 465, así que su estado lo
  // guarda una variable y no un `checked`.
  $('mcPdxSoloMios').addEventListener('click', () => {
    ctx.pdxSoloMios = !ctx.pdxSoloMios
    $('mcPdxSoloMios').classList.toggle('activo', ctx.pdxSoloMios)
    $('mcPdxSoloMios').setAttribute('aria-pressed', ctx.pdxSoloMios ? 'true' : 'false')
    ctx.especieAbierta = null
    if (ctx.pokedexCargada) pintarPokedex()
  })
  $('mcPanelPokedex').addEventListener('click', (e) => {
    const region = e.target.closest('[data-pdx-region]')
    if (region) {
      pdxRegion = Number(region.dataset.pdxRegion) || 0
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
    if (e.target.closest('#pdxSoloFaltan')) {
      ctx.pdxSoloFaltan = !ctx.pdxSoloFaltan
      pintarEspecieFiltrada()
    }
    // Juntas / separadas, la MISMA memoria que en una expansión (692):
    // quien colecciona set maestro lo quiere igual en los dos sitios.
    if (e.target.closest('#pdxVariantes')) {
      ctx.album.split = !ctx.album.split
      try { localStorage.setItem('mc-split', ctx.album.split ? '1' : '0') } catch {}
      ctx.pintarVistaVariantes()
      pintarEspecieFiltrada()
    }
  })
  // El idioma de la especie, en delegación por lo mismo que el buscador:
  // la cabecera se repinta entera.
  $('mcPokedexPanel')?.addEventListener('change', (e) => {
    if (e.target.id !== 'pdxIdioma') return
    ctx.pdxIdioma = e.target.value
    pintarEspecieFiltrada()
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
    for (const g of FILTROS_CATALOGO) filtrosEspecie[g.id].clear()
    pintarEspecieFiltrada()
  })
  $('mcPdxPanelFiltros')?.addEventListener('click', (e) => {
    const c = e.currentTarget.getBoundingClientRect()
    const dentro = e.clientX >= c.left && e.clientX <= c.right && e.clientY >= c.top && e.clientY <= c.bottom
    if (!dentro) e.currentTarget.close()
  })
}
