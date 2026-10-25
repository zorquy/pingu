// IMPORTAR, EXPORTAR Y «MI COLECCIÓN EN UNA IMAGEN», aparte (tanda 1011):
// lo que arranca desde tres botones que solo tiene quien mira SU colección.
// mi-coleccion.js escucha esos botones y, al primer toque, baja este módulo
// y le pasa el botón (`pulsar`); el estado llega en `ctx` (getters: cambia
// mientras se usa), como en el Panel de la 895.
import { escapeHtml } from '../app.js'
import { euros } from '../cardmarket.js'
import { cadenaDeEscaneo } from '../escaneo-carta.js'
import { nombreDeSet, padreDeColeccion } from '../catalogo-series.js'
import { rarezaDeCarta } from '../carta-traducciones.js'
import * as datos from './datos.js'

const $ = (id) => document.getElementById(id)

// Lo compartido con mi-coleccion.js llega aquí (ver `ctxExtras` allí).
let ctx = null
export function montar(c) {
  ctx = c
  enganchar()
}

// El botón que se pulsó: importar, exportar o la imagen.
export function pulsar(boton) {
  if (boton.matches('#mcImagenCrear')) return crearImagen()
  return importarOExportar(boton)
}

// ── Importar y exportar (tanda 580) ──
async function importarOExportar(boton) {
  if (boton.matches('#mcImportarAbrir, .mc-importar-abrir')) {
    const { abrirImportar } = await import('./importar.js')
    abrirImportar({
      sesion: ctx.sesion,
      mercado: ctx.mercado,
      alTerminar: async () => {
        await ctx.cargarColeccion(ctx.dueno.id)
        ctx.repintar()
      },
    })
  } else if (boton.matches('#mcExportar')) {
    const { descargarExport } = await import('./importar.js')
    const todas = ctx.lineasTodo.length ? ctx.lineasTodo : ctx.lineas
    descargarExport({ lineas: todas, cartaDe: (l) => ctx.cartasTodo.get(datos.claveDeLineaEnMercado(l)) || ctx.cartas.get(l.card_id) || null })
  }
}

// ── Mi colección en una imagen (tanda 571; cinco dibujos desde la 689) ──
// El carrusel: un lienzo a la vista y uno escondido por variante, que se
// pinta la primera vez que se pasa por ella y se copia al visible. Así
// pasar de una a otra es instantáneo y compartir coge siempre lo que se
// ve. `window.__mcImagenDatos` y `__mcImagenVariante` quedan a mano para
// la prueba y para depurar.
const carrusel = { indice: 0, datos: null, pintados: new Map(), version: 0 }
const variantesDeImagen = async () => (await import('./imagen.js')).VARIANTES_IMAGEN
async function enseñarVariante(i) {
  const variantes = await variantesDeImagen()
  carrusel.indice = (i + variantes.length) % variantes.length
  const v = variantes[carrusel.indice]
  window.__mcImagenVariante = v.id
  const rotulo = $('mcImagenRotulo')
  if (rotulo) rotulo.textContent = `${v.nombre} · ${carrusel.indice + 1} de ${variantes.length}`
  document.querySelectorAll('#mcImagenPuntos .mc-imagen-punto').forEach((b, k) => b.setAttribute('aria-current', k === carrusel.indice ? 'true' : 'false'))
  const visible = $('mcImagenLienzo')
  const version = carrusel.version
  let escondido = carrusel.pintados.get(v.id)
  if (!escondido) {
    escondido = document.createElement('canvas')
    escondido.width = visible.width
    escondido.height = visible.height
    visible.classList.add('mc-imagen-pintando')
    await v.pintar(escondido, carrusel.datos)
    // Si mientras se pintaba se cerró y se volvió a abrir con otros
    // datos, lo pintado es de la pintada vieja (la 663): no se guarda.
    if (version !== carrusel.version) return
    carrusel.pintados.set(v.id, escondido)
  }
  if (carrusel.indice !== variantes.indexOf(v)) return
  visible.getContext('2d').drawImage(escondido, 0, 0)
  visible.classList.remove('mc-imagen-pintando')
}
async function crearImagen() {
  const d = $('mcImagenDialogo')
  if (!d || !ctx.resumenHero) return
  const [ls, clave, busca] = ctx.pTodo()
  // Las tres que más valen siguen en los datos (la prueba de la 571 las
  // mira), pero desde la 691 ningún dibujo las pinta: la imagen no va de
  // dinero.
  const valiosas = ctx.masValiosas(3, ls, clave, busca).map((v) => ({
    nombre: ctx.nombreDe(v.carta),
    cadena: cadenaDeEscaneo(v.carta, v.carta?.tcg_sets?.tcg_online_code || null, 'high'),
    valor: euros(v.valor),
    expansion: nombreDeSet(v.carta?.tcg_sets) || v.carta?.set_id || '',
    anio: v.carta?.tcg_sets?.release_date ? String(v.carta.tcg_sets.release_date).slice(0, 4) : '',
    rareza: rarezaDeCarta(v.carta) || '',
  }))
  // La expansión más completa: la misma cuenta que el vistazo de
  // Expansiones, y el total oficial del set.
  const sets = await ctx.cargarSets().catch(() => null)
  let mejorSet = null
  for (const s of sets || []) {
    const suyas = [...ctx.cartas.values()].filter((c) => c?.set_id && (padreDeColeccion(c.set_id) || c.set_id) === s.id)
    const tengo = suyas.filter((c) => ctx.tengoDe(c.id) > 0).length
    const total = Number(s.card_count_total) || Number(s.card_count_official) || suyas.length
    if (!tengo || !total) continue
    const pct = tengo / total
    if (!mejorSet || pct > mejorSet.pct) mejorSet = { nombre: nombreDeSet(s) || s.id, tengo, total, pct }
  }
  // Lo que cuentan los dibujos (689, 691): el equipo, el perfil, el
  // viaje y la Pokédex. Sin un euro.
  const { cartasDistintas, resumenDelMes, resumenDePokedex, masRepetido, equipoDe6, viajeEnElTiempo, perfilDeColeccionista } = await import('./imagen-datos.js')
  const { urlDeSprite, cadenaDeRespaldos } = await import('../torneos/sprites-pokemon.js')
  const distintas = cartasDistintas(ls, busca)
  const conCadena = (c) => ({ nombre: ctx.nombreDe(c), cadena: cadenaDeEscaneo(c, c?.tcg_sets?.tcg_online_code || null, 'high'), expansion: nombreDeSet(c?.tcg_sets) || c?.set_id || '' })
  const mes = resumenDelMes(distintas, { nombreDeSet: (c) => nombreDeSet(c?.tcg_sets) || c?.set_id || '' })
  const pokedex = resumenDePokedex(distintas)
  const favorito = masRepetido(distintas)
  const alCien = (sets || []).filter((s) => {
    const suyas = [...ctx.cartas.values()].filter((c) => c?.set_id && (padreDeColeccion(c.set_id) || c.set_id) === s.id)
    const total = Number(s.card_count_total) || Number(s.card_count_official) || 0
    return total > 0 && suyas.filter((c) => ctx.tengoDe(c.id) > 0).length >= total
  }).length
  const equipo = equipoDe6(distintas).map((m) => {
    const sprite = urlDeSprite(m.dex)
    return { ...m, sprites: sprite ? [sprite, ...cadenaDeRespaldos(sprite)] : [], ejemplos: m.ejemplos.map(conCadena) }
  })
  const viaje = viajeEnElTiempo(distintas)
  const perfil = perfilDeColeccionista(distintas, { pokedex, mejorSet, alCien })
  // Las tres cartas de firma: las del líder del equipo y, si no, las
  // tres primeras que entraron.
  const firma = (equipo[0]?.ejemplos?.length ? equipo[0].ejemplos : distintas.slice(0, 3).map((x) => conCadena(x.carta))).slice(0, 3)
  const datos = {
    quien: ctx.dueno?.username || null,
    ...ctx.resumenHero,
    valiosas,
    mejorSet: mejorSet ? { nombre: mejorSet.nombre, tengo: mejorSet.tengo, total: mejorSet.total } : null,
    alCien,
    desde: $('mcHeroDesde')?.textContent?.trim() || '',
    mes: { nuevas: mes.nuevas, ultimas: mes.ultimas.map(conCadena), expansionesNuevas: mes.expansionesNuevas },
    pokedex: {
      especies: pokedex.especies, total: pokedex.total, pct: pokedex.pct, tipos: pokedex.tipos, regiones: pokedex.regiones,
      masAntigua: pokedex.masAntigua ? { nombre: ctx.nombreDe(pokedex.masAntigua.carta), anio: pokedex.masAntigua.anio, expansion: nombreDeSet(pokedex.masAntigua.carta?.tcg_sets) || pokedex.masAntigua.carta?.set_id || '' } : null,
      favorito,
    },
    equipo,
    viaje: viaje ? { ...viaje, antigua: { ...conCadena(viaje.antigua.carta), anio: viaje.antigua.anio }, nueva: { ...conCadena(viaje.nueva.carta), anio: viaje.nueva.anio } } : null,
    perfil,
    firma,
  }
  // A mano, para la prueba y para depurar: lo que se le dio al dibujo.
  window.__mcImagenDatos = datos
  carrusel.datos = datos
  carrusel.pintados = new Map()
  carrusel.version++
  const variantes = await variantesDeImagen()
  const puntos = $('mcImagenPuntos')
  if (puntos) puntos.innerHTML = variantes.map((v, i) => `<button type="button" class="mc-imagen-punto" data-indice="${i}" aria-label="${escapeHtml(v.nombre)}" aria-current="${i === 0 ? 'true' : 'false'}"></button>`).join('')
  d.showModal()
  await enseñarVariante(0)
}

const nombreDeFicheroDeImagen = () => `mi-coleccion${ctx.dueno?.username ? `-${ctx.dueno.username}` : ''}${carrusel.indice ? `-${window.__mcImagenVariante || ''}` : ''}.png`

function enganchar() {
  $('mcImagenCerrar')?.addEventListener('click', () => $('mcImagenDialogo').close())
  $('mcImagenAnterior')?.addEventListener('click', () => enseñarVariante(carrusel.indice - 1))
  $('mcImagenSiguiente')?.addEventListener('click', () => enseñarVariante(carrusel.indice + 1))
  $('mcImagenPuntos')?.addEventListener('click', (e) => {
    const b = e.target.closest('.mc-imagen-punto')
    if (b) enseñarVariante(Number(b.dataset.indice) || 0)
  })
  // Con el dedo: un arrastre horizontal sobre la imagen pasa de variante.
  let arrastre = null
  $('mcImagenLienzo')?.addEventListener('pointerdown', (e) => { arrastre = { x: e.clientX, y: e.clientY } })
  $('mcImagenLienzo')?.addEventListener('pointerup', (e) => {
    if (!arrastre) return
    const dx = e.clientX - arrastre.x
    const dy = e.clientY - arrastre.y
    arrastre = null
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return
    enseñarVariante(carrusel.indice + (dx < 0 ? 1 : -1))
  })
  $('mcImagenDialogo')?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') enseñarVariante(carrusel.indice - 1)
    else if (e.key === 'ArrowRight') enseñarVariante(carrusel.indice + 1)
  })
  $('mcImagenCompartir')?.addEventListener('click', async () => {
    const { compartirLienzo } = await import('../imagen-compartir.js')
    compartirLienzo($('mcImagenLienzo'), {
      nombreFichero: nombreDeFicheroDeImagen(),
      texto: 'Mi colección de Pokémon TCG en PokeDoc. pokedoc.es/mi-coleccion',
    })
  })
  $('mcImagenDescargar')?.addEventListener('click', async () => {
    const { descargarLienzo } = await import('../imagen-compartir.js')
    descargarLienzo($('mcImagenLienzo'), nombreDeFicheroDeImagen())
  })
}
