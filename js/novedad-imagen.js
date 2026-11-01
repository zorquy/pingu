// «IMAGEN PARA REDES» EN /novedades (tanda 1157, R4 de «Todas las imágenes
// de PokeDoc, con el mismo marco»). Cada destacada del mes ya tiene título,
// texto y enlace: con un botón, que solo ve el equipo, sale su imagen con el
// marco de redes (chapa NUEVO EN POKEDOC, el color de la sección a la que
// lleva) en publicación, historia y apaisada, por la hoja de siempre. La
// pieza es una captura si se sube una (en un móvil dibujado) o, si no, el
// icono del tipo en grande. Entra por `import()` desde novedades.js: la
// página no paga nada y quien no es del equipo no baja ni el marco.
import { icons } from './icons.js'
import { redondeado } from './imagen-compartir.js'
import { pintarMarco, prepararMarco } from './redes-marco.js'

// La sección de una novedad sale de a dónde lleva: el color del marco es el
// de la sección que se va a ver al pulsar.
const SECCIONES = [
  [/^\/(retos|parejas|carta-del-dia|quien-es|mas-caro|ordena|que-expansion|aprender|guia|curso|glosario)/, 'retos'],
  [/^\/(cartas|mi-coleccion|carta|lanzamientos|productos|evento|mercado)/, 'coleccion'],
  [/^\/(foro|tema|perfil|usuario|usuarios|mensajes|colabora|gente)/, 'comunidad'],
  [/^\/(torneos|torneo|mis-partidas|meta|mazos|constructor|laboratorio|repeticiones)/, 'jugar'],
  [/^\/noticias/, 'noticias'],
]
export function seccionDeNovedad(enlace) {
  const e = String(enlace || '')
  for (const [re, s] of SECCIONES) if (re.test(e)) return s
  return 'inicio'
}

const ICONO = { nuevo: 'sparkles', mejora: 'trendingUp', arreglo: 'checkCircle' }
const CHAPA = { nuevo: 'Nuevo en PokeDoc', mejora: 'Mejor en PokeDoc', arreglo: 'Arreglado' }
const sinMarcas = (t) => String(t || '').replace(/\[\[([^\]]+)\]\]/g, '[[$1]]')

// Lo que se pega con la imagen (y lo que se escribe en X).
export function textoDeNovedad(d) {
  const enlace = `pokedoc.es${d.enlace || ''}`
  return [`✨ ${d.titulo}`, sinMarcas(d.texto), enlace].filter(Boolean).join('\n')
}

// El icono del tipo, de icons.js, como imagen blanca para el lienzo.
function imagenDeIcono(tipo) {
  const svg = icons[ICONO[tipo] || 'sparkles'](96).replace('stroke="currentColor"', 'stroke="#ffffff"')
  const img = new Image()
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  return img.decode().then(() => img).catch(() => null)
}

// La captura, dentro de un móvil dibujado y un poco girado.
function movil(ctx, img, caja) {
  const prop = img.naturalWidth / img.naturalHeight || 9 / 19.5
  const borde = Math.max(8, Math.round(caja.h * 0.018))
  let h = caja.h
  let w = h * prop + borde * 2
  if (w > caja.w * 0.9) { w = caja.w * 0.9; h = (w - borde * 2) / prop }
  ctx.save()
  ctx.translate(caja.x + caja.w / 2, caja.y + caja.h / 2)
  ctx.rotate((2 * Math.PI) / 180)
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 50
  ctx.shadowOffsetY = 24
  ctx.fillStyle = '#05090d'
  redondeado(ctx, -w / 2, -h / 2, w, h, Math.round(w * 0.11))
  ctx.fill()
  ctx.shadowColor = 'transparent'
  redondeado(ctx, -w / 2 + borde, -h / 2 + borde, w - borde * 2, h - borde * 2, Math.round(w * 0.09))
  ctx.clip()
  ctx.drawImage(img, -w / 2 + borde, -h / 2 + borde, w - borde * 2, h - borde * 2)
  ctx.restore()
}

// El icono del tipo en una baldosa del color de la sección.
function baldosa(ctx, icono, caja, acento) {
  const lado = Math.min(caja.w, caja.h, 420)
  const x = caja.x + (caja.w - lado) / 2
  const y = caja.y + (caja.h - lado) / 2
  ctx.save()
  ctx.translate(x + lado / 2, y + lado / 2)
  ctx.rotate((-3 * Math.PI) / 180)
  ctx.shadowColor = 'rgba(0,0,0,0.4)'
  ctx.shadowBlur = 40
  ctx.shadowOffsetY = 20
  ctx.fillStyle = acento
  redondeado(ctx, -lado / 2, -lado / 2, lado, lado, Math.round(lado * 0.22))
  ctx.fill()
  ctx.shadowColor = 'transparent'
  if (icono) ctx.drawImage(icono, -lado * 0.3, -lado * 0.3, lado * 0.6, lado * 0.6)
  ctx.restore()
}

export function pintarNovedad(lienzo, d, { formato = 'historia', captura = null, icono = null } = {}) {
  const apaisada = formato === 'apaisada'
  const { ctx, caja, acento } = pintarMarco(lienzo, {
    formato,
    seccion: seccionDeNovedad(d.enlace),
    chapa: CHAPA[d.tipo] || CHAPA.nuevo,
    titulo: d.titulo,
    entradilla: sinMarcas(d.texto),
    enlace: `pokedoc.es${d.enlace || ''}`,
    linea: apaisada ? '' : formato === 'larga' ? 'Enlace en la bio' : 'Gratis, sin instalar nada',
    maxLineas: 3,
  })
  if (caja.h > 80) {
    if (captura) movil(ctx, captura, caja)
    else baldosa(ctx, icono, caja, acento)
  }
  return lienzo
}

export async function compartirNovedad(d, captura = null) {
  const { abrirHojaCompartir } = await import('./compartir-hoja.js')
  let icono
  return abrirHojaCompartir({
    titulo: 'Imagen para redes',
    texto: textoDeNovedad(d),
    nombre: `novedad-${String(d.titulo || 'pokedoc').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}`,
    historiaPropia: true,
    imagen: async (formato) => {
      await prepararMarco()
      if (icono === undefined) icono = await imagenDeIcono(d.tipo)
      return pintarNovedad(document.createElement('canvas'), d, { formato, captura, icono })
    },
  })
}

// Los botones, solo para el equipo, debajo de cada destacada.
export async function montarImagenParaRedes(lista, raiz = document.getElementById('nvDestacadas')) {
  if (!raiz || !lista?.length) return
  // app.js por import(): lo de arriba se prueba en node, sin documento.
  const { getSession, getProfile } = await import('./app.js')
  const sesion = await getSession()
  if (!sesion) return
  const perfil = await getProfile(sesion.user.id)
  if (!perfil?.is_admin) return
  raiz.querySelectorAll('.nv-dest').forEach((art, i) => {
    if (!lista[i] || art.querySelector('.nv-redes')) return
    const fila = document.createElement('div')
    fila.className = 'nv-redes'
    fila.innerHTML = `<button type="button" class="btn-secondary" data-nv-redes="${i}">${icons.image(16)} Imagen para redes</button>
      <label class="link-btn nv-redes-captura">Con una captura<input type="file" accept="image/*" data-nv-captura="${i}" hidden></label>`
    art.querySelector('.nv-dest-texto')?.append(fila)
  })
  raiz.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-nv-redes]')
    if (b) compartirNovedad(lista[Number(b.dataset.nvRedes)])
  })
  raiz.addEventListener('change', async (ev) => {
    const input = ev.target.closest('[data-nv-captura]')
    const fichero = input?.files?.[0]
    if (!fichero) return
    const url = URL.createObjectURL(fichero)
    const img = new Image()
    img.src = url
    try { await img.decode() } catch { return }
    compartirNovedad(lista[Number(input.dataset.nvCaptura)], img)
    input.value = ''
  })
}
