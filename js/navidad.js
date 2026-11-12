// LA NAVIDAD (tanda 1286, PINGU eligió lo recomendado: «tus colores, con rojo
// y nieve»). Del 22 de diciembre al 6 de enero la línea de la cabecera pone
// `data-temporada="navidad"` y `css/navidad.css` (acento rojo, nieve detrás
// del contenido, guirnalda bajo la barra y gorro en la «P»); esto, que lo
// entra app.js por `import()`, saca el regalo de Delibird del 25 al 4 de
// enero: un pop-up una vez por persona con una carta de invierno al azar, que
// se comparte en imagen con el marco de redes. Una tienda ve la decoración
// pero no el pop-up: está trabajando.
import { hojaInyectada } from './hoja.js'
import { supabase } from './supabase.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import { rutaDeCarta } from './carta-ruta.js'
import { tiendaRecordada } from './tienda-puertas.js'
import { escapeHtml } from './html.js'
import { icons } from './icons.js'
import { REGALOS, regaloToca, claveDeRegalo, elegir, cartaDeRegalo } from './fiestas-puro.js'
import { dibujoDe } from './adviento-puro.js'

const buscar = (nombre) => `/cartas?ver=buscar&q=${encodeURIComponent(nombre)}`
const ROJO = '#e0525c'

const dibujoHtml = (dex, lado = 128) => {
  const [src, respaldo] = dibujoDe(dex)
  return `<img class="nav-delibird" src="${src}" data-respaldo="${respaldo}" alt="" width="${lado}" height="${lado}" loading="lazy" decoding="async">`
}

export function popHtml() {
  return `<dialog class="navidad-pop" aria-labelledby="navidadTitulo">
    <div class="navidad-paso" data-paso="pregunta">
      ${dibujoHtml(225)}
      <h2 id="navidadTitulo">Delibird ha pasado por aquí</h2>
      <p>Te ha dejado un regalo debajo del árbol. ¿Lo abres?</p>
      <div class="navidad-botones">
        <button type="button" class="btn-secondary" data-navidad-luego>Luego</button>
        <button type="button" class="btn-primary" data-navidad-abrir autofocus>Abrir el regalo</button>
      </div>
    </div>
    <div class="navidad-paso" data-paso="abriendo" hidden>
      <span class="navidad-caja" aria-hidden="true">${icons.gift(56)}</span>
      <p>Abriendo…</p>
    </div>
    <div class="navidad-paso" data-paso="regalo" hidden data-navidad-regalo></div>
    <button type="button" class="navidad-quitar" data-fiesta-quitar="navidad">Quitar la decoración</button>
  </dialog>`
}

// Lo que sale al abrir: la carta con su brillo o, si no hay ninguna con foto,
// el dibujo del Pokémon y sus cartas en el buscador.
export function regaloHtml({ nombre, dex }, carta) {
  const visible = carta ? (carta.name_es || carta.name) : nombre
  const set = !carta ? '<p>Tu Pokémon de esta Navidad: mira todas sus cartas.</p>'
    : carta.tcg_sets?.name ? `<p>De ${escapeHtml(carta.tcg_sets.name)}. Para tu colección… o para tu lista de deseos.</p>`
      : '<p>Para tu colección… o para tu lista de deseos.</p>'
  const escaneo = carta ? atributosDeEscaneo(cadenaDeEscaneo(carta)) : null
  const foto = escaneo
    ? `<span class="navidad-carta"><img ${escaneo} alt="${escapeHtml(visible)}" width="245" height="342" loading="lazy" decoding="async"><i class="navidad-brillo" aria-hidden="true"></i></span>`
    : `<span class="navidad-carta navidad-carta-sin">${dibujoHtml(dex, 120)}</span>`
  return `<span class="navidad-chapa">Delibird te ha traído</span>
      ${foto}
      <h2>${escapeHtml(visible)}</h2>
      ${set}
      <div class="navidad-botones">
        <a class="btn-primary" href="${carta ? rutaDeCarta(carta) : buscar(nombre)}">${carta ? 'Ver la carta' : 'Ver sus cartas'}</a>
        <button type="button" class="btn-secondary" data-navidad-compartir>Compartir</button>
      </div>`
}

function engancharRespaldos(raiz) {
  for (const img of raiz.querySelectorAll('img[data-respaldo]')) {
    img.addEventListener('error', () => {
      if (img.dataset.respaldo) { img.src = img.dataset.respaldo; delete img.dataset.respaldo } else img.remove()
    })
  }
}

// Una carta de ese Pokémon con foto, del catálogo occidental. Si la base no
// contesta, el regalo sale igual (con el dibujo): un regalo no falla.
async function buscarCarta(nombre) {
  try {
    const { data } = await supabase.from('tcg_cards')
      .select('id,market,name,name_es,local_id,set_id,image_path,image_tcggo,tcg_sets(name,serie_id,tcg_online_code)')
      .eq('market', 'WEST').eq('name', nombre).limit(60)
    return cartaDeRegalo(data)
  } catch {
    return null
  }
}

async function compartir(regalo, carta) {
  const visible = carta ? (carta.name_es || carta.name) : regalo.nombre
  const [{ abrirHojaCompartir }, marco, { fotoParaElLienzo, cargarImagen }] = await Promise.all([
    import('./compartir-hoja.js'), import('./redes-marco.js'), import('./imagen-compartir.js'),
  ])
  let foto
  const imagen = async (formato) => {
    await marco.prepararMarco()
    if (foto === undefined) {
      foto = carta ? await fotoParaElLienzo(cadenaDeEscaneo(carta, null, 'high')) : null
      if (!foto) foto = await cargarImagen(dibujoDe(regalo.dex)[0]).catch(() => null)
    }
    const lienzo = document.createElement('canvas')
    const apaisada = formato === 'apaisada'
    const { ctx, caja } = marco.pintarMarco(lienzo, {
      formato,
      acento: ROJO,
      chapa: 'Navidad',
      titulo: `Delibird me ha traído *${visible}*`,
      entradilla: 'Mi regalo de Navidad en PokeDoc. ¿Qué te trae a ti?',
      enlace: 'pokedoc.es',
      linea: apaisada ? '' : formato === 'larga' ? 'Enlace en la bio' : 'Entra y abre el tuyo',
      maxLineas: 2,
    })
    if (foto && caja.h > 80) {
      // La carta llena la caja (tarjetaGirada respeta su forma); el dibujo
      // del Pokémon, en un cuadrado más pequeño.
      const lado = carta ? null : Math.min(caja.w, caja.h) * 0.8
      const zona = lado ? { x: caja.x + (caja.w - lado) / 2, y: caja.y + (caja.h - lado) / 2, w: lado, h: lado } : caja
      marco.tarjetaGirada(ctx, foto, { ...zona, angulo: apaisada ? 2 : -2.4, borde: carta ? 12 : 24 })
    }
    return lienzo
  }
  return abrirHojaCompartir({
    titulo: 'Compartir tu regalo',
    texto: `Delibird me ha traído ${visible} en PokeDoc. ¿Qué te trae a ti? https://pokedoc.es`,
    imagen,
    nombre: 'navidad-regalo',
    historiaPropia: true,
  })
}

function abrirPop(doc, win) {
  // Nunca encima de otra ventana ni de lo que estés escribiendo: sale en la
  // página siguiente.
  if (doc.querySelector('dialog:modal') || doc.activeElement?.matches?.('input, textarea, select, [contenteditable="true"]')) return
  doc.body.insertAdjacentHTML('beforeend', popHtml())
  const pop = doc.body.lastElementChild
  engancharRespaldos(pop)
  const paso = (nombre) => { for (const p of pop.querySelectorAll('[data-paso]')) p.hidden = p.dataset.paso !== nombre }
  const visto = () => { try { win.localStorage.setItem(claveDeRegalo(), '1') } catch { /* sin almacenamiento */ } }
  let regalo = null
  let carta = null
  pop.addEventListener('click', async (e) => {
    if (e.target.closest('[data-navidad-luego]')) {
      // «Luego» no lo gasta: vuelve en otra visita (no en esta).
      try { win.sessionStorage.setItem('pd-navidad-luego', '1') } catch { /* nada */ }
      return pop.close()
    }
    if (e.target === pop) return pop.close()
    if (e.target.closest('[data-navidad-compartir]') && regalo) return compartir(regalo, carta)
    if (!e.target.closest('[data-navidad-abrir]') || regalo) return
    const [nombre, dex] = elegir(REGALOS)
    regalo = { nombre, dex }
    visto()
    paso('abriendo')
    const espera = new Promise((ok) => win.setTimeout(ok, 900))
    carta = await buscarCarta(nombre)
    await espera
    const caja = pop.querySelector('[data-navidad-regalo]')
    caja.innerHTML = regaloHtml(regalo, carta)
    engancharRespaldos(caja)
    paso('regalo')
  })
  pop.addEventListener('close', () => pop.remove())
  pop.showModal()
}

// Una tienda está trabajando: ve la decoración, no el regalo. La marca de la
// última vez lo dice al momento; la primera vez, su perfil.
export async function esTienda(doc = document) {
  if (tiendaRecordada() || doc.documentElement.dataset.seccion === 'tienda' || doc.body?.hasAttribute('data-tienda')) return true
  try {
    const { getSession, getProfile } = await import('./app.js')
    const s = await getSession()
    return s?.user?.id ? (await getProfile(s.user.id))?.tipo === 'tienda' : false
  } catch {
    return false
  }
}

export async function montarNavidad({ doc = document, win = window, fecha = new Date() } = {}) {
  await hojaInyectada('css/navidad.css')
  doc.addEventListener('click', (e) => {
    const f = e.target.closest?.('[data-fiesta-quitar]')?.dataset.fiestaQuitar
    if (!f) return
    try { win.localStorage.setItem(`pd-sin-${f}`, '1') } catch { /* sin almacenamiento: solo esta visita */ }
    win.location.reload()
  })
  const forzado = /[?&]temporada=navidad/.test(win.location.search)
  if (!forzado && !regaloToca(fecha)) return
  if (await esTienda(doc)) return
  let ya = true
  try { ya = win.localStorage.getItem(claveDeRegalo(fecha)) === '1' || win.sessionStorage.getItem('pd-navidad-luego') === '1' } catch { /* sin almacenamiento, mejor no salir en cada página */ }
  if (ya) return
  const luego = () => win.setTimeout(() => abrirPop(doc, win), 900)
  if (doc.prerendering) doc.addEventListener('prerenderingchange', luego, { once: true })
  else luego()
}
