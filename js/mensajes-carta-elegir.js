// MANDAR UNA CARTA DESDE EL CLIP (tanda 1140, M3 de la propuesta de
// comunidad). Hasta ahora una carta solo entraba en un mensaje desde «Me
// interesa» de una tienda (1080); para enseñar una tuya había que hacerle una
// foto. Ahora el clip ofrece «Una carta»: se busca con el buscador de siempre
// (`buscarComoEnCartas`, el único de la web), lo que TIENES sale primero con
// su idioma, estado y versión, y después el catálogo. Se manda como el
// adjunto de «Me interesa» (`tipo: 'carta'`) sin `stock_id`: con `de` dice si
// es de tu colección o del catálogo. El precio es el de la ficha en su idioma
// (`valorDe(precioDeFila(…), idioma)`), apuntado al mandarlo.
//
// Entra por `import()` desde mensajes.js al tocar «Una carta».
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { euros, valorDe, precioDeFila } from './cardmarket.js'
import { buscarComoEnCartas } from './buscar-cartas.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import { nombreDeCarta } from './catalogo-series.js'
import { nombreDeVariante } from './mi-coleccion/variantes.js'
import { COLUMNAS_CARTA_DE_SET } from './mi-coleccion/columnas-set.js'

// El adjunto de una carta elegida: lo justo para pintarla (la foto sale del
// catálogo por `card_id`, nunca de aquí).
export function adjuntoDeEleccion(carta, linea, precio) {
  return {
    tipo: 'carta',
    de: linea ? 'coleccion' : 'catalogo',
    card_id: carta.id,
    market: carta.market || 'WEST',
    nombre: String(nombreDeCarta(carta) || carta.name || '').slice(0, 120),
    idioma: linea?.idioma || null,
    estado: linea?.estado || null,
    variante: linea?.variante || null,
    precio: Number.isFinite(precio) ? Math.round(precio * 100) / 100 : null,
  }
}

// Las filas: primero cada copia tuya (una por línea) y después las cartas
// que no tienes. Puro, lo prueba Node.
export function filasDeEleccion(cartas, lineas) {
  const porCarta = new Map()
  for (const l of lineas || []) {
    if (!porCarta.has(l.card_id)) porCarta.set(l.card_id, [])
    porCarta.get(l.card_id).push(l)
  }
  const tuyas = []
  const resto = []
  for (const c of cartas || []) {
    const mias = porCarta.get(c.id)
    if (mias) for (const l of mias) tuyas.push({ carta: c, linea: l })
    else resto.push({ carta: c, linea: null })
  }
  return { tuyas, resto }
}

const detalleDeLinea = (l) =>
  [String(l.idioma || '').toUpperCase(), l.estado, l.variante && l.variante !== 'normal' ? nombreDeVariante(l.variante) : null, l.cantidad > 1 ? `tienes ${l.cantidad}` : 'la tienes']
    .filter(Boolean)
    .join(' · ')

let dialogo = null
function crear() {
  if (dialogo) return dialogo
  dialogo = document.createElement('dialog')
  dialogo.className = 'msg-hoja msg-elegir'
  dialogo.setAttribute('aria-labelledby', 'msgElegirTitulo')
  dialogo.innerHTML = `
    <div class="msg-hoja-tirador"></div>
    <h2 class="msg-elegir-titulo" id="msgElegirTitulo">Mandar una carta</h2>
    <div class="search-input-wrap"><input type="search" enterkeyhint="search" class="search-input" id="msgElegirBuscar" placeholder="Busca por nombre o número" aria-label="Buscar una carta" autocomplete="off" /></div>
    <div class="msg-elegir-lista" id="msgElegirLista" aria-live="polite"></div>
    <button type="button" class="btn-secondary msg-hoja-cerrar" data-elegir="cerrar">Cancelar</button>`
  document.body.append(dialogo)
  return dialogo
}

const filaHtml = ({ carta, linea }, i, precio) => {
  const foto = atributosDeEscaneo(cadenaDeEscaneo(carta))
  const set = carta.tcg_sets?.tcg_online_code ? `${carta.tcg_sets.tcg_online_code} ${carta.local_id || ''}`.trim() : carta.local_id || ''
  return `<button type="button" class="msg-elegir-fila" data-i="${i}">
    <span class="msg-elegir-foto">${foto ? `<img ${foto} alt="" width="245" height="342" loading="lazy" />` : ''}</span>
    <span class="msg-elegir-texto"><strong>${escapeHtml(nombreDeCarta(carta) || carta.name || '')}</strong><small>${escapeHtml([set, linea ? detalleDeLinea(linea) : null].filter(Boolean).join(' · '))}</small></span>
    ${precio != null ? `<span class="msg-elegir-precio">${escapeHtml(euros(precio))}</span>` : ''}
  </button>`
}

// Abre la hoja y devuelve el adjunto elegido, o null si se cancela.
export function elegirCarta({ miId }) {
  const d = crear()
  const campo = d.querySelector('#msgElegirBuscar')
  const lista = d.querySelector('#msgElegirLista')
  campo.value = ''
  lista.innerHTML = '<p class="subtext msg-elegir-pista">Escribe el nombre de la carta. Las tuyas salen primero, con su idioma y su estado.</p>'
  let version = 0
  let espera = null
  let filas = []
  let precios = new Map()

  const precioDe = ({ carta, linea }) => valorDe(precioDeFila(precios.get(carta.id) || null, { variante: linea?.variante || null }), linea?.idioma || null)

  async function buscar() {
    const q = campo.value.trim()
    const mia = ++version
    if (q.length < 2) {
      filas = []
      lista.innerHTML = '<p class="subtext msg-elegir-pista">Escribe el nombre de la carta. Las tuyas salen primero, con su idioma y su estado.</p>'
      return
    }
    lista.innerHTML = '<div class="skeleton msg-esqueleto"></div>'
    try {
      const { lista: cartas } = await buscarComoEnCartas(q, 40, { columnas: COLUMNAS_CARTA_DE_SET })
      const ids = cartas.map((c) => c.id)
      const [{ data: lineas }, { data: filasPrecio }] = await Promise.all([
        ids.length ? supabase.from('user_collection').select('id,card_id,idioma,estado,variante,cantidad').eq('user_id', miId).in('card_id', ids) : Promise.resolve({ data: [] }),
        ids.length ? supabase.from('tcg_card_prices').select('*').in('card_id', ids) : Promise.resolve({ data: [] }),
      ])
      if (mia !== version) return
      precios = new Map((filasPrecio || []).map((f) => [f.card_id, f]))
      const { tuyas, resto } = filasDeEleccion(cartas, lineas)
      filas = [...tuyas, ...resto]
      if (!filas.length) {
        lista.innerHTML = '<p class="subtext msg-elegir-pista">No hay ninguna carta con ese nombre.</p>'
        return
      }
      lista.innerHTML = `${tuyas.length ? `<p class="msg-elegir-grupo">En tu colección</p>${tuyas.map((f, i) => filaHtml(f, i, precioDe(f))).join('')}` : ''}${resto.length ? `<p class="msg-elegir-grupo">Del catálogo</p>${resto.map((f, i) => filaHtml(f, tuyas.length + i, precioDe(f))).join('')}` : ''}`
    } catch {
      if (mia === version) lista.innerHTML = '<p class="subtext msg-elegir-pista">No se ha podido buscar. Prueba otra vez.</p>'
    }
  }
  const alEscribir = () => {
    clearTimeout(espera)
    espera = setTimeout(buscar, 250)
  }
  campo.addEventListener('input', alEscribir)

  return new Promise((resolver) => {
    const alPulsar = (e) => {
      if (e.target === d || e.target.closest('[data-elegir="cerrar"]')) return d.close()
      const fila = e.target.closest('.msg-elegir-fila')
      if (!fila) return
      const f = filas[Number(fila.dataset.i)]
      if (!f) return
      d.returnValue = 'si'
      d.elegida = adjuntoDeEleccion(f.carta, f.linea, precioDe(f))
      d.close()
    }
    d.addEventListener('click', alPulsar)
    d.addEventListener(
      'close',
      () => {
        d.removeEventListener('click', alPulsar)
        campo.removeEventListener('input', alEscribir)
        clearTimeout(espera)
        const elegida = d.returnValue === 'si' ? d.elegida : null
        d.returnValue = ''
        d.elegida = null
        resolver(elegida)
      },
      { once: true }
    )
    d.returnValue = ''
    d.showModal()
    campo.focus()
  })
}
