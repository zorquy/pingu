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

// La línea de la bandeja: «Tú: …», «Foto», «2 fotos · texto», «Mensaje
// eliminado». `foto` dice si lleva icono delante.
export function resumenDeUltimo(mensaje, mio) {
  if (!mensaje) return { texto: '', foto: false }
  if (mensaje.deleted_at) return { texto: 'Mensaje eliminado', foto: false }
  const n = adjuntosDe(mensaje).length
  const texto = String(mensaje.body || '').trim()
  const fotos = n === 0 ? '' : n === 1 ? 'Foto' : `${n} fotos`
  const cuerpo = [fotos, texto].filter(Boolean).join(' · ')
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
