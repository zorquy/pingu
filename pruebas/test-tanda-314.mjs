import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

// Tanda 314: las piezas de alrededor del foro, que estaban SIN RED.
//
// Desde la tanda 299 el foro tenía cubiertos el índice, la lista de
// temas y la vista de un tema. Lo de alrededor —encuestas, no leídos,
// suscripciones, búsqueda, menciones y moderación— no tenía ni una
// prueba, y es la sección más grande del sitio: cada cambio ahí salía a
// producción a pelo.
//
// Lo que se comprueba no es que «funcione»: son las DECISIONES que se
// tomaron y que un refactor se llevaría por delante sin que nada diera
// error. La más importante, la primera: los resultados de una encuesta
// no se enseñan antes de votar.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

const BASE = 'http://localhost:8892'
const browser = await chromium.launch()

const MUNDO = {
  __FAKE_SECCIONES__: [{ id: 'sec-1', name: 'General', slug: 'general' }],
  __FAKE_FOROS__: [{ id: 'foro-1', section_id: 'sec-1', name: 'Dudas', slug: 'dudas' }],
  __FAKE_TEMAS__: [{ id: 'tema-1', board_id: 'foro-1', title: 'Con encuesta', author_id: 'user-1', post_count: 1 }],
  __FAKE_MENSAJES__: [{ id: 'msg-1', thread_id: 'tema-1', author_id: 'user-1', body_html: '<p>Hola</p>' }],
}

const ENCUESTA = {
  __FAKE_ENCUESTA__: [{ thread_id: 'tema-1', question: '¿Cómo la llamamos?', multiple: false, closes_at: null }],
  __FAKE_OPCIONES__: [
    { id: 'op-1', thread_id: 'tema-1', label: 'Pika', order_pos: 0 },
    { id: 'op-2', thread_id: 'tema-1', label: 'Chu', order_pos: 1 },
  ],
}

const abrir = async (ruta, semillas = {}, { sesion = 'user-1', ancho = 1000 } = {}) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.addInitScript((s) => {
    if (s.__SESION__) window.__FAKE_SESSION__ = s.__SESION__
    for (const [k, v] of Object.entries(s)) if (k !== '__SESION__') window[k] = v
  }, { __SESION__: sesion, ...semillas })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  return { page, errores }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Una encuesta no enseña por dónde va antes de que votes ──')
{
  // LA DECISIÓN, escrita en js/encuesta.js: «ver por dónde va la
  // votación cambia lo que vota la gente, y en una comunidad pequeña eso
  // se nota mucho». Es lo primero que se pierde en un refactor porque no
  // rompe nada visible.
  const { page, errores } = await abrir('/tema?t=tema-1', {
    ...MUNDO, ...ENCUESTA,
    // Votos de OTROS: la encuesta tiene resultados que enseñar, pero tú
    // todavía no has votado.
    __FAKE_VOTOS__: [
      { id: 'v1', option_id: 'op-1', thread_id: 'tema-1', user_id: 'user-8' },
      { id: 'v2', option_id: 'op-1', thread_id: 'tema-1', user_id: 'user-9' },
    ],
  })
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  const antes = await page.evaluate(() => {
    const e = document.querySelector('#encuestaBloque')
    if (!e) return null
    return {
      pregunta: e.querySelector('h3')?.textContent.trim(),
      paraVotar: [...e.querySelectorAll('.encuesta-opcion-voto')].map((n) => n.textContent.trim()),
      resultados: e.querySelectorAll('.encuesta-resultado').length,
      // El total sí se dice: saber cuánta gente ha votado no condiciona
      // a nadie; saber a QUÉ han votado, sí.
      pie: e.querySelector('.encuesta-pie')?.textContent.replace(/\s+/g, ' ').trim(),
      hayBotonVotar: !!e.querySelector('#btnVotar'),
    }
  })
  check('la encuesta está en el tema', antes !== null)
  check('  …con sus opciones para votar', antes?.paraVotar.join('|') === 'Pika|Chu', JSON.stringify(antes?.paraVotar))
  check('  …y NINGÚN resultado a la vista', antes?.resultados === 0, String(antes?.resultados))
  check('  …aunque sí cuántos han votado', /2 votos/.test(antes?.pie || ''), antes?.pie)
  check('  …y el botón de votar', antes?.hayBotonVotar === true)

  // Al votar, los resultados aparecen — y el voto llega a la tabla.
  await page.locator('input[name="encuestaVoto"][value="op-2"]').check()
  await page.locator('#btnVotar').click()
  await page.waitForTimeout(900)
  const despues = await page.evaluate(() => ({
    resultados: [...document.querySelectorAll('.encuesta-resultado')].map((n) => n.textContent.replace(/\s+/g, ' ').trim()),
    mio: document.querySelectorAll('.encuesta-mio').length,
    puedeCambiar: !!document.querySelector('#btnCambiarVoto'),
    yaNoSeVota: document.querySelectorAll('.encuesta-opcion-voto').length,
    votosEnLaTabla: window.__TABLAS__.forum_poll_votes.filter((v) => v.user_id === 'user-1').map((v) => v.option_id),
  }))
  check('después de votar sí se ven los resultados', despues.resultados.length === 2, JSON.stringify(despues.resultados))
  check('  …con el mío marcado', despues.mio === 1, String(despues.mio))
  check('  …ya no se puede volver a marcar', despues.yaNoSeVota === 0, String(despues.yaNoSeVota))
  check('  …y el voto llegó a la tabla', despues.votosEnLaTabla.join() === 'op-2', JSON.stringify(despues.votosEnLaTabla))
  check('  …con la puerta para cambiarlo', despues.puedeCambiar === true)

  // Cambiar el voto BORRA el anterior. Si no, se quedarían los dos y la
  // encuesta contaría doble a quien se lo pensó dos veces.
  await page.locator('#btnCambiarVoto').click()
  await page.waitForTimeout(900)
  const tras = await page.evaluate(() => ({
    mios: window.__TABLAS__.forum_poll_votes.filter((v) => v.user_id === 'user-1').length,
    vuelveAVotar: document.querySelectorAll('.encuesta-opcion-voto').length,
  }))
  check('cambiar el voto borra el anterior', tras.mios === 0, String(tras.mios))
  check('  …y vuelve a preguntar', tras.vuelveAVotar === 2, String(tras.vuelveAVotar))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Sin cuenta se ve la encuesta pero no se vota ──')
{
  const { page } = await abrir('/tema?t=tema-1', { ...MUNDO, ...ENCUESTA, __FAKE_VOTOS__: [] }, { sesion: 'none' })
  const r = await page.evaluate(() => {
    const e = document.querySelector('#encuestaBloque')
    return e && {
      opciones: e.querySelectorAll('.encuesta-opcion-voto').length,
      desactivadas: [...e.querySelectorAll('input[name="encuestaVoto"]')].every((i) => i.disabled),
      botonVotar: !!e.querySelector('#btnVotar'),
      dice: e.querySelector('.encuesta-pie')?.textContent.replace(/\s+/g, ' ').trim(),
    }
  })
  check('la encuesta se ve sin cuenta', r?.opciones === 2, String(r?.opciones))
  check('  …pero no se puede marcar nada', r?.desactivadas === true)
  check('  …no hay botón de votar', r?.botonVotar === false)
  check('  …y se dice por qué', /cuenta/i.test(r?.dice || ''), r?.dice)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Una encuesta de varias respuestas se marca distinto ──')
{
  const { page } = await abrir('/tema?t=tema-1', {
    ...MUNDO,
    __FAKE_ENCUESTA__: [{ thread_id: 'tema-1', question: '¿Cuáles?', multiple: true, closes_at: null }],
    __FAKE_OPCIONES__: ENCUESTA.__FAKE_OPCIONES__,
    __FAKE_VOTOS__: [],
  })
  const tipo = await page.evaluate(() => document.querySelector('input[name="encuestaVoto"]')?.type)
  check('con varias respuestas son casillas, no botones de radio', tipo === 'checkbox', tipo)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Una encuesta cerrada enseña el resultado y no deja votar ──')
{
  const { page } = await abrir('/tema?t=tema-1', {
    ...MUNDO,
    __FAKE_ENCUESTA__: [{ thread_id: 'tema-1', question: '¿Ya está?', multiple: false, closes_at: '2020-01-01T00:00:00Z' }],
    __FAKE_OPCIONES__: ENCUESTA.__FAKE_OPCIONES__,
    __FAKE_VOTOS__: [{ id: 'v1', option_id: 'op-1', thread_id: 'tema-1', user_id: 'user-8' }],
  })
  const r = await page.evaluate(() => ({
    resultados: document.querySelectorAll('.encuesta-resultado').length,
    paraVotar: document.querySelectorAll('.encuesta-opcion-voto').length,
    botonVotar: !!document.querySelector('#btnVotar'),
    pie: document.querySelector('.encuesta-pie')?.textContent.replace(/\s+/g, ' ').trim(),
  }))
  check('una encuesta cerrada enseña sus resultados', r.resultados === 2, String(r.resultados))
  check('  …sin nada que marcar', r.paraVotar === 0 && r.botonVotar === false, JSON.stringify(r))
  check('  …y lo dice', /cerrada/.test(r.pie || ''), r.pie)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Las menciones: lo que NO es una mención ──')
{
  // Cuatro reglas que están escritas en js/menciones.js con su porqué y
  // que un refactor se lleva sin enterarse. Se prueban las funciones
  // PURAS, importándolas en la página (necesitan DOMParser).
  const { page } = await abrir('/foro', MUNDO)
  const r = await page.evaluate(async () => {
    const m = await import('/js/menciones.js')
    const perfiles = m.porNombre([
      { id: 'u-ash', username: 'ash', display_name: 'Ash' },
      { id: 'u-misty', username: 'misty', display_name: 'Misty' },
    ])
    return {
      // Una dirección de correo NO menciona a nadie.
      correo: m.nombresMencionados('escribe a hola@pokedoc.es'),
      // Un @nombre normal sí.
      normal: m.nombresMencionados('gracias @ash y @misty'),
      // Como mucho cinco: un mensaje con veinte menciones no es una
      // conversación, es una lista de correo.
      tope: m.nombresMencionados('@a1 @a2 @a3 @a4 @a5 @a6 @a7').length,
      // Los párrafos SEPARAN: `textContent` a secas pegaba "hola" con
      // "@ash" y, con la regla del correo, dejaba de ser una mención.
      // Empezar un párrafo con @alguien es lo más normal del mundo.
      entreParrafos: m.nombresMencionados(m.textoPlano('<p>hola</p><p>@ash</p>')),
      // Al enlazar: solo quien existe, y nunca dentro de otro enlace.
      enlazado: m.enlazarMenciones('<p>hola @ash y @nadie</p>', perfiles),
      dentroDeEnlace: m.enlazarMenciones('<p><a href="/x">@ash</a></p>', perfiles),
      // Ni dentro de código, que es texto literal.
      dentroDeCodigo: m.enlazarMenciones('<p><code>@ash</code></p>', perfiles),
    }
  })
  check('una dirección de correo no menciona a nadie', r.correo.length === 0, JSON.stringify(r.correo))
  check('un @nombre normal sí', r.normal.join() === 'ash,misty', JSON.stringify(r.normal))
  check('como mucho cinco menciones por mensaje', r.tope === 5, String(r.tope))
  check('un @nombre que abre un párrafo cuenta', r.entreParrafos.join() === 'ash', JSON.stringify(r.entreParrafos))
  check('se enlaza a quien existe', /<a class="mencion"[^>]*>@ash<\/a>/.test(r.enlazado), r.enlazado)
  check('  …y @nadie se queda como texto pelado',
    r.enlazado.includes('@nadie') && !/<a[^>]*>@nadie/.test(r.enlazado), r.enlazado)
  check('no se mete un enlace dentro de otro', !/mencion/.test(r.dentroDeEnlace), r.dentroDeEnlace)
  check('ni se tocan las menciones dentro de código', !/mencion/.test(r.dentroDeCodigo), r.dentroDeCodigo)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. Lo no leído: y lo que NO cuenta como no leído ──')
{
  const hace = (m) => new Date(Date.now() - m * 60000).toISOString()
  const FORO = {
    __FAKE_SECCIONES__: MUNDO.__FAKE_SECCIONES__,
    __FAKE_FOROS__: MUNDO.__FAKE_FOROS__,
    __FAKE_TEMAS__: [
      // Nuevo de verdad: última respuesta de OTRO, después de mi marca.
      { id: 'tema-1', board_id: 'foro-1', title: 'Con respuesta nueva', author_id: 'user-2', post_count: 2,
        last_post_at: hace(5), last_post_author_id: 'user-2', created_at: hace(600) },
      // Viejo y leído.
      { id: 'tema-2', board_id: 'foro-1', title: 'Ya visto', author_id: 'user-2', post_count: 1,
        last_post_at: hace(500), last_post_author_id: 'user-2', created_at: hace(600) },
      // El último mensaje es MÍO y es recentísimo.
      { id: 'tema-3', board_id: 'foro-1', title: 'Acabo de responder yo', author_id: 'user-2', post_count: 3,
        last_post_at: hace(1), last_post_author_id: 'user-1', created_at: hace(600) },
    ],
    __FAKE_LECTURAS__: [{ id: 'l1', thread_id: 'tema-2', user_id: 'user-1', last_read_at: hace(400) }],
  }

  const { page, errores } = await abrir('/foro', FORO)
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  const r = await page.evaluate(() => ({
    chapa: document.querySelector('.foro-chapa-nuevos')?.textContent.trim(),
    puntos: document.querySelectorAll('.foro-punto-nuevo').length,
    filasNuevas: document.querySelectorAll('.foro-fila-nueva').length,
  }))
  // UNO, no dos: el tema al que acabo de responder YO no cuenta. Sin esa
  // excepción, responder te marcaba el tema en negrita — tu propio
  // mensaje contando como nuevo para ti.
  check('el foro cuenta UN tema sin leer', r.chapa === '1 nuevo', r.chapa)
  check('  …con su punto', r.puntos >= 1, String(r.puntos))
  check('  …y su fila marcada', r.filasNuevas === 1, String(r.filasNuevas))
  await page.close()

  // Sin la migración puesta, NO se marca nada. Lo contrario sería media
  // pantalla en negrita para siempre y sin forma de quitarlo.
  const { page: sinTabla } = await abrir('/foro', { ...FORO, __SIN_TABLAS__: ['forum_thread_reads'] })
  const s = await sinTabla.evaluate(() => ({
    chapas: document.querySelectorAll('.foro-chapa-nuevos').length,
    puntos: document.querySelectorAll('.foro-punto-nuevo').length,
    // Y el foro se ve ENTERO igual: sin la migración no se marca lo
    // nuevo, pero no se cae nada.
    foros: document.querySelectorAll('.foro-fila').length,
  }))
  check('sin la migración de lecturas no se marca nada', s.chapas === 0 && s.puntos === 0, JSON.stringify(s))
  check('  …pero el foro se ve igual', s.foros >= 1, String(s.foros))
  await sinTabla.close()

  // Y sin cuenta tampoco: a quien acaba de llegar, marcarle media
  // pantalla en negrita no le dice nada.
  const { page: anon } = await abrir('/foro', FORO, { sesion: 'none' })
  const a = await anon.evaluate(() => ({
    chapas: document.querySelectorAll('.foro-chapa-nuevos').length,
    foros: document.querySelectorAll('.foro-fila').length,
  }))
  check('sin cuenta no se marca nada', a.chapas === 0, String(a.chapas))
  check('  …y el foro también se ve', a.foros >= 1, String(a.foros))
  await anon.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 7. Seguir un tema ──')
{
  const { page, errores } = await abrir('/tema?t=tema-1', MUNDO)
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  const leer = () => page.evaluate(() => {
    const n = document.getElementById('btnSeguirTema')
    return n && {
      texto: n.textContent.trim(),
      pulsado: n.getAttribute('aria-pressed'),
      enLaTabla: window.__TABLAS__.forum_subscriptions.filter((s) => s.user_id === 'user-1' && s.thread_id === 'tema-1').length,
    }
  })
  const antes = await leer()
  check('el botón empieza en «Seguir»', antes?.texto === 'Seguir' && antes?.pulsado === 'false', JSON.stringify(antes))
  await page.locator('#btnSeguirTema').click()
  await page.waitForTimeout(700)
  const uno = await leer()
  check('al pulsarlo pasa a «Siguiendo»', uno?.texto === 'Siguiendo' && uno?.pulsado === 'true', JSON.stringify(uno))
  check('  …y queda apuntado en la base', uno?.enLaTabla === 1, String(uno?.enLaTabla))
  await page.locator('#btnSeguirTema').click()
  await page.waitForTimeout(700)
  const dos = await leer()
  check('volver a pulsarlo deja de seguirlo', dos?.texto === 'Seguir' && dos?.enLaTabla === 0, JSON.stringify(dos))
  await page.close()

  // Sin la migración del foro, el botón AVISA en vez de mentir. El
  // cambio se pinta antes de que conteste la base —un botón que tarda
  // medio segundo se pulsa dos veces— así que si falla hay que volver
  // atrás; si no, dirías «Siguiendo» a alguien a quien no vas a avisar.
  const { page: roto } = await abrir('/tema?t=tema-1', { ...MUNDO, __SIN_TABLAS__: ['forum_subscriptions'] })
  await roto.locator('#btnSeguirTema').click()
  await roto.waitForTimeout(900)
  const r = await roto.evaluate(() => ({
    texto: document.getElementById('btnSeguirTema')?.textContent.trim(),
    aviso: document.querySelector('.toast, #toast')?.textContent || '',
  }))
  check('si la base no lo acepta, el botón vuelve atrás', r.texto === 'Seguir', JSON.stringify(r))
  await roto.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 8. El buscador del foro ──')
{
  const hace = (m) => new Date(Date.now() - m * 60000).toISOString()
  const CONTENIDO = {
    __FAKE_SECCIONES__: MUNDO.__FAKE_SECCIONES__,
    __FAKE_FOROS__: MUNDO.__FAKE_FOROS__,
    __FAKE_TEMAS__: [
      { id: 'tema-1', board_id: 'foro-1', title: 'Mi mazo de Charizard', author_id: 'user-2', post_count: 1, last_post_at: hace(10), created_at: hace(60) },
      { id: 'tema-2', board_id: 'foro-1', title: 'Duda de reglamento', author_id: 'user-2', post_count: 1, last_post_at: hace(20), created_at: hace(60) },
    ],
    __FAKE_MENSAJES__: [
      { id: 'msg-1', thread_id: 'tema-2', author_id: 'user-2', body_html: '<p>¿Se puede jugar Pikachu ex?</p>', created_at: hace(20) },
    ],
  }
  // Por TÍTULO. Y sin tildes ni mayúsculas: `search_norm` es una columna
  // generada que pliega el texto, y el doble la calcula igual.
  const { page, errores } = await abrir('/foro?q=charizard', CONTENIDO)
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  const porTitulo = await page.evaluate(() => ({
    titulo: document.getElementById('foroTitulo')?.textContent.trim(),
    enlaces: [...document.querySelectorAll('a[href*="/tema"]')].map((n) => n.textContent.trim()).filter(Boolean),
  }))
  check('la búsqueda dice qué se buscó', /charizard/i.test(porTitulo.titulo || ''), porTitulo.titulo)
  check('  …y encuentra el tema por su título',
    porTitulo.enlaces.some((x) => /Charizard/.test(x)), JSON.stringify(porTitulo.enlaces))
  check('  …sin traerse el que no toca',
    !porTitulo.enlaces.some((x) => /reglamento/i.test(x)), JSON.stringify(porTitulo.enlaces))
  await page.close()

  // Por el TEXTO de un mensaje, no solo por el título.
  const { page: porTexto } = await abrir('/foro?q=pikachu', CONTENIDO)
  const enc = await porTexto.evaluate(() =>
    [...document.querySelectorAll('a[href*="/tema"]')].map((n) => n.textContent.trim()).filter(Boolean))
  check('encuentra también por el texto de un mensaje',
    enc.some((x) => /reglamento/i.test(x)), JSON.stringify(enc))
  await porTexto.close()

  // Y si la columna del buscador no existe todavía, se DICE que no está
  // activado. Enseñar «no hay nada con “charizard”» sería MENTIR: haberlo
  // lo hay, lo que no se puede es buscarlo. Se comprueba el mensaje que
  // sale, no que no salga otro.
  const { page: sinColumna } = await abrir('/foro?q=charizard', { ...CONTENIDO, __SIN_COLUMNAS__: { forum_threads: ['search_norm'], forum_posts: ['search_norm'] } })
  const dice = await sinColumna.evaluate(() => ({
    // DENTRO de la columna principal: el lateral tiene su propio
    // `.empty-state` («Cargando…») y coger el primero del documento
    // leía ese, no el del buscador.
    vacio: document.querySelector('#foroPrincipal .empty-state')?.textContent.trim() || '',
    hayResultados: document.querySelectorAll('#foroPrincipal .foro-seccion').length,
  }))
  check('sin la migración, el buscador dice que no está activado',
    /no está activado/i.test(dice.vacio), JSON.stringify(dice))
  check('  …y no dice que no haya nada, que sería mentira',
    !/no hay nada con/i.test(dice.vacio), dice.vacio)
  await sinColumna.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 9. La moderación solo la ve el equipo ──')
{
  const LISTA = {
    __FAKE_SECCIONES__: MUNDO.__FAKE_SECCIONES__,
    __FAKE_FOROS__: MUNDO.__FAKE_FOROS__,
    __FAKE_TEMAS__: [
      { id: 'tema-1', board_id: 'foro-1', title: 'Uno', author_id: 'user-2', post_count: 1, last_post_at: new Date().toISOString(), created_at: new Date().toISOString() },
      { id: 'tema-2', board_id: 'foro-1', title: 'Dos', author_id: 'user-2', post_count: 1, last_post_at: new Date().toISOString(), created_at: new Date().toISOString() },
    ],
  }
  const mirar = (page) => page.evaluate(() => ({
    casillas: document.querySelectorAll('.foro-mod-casilla').length,
    menus: document.querySelectorAll('.foro-mod-menu-btn').length,
  }))

  const { page: normal } = await abrir('/foro?f=dudas', LISTA)
  const n = await mirar(normal)
  check('quien no es del equipo no ve nada de moderación', n.casillas === 0 && n.menus === 0, JSON.stringify(n))
  await normal.close()

  const { page: anon } = await abrir('/foro?f=dudas', LISTA, { sesion: 'none' })
  const a = await mirar(anon)
  check('  …ni quien entra sin cuenta', a.casillas === 0 && a.menus === 0, JSON.stringify(a))
  await anon.close()

  // Un MODERADOR, no solo el admin: `rolEnElEquipo` mira is_admin O
  // is_moderator, y perder el segundo dejaría al equipo sin herramientas
  // sin que nada diera error.
  for (const [quien, etiq] of [['admin-1', 'el admin'], ['mod-1', 'un moderador']]) {
    const { page, errores } = await abrir('/foro?f=dudas', LISTA, { sesion: quien })
    check(`[${etiq}] sin errores de JavaScript`, errores.length === 0, errores[0] || '')
    const r = await mirar(page)
    check(`[${etiq}] ve una casilla y un menú por tema`, r.casillas === 2 && r.menus === 2, JSON.stringify(r))
    await page.close()
  }

  // Y la barra de abajo aparece al marcar, con lo que se puede hacer.
  const { page: staff } = await abrir('/foro?f=dudas', LISTA, { sesion: 'admin-1' })
  await staff.locator('input[data-mod-sel]').first().check()
  await staff.waitForTimeout(500)
  const barra = await staff.evaluate(() => ({
    hay: !!document.querySelector('.foro-mod-barra'),
    cuenta: document.querySelector('.foro-mod-cuenta')?.textContent.trim(),
    acciones: [...document.querySelectorAll('.foro-mod-acciones button')].map((n) => n.textContent.trim()),
  }))
  check('al marcar un tema sale la barra de acciones', barra.hay === true)
  check('  …diciendo cuántos hay', barra.cuenta === '1 tema seleccionado', barra.cuenta)
  check('  …y con qué hacer', barra.acciones.length >= 3, JSON.stringify(barra.acciones))
  await staff.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
