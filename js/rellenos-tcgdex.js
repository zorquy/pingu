// Los sets que se completan desde TCGdex (tanda 1158; aquí desde la 1159).
//
// Lo usan los dos lados: la pasada programada (`tcgdex-rellenar-set`) y el
// botón «Traer ahora lo que falta» de /admin → Colecciones, que solo sale en
// un set de esta lista. Puro y sin importar nada, para que lo puedan cargar
// el navegador y una función de Netlify (la 471: no copiar).
//
// `rehacerDesde`: la próxima pasada lo vuelve a hacer aunque ya estuviera
// hecho, y olvida los intentos fallidos de antes de esa fecha (la 1159: la
// primera vuelta de las MEP no salió y nadie supo por qué).
export const RELLENOS_TCGDEX = [
  {
    clave: 'mep-tcgdex',
    mercado: 'WEST',
    set: { ids: ['mep'], codigo: 'MEP', nombre: 'MEP Black Star Promos' },
    tcgdex: 'mep',
    cadaDias: 7,
    rehacerDesde: '2026-11-01T15:30:00Z',
    motivo: 'TCGGO no tiene las MEP más nuevas (la 90 de Mega Darkrai y otras)',
  },
]

// El relleno de un set nuestro: por id o por código, sin distinguir caja (la
// 486).
export function rellenoDeSet(set, mercado = 'WEST') {
  if (!set) return null
  const id = String(set.id || '').toLowerCase()
  const codigo = String(set.tcg_online_code || '').toLowerCase()
  return RELLENOS_TCGDEX.find((r) => r.mercado === mercado && (
    (r.set.ids || []).some((x) => String(x).toLowerCase() === id) ||
    (codigo && String(r.set.codigo || '').toLowerCase() === codigo)
  )) || null
}

// Lo que contesta «Traer ahora» en /admin, en una frase (la 1159). Cada caso
// dice una cosa distinta (la 510): no se pudo, no hacía falta, se hizo.
export function textoDeRelleno(r) {
  if (!r) return 'No ha contestado.'
  if (!r.ok) return `No se ha podido: ${r.error || 'sin motivo'}.`
  if (r.saltado) return `No se ha hecho nada: ${r.saltado}.`
  const h = r.hecho || {}
  const partes = [`TCGdex tiene ${h.suyas ?? '?'} cartas de este set y aquí había ${h.teniamos ?? '?'}.`]
  if (!h.faltaban) partes.push('No falta ninguna por número.')
  else partes.push(`Faltaban ${h.faltaban}; ${h.escritas === h.faltaban ? 'escritas todas' : `escritas ${h.escritas}`}${h.numeros ? ` (${h.numeros})` : ''}.`)
  if (h.escritas) partes.push(`${h.conCardmarket} con su id de Cardmarket${h.sinFoto ? `, ${h.sinFoto} sin foto en TCGdex` : ''}.`)
  if (h.enOtroSet?.length) partes.push(`Saltadas porque ya están en otro set: ${h.enOtroSet.map((x) => `${x.numero} (${x.id} en «${x.set}»)`).join(', ')}.`)
  if (h.escritas) partes.push(r.web?.ok ? 'La web ya las enseña.' : 'La web puede tardar hasta diez minutos en enseñarlas.')
  return partes.join(' ')
}
