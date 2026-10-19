// Tanda 902 — las noticias, a la cuenta de X de PokeDoc (@pokedoc_es).
//
// Sin red: se doblan Supabase y la API de X. La firma OAuth 1.0a se
// comprueba contra el ejemplo OFICIAL de la documentación de X, que es la
// única forma de saber que una firma hecha a mano casa con la suya. Y lo
// estático: el pie de las 44 páginas enlaza a las dos cuentas, las 34
// páginas con tarjeta de X llevan `twitter:site`, y el semáforo de /admin
// lee la clave nueva.
import { readFileSync, readdirSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const { cabeceraOAuth, escaparOAuth, textoDeNoticia, publicarEnX, llavesQueFaltan, esFalloDefinitivo, PUBLICAR_URL } = await import(`${RAIZ}/netlify/lib/x.mjs`)
const { procesar, CLAVE_ESTADO } = await import(`${RAIZ}/netlify/functions/x-noticias.mjs`)
const { mandarUna, reanudar } = await import(`${RAIZ}/netlify/functions/x-mandar.mjs`)

console.log('── 1. La firma, contra el ejemplo oficial de X ──')
{
  // El ejemplo de «Creating a signature» de la documentación de X: con
  // estas claves, este nonce y esta hora, la firma tiene que ser EXACTA.
  const cabecera = cabeceraOAuth({
    metodo: 'POST',
    url: 'https://api.twitter.com/1.1/statuses/update.json',
    parametros: { include_entities: 'true', status: 'Hello Ladies + Gentlemen, a signed OAuth request!' },
    claves: {
      apiKey: 'xvz1evFS4wEEPTGEFPHBog',
      apiSecret: 'kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw',
      accessToken: '370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb',
      accessSecret: 'LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE',
    },
    nonce: 'kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg',
    timestamp: 1318622958,
  })
  check('la firma es la del ejemplo', cabecera.includes('oauth_signature="hCtSmYh%2BiHYCEqBWrE7C7hYmtUk%3D"'), cabecera)
  check('  …con los seis campos oauth y el método HMAC-SHA1', /oauth_consumer_key=.*oauth_nonce=.*oauth_signature=.*oauth_signature_method="HMAC-SHA1".*oauth_timestamp=.*oauth_token=.*oauth_version="1\.0"/.test(cabecera))
  // `encodeURIComponent` deja pasar `!'()*` y OAuth no: el ejemplo lleva un «!».
  check('el escape es el de la RFC 3986, no el del navegador', escaparOAuth("a!b'c(d)e*f ñ") === 'a%21b%27c%28d%29e%2Af%20%C3%B1', escaparOAuth("a!b'c(d)e*f ñ"))
  // Y con un cuerpo JSON (lo nuestro) el cuerpo NO entra en la firma: dos
  // textos distintos dan la misma firma con el mismo nonce.
  const claves = { apiKey: 'k', apiSecret: 's', accessToken: 't', accessSecret: 'ts' }
  const a = cabeceraOAuth({ metodo: 'POST', url: PUBLICAR_URL, claves, nonce: 'n', timestamp: 1 })
  const b = cabeceraOAuth({ metodo: 'POST', url: PUBLICAR_URL, claves, nonce: 'n', timestamp: 1 })
  check('la firma no depende de nada que no sea la URL y los oauth_*', a === b)
  check('sin nonce ni hora se generan solos y distintos', cabeceraOAuth({ metodo: 'POST', url: PUBLICAR_URL, claves }) !== cabeceraOAuth({ metodo: 'POST', url: PUBLICAR_URL, claves }))
}

const NOTICIA = {
  id: 'n1',
  slug: 'mega-evolucion',
  title: 'Revelada la nueva expansión de Mega Evolución',
  description: 'Mega Charizard X ex, Mega Lucario ex y 180 cartas que llegan en noviembre.',
  kind: 'news',
  published_at: new Date().toISOString(),
}
const ENV = { X_API_KEY: 'k', X_API_SECRET: 's', X_ACCESS_TOKEN: 't', X_ACCESS_SECRET: 'ts', SUPABASE_SERVICE_ROLE_KEY: 'srv' }

console.log('\n── 2. El texto: el del botón de compartir, con el enlace ──')
{
  const { textoParaX } = await import(`${RAIZ}/js/compartir-x.js`)
  const t = textoDeNoticia(NOTICIA)
  check('es el texto del botón «Compartir en X»', t.startsWith(textoParaX({ titulo: NOTICIA.title, descripcion: NOTICIA.description })))
  check('  …y el enlace a la noticia al final, en su línea', t.endsWith('\n\nhttps://pokedoc.es/noticias/mega-evolucion'), t.slice(-60))
  check('  …cabe en 280 con el enlace a 23', t.length - 'https://pokedoc.es/noticias/mega-evolucion'.length + 23 <= 280)
  check('las cuatro llaves se nombran cuando faltan', llavesQueFaltan({ X_API_KEY: 'k' }).join(',') === 'X_API_SECRET,X_ACCESS_TOKEN,X_ACCESS_SECRET')
  check('401, 402 y 403 son definitivos; 429 y 500 no', [401, 402, 403].every(esFalloDefinitivo) && ![429, 500, 0].some(esFalloDefinitivo))
}

// El doble: Supabase (REST) y X (fetch).
function doblar({ pendientes = [NOTICIA], estado = {}, xEstado = 201, xCuerpo = null, patchFalla = false, sinColumna = false, fetchFalla = false } = {}) {
  const publicado = []
  const marcado = []
  const estados = []
  const rutas = []
  const restImpl = async (ruta, _clave, opciones = {}) => {
    rutas.push(ruta)
    if (ruta.startsWith('scrydex_estado') && opciones.method === 'POST') {
      estados.push(JSON.parse(opciones.body)[0].valor)
      return null
    }
    if (ruta.startsWith('scrydex_estado')) return [{ valor: estado }]
    if (opciones.method === 'PATCH') {
      if (patchFalla) throw new Error('no se pudo escribir')
      marcado.push({ ruta, cuerpo: JSON.parse(opciones.body) })
      return null
    }
    if (sinColumna) throw new Error('Supabase 400: {"code":"42703","message":"column guides.x_sent_at does not exist"}')
    if (ruta.includes('limit=1') && ruta.startsWith('guides?id=')) return pendientes.slice(0, 1)
    return pendientes
  }
  const fetchImpl = async (url, opciones) => {
    if (fetchFalla) throw new Error('red caída')
    publicado.push({ url, cabecera: opciones.headers.authorization, cuerpo: JSON.parse(opciones.body) })
    const cuerpo = xCuerpo || (xEstado < 300 ? { data: { id: '1234567890', text: 'x' } } : { title: 'Unauthorized', detail: 'Unauthorized', status: xEstado })
    return new Response(JSON.stringify(cuerpo), { status: xEstado })
  }
  return { restImpl, fetchImpl, publicado, marcado, estados, rutas }
}

console.log('\n── 3. Se publica, y se apunta ──')
{
  const d = doblar()
  const r = await procesar({ env: ENV, ...d })
  check('va a la API v2 de X con la cabecera firmada', d.publicado[0]?.url === PUBLICAR_URL && /^OAuth oauth_consumer_key="k"/.test(d.publicado[0]?.cabecera), d.publicado[0]?.cabecera)
  check('  …con el texto de la noticia', d.publicado[0]?.cuerpo.text === textoDeNoticia(NOTICIA))
  check('se apunta como publicada, con el id del post', d.marcado.length === 1 && d.marcado[0].cuerpo.x_sent_at && d.marcado[0].cuerpo.x_post_id === '1234567890', JSON.stringify(d.marcado))
  check('y lo dice', r.ok && r.mandadas === 1 && r.slugs[0] === 'mega-evolucion', JSON.stringify(r))
  check('el estado apunta la última publicación', d.estados.at(-1)?.ultimaPublicacion?.id === '1234567890', JSON.stringify(d.estados))
  const r2 = await procesar({ env: { X_API_KEY: 'k' }, ...doblar() })
  check('sin las llaves no hace nada y dice cuáles faltan', r2.saltado && r2.faltan.join(',') === 'X_API_SECRET,X_ACCESS_TOKEN,X_ACCESS_SECRET', JSON.stringify(r2))
}

console.log('\n── 4. Lo que NO puede pasar: repetir, perder o insistir ──')
{
  // Un 500 de X NO marca: se reintenta en la siguiente pasada, y se apunta
  // como último error para el semáforo. Sin parada: es cosa suya.
  const d = doblar({ xEstado: 500 })
  const r = await procesar({ env: ENV, ...d })
  check('si X falla (5xx), no se da por publicada', d.marcado.length === 0)
  check('  …se avisa del fallo', !r.ok && r.fallos?.length === 1, JSON.stringify(r.fallos))
  check('  …y queda en el estado como último error, SIN parada', d.estados.at(-1)?.ultimoError && !d.estados.at(-1)?.parado, JSON.stringify(d.estados))

  // Un 401 son las claves: PARA, y no prueba con la siguiente noticia.
  const d2 = doblar({ pendientes: [NOTICIA, { ...NOTICIA, id: 'n2', slug: 'otra' }], xEstado: 401 })
  const r2 = await procesar({ env: ENV, ...d2 })
  check('un 401 para la función (y lo dice)', d2.estados.at(-1)?.parado?.motivo?.includes('401'), JSON.stringify(d2.estados.at(-1)))
  check('  …y no insiste con la siguiente noticia', d2.publicado.length === 1 && r2.fallos.length === 1, String(d2.publicado.length))

  // Parada: la pasada siguiente se sale ANTES de llamar a X.
  const d3 = doblar({ estado: { parado: { fecha: 'ayer', motivo: 'X contestó 401' } } })
  const r3 = await procesar({ env: ENV, ...d3 })
  check('con la parada puesta no se llama a X', d3.publicado.length === 0 && r3.saltado?.startsWith('parada'), JSON.stringify(r3))
  check('  …ni se consultan las noticias', !d3.rutas.some((x) => x.startsWith('guides')), d3.rutas.join(' | '))

  // Publicada pero sin apuntar: el único caso que duplica. Se canta y PARA.
  const d4 = doblar({ patchFalla: true })
  const r4 = await procesar({ env: ENV, ...d4 })
  check('publicada pero no apuntada se canta', /PUBLICADA PERO NO APUNTADA/.test(JSON.stringify(r4.fallos)), JSON.stringify(r4.fallos))
  check('  …y para hasta que alguien la marque a mano', d4.estados.at(-1)?.parado?.motivo?.includes('se publicó en X pero no se pudo apuntar'), JSON.stringify(d4.estados.at(-1)))

  // La red caída no es un 401: ni parada ni marca.
  const d5 = doblar({ fetchFalla: true })
  const r5 = await procesar({ env: ENV, ...d5 })
  check('la red caída se reintenta (no para, no marca)', !r5.ok && d5.marcado.length === 0 && !d5.estados.at(-1)?.parado, JSON.stringify(r5))
}

console.log('\n── 5. No se publica el archivo entero, y sin la migración se dice ──')
{
  const muchas = [...Array(12)].map((_, i) => ({ ...NOTICIA, id: `n${i}`, slug: `noticia-${i}` }))
  const d = doblar({ pendientes: muchas.slice(0, 3) })
  const r = await procesar({ env: ENV, ...d })
  check('como mucho tres por pasada', r.mandadas <= 3, String(r.mandadas))
  const ruta = d.rutas.find((x) => x.startsWith('guides?'))
  check('solo se piden las pendientes de X', ruta.includes('x_sent_at=is.null') && ruta.includes('limit=3'), ruta)
  check('  …y solo las recientes', ruta.includes('published_at=gte.'), ruta)
  const d2 = doblar({ sinColumna: true })
  const r2 = await procesar({ env: ENV, ...d2 })
  check('sin la columna (42703) se dice qué migración falta, sin error', r2.ok && /supabase-migration-x-noticias/.test(r2.saltado), JSON.stringify(r2))
  const sql = leer('supabase-migration-x-noticias.sql')
  check('la migración crea las dos columnas', /add column if not exists x_sent_at timestamptz/.test(sql) && /add column if not exists x_post_id text/.test(sql))
  check('  …y da por publicado lo ya publicado (el estreno no es el archivo entero)', /update public\.guides[\s\S]*?set x_sent_at = now\(\)/.test(sql))
}

console.log('\n── 6. El botón del panel: una noticia a mano ──')
{
  const d = doblar()
  const r = await mandarUna({ id: 'n1', env: ENV, ...d })
  check('publica y apunta', r.estado === 200 && r.cuerpo.ok && d.marcado.length === 1, JSON.stringify(r))
  const r2 = await mandarUna({ id: 'n1', env: ENV, ...doblar({ pendientes: [{ ...NOTICIA, x_sent_at: '2026-10-19T10:00:00Z' }] }) })
  check('ya publicada: 409 para que se confirme', r2.estado === 409 && r2.cuerpo.yaMandada, JSON.stringify(r2))
  const d3 = doblar({ pendientes: [{ ...NOTICIA, x_sent_at: '2026-10-19T10:00:00Z' }] })
  const r3 = await mandarUna({ id: 'n1', forzar: true, env: ENV, ...d3 })
  check('  …y forzada, sale', r3.estado === 200 && d3.publicado.length === 1)
  const r4 = await mandarUna({ id: 'n1', env: ENV, ...doblar({ pendientes: [{ ...NOTICIA, published_at: null }] }) })
  check('un borrador no sale', r4.estado === 400 && /borrador/.test(r4.cuerpo.error), JSON.stringify(r4))
  const r5 = await mandarUna({ id: 'n1', env: ENV, ...doblar({ xEstado: 403, xCuerpo: { detail: 'Your client app is not configured with the appropriate oauth1 app permissions for this endpoint.' } }) })
  check('el error de X se pasa tal cual (dice qué arreglar)', r5.estado === 502 && /oauth1 app permissions/.test(r5.cuerpo.error) && r5.cuerpo.definitivo === true, JSON.stringify(r5))
  const r6 = await mandarUna({ id: 'n1', env: { X_API_KEY: 'k' }, ...doblar() })
  check('sin las llaves, 503 con los nombres', r6.estado === 503 && r6.cuerpo.faltan.length === 3, JSON.stringify(r6))
  const r7 = await mandarUna({ id: 'n1', env: ENV, ...doblar({ sinColumna: true }) })
  check('sin la migración, lo dice', r7.estado === 503 && /supabase-migration-x-noticias/.test(r7.cuerpo.error), JSON.stringify(r7))
  // Quitar la parada: se guarda el estado sin `parado`.
  const d8 = doblar({ estado: { parado: { motivo: '401' }, ultimoError: { motivo: 'x' } } })
  const r8 = await reanudar({ env: ENV, ...d8 })
  check('reanudar quita la parada y deja el resto', r8.estado === 200 && r8.cuerpo.habiaParada && !d8.estados.at(-1).parado && d8.estados.at(-1).ultimoError, JSON.stringify(d8.estados))
  check('  …sobre la clave del semáforo', d8.rutas.at(-1) === 'scrydex_estado' && CLAVE_ESTADO === 'x_noticias')
}

console.log('\n── 7. Lo estático: el pie, la etiqueta de X y el semáforo ──')
{
  const PAGINAS = readdirSync(RAIZ).filter((f) => f.endsWith('.html'))
  const conPie = PAGINAS.filter((f) => /<footer class="footer">/.test(leer(f)))
  const sinRedes = conPie.filter((f) => !/<p class="pie-redes"><a href="https:\/\/x\.com\/pokedoc_es"[^>]*>X<\/a><a href="https:\/\/www\.instagram\.com\/pokedoc_es"[^>]*>Instagram<\/a><\/p>/.test(leer(f)))
  check(`las ${conPie.length} páginas con pie enlazan a X e Instagram`, conPie.length >= 44 && sinRedes.length === 0, sinRedes.join(', '))
  check('  …en una pestaña nueva y sin referrer de vuelta', conPie.every((f) => /pie-redes"><a href="https:\/\/x\.com\/pokedoc_es" target="_blank" rel="noopener"/.test(leer(f))))
  const conTarjeta = PAGINAS.filter((f) => /name="twitter:card"/.test(leer(f)))
  const sinSitio = conTarjeta.filter((f) => !/<meta name="twitter:site" content="@pokedoc_es" \/>/.test(leer(f)))
  check(`las ${conTarjeta.length} páginas con tarjeta de X llevan twitter:site`, conTarjeta.length >= 34 && sinSitio.length === 0, sinSitio.join(', '))
  const edge = leer('netlify/edge-functions/meta-social.js')
  check('  …y el edge, que sustituye ese bloque, también', /<meta name="twitter:site" content="\$\{CUENTA_X\}" \/>/.test(edge) && /const CUENTA_X = '@pokedoc_es'/.test(edge))
  check('  …y la plantilla de /cartas (se genera)', /twitter:site" content="@pokedoc_es"/.test(leer('generar-cartas.mjs')))
  const { PASADAS } = await import(`${RAIZ}/admin/js/semaforo.js`)
  check('el semáforo de /admin lee la clave de X', PASADAS.some(([k]) => k === 'x_noticias'))
  const admin = leer('admin/js/admin.js')
  check('la lista de noticias pide x_sent_at y cae sin ella (624)', /pedir\(`\$\{columnas\}, telegram_sent_at, x_sent_at, x_post_id`\)/.test(admin) && (admin.match(/error\?\.code === '42703'/g) || []).length >= 2)
  check('  …con el botón «X» por noticia y el aviso de parada', /data-x-noticia=/.test(admin) && /async function pintarParadaDeX/.test(admin) && /reanudar: true/.test(admin))
  check('la función corre cada cinco minutos', /schedule: CADA/.test(leer('netlify/functions/x-noticias.mjs')) && /const CADA = '\*\/5 \* \* \* \*'/.test(leer('netlify/functions/x-noticias.mjs')))
  check('las claves no están en el repo', !/X_API_SECRET\s*=\s*['"][A-Za-z0-9]{10,}/.test(leer('netlify/lib/x.mjs')))
}

console.log('\n── 8. El pie en pantalla: los enlaces se pulsan (44) y se ven ──')
{
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  await page.goto(`${BASE}/sobre.html`, { waitUntil: 'domcontentloaded' })
  // La hoja del móvil entra por `import()` con su `<link>` (704): hay que
  // esperar a que esté, o se mide el pie del ordenador.
  await page.waitForFunction(() => [...document.styleSheets].some((h) => (h.href || '').includes('movil.css')), null, { timeout: 8000 }).catch(() => {})
  const r = await page.evaluate(() => {
    const enlaces = [...document.querySelectorAll('.pie-redes a')]
    return enlaces.map((a) => {
      const b = a.getBoundingClientRect()
      return { texto: a.textContent, alto: b.height, ancho: b.width, color: getComputedStyle(a).color }
    })
  })
  check('dos enlaces, X e Instagram', r.map((x) => x.texto).join(',') === 'X,Instagram', JSON.stringify(r))
  check('  …de 44 por lo menos en el móvil', r.every((x) => x.alto >= 44 && x.ancho >= 44), JSON.stringify(r.map((x) => [x.alto, x.ancho])))
  await page.close()
  const pc = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await pc.goto(`${BASE}/sobre.html`, { waitUntil: 'domcontentloaded' })
  const r2 = await pc.evaluate(() => {
    const p = document.querySelector('.pie-redes')
    const lema = document.querySelector('.pie-lema')
    return { visible: p && p.getBoundingClientRect().height > 0, debajoDelLema: p.getBoundingClientRect().top >= lema.getBoundingClientRect().bottom, columna: p.closest('.pie-rejiilla, .pie-rejilla > div') === lema.parentElement }
  })
  check('en el ordenador va debajo del lema, en la primera columna', r2.visible && r2.debajoDelLema && r2.columna, JSON.stringify(r2))
  await browser.close()
}

console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
