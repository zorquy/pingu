// Los correos (tanda 249). Sin navegador y sin red: todo lo que se pinta
// vive en netlify/lib/, que está separado a propósito para poder
// probarlo. Hasta ahora no había NINGUNA prueba de correo — se perdieron
// en el reinicio del 2026-08-28 y no se rehicieron.
import { readFileSync } from 'node:fs'
import {
  absoluteUrl,
  safePath,
  sanitizeHeader,
  renderEmail,
  renderFilaDeCola,
  textosDeTipo,
  TEXTOS_POR_TIPO,
} from '/home/user/pingu/netlify/lib/email.mjs'
import { fechaLargaEs, horaEs, normalizarHora } from '/home/user/pingu/netlify/lib/fechas.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

const SITIO = 'https://pokedoc.es'
const BAJA = 'https://pokedoc.es/baja-correo?t=abc&tipo=torneo_ronda'
const pintar = (fila) => renderFilaDeCola(fila, { siteUrl: SITIO, unsubscribeUrl: BAJA })

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. El enlace lleva a la cosa, no a la portada ──')
{
  // EL FALLO DE LA TANDA: el barredor encola URLs ENTERAS (las necesita
  // así para el push) y aquí solo se aceptaban rutas. El `?:` se caía a
  // la portada y TODOS los correos de torneo llevaban a pokedoc.es.
  check('una URL nuestra entera se respeta',
    absoluteUrl(SITIO, 'https://pokedoc.es/torneo?slug=copa') === 'https://pokedoc.es/torneo?slug=copa',
    absoluteUrl(SITIO, 'https://pokedoc.es/torneo?slug=copa'))
  check('una ruta se vuelve absoluta',
    absoluteUrl(SITIO, '/tema/42') === 'https://pokedoc.es/tema/42', absoluteUrl(SITIO, '/tema/42'))
  check('y NUNCA se cae a la portada',
    absoluteUrl(SITIO, 'https://pokedoc.es/torneo?slug=copa') !== SITIO)
}

console.log('\n── 2. Lo que no es nuestro no entra ──')
{
  for (const malo of ['https://evil.example/roba', '//evil.example', 'javascript:alert(1)', 'http://pokedoc.es.evil.com/x', '', null]) {
    check(`rechazado: ${JSON.stringify(malo)}`, absoluteUrl(SITIO, malo) === null, String(absoluteUrl(SITIO, malo)))
  }
  check('safePath sigue diciendo que no a las rutas raras', safePath('//evil') === null && safePath(' /x') === null)
  // Y lo importante: un enlace que no vale deja el correo SIN botón, no
  // con un botón a la portada, que se lee como si funcionara.
  const { html, text } = renderEmail({ subject: 'Hola', preview: 'Qué tal', link: 'https://evil.example', siteUrl: SITIO, tipo: 'forum_reply' })
  check('sin enlace válido no hay botón', !/<a href[^>]*background-color:#1e5175/.test(html))
  check('ni aparece la portada suelta en el texto', !text.includes('https://pokedoc.es\n'), text)
}

console.log('\n── 3. Cada tipo con su verbo ──')
{
  check('torneo_ronda → «Ir a tu mesa»', textosDeTipo('torneo_ronda').cta === 'Ir a tu mesa')
  check('forum_reply → «Leer el tema»', textosDeTipo('forum_reply').cta === 'Leer el tema')
  check('torneo_final → «Ver la clasificación»', textosDeTipo('torneo_final').cta === 'Ver la clasificación')
  check('un tipo que no existe cae al genérico', textosDeTipo('lo_que_sea').cta === 'Verlo en PokeDoc')
  const { html } = pintar({ type: 'torneo_ronda', subject: 'Ronda 1', preview: 'Tu mesa', link: 'https://pokedoc.es/torneo?slug=copa' })
  check('y el verbo sale en el botón', html.includes('Ir a tu mesa'))
  check('ya no pone «Verlo en PokeDoc»', !html.includes('Verlo en PokeDoc'))
}

console.log('\n── 4. El pie dice la verdad ──')
{
  const torneo = pintar({ type: 'torneo_ronda', subject: 'Ronda 1', preview: 'x', link: 'https://pokedoc.es/torneo?slug=copa' })
  // En un «empieza tu ronda» no se ha dirigido a ti nadie. Decirlo era
  // mentira, y un pie que miente es un pie que acaba en spam.
  check('un aviso de torneo NO dice «alguien se ha dirigido a ti»', !/se ha dirigido a ti/.test(torneo.html), '')
  check('dice por qué te llega de verdad', /estás jugando este torneo/.test(torneo.html))
  const privado = pintar({ type: 'private_message', subject: 'Misty te ha escrito', preview: 'hola', link: '/mensajes.html?c=1' })
  check('y el de un privado dice lo suyo', /te ha escrito por privado/.test(privado.html))
}

console.log('\n── 5. Preheader, el trozo que decide si se abre ──')
{
  const { html } = pintar({ type: 'forum_reply', subject: 'Ash ha respondido', preview: 'Yo esa la tengo por buena', link: '/tema/1' })
  check('hay preheader oculto', /display:none;max-height:0/.test(html))
  check('y lleva la cita', html.indexOf('Yo esa la tengo por buena') < html.indexOf('<table'), 'va antes de la tarjeta')
}

console.log('\n── 6. Nada de lo que llega de fuera se pinta a pelo ──')
{
  const { html, subject } = pintar({
    type: 'forum_reply',
    subject: 'Mira <script>alert(1)</script>',
    preview: '<img src=x onerror=alert(1)>',
    link: '/tema/1',
  })
  check('el asunto sale escapado', !html.includes('<script>'), '')
  check('la cita también', !html.includes('<img src=x'), '')
  check('y el asunto no lleva saltos de línea (es una cabecera)',
    sanitizeHeader('Hola\nBcc: otro@sitio.com') === 'Hola Bcc: otro@sitio.com',
    sanitizeHeader('Hola\nBcc: otro@sitio.com'))
  check('el asunto devuelto va limpio', !/[\n\r]/.test(subject))
}

console.log('\n── 7. Maquetación que aguanta Outlook ──')
{
  const { html } = pintar({ type: 'forum_reply', subject: 'x', preview: 'y', link: '/tema/1' })
  // El Outlook de Windows pinta con el motor de Word y se salta
  // max-width: sin el atributo width la tarjeta sale a pantalla completa.
  check('la tarjeta lleva width de verdad', /<table[^>]*width="520"/.test(html))
  check('y no un div con max-width suelto', !/<div style="max-width:520px/.test(html))
  check('el fondo va declarado (modo oscuro no lo invierte)', /background-color:#f4f6f8/.test(html))
}

console.log('\n── 8. El texto plano también sirve ──')
{
  const { text } = pintar({ type: 'torneo_recordatorio', subject: 'Empieza a las 19:00', preview: 'Ten TCG Live a mano', link: 'https://pokedoc.es/torneo?slug=copa' })
  check('lleva el enlace de verdad', text.includes('https://pokedoc.es/torneo?slug=copa'), text)
  check('con su verbo delante', text.includes('Ir al torneo:'))
  check('y la forma de darse de baja', text.includes(BAJA))
}

console.log('\n── 9. El resumen semanal, cada tema a SU tema ──')
{
  const { html, text } = pintar({
    type: 'weekly_digest',
    subject: 'x',
    preview: JSON.stringify({ temas: [{ id: 11, titulo: 'Dudas con Dragapult', mensajes: 23 }], guia: { titulo: 'Marcas de regulación', slug: 'marcas' } }),
    link: null,
  })
  check('el tema enlaza a su tema', html.includes('https://pokedoc.es/tema/11'))
  check('la guía a su guía', html.includes('https://pokedoc.es/guia.html?slug=marcas'))
  check('y el botón al foro', html.includes('https://pokedoc.es/foro'))
  check('el pie dice que es semanal', /una vez por semana/.test(html))
  check('en texto plano van los enlaces', text.includes('https://pokedoc.es/tema/11'))
  // Una fila vieja de antes del resumen estructurado no puede reventar.
  const viejo = pintar({ type: 'weekly_digest', subject: 'Resumen', preview: 'texto de los de antes', link: '/foro' })
  check('una fila antigua cae a la plantilla normal', viejo.html.includes('texto de los de antes'))
}

console.log('\n── 10. Las fechas, en español y en hora de España ──')
{
  const ahora = new Date('2026-09-01T10:00:00Z')
  check('verano (UTC+2)', fechaLargaEs('2026-09-04T17:00:00Z', { ahora }) === 'viernes 4 de septiembre a las 19:00', String(fechaLargaEs('2026-09-04T17:00:00Z', { ahora })))
  check('invierno (UTC+1)', fechaLargaEs('2026-12-20T18:30:00Z', { ahora }) === 'domingo 20 de diciembre a las 19:30', String(fechaLargaEs('2026-12-20T18:30:00Z', { ahora })))
  check('otro año lo dice', /de 2027$/.test(String(fechaLargaEs('2027-01-05T18:30:00Z', { ahora }))) === false && String(fechaLargaEs('2027-01-05T18:30:00Z', { ahora })).includes('de 2027'), String(fechaLargaEs('2027-01-05T18:30:00Z', { ahora })))
  check('la hora sola', horaEs('2026-09-04T17:00:00Z') === '19:00', String(horaEs('2026-09-04T17:00:00Z')))
  check('medianoche no es «24:00»', String(fechaLargaEs('2026-09-03T22:00:00Z', { ahora })).endsWith('a las 00:00'), String(fechaLargaEs('2026-09-03T22:00:00Z', { ahora })))
  // El ciclo h24 de Intl escribe la medianoche como «24». Aquí se pide
  // h23, pero esto lo ejecuta el runtime de Netlify: se comprueba la
  // normalización POR SEPARADO, porque con h23 ninguna fecha llega a
  // ejercitarla y sería una rama sin probar.
  check('la hora 24 se normaliza a 0', normalizarHora('24') === 0, String(normalizarHora('24')))
  check('y las normales no se tocan', normalizarHora('19') === 19 && normalizarHora('00') === 0)
  check('una hora que no es número no rompe', normalizarHora('x') === 0)
  // `new Date(null)` es 1970, no una fecha inválida: sin la guarda, un
  // torneo sin fecha se anunciaba para el 1 de enero de 1970.
  for (const v of [null, undefined, '', 'no-es-una-fecha']) {
    check(`sin fecha no se inventa nada: ${JSON.stringify(v)}`, fechaLargaEs(v) === null && horaEs(v) === null)
  }
}

console.log('\n── 11. Las listas de tipos siguen cuadrando ──')
{
  // Tres ficheros tienen que decir lo mismo, y si uno se queda atrás no
  // se nota hasta que alguien se da de baja: un tipo que baja-correo no
  // reconoce apaga TODOS los correos de esa persona.
  const claves = (texto, nombre) => {
    const m = texto.match(new RegExp(`(?:export )?const ${nombre} = \\{([\\s\\S]*?)\\n\\}`))
    return new Set([...m[1].matchAll(/^\s{2}(\w+):/gm)].map((x) => x[1]))
  }
  const notif = readFileSync('/home/user/pingu/js/notifications.js', 'utf8')
  const ui = new Set([...claves(notif, 'EMAIL_TYPES'), ...claves(notif, 'EMAIL_TYPES_EQUIPO')])
  const baja = claves(readFileSync('/home/user/pingu/netlify/functions/baja-correo.mjs', 'utf8'), 'NOMBRES')
  const conTexto = new Set(Object.keys(TEXTOS_POR_TIPO))

  // `torneo_apertura` es la excepción a propósito (tanda 252): dejó de
  // mandar correo —era un email a TODA la comunidad por cada torneo que
  // abría— pero el tipo SIGUE en la baja, para que el enlace de un
  // correo ya enviado no apague todo lo demás de esa persona.
  const YA_NO_SE_MANDAN = new Set(['torneo_apertura'])
  const faltanEnBaja = [...ui].filter((t) => !baja.has(t))
  const sobranEnBaja = [...baja].filter((t) => !ui.has(t) && !YA_NO_SE_MANDAN.has(t))
  const sinTexto = [...ui].filter((t) => t !== 'weekly_digest' && !conTexto.has(t))
  check('la baja conoce todos los tipos de la web', faltanEnBaja.length === 0, faltanEnBaja.join(','))
  check('y no conoce ninguno de más', sobranEnBaja.length === 0, sobranEnBaja.join(','))
  check('el tipo retirado sigue en la baja (por los correos ya enviados)',
    [...YA_NO_SE_MANDAN].every((t) => baja.has(t)), [...YA_NO_SE_MANDAN].filter((t) => !baja.has(t)).join(','))
  check('pero la web ya no ofrece su casilla',
    [...YA_NO_SE_MANDAN].every((t) => !ui.has(t)), [...YA_NO_SE_MANDAN].filter((t) => ui.has(t)).join(','))
  check('todos los tipos tienen su verbo y su pie', sinTexto.length === 0, sinTexto.join(','))
}

console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
