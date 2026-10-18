// ── Lo puro de la pestaña «Cambios» del perfil (887) ──
//
// Sin DOM ni Supabase: lo importa js/perfil-cambios.js y las pruebas.

export const FICHERO_MIGRACION = 'supabase-migration-887-cambios-perfil.sql'
// Cuántas se enseñan de cada lista antes de «Ver las N».
export const DE_PRIMERAS = 18

// ── Lo puro ──

// Una fila por CARTA: dos copias (o dos idiomas) de la misma son una
// baldosa con la suma. Lo que se enseña de cada una es lo que viene.
export function porCarta(filas, { sumar = 'cambio' } = {}) {
  const mapa = new Map()
  for (const f of filas || []) {
    if (!f?.card_id) continue
    const clave = `${f.card_id}|${f.market || 'WEST'}`
    const v = mapa.get(clave)
    if (!v) mapa.set(clave, { card_id: f.card_id, market: f.market || 'WEST', idiomas: f.idioma ? [f.idioma] : [], estados: f.estado ? [f.estado] : [], total: Number(f[sumar]) || 0 })
    else {
      if (f.idioma && !v.idiomas.includes(f.idioma)) v.idiomas.push(f.idioma)
      if (f.estado && !v.estados.includes(f.estado)) v.estados.push(f.estado)
      v.total += Number(f[sumar]) || 0
    }
  }
  return [...mapa.values()]
}

// La chapa de la cabecera: nada si no hay nada (una chapa «da 0 · busca
// 0» es ruido); si solo hay una de las dos, solo esa.
export function textoDeChapa({ da = 0, busca = 0 } = {}) {
  const partes = []
  if (da > 0) partes.push(`da ${da}`)
  if (busca > 0) partes.push(`busca ${busca}`)
  return partes.length ? `Cambia · ${partes.join(' · ')}` : ''
}

// Qué sello lleva una baldosa de lo que DA respecto a ti: «La buscas» si
// está en tu lista (en cualquier idioma, o en uno que dé).
export function selloDeLoQueDa(fila, misDeseos) {
  const mios = (misDeseos || []).filter((w) => w.card_id === fila.card_id)
  if (!mios.length) return null
  return mios.some((w) => !w.idioma || !fila.idiomas.length || fila.idiomas.includes(w.idioma)) ? 'La buscas' : null
}

// Y de lo que BUSCA: «La das» si tú la das (y el idioma cuadra), «La
// tienes» si la tienes pero no la das.
export function selloDeLoQueBusca(fila, misLineas) {
  const mias = (misLineas || []).filter((l) => l.card_id === fila.card_id)
  if (!mias.length) return null
  const idiomaVale = (l) => !fila.idiomas.length || fila.idiomas.includes(l.idioma)
  if (mias.some((l) => Number(l.cambio) > 0 && idiomaVale(l))) return 'La das'
  return 'La tienes'
}
