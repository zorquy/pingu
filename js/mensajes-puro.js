// Lo puro de los mensajes privados (tanda 891): sin DOM y sin Supabase,
// para que se pruebe en Node. Lo que pinta vive en js/mensajes.js.

export const MAX_FOTOS = 4
export const MAX_MB_POR_FOTO = 10
// Dos mensajes seguidos de la misma persona dentro de este margen van
// pegados (sin repetir avatar ni separación): es un «grupo».
export const MS_DE_GRUPO = 5 * 60 * 1000

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const mismoDia = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

// «Hoy», «Ayer», «12 oct» o «12 oct 2025» si es de otro año.
export function etiquetaDeDia(iso, ahora = new Date()) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  if (mismoDia(d, ahora)) return 'Hoy'
  const ayer = new Date(ahora)
  ayer.setDate(ahora.getDate() - 1)
  if (mismoDia(d, ayer)) return 'Ayer'
  const base = `${d.getDate()} ${MESES[d.getMonth()]}`
  return d.getFullYear() === ahora.getFullYear() ? base : `${base} ${d.getFullYear()}`
}

export function horaDe(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Los mensajes en bloques por día, y dentro cada uno sabe si sigue al
// anterior (misma persona, menos de cinco minutos): así el que pinta no
// tiene que mirar al vecino.
export function agruparPorDia(mensajes, ahora = new Date()) {
  const dias = []
  let anterior = null
  for (const m of mensajes || []) {
    const etiqueta = etiquetaDeDia(m.created_at, ahora)
    let dia = dias[dias.length - 1]
    if (!dia || dia.etiqueta !== etiqueta || !mismoDia(new Date(dia.fecha), new Date(m.created_at))) {
      dia = { etiqueta, fecha: m.created_at, mensajes: [] }
      dias.push(dia)
      anterior = null
    }
    const seguido =
      !!anterior && anterior.sender_id === m.sender_id && !anterior.deleted_at && new Date(m.created_at) - new Date(anterior.created_at) < MS_DE_GRUPO
    dia.mensajes.push({ ...m, seguido })
    anterior = m
  }
  return dias
}

// El id del último mensaje MÍO que la otra persona ya ha leído, o null.
// «Visto» va debajo de ese y de ningún otro: un «visto» en cada burbuja
// es ruido, y uno solo dice lo mismo.
export function ultimoVisto(mensajes, myId, otroLeyoHasta) {
  if (!otroLeyoHasta) return null
  const limite = new Date(otroLeyoHasta).getTime()
  let visto = null
  for (const m of mensajes || []) {
    if (m.sender_id !== myId || m.deleted_at) continue
    if (new Date(m.created_at).getTime() <= limite) visto = m.id
  }
  return visto
}

// Cuántos mensajes de la otra persona hay después de la última vez que
// yo leí. Lo eliminado no cuenta: un hueco gris no es nada que leer.
export function cuentaNoLeidos(mensajes, myId, leiHasta) {
  const limite = leiHasta ? new Date(leiHasta).getTime() : 0
  return (mensajes || []).filter((m) => m.sender_id !== myId && !m.deleted_at && new Date(m.created_at).getTime() > limite).length
}

export function adjuntosDe(mensaje) {
  const a = mensaje?.adjuntos
  if (!Array.isArray(a)) return []
  return a.filter((x) => x && typeof x.ruta === 'string' && x.ruta.length)
}

// Las cartas de un mensaje (1080, «Me interesa»): lo que alguien preguntó
// del escaparate de una tienda, con lo que era cuando escribió. Van en la
// misma lista que las fotos, pero sin `ruta`: las fotos no las ven.
export function cartasDe(mensaje) {
  const a = mensaje?.adjuntos
  if (!Array.isArray(a)) return []
  // Las de una tienda llevan `stock_id`; las del clip (1140), `de`.
  return a.filter((x) => x && x.tipo === 'carta' && (typeof x.stock_id === 'string' || x.de === 'coleccion' || x.de === 'catalogo') && (x.card_id || x.product_id))
}

// EL MENSAJE DE UN CAMBIO (1101, PINGU: «en vez de texto plano, algo más
// interactivo, con un botón de propuesta»). Desde la migración 1101 lleva un
// adjunto `{ tipo: 'propuesta', oferta, evento }`; los de antes se
// reconocen por su texto (los escribe `cambio_avisar`, siempre igual) y van
// sin oferta: el botón lleva a «En curso» a secas.
const EVENTOS_POR_TEXTO = [
  [/^Te he mandado una propuesta de cambio/, 'cambio_propuesta'],
  [/^He cambiado la propuesta de cambio/, 'cambio_contraoferta'],
  [/^He aceptado tu propuesta/, 'cambio_aceptado'],
  [/^No me cuadra esta propuesta/, 'cambio_rechazado'],
  [/^He anulado la propuesta/, 'cambio_anulado'],
  [/^Ya me ha llegado lo tuyo/, 'cambio_recibido'],
  [/^Cambio hecho/, 'cambio_hecho'],
  [/^He deshecho el cambio/, 'cambio_deshecho'],
  [/^Ya tienes mi dirección/, 'cambio_direccion'],
  [/^Te lo he mandado/, 'cambio_enviado'],
  [/^Ya tienes mi (Bizum|PayPal)/, 'cambio_cobro'],
]
export const TITULO_DE_EVENTO = {
  cambio_propuesta: 'Propuesta de cambio',
  cambio_contraoferta: 'Contraoferta',
  cambio_aceptado: 'Propuesta aceptada',
  cambio_rechazado: 'Propuesta rechazada',
  cambio_anulado: 'Propuesta anulada',
  cambio_recibido: 'Le ha llegado lo tuyo',
  cambio_hecho: 'Cambio hecho',
  cambio_deshecho: 'Cambio deshecho',
  cambio_direccion: 'Dirección lista',
  cambio_enviado: 'Enviado',
  cambio_cobro: 'Datos de pago',
}
export function propuestaDe(mensaje) {
  const texto = String(mensaje?.body || '').trim()
  const a = Array.isArray(mensaje?.adjuntos) ? mensaje.adjuntos.find((x) => x && x.tipo === 'propuesta' && x.oferta) : null
  const porTexto = EVENTOS_POR_TEXTO.find(([re]) => re.test(texto))?.[1] || null
  if (!a && !porTexto) return null
  // Una contraoferta se escribe con el mismo tipo que una propuesta: la
  // distingue el texto.
  const evento = porTexto === 'cambio_contraoferta' ? porTexto : (a?.evento || porTexto)
  return {
    oferta: a?.oferta || null,
    evento,
    titulo: TITULO_DE_EVENTO[evento] || 'Propuesta de cambio',
    texto: texto.replace(/\s*La tienes arriba de la conversación\.$/, ''),
    enlace: `/mi-coleccion?ver=cambios${a?.oferta ? `#oferta-${a.oferta}` : ''}`,
  }
}

// El adjunto de una línea del escaparate: solo lo que hace falta para
// pintarla y para que la tienda la encuentre (`stock_id`), nada del coste.
export function adjuntoDeCarta(linea, tiendaId) {
  if (!linea?.id) return null
  const precio = linea.precio == null ? null : Number(linea.precio)
  return {
    tipo: 'carta', stock_id: String(linea.id), tienda: tiendaId,
    card_id: linea.card_id || null, market: linea.market || 'WEST', product_id: linea.product_id ?? null,
    nombre: String(linea.nombre || '').slice(0, 120), idioma: linea.idioma || null, estado: linea.estado || null,
    variante: linea.variante || null, precio: Number.isFinite(precio) ? precio : null,
  }
}

// La línea de la bandeja: «Tú: …», «Foto», «2 fotos · texto», «Mensaje
// eliminado». `foto` dice si lleva icono delante.
export function resumenDeUltimo(mensaje, mio) {
  if (!mensaje) return { texto: '', foto: false }
  if (mensaje.deleted_at) return { texto: 'Mensaje eliminado', foto: false }
  const n = adjuntosDe(mensaje).length
  const texto = String(mensaje.body || '').trim()
  const fotos = n === 0 ? '' : n === 1 ? 'Foto' : `${n} fotos`
  const carta = cartasDe(mensaje)[0]
  const cuerpo = [carta ? `Carta: ${carta.nombre || 'una carta'}` : '', fotos, texto].filter(Boolean).join(' · ')
  return { texto: `${mio ? 'Tú: ' : ''}${cuerpo}`, foto: n > 0 }
}

// Qué cabe de lo que alguien quiere adjuntar: lo que pase de MAX_FOTOS
// contando lo que ya hay se queda fuera, y lo que pese más del tope
// también. Devuelve las dos listas para poder avisar de lo que no entra.
export function cabenAdjuntos(actuales, nuevos, { max = MAX_FOTOS, maxMB = MAX_MB_POR_FOTO } = {}) {
  const aceptados = []
  const rechazados = []
  let hueco = Math.max(0, max - (actuales || []).length)
  for (const f of nuevos || []) {
    const esImagen = /^image\//.test(String(f?.type || ''))
    if (!esImagen) rechazados.push({ fichero: f, motivo: 'no es una imagen' })
    else if (f.size > maxMB * 1024 * 1024) rechazados.push({ fichero: f, motivo: `pesa más de ${maxMB} MB` })
    else if (hueco <= 0) rechazados.push({ fichero: f, motivo: `como mucho ${max} fotos por mensaje` })
    else {
      aceptados.push(f)
      hueco--
    }
  }
  return { aceptados, rechazados }
}

// La medida a la que se reduce una foto: el lado mayor a `ladoMax`, y
// nunca se agranda.
export function medidaReducida(ancho, alto, ladoMax = 1600) {
  const mayor = Math.max(ancho, alto)
  if (!mayor || mayor <= ladoMax) return { ancho, alto }
  const f = ladoMax / mayor
  return { ancho: Math.max(1, Math.round(ancho * f)), alto: Math.max(1, Math.round(alto * f)) }
}

// Enter envía solo con teclado de verdad: en el móvil Enter es «línea
// nueva», como en cualquier app de mensajes.
export function enterEnvia(evento, conRaton) {
  return !!conRaton && evento.key === 'Enter' && !evento.shiftKey && !evento.isComposing
}
