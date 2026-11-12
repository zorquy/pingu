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

// Las nuevas que la base no ha escrito (1290): con lápida (se borraron en
// /admin o se juntaron como repetidas, y el disparador no deja que vuelvan) o
// por otra cosa, con sus números para buscarlas.
export function noEscritasTexto(t) {
  const lista = t.noEscritas || []
  const conLapida = lista.filter((x) => x.lapida).length
  const otras = lista.length - conLapida
  const cuales = lista.slice(0, 12).map((x) => `${x.numero || '?'} ${x.nombre || ''}`.trim()).join(', ')
  const mas = (t.noEscritasTotal || lista.length) > 12 ? ` y ${n((t.noEscritasTotal || lista.length) - 12)} más` : ''
  const por = [conLapida ? `${n(conLapida)} porque se borraron o se juntaron como repetidas en /admin (tienen lápida y no se vuelven a crear)` : '', otras ? `${n(otras)} por otro motivo` : ''].filter(Boolean).join(' y ')
  return `${n(t.noEscritasTotal || lista.length)} nuevas NO se han escrito: ${por}. Son: ${cuales}${mas}.`
}

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
    if (t.sinCm) return `Es «${t.episodioNombre}» (TCGGO ${t.episodio}), pero TCGGO aún no da el id de Cardmarket de sus ${n(t.suyas)} cartas: los precios se casan por su id de TCGGO, y se vuelve a mirar sola.`
    return `Es «${t.episodioNombre}» (TCGGO ${t.episodio}): ${n(t.pares)} de ${n(t.nuestras)} cartas casadas${t.escritas ? `, ${n(t.escritas)} con su id de Cardmarket nuevo` : ''}${t.suyas ? '' : '; TCGGO aún no da sus cartas'}.`
  }
  if (paso === 'cartas') {
    const t = r.turno
    if (!t) return 'Sin respuesta de la expansión.'
    if (!t.suyas) return `TCGGO todavía no da cartas sueltas de esta expansión${t.nota ? ` (${t.nota})` : ''}.`
    const base = `TCGGO tiene ${n(t.suyas)} cartas: ${n(t.casadas)} ya estaban${t.nuevas ? `, ${n(t.nuevas)} nuevas` : ''}; ${n(t.escritas)} escritas.`
    // Lo que contestó TCGGO a cada petición (1291c): «100·p1 → 100 (dice 139)».
    const pedidas = Array.isArray(t.pedidas) && t.pedidas.length
      ? ` Lo que contestó TCGGO: ${t.pedidas.map((x) => `de ${x.pp}, pág. ${x.pag}${x.total ? `/${x.total}` : ''} → ${x.fin ? `sin respuesta (${x.fin})` : `${x.n}${x.dice != null ? ` (dice ${x.dice})` : ''}`}`).join('; ')}.`
      : ''
    const lista = t.anunciadas ? ` TCGGO dice que tiene ${n(t.anunciadas)}, pero su lista dio ${n(t.recibidas)}: se ha vuelto a pedir de 20 en 20 y ${t.recuperadas ? `han aparecido ${n(t.recuperadas)} más` : 'no ha aparecido ninguna más'}.` : ''
    const fuera = t.descartadas ? ` ${n(t.descartadas)} no son cartas sueltas (sobres, cajas) y no entran.` : ''
    return `${base}${lista}${fuera}${t.noEscritasTotal ? ` ${noEscritasTexto(t)}` : ''}${pedidas}`
  }
  if (paso === 'precios') {
    if (r.sinCm) return 'TCGGO da sus cartas sin id de Cardmarket: sin precios por ahora.'
    const h = r.hecha
    const f = r.filaDelSet
    const partes = [h ? `${n(h.escritas)} precios escritos (${n(h.nuestras)} de nuestras cartas, de ${n(h.suyas)} suyas).` : 'Precios: sin cambios.']
    if (f?.error) partes.push(`La fila del set no se ha podido escribir: ${f.error}.`)
    else if (f) partes.push(`El set: ${n(f.cartas)} cartas${f.contadas ? ' (contadas aquí: TCGGO aún dice 0)' : ''}${f.impresas ? ` (${n(f.impresas)} impresas)` : ''}${f.fecha ? `, sale el ${f.fecha}` : ''}${euros(f.valorCm) ? `, vale ${euros(f.valorCm)}` : ''}${f.logo ? ', con logo' : ''}.`)
    return partes.join(' ')
  }
  const web = r.web?.ok ? ' La web ya lo enseña.' : ' La web puede tardar hasta diez minutos en enseñarlo.'
  return `${n(r.productos)} productos.${web}`
}

// Los cuatro pasos en orden. `alPaso(paso, r, intento)` se llama con cada
// respuesta. Un fallo de NUESTRA base para (seguir sería escribir encima de
// algo roto), y uno del PLAN de TCGGO también (sin peticiones no hay nada que
// hacer); un `parado` de un paso por otra cosa (1275b: el emparejador sin ids
// de Cardmarket) no impide los demás.
export const paraLaCadena = (r) => r?.ok === false || /RapidAPI|plan|tope diario/i.test(String(r?.parado || ''))
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
    if (paraLaCadena(r)) break
  }
  return resultados
}
