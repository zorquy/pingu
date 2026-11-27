// Tanda 1488 — El correo de los lunes, visual (PINGU: «es mucho texto, pocas
// imágenes… meter la mascota por ahí haciendo algo tipo GIF»; con la propuesta
// «Correo de los lunes»: «dale con lo recomendado»). Se mira, sin red:
//   · el asunto con lo más llamativo (lo tuyo que más tira y lo que sale);
//   · la plantilla: la mascota de cartero (GIF) arriba, tus losas, la noticia
//     con su portada, las tres que más suben con su foto en PNG, el
//     lanzamiento, el foro con el botón que cambia el equipo, la guía y el reto
//     con su GIF; y todo también en el texto plano;
//   · la función: pide las tres que más suben y la portada de la noticia, y
//     encola con el asunto nuevo.
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const m = await import(`${RAIZ}/js/email-plantilla.js`)
const rs = await import(`${RAIZ}/netlify/functions/resumen-semanal.mjs`)
const { existsSync, statSync } = await import('node:fs')

console.log('── 1. El asunto ──')
check('lo que sube tu colección y lo que sale', m.asuntoDelResumen({ tu: { cambio: 48.2 }, lanzamientos: [{ nombre: 'Ascended Heroes' }] }) === 'Tu colección sube 48 € · y sale Ascended Heroes')
check('miles con punto', m.asuntoDelResumen({ tu: { cambio: 1234.4 } }) === 'Tu colección sube 1.234 €')
check('cruces, luego racha', m.asuntoDelResumen({ tu: { cruces: 2, racha: 9 } }) === '2 cruces nuevos para ti' && m.asuntoDelResumen({ tu: { racha: 9 } }) === 'Llevas 9 días de racha')
check('sin lo tuyo, el lanzamiento o la noticia', m.asuntoDelResumen({ lanzamientos: [{ nombre: 'X' }] }) === 'Esta semana sale X' && m.asuntoDelResumen({ noticias: [{ titulo: 'Reveladas las cartas' }] }) === 'Reveladas las cartas')
check('lo tuyo y la noticia, en minúscula detrás', m.asuntoDelResumen({ tu: { racha: 5 }, noticias: [{ titulo: 'Reveladas las cartas' }] }) === 'Llevas 5 días de racha · y reveladas las cartas')
check('sin nada, el de siempre', m.asuntoDelResumen({}) === 'Lo mejor de PokeDoc esta semana')

console.log('── 2. La plantilla ──')
const r = m.renderResumenSemanal({
  temas: [{ id: 't1', titulo: 'Un hilo movido', mensajes: 7 }],
  noticias: [{ titulo: 'Reveladas', slug: 'rev', portada: 'https://x.supabase.co/storage/v1/object/public/a/portada.webp' }, { titulo: 'Otra', slug: 'otra', portada: 'javascript:alert(1)' }],
  suben: [1, 2, 3].map((i) => ({ nombre: `Carta ${i}`, ruta: `/carta/c${i}`, imagen: `https://assets.tcgdex.net/en/sv/sv1/${i}/low.png`, pct: 10 * i })),
  lanzamientos: [{ nombre: 'Ascended Heroes', fecha: '2026-11-28' }],
  guia: { titulo: 'Guía', slug: 'g', portada: '/assets/images/og-default.png', minutos: 8 },
  tu: { valor: 1234.5, cambio: 48.2, racha: 12, respuestas: 3, cruces: 2 },
  semana: { desde: '2026-11-20', hasta: '2026-11-26' },
  siteUrl: 'https://pokedoc.es', unsubscribeUrl: 'https://pokedoc.es/baja',
})
check('la mascota de cartero arriba y la que piensa en el reto, de la web', r.html.includes('https://pokedoc.es/assets/correo/mascota-entregar.gif') && r.html.includes('https://pokedoc.es/assets/correo/mascota-pensar.gif'))
check('los GIF existen en la web y pesan menos de 250 KB', ['mascota-entregar.gif', 'mascota-pensar.gif'].every((f) => existsSync(`${RAIZ}/assets/correo/${f}`) && statSync(`${RAIZ}/assets/correo/${f}`).size < 250e3))
check('las losas de tu semana, con el punto de los miles', r.html.includes('1.235 €') && r.html.includes('+48 €') && r.html.includes('días de racha') && r.html.includes('cruces nuevos'))
check('la noticia con su portada; una dirección rara no se pinta', r.html.includes('portada.webp') && !r.html.includes('javascript:'))
check('las tres que más suben, con su foto y su %', (r.html.match(/assets\.tcgdex\.net\/en\/sv\/sv1\/\d\/low\.png/g) || []).length === 3 && r.html.includes('+30 %'))
check('el lanzamiento con su día', r.html.includes('Ascended Heroes') && />28</.test(r.html))
check('el foro y su botón (el que cambia el equipo)', r.html.includes('https://pokedoc.es/tema/t1') && />Ver el foro</.test(r.html))
check('la guía con su portada de la web y sus minutos', r.html.includes('https://pokedoc.es/assets/images/og-default.png') && r.html.includes('8 min de lectura'))
check('el reto con su botón', r.html.includes('https://pokedoc.es/retos') && r.html.includes('Llevas 12 días de racha'))
check('el texto plano lo lleva todo', /Sube: Carta 1 \(\+10 %\)/.test(r.text) && /Noticia: Reveladas/.test(r.text) && /Los retos de hoy/.test(r.text))
check('a 600 de ancho', r.html.includes('max-width:600px'))
check('el rango de la semana', r.html.includes('Del 20 al 26 de noviembre'))
check('sin dos fotos de las que más suben, sin bloque', !m.renderResumenSemanal({ temas: [], suben: [{ nombre: 'a', imagen: 'https://x/a.png', pct: 1 }], siteUrl: 'https://pokedoc.es' }).html.includes('Lo que más sube'))

console.log('── 3. La función ──')
{
  const encolado = []
  const rest = async (ruta, clave, op) => {
    if (op?.method === 'POST') { encolado.push(...JSON.parse(op.body)); return null }
    if (ruta.startsWith('tcg_card_prices?')) return [{ card_id: 'a', cm_trend: 40, cm_avg7: 40, cm_avg30: 20 }, { card_id: 'b', cm_trend: 30, cm_avg7: 36, cm_avg30: 30 }, { card_id: 'c', cm_trend: 20, cm_avg7: 26, cm_avg30: 20 }]
    if (ruta.startsWith('tcg_cards?')) return ['a', 'b', 'c'].map((id, i) => ({ id, name: `Carta ${id}`, name_es: `Carta ${id}`, image_path: `sv/sv1/${i + 1}`, market: 'WEST', set_id: 'sv1', local_id: String(i + 1) }))
    if (ruta.startsWith('guides?kind=eq.news')) return [{ title: 'Reveladas', slug: 'rev', cover_image: 'https://x/p.webp' }]
    if (ruta.startsWith('user_profiles?')) return [{ id: 'u1', notification_email_disabled: [], current_streak: 0 }]
    return []
  }
  const suben = await rs.subenDeLaSemana(rest, 'k')
  check('las tres que más suben, la que más primero y en PNG', suben.length === 3 && suben[0].pct === 100 && suben.every((x) => /\.png$/.test(x.imagen)), JSON.stringify(suben))
  const res = await rs.procesar({ env: { SUPABASE_SERVICE_ROLE_KEY: 'k' }, rest, ahora: new Date('2026-11-30T08:10:00Z') })
  const carga = encolado[0] && JSON.parse(encolado[0].preview)
  check('encola con las que suben, la portada de la noticia y la semana', res.encolados === 1 && carga.suben.length === 3 && carga.noticias[0].portada === 'https://x/p.webp' && carga.semana.desde === '2026-11-23', JSON.stringify(carga || res))
  check('y el asunto nuevo', encolado[0]?.subject === 'Reveladas', encolado[0]?.subject)
}
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
