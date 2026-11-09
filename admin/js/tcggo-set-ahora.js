// «Actualizar desde TCGGO», el botón del editor de un set en /admin →
// Colecciones (tanda 1275). Llama a `tcggo-set-ahora` paso a paso
// (emparejar, cartas, precios, productos): los cuatro juntos no caben en el
// tiempo de una función, así que se encadenan aquí, y un paso que se queda a
// medias por tiempo se repite (como mucho `REPETIR` veces). Sin Supabase
// dentro: quien llama le da la sesión, y así se prueba en Node.

export const PASOS_TCGGO = [
  { paso: 'emparejar', rotulo: 'Emparejar' },
  { paso: 'cartas', rotulo: 'Cartas' },
  { paso: 'precios', rotulo: 'Precios e idiomas' },
  { paso: 'productos', rotulo: 'Productos' },
]
export const REPETIR = 4

const n = (x) => (Number.isFinite(Number(x)) ? Number(x).toLocaleString('es-ES') : '?')
const euros = (x) => (Number.isFinite(Number(x)) ? `${Number(x).toLocaleString('es-ES', { maximumFractionDigits: 2 })} €` : null)

// Lo que se dice de cada paso, en una frase para el panel.
export function textoDePaso(paso, r) {
  if (!r) return 'No ha contestado.'
  if (r.ok === false) return `No se ha podido: ${r.error || 'sin motivo'}.`
  if (r.saltado) return `No se ha hecho: ${r.saltado}.`
  if (r.parado) return `Parado: ${r.parado}.`
  if (r.sigue) return 'Se ha quedado a medias por tiempo.'
  if (paso === 'emparejar') {
    if (r.nota) return `Nada que hacer: ${r.nota}.`
    const t = r.turno
    if (!t) return 'No se ha tocado (sin tiempo o sin peticiones).'
    if (t.sinEpisodio) return `No se encuentra su expansión en TCGGO (${t.sinEpisodio}).`
    if (t.SOSPECHOSO) return `Sospechoso, no se escribe: ${t.SOSPECHOSO}.`
    return `Es «${t.episodioNombre}» (TCGGO ${t.episodio}): ${n(t.pares)} de ${n(t.nuestras)} cartas casadas${t.escritas ? `, ${n(t.escritas)} con su id de Cardmarket nuevo` : ''}${t.suyas ? '' : '; TCGGO aún no da sus cartas'}.`
  }
  if (paso === 'cartas') {
    const t = r.turno
    if (!t) return 'Sin respuesta de la expansión.'
    if (!t.suyas) return `TCGGO todavía no da cartas sueltas de esta expansión${t.nota ? ` (${t.nota})` : ''}.`
    return `TCGGO tiene ${n(t.suyas)} cartas: ${n(t.casadas)} ya estaban${t.nuevas ? `, ${n(t.nuevas)} nuevas` : ''}; ${n(t.escritas)} escritas.`
  }
  if (paso === 'precios') {
    if (r.sinCm) return 'TCGGO da sus cartas sin id de Cardmarket: sin precios por ahora.'
    const h = r.hecha
    const f = r.filaDelSet
    const partes = [h ? `${n(h.escritas)} precios escritos (${n(h.nuestras)} de nuestras cartas, de ${n(h.suyas)} suyas).` : 'Precios: sin cambios.']
    if (f?.error) partes.push(`La fila del set no se ha podido escribir: ${f.error}.`)
    else if (f) partes.push(`El set: ${n(f.cartas)} cartas${f.impresas ? ` (${n(f.impresas)} impresas)` : ''}${f.fecha ? `, sale el ${f.fecha}` : ''}${euros(f.valorCm) ? `, vale ${euros(f.valorCm)}` : ''}${f.logo ? ', con logo' : ''}.`)
    return partes.join(' ')
  }
  const web = r.web?.ok ? ' La web ya lo enseña.' : ' La web puede tardar hasta diez minutos en enseñarlo.'
  return `${n(r.productos)} productos.${web}`
}

// Los cuatro pasos en orden. `alPaso(paso, r, intento)` se llama con cada
// respuesta; un fallo de NUESTRA base para (seguir sería escribir encima de
// algo roto), uno de TCGGO también (`parado`), y lo demás sigue.
export async function actualizarSetDesdeTcggo({ set, mercado, token, fetchImpl = fetch, alPaso = () => {} }) {
  const resultados = {}
  for (const { paso } of PASOS_TCGGO) {
    let r = null
    for (let intento = 1; intento <= REPETIR; intento++) {
      try {
        const res = await fetchImpl('/.netlify/functions/tcggo-set-ahora', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token || ''}` },
          body: JSON.stringify({ set, mercado, paso }),
        })
        r = await res.json().catch(() => ({ ok: false, error: `Error ${res.status}` }))
      } catch (e) {
        r = { ok: false, error: String(e?.message || e).slice(0, 140) }
      }
      alPaso(paso, r, intento)
      if (!(r?.ok && r.sigue)) break
    }
    resultados[paso] = r
    if (r?.ok === false || r?.parado) break
  }
  return resultados
}
