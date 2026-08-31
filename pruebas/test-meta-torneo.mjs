// Comprobación de la vista previa de un torneo (tanda 228).
// Sin red: se sustituye fetch por un doble que responde como PostgREST.
import meta from '/home/user/pingu/netlify/edge-functions/meta-social.js'

let fallos = 0
const ok = (cond, que) => { if (!cond) { console.log('  ✗ ' + que); fallos++ } else console.log('  ✓ ' + que) }

const HTML = `<!DOCTYPE html><html><head><title>Torneo — PokeDoc</title>
<meta name="description" content="generica" />
<!-- meta-social:inicio -->
<meta property="og:title" content="viejo" />
<!-- meta-social:fin -->
</head><body></body></html>`

function montarFetch({ torneo, count = 24 }) {
  return async (url, opciones = {}) => {
    const u = String(url)
    if (opciones.method === 'HEAD') {
      return new Response(null, { status: 200, headers: { 'content-range': `0-${count - 1}/${count}` } })
    }
    if (u.includes('/tournaments?')) {
      return new Response(JSON.stringify(torneo ? [torneo] : []), {
        status: 200, headers: { 'content-type': 'application/json' },
      })
    }
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
  }
}

async function correr(ruta, opciones) {
  globalThis.fetch = montarFetch(opciones)
  const ctx = { next: async () => new Response(HTML, { status: 200, headers: { 'content-type': 'text/html' } }) }
  const res = await meta(new Request(ruta), ctx)
  return await res.text()
}

const TORNEO = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Copa PokeDoc de Septiembre',
  slug: 'copa-septiembre',
  description: '<p>Ven a <strong>jugar</strong>.</p>',
  start_at: '2026-09-06T16:00:00Z',
  status: 'registration_open',
  format: 'swiss',
  max_players: 24,
  swiss_rounds: 5,
  swiss_bo: 1,
  top_cut_size: 8,
  top_cut_bo: 3,
  round_time_minutes: 30,
}

console.log('\n1. Un torneo abierto se personaliza')
{
  const html = await correr('https://pokedoc.es/torneo?slug=copa-septiembre', { torneo: TORNEO, count: 18 })
  ok(html.includes('<title>Copa PokeDoc de Septiembre — Inscripciones abiertas · Torneos de PokeDoc</title>'), 'el título lleva nombre y estado')
  ok(html.includes('og:url" content="https://pokedoc.es/torneo?slug=copa-septiembre"'), 'la canónica apunta al slug')
  ok(html.includes('Ven a jugar.'), 'la descripción del organizador, sin etiquetas')
  ok(!html.includes('<strong>'), 'no se cuela HTML en la descripción')
  ok(html.includes('"@type":"Event"'), 'datos estructurados de evento')
  ok(html.includes('"maximumAttendeeCapacity":24'), 'las plazas van en los datos')
  ok(html.includes('"startDate":"2026-09-06T16:00:00Z"'), 'la fecha de comienzo')
  ok(!html.includes('content="viejo"'), 'el bloque viejo se ha sustituido, no duplicado')
  ok((html.match(/meta-social:inicio/g) || []).length === 1, 'un solo bloque meta-social')
}

console.log('\n2. Sin descripción propia, la frase se fabrica con los datos')
{
  const html = await correr('https://pokedoc.es/torneo?slug=copa-septiembre', { torneo: { ...TORNEO, description: null }, count: 18 })
  ok(html.includes('18/24 plazas'), 'dice cuántas plazas quedan')
  ok(html.includes('5 rondas suizas BO1 + top 8 BO3'), 'dice la estructura')
  ok(/sáb|sept/i.test(html), 'dice cuándo')
}

console.log('\n3. Una liga habla de jornadas')
{
  const html = await correr('https://pokedoc.es/torneo?slug=liga', { torneo: { ...TORNEO, description: null, format: 'league', top_cut_size: null }, count: 12 })
  ok(html.includes('liga de 5 jornadas BO1'), 'jornadas, no rondas suizas')
  ok(!html.includes('top '), 'sin corte no se anuncia corte')
}

console.log('\n3b. Un torneo sin límite de plazas (tanda 228 de IBAI)')
{
  const html = await correr('https://pokedoc.es/torneo?slug=abierta', {
    torneo: { ...TORNEO, description: null, max_players: null }, count: 41,
  })
  ok(html.includes('41 inscritos · sin límite'), 'dice cuánta gente hay, no «0 plazas»')
  ok(!html.includes('0 plazas') && !html.includes('null'), 'sin restos de null')
  ok(!html.includes('maximumAttendeeCapacity'), 'y no declara aforo en los datos')
}

console.log('\n4. Lo que NO puede pasar')
{
  // La RLS de hoy (solo admins) hace que la consulta vuelva vacía.
  const html = await correr('https://pokedoc.es/torneo?slug=oculto', { torneo: null })
  ok(html.includes('<title>Torneo — PokeDoc</title>'), 'sin fila, la página sale tal cual')
  ok(html.includes('content="viejo"'), 'no se toca el bloque de la página')

  const sinSlug = await correr('https://pokedoc.es/torneo', { torneo: TORNEO })
  ok(sinSlug.includes('<title>Torneo — PokeDoc</title>'), 'sin slug no se personaliza nada')

  // /torneos es la LISTA, no una ficha: no debe entrar por aquí.
  // Con un ?slug= colgando, que es como se vería si algún día /torneos
  // entra en la lista de rutas de la función: el enrutador tiene que
  // seguir sabiendo que la LISTA no es una ficha.
  const lista = await correr('https://pokedoc.es/torneos?slug=copa-septiembre', { torneo: TORNEO })
  ok(lista.includes('<title>Torneo — PokeDoc</title>'), '/torneos no se confunde con /torneo')
}

console.log('\n5. Un borrador no se anuncia')
{
  globalThis.fetch = async (url, o = {}) => {
    const u = String(url)
    if (u.includes('/tournaments?')) {
      // El filtro status=neq.draft tiene que ir en la consulta.
      if (!u.includes('status=neq.draft')) { console.log('  ✗ la consulta no filtra los borradores'); fallos++ }
      else console.log('  ✓ la consulta filtra los borradores')
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return new Response(null, { status: 200, headers: { 'content-range': '0-0/1' } })
  }
  const ctx = { next: async () => new Response(HTML, { status: 200, headers: { 'content-type': 'text/html' } }) }
  await meta(new Request('https://pokedoc.es/torneo?slug=x'), ctx)
}

console.log('\n6. Y no puede pedir nada de nadie')
{
  const pedidas = []
  globalThis.fetch = async (url) => {
    pedidas.push(String(url))
    if (String(url).includes('/tournaments?')) {
      return new Response(JSON.stringify([TORNEO]), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return new Response(null, { status: 200, headers: { 'content-range': '0-17/18' } })
  }
  const ctx = { next: async () => new Response(HTML, { status: 200, headers: { 'content-type': 'text/html' } }) }
  await meta(new Request('https://pokedoc.es/torneo?slug=copa-septiembre'), ctx)
  ok(!pedidas.some((u) => /tcg_live|user_profiles|decklist|match_messages/.test(u)), 'no pide nombres, decklists ni chats')
  ok(pedidas.some((u) => u.includes('tournament_registrations')), 'solo cuenta las inscripciones')
}

console.log(fallos ? `\n${fallos} FALLOS\n` : '\nTodo en verde\n')
process.exit(fallos ? 1 : 0)
