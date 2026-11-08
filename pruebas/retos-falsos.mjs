// Los retos del día en una prueba de pantalla (tanda 1268). Desde la 1268 la
// función del día sirve la MESA (sin respuestas) y la base corrige cada jugada
// (`retos_jugar`). Aquí:
//
//   · la mesa se hace con netlify/lib/reto-mesa.mjs DE VERDAD, a partir de lo
//     que las pruebas ya escribían (la carta, las seis con precio, las
//     rondas…), y se sirve en la dirección de su función;
//   · lo del árbitro va a `window.__RETOS_FALSOS__`, que lee el árbitro del
//     doble de Supabase (herramientas/stub-supabase.js);
//   · las fotos de /reto-foto llevan su receta en claro (base64): una que solo
//     tenga direcciones con «rota-» da 404, como una cadena agotada.
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const M = await import(`${RAIZ}/netlify/lib/reto-mesa.mjs`)

export const FOTO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#c33"/></svg>'
export const fotoFalsa = (spec) => `/.netlify/functions/reto-foto?f=${encodeURIComponent(Buffer.from(JSON.stringify(spec)).toString('base64'))}`
export const recetaDe = (url) => {
  try { return JSON.parse(Buffer.from(decodeURIComponent(new URL(url, 'http://x').searchParams.get('f')), 'base64').toString('utf8')) } catch { return null }
}

const FUNCION = { carta: 'carta-del-dia', caro: 'mas-caro', ordena: 'ordena-precio', expansion: 'que-expansion', silueta: 'quien-es', parejas: 'parejas' }

// De lo que la prueba trae (la forma de antes de la 1268) a { mesa, falso }.
export function partir(juego, r) {
  if (juego === 'carta') { const { datos, mesa } = M.partirCarta(r, fotoFalsa); return { mesa, falso: { datos, respuesta: r.carta } } }
  if (juego === 'caro') { const { datos, mesa } = M.partirCaro(r, fotoFalsa); return { mesa, falso: { datos } } }
  if (juego === 'ordena') { const { datos, mesa } = M.partirOrdena(r, fotoFalsa); return { mesa, falso: { datos } } }
  if (juego === 'expansion') { const { datos, mesa } = M.partirExpansion({ ...r, rondas: r.rondas.map((x) => ({ ...x, set_id: x.set_id || x.carta?.set_id })) }, fotoFalsa); return { mesa, falso: { datos } } }
  if (juego === 'silueta') { const { datos, mesa } = M.partirSilueta(r, fotoFalsa); return { mesa, falso: { datos } } }
  // Parejas: las seis cartas son públicas; lo secreto es la mesa.
  return { mesa: { dia: r.dia, numero: r.numero ?? null, libre: r.libre ?? null, cartas: r.cartas }, falso: { datos: {}, mesa: r.mesa || null } }
}

// `retos` = { carta: {dia, numero, carta, ayer}, caro: {dia, numero, cartas}, … }.
// `revisado` (opcional, mismo formato): lo que contesta `?revisar=1`.
// `libres` (opcional, mismo formato): lo de las partidas libres (`?libre=N`);
// sin él, una libre juega lo mismo que el día. El día de la mesa de una libre
// es siempre el suyo (`diaLibre(N)`).
export async function instalarRetos(ctx, retos, { revisado = {}, libres = {}, fotoRota = (receta) => (receta?.u || []).every((u) => /rota-/.test(u)) } = {}) {
  const { diaLibre } = await import(`${RAIZ}/js/retos-libre.js`)
  const falsos = {}
  for (const [juego, r] of Object.entries(retos)) {
    const { mesa, falso } = partir(juego, r)
    falsos[juego] = falso
    const otra = revisado[juego] ? partir(juego, revisado[juego]) : null
    if (otra) falsos[juego] = otra.falso
    const deLibre = libres[juego] ? partir(juego, libres[juego]) : null
    if (deLibre) falsos[`${juego}:libre`] = deLibre.falso
    await ctx.route(new RegExp(`/\\.netlify/functions/${FUNCION[juego]}(\\?|$)`), (route) => {
      const url = new URL(route.request().url())
      const revisar = url.searchParams.get('revisar') === '1'
      const libre = Number(url.searchParams.get('libre')) || null
      const cuerpo = libre
        ? { ...(deLibre?.mesa || mesa), dia: diaLibre(libre), libre, numero: null }
        : revisar ? { ...(otra?.mesa || mesa), sinFoto: revisado[juego]?.sinFoto ?? (otra ? [] : ['x']) } : mesa
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(cuerpo) })
    })
  }
  await ctx.route(/\/\.netlify\/functions\/reto-foto\?/, (route) => {
    const receta = recetaDe(route.request().url())
    return fotoRota(receta) ? route.fulfill({ status: 404, body: '' }) : route.fulfill({ contentType: 'image/svg+xml', body: FOTO_SVG })
  })
  await ctx.addInitScript((f) => { window.__RETOS_FALSOS__ = Object.assign(window.__RETOS_FALSOS__ || {}, f) }, falsos)
  return falsos
}

// Una partida a medias SIN cuenta, como la deja el navegador: su ficha (la del
// árbitro de mentira va en claro). Para sembrar `localStorage`.
export const fichaFalsa = (juego, dia, e, libre = null) => ({
  [`pokedoc-ficha-${juego}${libre ? '-libre' : ''}`]: { dia, libre, ficha: Buffer.from(JSON.stringify({ j: juego, d: dia, l: libre, e: { dia, ...e } })).toString('base64') },
})
