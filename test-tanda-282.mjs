// Tanda 282: mandar una noticia a Telegram a mano, desde el panel.
//
// Lo que arregla: PINGU publicó una noticia y no salió por el canal. La
// función programada se iba en silencio porque le faltaba una variable de
// entorno, y no había ni forma de enterarse ni forma de recuperarla.
import { mandarUna } from '/home/user/pingu/netlify/functions/telegram-mandar.mjs'
import { procesar } from '/home/user/pingu/netlify/functions/telegram-noticias.mjs'
import { llavesQueFaltan, mensajeDeNoticia, portadaAbsoluta, describirImagen, comoEsLaPortada } from '/home/user/pingu/netlify/lib/telegram.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 150) : ''}`)
}

const ENV = {
  TELEGRAM_BOT_TOKEN: 'tok',
  TELEGRAM_CANAL_NOTICIAS: '@pingucollects',
  TELEGRAM_TEMA_NOTICIAS: '51511',
  SUPABASE_SERVICE_ROLE_KEY: 'k',
}

const NOTICIA = {
  id: 'n1',
  slug: 'promos-30',
  kind: 'news',
  title: 'Las 18 promos del 30 aniversario',
  description: 'Todas las promos reveladas, una por una.',
  cover_image: 'https://pokedoc.es/portada.png',
  published_at: '2026-09-02T10:00:00.000Z',
  telegram_sent_at: null,
}

function doblar({ fila = NOTICIA, telegramOk = true, patchFalla = false, enlaceFalla = false, subidaOk = true, portada = {} } = {}) {
  const enviado = []
  const marcado = []
  const pedido = []
  const cabeceras = []
  const restImpl = async (ruta, _clave, opciones = {}) => {
    if (opciones.method === 'PATCH') {
      if (patchFalla) throw new Error('sin permiso')
      marcado.push(JSON.parse(opciones.body))
      return null
    }
    return fila ? [fila] : []
  }
  const fetchImpl = async (url, opciones = {}) => {
    // Lo que no va a api.telegram.org es la DESCARGA de la portada: la
    // lib se la trae para subirla cuando el enlace no le vale a Telegram.
    if (!String(url).startsWith('https://api.telegram.org/')) {
      pedido.push(String(url))
      cabeceras.push(opciones.headers || {})
      if (!portada) return new Response('', { status: 404 })
      return new Response(portada.cuerpo ?? new Uint8Array(portada.bytes ?? 1000), { status: portada.estado ?? 200, headers: { 'content-type': portada.tipo ?? 'image/png' } })
    }
    const metodo = String(url).split('/').pop()
    // Subida: el cuerpo es un formulario, no JSON.
    if (opciones.body instanceof FormData) {
      const f = opciones.body
      enviado.push({ metodo, subida: true, chat_id: f.get('chat_id'), caption: f.get('caption'), message_thread_id: f.get('message_thread_id'), foto: f.get('photo') })
      // `telegramOk: false` es «el canal no existe»: eso tumba TODO, la
      // subida incluida. No respetarlo aquí dejaría pasar por buena una
      // noticia que en realidad no ha llegado a ninguna parte.
      const vale = subidaOk && telegramOk
      return new Response(JSON.stringify({ ok: vale, description: vale ? '' : telegramOk ? 'PHOTO_INVALID_DIMENSIONS' : 'chat not found' }), { status: 200 })
    }
    enviado.push({ metodo, ...JSON.parse(opciones.body) })
    if (metodo === 'sendPhoto' && enlaceFalla) {
      return new Response(JSON.stringify({ ok: false, description: 'failed to get HTTP URL content' }), { status: 400 })
    }
    return new Response(JSON.stringify({ ok: telegramOk, description: telegramOk ? '' : 'chat not found' }), { status: 200 })
  }
  return { restImpl, fetchImpl, enviado, marcado, pedido, cabeceras }
}

console.log('\n── 1. EL FALLO: sin la variable, decir CUÁL falta ──')
{
  // Esto es lo que pasó de verdad. La función programada se iba con un
  // «sin TELEGRAM_BOT_TOKEN o TELEGRAM_CANAL_NOTICIAS» que ni decía cuál
  // era ni salía en ningún sitio. Sin el nombre no hay nada que arreglar.
  check('se nombra la que falta', llavesQueFaltan({ ...ENV, TELEGRAM_CANAL_NOTICIAS: '' }).join() === 'TELEGRAM_CANAL_NOTICIAS')
  check('y si faltan dos, las dos', llavesQueFaltan({}).length === 3, llavesQueFaltan({}).join())
  check('con todas puestas, ninguna', llavesQueFaltan(ENV).length === 0)

  const d = doblar()
  const r = await mandarUna({ id: 'n1', env: { ...ENV, TELEGRAM_CANAL_NOTICIAS: '' }, ...d })
  check('el botón no manda nada', d.enviado.length === 0)
  check('y responde diciendo el nombre', r.estado === 503 && r.cuerpo.error.includes('TELEGRAM_CANAL_NOTICIAS'), JSON.stringify(r.cuerpo))
  check('y dice dónde se pone', /Environment variables/.test(r.cuerpo.error))

  // La programada tiene que cantarlo igual: es la que corre sola.
  const r2 = await procesar({ env: { ...ENV, TELEGRAM_CANAL_NOTICIAS: '' }, restImpl: async () => [], fetchImpl: async () => new Response('{}') })
  check('la programada también lo nombra', /TELEGRAM_CANAL_NOTICIAS/.test(r2.saltado || ''), JSON.stringify(r2))
}

console.log('\n── 2. Mandar una noticia a mano ──')
{
  const d = doblar()
  const r = await mandarUna({ id: 'n1', env: ENV, ...d })
  check('sale', r.estado === 200 && r.cuerpo.ok, JSON.stringify(r.cuerpo))
  check('como foto con pie', d.enviado[0]?.metodo === 'sendPhoto', d.enviado[0]?.metodo)
  check('al grupo', d.enviado[0]?.chat_id === '@pingucollects')
  check('y al tema de noticias', d.enviado[0]?.message_thread_id === 51511, JSON.stringify(d.enviado[0]?.message_thread_id))
  check('el mensaje es el mismo que manda la automática', d.enviado[0]?.caption === mensajeDeNoticia(NOTICIA))
  check('y se apunta como mandada', !!d.marcado[0]?.telegram_sent_at, JSON.stringify(d.marcado))
}

console.log('\n── 3. Las redes de la automática NO le aplican ──')
{
  // Esta es la razón de ser del botón: la programada solo mira las
  // últimas 48 horas, así que una noticia de hace días no la recupera
  // jamás. A mano sí, porque hay una persona decidiéndolo.
  const vieja = { ...NOTICIA, published_at: '2026-08-01T10:00:00.000Z' }
  const d = doblar({ fila: vieja })
  const r = await mandarUna({ id: 'n1', env: ENV, ...d })
  check('una noticia de hace un mes se manda igual', r.estado === 200 && d.enviado.length === 1, JSON.stringify(r.cuerpo))

  // Y a la programada se le siguen escapando: la red sigue puesta.
  let ruta = ''
  await procesar({ env: ENV, restImpl: async (r2) => { ruta = r2; return [] }, fetchImpl: async () => new Response('{}') })
  check('pero la automática sigue pidiendo solo las recientes', ruta.includes('published_at=gte.'))
}

console.log('\n── 4. Repetir una noticia tiene que ser una decisión ──')
{
  // Mandar dos veces lo mismo a un canal es lo que hace que la gente lo
  // silencie: sin insistir, se avisa en vez de repetirla.
  const ya = { ...NOTICIA, telegram_sent_at: '2026-09-10T08:00:00.000Z' }
  const d = doblar({ fila: ya })
  const r = await mandarUna({ id: 'n1', env: ENV, ...d })
  check('ya mandada: no se repite sola', r.estado === 409 && d.enviado.length === 0, JSON.stringify(r.cuerpo))
  check('y se dice cuándo salió', r.cuerpo.yaMandada === ya.telegram_sent_at)

  const d2 = doblar({ fila: ya })
  const r2 = await mandarUna({ id: 'n1', forzar: true, env: ENV, ...d2 })
  check('pero insistiendo, sale', r2.estado === 200 && d2.enviado.length === 1, JSON.stringify(r2.cuerpo))
}

console.log('\n── 5. Lo que no puede salir por el canal ──')
{
  const borrador = { ...NOTICIA, published_at: null }
  const d = doblar({ fila: borrador })
  const r = await mandarUna({ id: 'n1', env: ENV, ...d })
  // El enlace del mensaje llevaría a una página que no existe.
  check('un borrador no se manda', r.estado === 400 && d.enviado.length === 0, JSON.stringify(r.cuerpo))
  check('y se dice por qué', /borrador/i.test(r.cuerpo.error))

  const d2 = doblar({ fila: { ...NOTICIA, kind: 'guide' } })
  const r2 = await mandarUna({ id: 'n1', env: ENV, ...d2 })
  check('una guía tampoco', r2.estado === 400 && d2.enviado.length === 0, JSON.stringify(r2.cuerpo))

  const d3 = doblar({ fila: null })
  const r3 = await mandarUna({ id: 'fantasma', env: ENV, ...d3 })
  check('una noticia borrada, tampoco', r3.estado === 404 && d3.enviado.length === 0)

  const r4 = await mandarUna({ env: ENV, ...doblar() })
  check('y sin id no se hace nada', r4.estado === 400)
}

console.log('\n── 6. Cuando Telegram dice que no ──')
{
  // «chat not found», «bot is not a member of the supergroup chat»: eso
  // dice EXACTAMENTE qué arreglar. Traducirlo a un «no se ha podido»
  // sería tirar la única pista que hay.
  const d = doblar({ telegramOk: false })
  const r = await mandarUna({ id: 'n1', env: ENV, ...d })
  check('el error de Telegram llega tal cual', /chat not found/.test(r.cuerpo.error || ''), JSON.stringify(r.cuerpo))
  check('y NO se da por mandada', d.marcado.length === 0)
}

console.log('\n── 7. Mandada pero sin apuntar ──')
{
  // El único caso que puede duplicar: la programada la volvería a mandar
  // en cinco minutos. No es un error —la noticia ya está en el canal—
  // pero hay que decirlo.
  const d = doblar({ patchFalla: true })
  const r = await mandarUna({ id: 'n1', env: ENV, ...d })
  check('se responde que sí salió', r.estado === 200 && r.cuerpo.ok, JSON.stringify(r.cuerpo))
  check('pero avisando de que puede repetirse', /repetirse/i.test(r.cuerpo.aviso || ''), r.cuerpo.aviso)
}

console.log('\n── 8. El botón está en el panel, y se ve el estado ──')
{
  const fs = await import('node:fs')
  const admin = fs.readFileSync('/home/user/pingu/admin/js/admin.js', 'utf8')
  check('hay botón por noticia', /data-telegram-noticia/.test(admin))
  check('y llama a la función', /\/\.netlify\/functions\/telegram-mandar/.test(admin))
  check('con el token del admin', /authorization: `Bearer \$\{session\.access_token\}`/.test(admin))
  // Sin esta columna, una noticia publicada que no salió por el canal no
  // se distingue de una que sí: el fallo puede estar semanas escondido.
  check('la tabla dice si salió o no', /Sin mandar/.test(admin) && /Mandada/.test(admin))
  check('solo en las publicadas', /n\.published_at \? `<button class="btn-secondary" data-telegram-noticia/.test(admin))
  // Icono de js/icons.js, nunca un emoji suelto (normas de la casa).
  check('con icono, no emoji', /icons\.send\(15\)\} Telegram/.test(admin))
}

console.log('\n── 9. La portada tiene que LLEGAR (tanda 283) ──')
{
  // A la foto no la sube PokeDoc: se le pasa la URL y va Telegram a
  // buscarla desde SUS servidores. Una ruta del sitio, que dentro de la
  // web funciona, ahí no se puede resolver.
  check('una ruta del sitio se completa', portadaAbsoluta('/fotos/p.png') === 'https://pokedoc.es/fotos/p.png')
  check('sin barra, también', portadaAbsoluta('fotos/p.png') === 'https://pokedoc.es/fotos/p.png')
  check('una absoluta se deja en paz', portadaAbsoluta('https://sb.co/a.png') === 'https://sb.co/a.png')
  // data:/blob: no son direcciones que nadie pueda ir a buscar: mandarlas
  // es un envío rechazado. Mejor sin foto.
  check('una imagen incrustada no se manda como foto', portadaAbsoluta('data:image/png;base64,AAA') === '')
  check('ni un esquema raro', portadaAbsoluta('javascript:alert(1)') === '')
  check('sin portada, nada', portadaAbsoluta(null) === '' && portadaAbsoluta('  ') === '')

  const d = doblar({ fila: { ...NOTICIA, cover_image: '/fotos/p.png' } })
  await mandarUna({ id: 'n1', env: ENV, ...d })
  check('y el envío usa la completa', d.enviado[0]?.photo === 'https://pokedoc.es/fotos/p.png', d.enviado[0]?.photo)

  const d2 = doblar({ fila: { ...NOTICIA, cover_image: 'data:image/png;base64,AAA' } })
  await mandarUna({ id: 'n1', env: ENV, ...d2 })
  check('una incrustada no rompe el envío: va como mensaje', d2.enviado[0]?.metodo === 'sendMessage', d2.enviado[0]?.metodo)
}

console.log('\n── 10. Si el enlace no le sirve a Telegram, la subimos nosotros (tanda 284) ──')
{
  // «failed to get HTTP URL content»: Telegram descarga la foto desde SUS
  // servidores, y hay sitios que a él le dicen que no aunque a un
  // navegador le digan que sí. Si nosotros sí podemos traérnosla, se le
  // sube — y la portada sale igual.
  const d = doblar({ enlaceFalla: true })
  const r = await mandarUna({ id: 'n1', env: ENV, ...d })
  check('primero se prueba por enlace', d.enviado[0]?.metodo === 'sendPhoto' && d.enviado[0]?.photo === NOTICIA.cover_image)
  check('luego se pide la portada', d.pedido[0] === NOTICIA.cover_image, JSON.stringify(d.pedido))
  // Sin user-agent, muchos sitios que alojan imágenes contestan 403 a
  // secas: una petición pelada tiene pinta de robot raspando.
  check('diciendo quién la pide', /PokeDocBot/.test(d.cabeceras[0]?.['user-agent'] || ''), JSON.stringify(d.cabeceras[0]))
  check('y que lo que quiere es una imagen', /^image\//.test(d.cabeceras[0]?.accept || ''), d.cabeceras[0]?.accept)
  // El referer es justo lo que miran las webs con protección contra
  // enlazado externo: mandarlo sería pedir el rechazo.
  check('y sin referer', !('referer' in (d.cabeceras[0] || {})))
  check('y se sube como fichero', d.enviado[1]?.subida === true && d.enviado[1]?.metodo === 'sendPhoto', JSON.stringify(d.enviado[1]?.metodo))
  check('con el mismo pie', d.enviado[1]?.caption === mensajeDeNoticia(NOTICIA))
  check('y al mismo tema', d.enviado[1]?.message_thread_id === '51511', d.enviado[1]?.message_thread_id)
  check('la noticia sale CON la portada', r.estado === 200 && r.cuerpo.ok && !r.cuerpo.sinFoto, JSON.stringify(r.cuerpo))
  check('y no se manda dos veces', d.enviado.filter((e) => e.metodo === 'sendMessage').length === 0)
}

console.log('\n── 11. Y si tampoco la podemos traer, se dice QUÉ le pasa ──')
{
  // El mensaje de Telegram no distingue un 404 de un 403 ni de una
  // portada servida con el tipo equivocado. Pidiéndola nosotros, sí.
  for (const [que, portada, espera] of [
    ['que no existe', null, /responde 404/],
    ['que no es una imagen', { tipo: 'application/octet-stream' }, /no es una imagen/],
    ['que pesa demasiado', { bytes: 11 * 1024 * 1024 }, /pesa 11\.0 MB/],
    ['que viene vacía', { bytes: 0 }, /vacía/],
  ]) {
    const d = doblar({ enlaceFalla: true, portada })
    const r = await mandarUna({ id: 'n1', env: ENV, ...d })
    check(`una portada ${que}: se cuenta`, espera.test(r.cuerpo.motivo || ''), r.cuerpo.motivo)
    check(`  …y la noticia sale igual`, r.estado === 200 && r.cuerpo.ok && r.cuerpo.sinFoto === true)
    check('  …con la vista previa grande', d.enviado.at(-1)?.link_preview_options?.prefer_large_media === true)
    // Y ENCIMA del texto: es lo que hace que parezca una noticia y no un
    // enlace suelto al final del mensaje.
    check('  …y encima del texto', d.enviado.at(-1)?.link_preview_options?.show_above_text === true)
  }
  // Y se dice CUÁL es la portada: sin la dirección no hay nada que mirar.
  const d = doblar({ enlaceFalla: true, portada: null })
  const r = await mandarUna({ id: 'n1', env: ENV, ...d })
  check('y se dice cuál es', (r.cuerpo.motivo || '').includes(NOTICIA.cover_image), r.cuerpo.motivo)

  // Si la subida tampoco le gusta, la noticia sale igual y se cuentan las dos.
  const d2 = doblar({ enlaceFalla: true, subidaOk: false })
  const r2 = await mandarUna({ id: 'n1', env: ENV, ...d2 })
  check('si la subida tampoco vale, sale sin foto', r2.estado === 200 && r2.cuerpo.sinFoto === true)
  check('contando los dos intentos', /failed to get HTTP URL content[\s\S]*PHOTO_INVALID_DIMENSIONS/.test(r2.cuerpo.motivo || ''), r2.cuerpo.motivo)

  // Una portada incrustada ni se intenta: se dice y se manda el mensaje.
  const d3 = doblar({ fila: { ...NOTICIA, cover_image: 'data:image/png;base64,AAA' } })
  const r3 = await mandarUna({ id: 'n1', env: ENV, ...d3 })
  check('una incrustada se explica', /Telegram pueda pedir/.test(r3.cuerpo.motivo || ''), r3.cuerpo.motivo)
  check('y no se pide nada a la red', d3.pedido.length === 0)
}

console.log('\n── 12. El panel cuenta lo de la portada ──')
{
  const admin = (await import('node:fs')).readFileSync('/home/user/pingu/admin/js/admin.js', 'utf8')
  check('se avisa de que la portada no entró como foto', /la portada no ha entrado como foto/.test(admin))
  check('con el motivo de Telegram', /\$\{r\.motivo/.test(admin))
}

console.log('\n── 13. Qué ES esa portada (tanda 285) ──')
{
  // «IMAGE_PROCESS_FAILED»: nos la bajamos bien y aun así Telegram no la
  // quiere. Sin saber qué es, ese mensaje no se puede ni empezar a mirar.
  const png = (a, al) => { const b = Buffer.alloc(40); b.write('\x89PNG\r\n\x1a\n', 'binary'); b.writeUInt32BE(a, 16); b.writeUInt32BE(al, 20); return b }
  const webp = () => { const b = Buffer.alloc(40); b.write('RIFF'); b.write('WEBP', 8); b.write('VP8X', 12); b[24] = 0x4f; b[25] = 0x04; b[27] = 0x75; b[28] = 0x02; return b }
  const avif = () => { const b = Buffer.alloc(20); b.write('ftyp', 4); b.write('avif', 8); return b }
  const jpeg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 17, 8]), Buffer.from([0x03, 0x84, 0x06, 0x40]), Buffer.alloc(10)])

  check('un PNG se reconoce con sus medidas', JSON.stringify(describirImagen(png(1200, 630))) === '{"formato":"png","ancho":1200,"alto":630}')
  check('un JPEG también', describirImagen(jpeg()).ancho === 1600 && describirImagen(jpeg()).alto === 900)
  check('un WebP también', describirImagen(webp()).formato === 'webp' && describirImagen(webp()).ancho === 1104)
  check('y un AVIF se reconoce aunque no se midan', describirImagen(avif()).formato === 'avif')
  // El content-type MIENTE: lo pone quien sirve el fichero.
  check('lo que no es una imagen no se inventa', describirImagen(Buffer.from('<html>no soy una imagen</html>')).formato === '')
  check('y se cuenta en cristiano', comoEsLaPortada(describirImagen(png(1200, 630)), 250000) === 'PNG 1200×630 px, 244 KB')
  // Una portada de 300 bytes es una imagen rota; «0 KB» no lo contaría.
  check('y una imagen rota no se queda en «0 KB»', comoEsLaPortada({ formato: 'png' }, 300) === 'PNG, 300 B')

  // Lo que Telegram NO acepta como foto, aunque sea una imagen válida
  // que se ve en cualquier navegador.
  for (const [que, bytes, espera] of [
    ['un WebP', webp(), /WEBP.*no acepta ese formato como foto/s],
    ['un AVIF', avif(), /AVIF.*no acepta ese formato como foto/s],
    ['una imagen gigante', png(9000, 9000), /demasiado grande.*9000×9000/s],
    ['una tira alargada', png(6000, 100), /demasiado alargada/],
  ]) {
    const d = doblar({ enlaceFalla: true, portada: { cuerpo: bytes } })
    const r = await mandarUna({ id: 'n1', env: ENV, ...d })
    check(`${que}: se dice qué le pasa`, espera.test(r.cuerpo.motivo || ''), r.cuerpo.motivo)
    // Y ni se intenta subirla: se sabe de antemano que la va a rechazar.
    check(`  …y no se sube para nada`, !d.enviado.some((e) => e.subida))
    check(`  …pero la noticia sale igual`, r.estado === 200 && r.cuerpo.ok)
  }
  // Y se dice cómo arreglarlo, que es lo único accionable.
  const d = doblar({ enlaceFalla: true, portada: { cuerpo: webp() } })
  const r = await mandarUna({ id: 'n1', env: ENV, ...d })
  check('diciendo qué hacer', /vuelve a subirla en JPG o PNG/.test(r.cuerpo.motivo || ''), r.cuerpo.motivo)

  // Un PNG normal sí se sube.
  const d2 = doblar({ enlaceFalla: true, portada: { cuerpo: png(1200, 630) } })
  await mandarUna({ id: 'n1', env: ENV, ...d2 })
  check('un PNG en condiciones sí se sube', d2.enviado.some((e) => e.subida))

  // Y si aun así Telegram la rechaza, se dice EN QUÉ CONSISTE.
  const d3 = doblar({ enlaceFalla: true, subidaOk: false, portada: { cuerpo: png(1200, 630) } })
  const r3 = await mandarUna({ id: 'n1', env: ENV, ...d3 })
  check('y si la rechaza igual, se describe', /la portada es PNG 1200×630 px/.test(r3.cuerpo.motivo || ''), r3.cuerpo.motivo)
}

console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
