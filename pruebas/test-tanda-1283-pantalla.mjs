// Tanda 1283 — LA GUÍA Y LA NOTICIA COMO UNA REVISTA (PINGU eligió lo
// recomendado): portada a lo ancho (su imagen o el Pokémon de su tema), la
// franja de la firma, el índice con lo leído y lo que queda, las cajas de
// Consejo, Ojo y Dato, y un final con quién la escribe, «Me ha servido» y
// «Sigue leyendo». La noticia, con su fecha en grande y «Lo importante».
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`) }

const HTML = `<p>Intro de la guía con bastante texto para que haya algo que leer antes del primer apartado.</p>
<h2>La lista</h2><p>${'Texto de la lista. '.repeat(40)}</p>
<blockquote>Guarda siempre un Caramelo Raro.</blockquote>
<h2>Cómo se juega</h2><p>${'Texto del juego. '.repeat(40)}</p>
<h3>Los primeros turnos</h3><p>${'Más texto. '.repeat(40)}</p>
<blockquote class="caja-ojo">No dejes dos Pokémon tocados.</blockquote>
<h2>Emparejamientos</h2><p>${'Texto de emparejamientos. '.repeat(60)}</p>
<blockquote class="caja-dato">Ganó 4 de 10 regionales.</blockquote>`
const base = { review_status: 'approved', published_at: '2026-11-10T10:00:00Z', category_id: 'cat-1', level: 'intermediate', guide_rarity: 'silver', reference_blocks: [{ type: 'richtext', html: HTML }] }
const GUIAS = [
  { ...base, id: 'g-1', slug: 'con-foto', kind: 'guide', title: 'Cómo jugar Charizard ex', description: 'La lista y cómo se juega.', author_id: 'user-2', cover_image: '/fotos/foto1.svg' },
  { ...base, id: 'g-2', slug: 'sin-foto', kind: 'guide', title: 'Tu primer mazo', description: 'Paso a paso.', author_id: 'user-2' },
  { ...base, id: 'g-3', slug: 'otra-1', kind: 'guide', title: 'Otra 1', author_id: 'user-3' },
  { ...base, id: 'g-4', slug: 'otra-2', kind: 'guide', title: 'Otra 2', author_id: 'user-3' },
  { ...base, id: 'n-1', slug: 'delta', kind: 'news', title: 'Delta Reign sale el 21', description: 'Sale el 21 de noviembre. Trae las Pokémon delta. Entra en Estándar el 5 de diciembre.', author_id: 'admin-1', published_at: '2026-11-09T10:00:00Z', reference_blocks: [{ type: 'richtext', html: '<p>Llega con 200 cartas.</p>' }] },
  { ...base, id: 'n-2', slug: 'otra-noticia', kind: 'news', title: 'Otra noticia', description: 'Una.', published_at: '2026-11-08T10:00:00Z' },
]
const b = await chromium.launch()
const abrir = async (ruta, { movil = false, sesion = 'user-1' } = {}) => {
  const ctx = await b.newContext(movil ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 900 } })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = d.sesion
    window.__FAKE_CATEGORIAS__ = [{ id: 'cat-1', name: 'Mazos y estrategia', slug: 'estrategia' }]
    window.__FAKE_GUIAS__ = d.GUIAS
    window.__FAKE_PERFILES__ = [{ id: 'user-2', username: 'deckmasters', display_name: 'Deckmasters', is_writer: true }]
  }, { GUIAS, sesion })
  await ctx.route(/cdn\.jsdelivr\.net|raw\.githubusercontent/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><circle cx="150" cy="150" r="120" fill="#e8763a"/></svg>' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(e.message))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2800)
  return { page, ctx, errores }
}

console.log('── Lo puro ──')
{
  const M = await import(`${REPO}/js/articulo-cabecera.js`)
  check('la fecha en hora de España (23:30 UTC del 21 es el 22)', JSON.stringify(M.diaYMes('2026-11-21T23:30:00Z')) === '{"dia":"22","mes":"nov"}')
  check('«Lo importante»: tres frases como mucho, y nada con una sola', M.loImportante('Uno. Dos. Tres. Cuatro.').length === 3 && M.loImportante('Solo una frase.').length === 0)
  check('lo que queda: 8 min leído el 42 % son 5', M.minutosQueQuedan(8, 0.42) === 5 && M.minutosQueQuedan(8, 1) === 0)
  const n = M.numerarApartados([{ id: 'a', text: 'A', nivel: 2 }, { id: 'b', text: 'B', nivel: 3 }, { id: 'c', text: 'C', nivel: 2 }])
  check('el índice numera los títulos y deja los subtítulos sin número', n.map((h) => h.n).join() === '1,,2')
  const sin = M.fondoDeArticulo({ slug: 'x' }, { name: 'Mazos y estrategia', slug: 'estrategia' })
  check('sin imagen, el Pokémon de su tema (Mazos → Alakazam, 65)', sin.dex === 65 && !sin.foto)
  check('una imagen que no es una dirección limpia no se pinta', !M.fondoDeArticulo({ cover_image: 'javascript:alert(1)', slug: 'x' }, null).foto)
  const html = M.portadaDeArticuloHtml({ title: '<b>x</b>', description: 'd', kind: 'guide', slug: 's' }, { tema: null })
  check('el título va escapado', html.includes('&lt;b&gt;x&lt;/b&gt;') && !html.includes('<b>x</b>'))
  const meta = await import(`${REPO}/netlify/edge-functions/meta-social.js`)
  const fila = { title: 'Delta', description: 'Uno. Dos.', slug: 'delta', published_at: '2026-11-09T10:00:00Z', categories: { name: 'A', slug: 'a' } }
  const delServidor = meta.cuerpoDeArticulo({ titulo: fila.title, entradilla: fila.description, bloques: [{ type: 'richtext', html: '<p>hola</p>' }], guia: fila, esNoticia: true })
  check('el servidor pinta LA MISMA portada que el navegador', delServidor.includes(M.portadaDeArticuloHtml({ ...fila, kind: 'news' }, { tema: fila.categories })))
  check('  …con el hueco de la franja y «Lo importante»', delServidor.includes('gh-franja-reservada') && delServidor.includes('gh-importante'))
}

console.log('── La guía con portada (PC) ──')
{
  const { page, ctx, errores } = await abrir('/guia?slug=con-foto')
  check('sin errores', errores.length === 0, errores[0])
  const r = await page.evaluate(() => {
    const gh = document.querySelector('.gh')
    const caja = (s) => document.querySelector(s)?.getBoundingClientRect()
    return {
      foto: !!gh?.querySelector('.gh-foto'), h1: gh?.querySelector('h1')?.textContent,
      chips: [...document.querySelectorAll('.gh-chip')].map((c) => c.textContent),
      ancho: Math.round(caja('.gh')?.width || 0), cuerpo: Math.round(caja('.article-body')?.width || 0), lado: Math.round(caja('.article-sidebar')?.left || 0), cuerpoIzq: Math.round(caja('.article-body')?.left || 0),
      firma: document.querySelector('.gh-franja .guide-author')?.textContent.replace(/\s+/g, ' ').trim(), datos: document.querySelector('.gh-datos')?.textContent.replace(/\s+/g, ' ').trim(),
      botones: !!document.querySelector('.gh-franja #btnSave') && !!document.querySelector('.gh-franja #btnCompartir'),
    }
  })
  check('la portada lleva su imagen y el título', r.foto && r.h1 === 'Cómo jugar Charizard ex', JSON.stringify(r))
  check('  …con el tema, el nivel y la rareza', r.chips.join('|') === 'Mazos y estrategia|Intermedio|Plata', r.chips.join('|'))
  check('  …a lo ancho: más ancha que el texto, y el índice a la izquierda del texto', r.ancho > r.cuerpo + 200 && r.lado < r.cuerpoIzq, JSON.stringify(r))
  check('la franja: quién la firma, los minutos, los apartados y los botones', /Deckmasters/.test(r.firma) && /min/.test(r.datos) && /3 apartados/.test(r.datos) && r.botones, `${r.firma} · ${r.datos}`)
  const indice = await page.evaluate(() => [...document.querySelectorAll('#articleSidebar .gi-paso')].map((a) => `${a.querySelector('em').textContent}:${a.closest('li').className}`))
  check('el índice: 1, 2, el subtítulo sin número, 3', indice.join(' ') === '1: 2: :gi-sub 3:', indice.join(' '))
  const cajas = await page.evaluate(() => [...document.querySelectorAll('.article-body blockquote')].map((q) => getComputedStyle(q, '::after').content))
  check('las cajas dicen Consejo, Ojo y Dato', cajas.join('|') === '"Consejo"|"Ojo"|"Dato"', cajas.join('|'))
  const numeros = await page.evaluate(() => [...document.querySelectorAll('.article-body h2')].map((h) => getComputedStyle(h, '::before').content))
  check('los títulos del texto llevan su número (01, 02, 03)', numeros.every((c) => /counter/.test(c) || /0\d/.test(c)), numeros.join(' '))
  await page.evaluate(() => document.querySelectorAll('.article-body h2')[1].scrollIntoView({ behavior: 'instant' }))
  await page.waitForTimeout(300)
  const leido = await page.evaluate(() => ({ hechos: document.querySelectorAll('#articleSidebar .gi-paso.hecho').length, activo: document.querySelector('#articleSidebar .gi-paso.activo em')?.textContent, barra: parseFloat(document.querySelector('#articleSidebar .gi-barra i').style.width), queda: document.getElementById('giQueda').textContent }))
  check('al bajar: lo leído marcado, el apartado actual y la barra', leido.hechos === 1 && leido.activo === '2' && leido.barra > 10, JSON.stringify(leido))
  check('  …y los minutos que quedan', /Te quedan|Ya casi/.test(leido.queda), leido.queda)
  const fin = await page.evaluate(() => ({ autor: document.querySelector('#guiaAutor')?.textContent.replace(/\s+/g, ' ').trim(), seguir: document.querySelector('#guiaSeguir:not(.hidden)')?.textContent.trim(), servido: !!document.querySelector('.gf-servido #guideHelpful'), portadas: [...document.querySelectorAll('#guiaMasDelTema .guia-portada')].map((a) => a.getAttribute('href')), titulo: document.querySelector('.guia-mas-tema-titulo')?.textContent }))
  check('el final: quién la escribe, con «Seguir»', /Escrita por/.test(fin.autor) && /Deckmasters/.test(fin.autor) && fin.seguir === 'Seguir', JSON.stringify(fin))
  check('  …«Me ha servido» al lado', fin.servido)
  check('  …y «Sigue leyendo» con portadas del tema, sin ella misma', fin.titulo === 'Sigue leyendo en Mazos y estrategia' && fin.portadas.length >= 2 && !fin.portadas.some((h) => /con-foto$/.test(h)), JSON.stringify(fin.portadas))
  await ctx.close()
}

console.log('── Sin portada ──')
{
  const { page, ctx } = await abrir('/guia?slug=sin-foto')
  const r = await page.evaluate(() => ({ sin: !!document.querySelector('.gh.gh-sin-foto'), arte: document.querySelector('.gh-arte')?.getAttribute('src') || '', color: [...document.querySelector('.gh').classList].find((c) => /^arte-\d$/.test(c)) }))
  check('el Pokémon del tema sobre el color de su tarjeta', r.sin && /\/65\.png$/.test(r.arte) && !!r.color, JSON.stringify(r))
  await ctx.close()
}

console.log('── La noticia ──')
{
  const { page, ctx, errores } = await abrir('/guia?slug=delta')
  check('sin errores', errores.length === 0, errores[0])
  const r = await page.evaluate(() => ({ fecha: document.querySelector('.gh-fecha')?.textContent.replace(/\s+/g, ''), tipo: document.querySelector('.gh-chip-tipo')?.textContent, lead: !!document.querySelector('.gh .lead'), importante: [...document.querySelectorAll('.gh-importante li')].length, time: !!document.querySelector('.gh-franja time[datetime]'), firma: document.querySelector('.guide-author')?.textContent.replace(/\s+/g, ' ').trim(), mas: document.querySelector('.guia-mas-tema-titulo')?.textContent }))
  check('la fecha en grande y la chapa «Noticia»', r.fecha === '9nov' && r.tipo === 'Noticia', JSON.stringify(r))
  check('«Lo importante» en tres líneas, y no repetido debajo del título', r.importante === 3 && !r.lead)
  check('la franja lleva la fecha para Google (<time datetime>) y la firma de PokeDoc', r.time && /Noticia de ?PokeDoc/.test(r.firma), r.firma)
  check('al final, «Más noticias»', r.mas === 'Más noticias', r.mas)
  await ctx.close()
}

console.log('── En el móvil ──')
{
  const { page, ctx } = await abrir('/guia?slug=con-foto', { movil: true })
  const r = await page.evaluate(() => ({ ancho: document.documentElement.scrollWidth, pildora: getComputedStyle(document.querySelector('.gi-movil')).display !== 'none', lado: getComputedStyle(document.querySelector('.article-sidebar')).display, migas: getComputedStyle(document.querySelector('.gh .breadcrumb')).display }))
  check('sin scroll de lado', r.ancho <= 390, r.ancho)
  check('el índice es la píldora (el de al lado no sale)', r.pildora && r.lado === 'none', JSON.stringify(r))
  await page.click('.gi-movil summary')
  check('  …que se despliega con los apartados', (await page.locator('.gi-movil .gi-paso').count()) === 4)
  const alto = await page.evaluate(() => document.querySelector('.gi-movil summary')?.getBoundingClientRect().height)
  check('  …y se pulsa (44 px)', alto >= 44, alto)
  await ctx.close()
}

console.log('── El editor: Consejo, Ojo y Dato ──')
{
  const { page, ctx } = await abrir('/editor-guia', { sesion: 'user-2' })
  check('el editor de guías tiene el botón «Caja»', (await page.locator('[data-action="caja"]').count()) >= 1)
  await page.click('#refRteSurface')
  await page.keyboard.type('Ojo con esto')
  await page.click('[data-action="caja"]')
  await page.click('[data-caja="ojo"]')
  const html = await page.locator('#refRteSurface').innerHTML()
  check('  …y pone la cita con su clase', /<blockquote class="caja-ojo">/.test(html), html.slice(0, 160))
  await page.click('[data-action="caja"]')
  await page.click('[data-caja="quitar"]')
  check('  …y «Quitar» la devuelve a párrafo', !/<blockquote/.test(await page.locator('#refRteSurface').innerHTML()))
  const limpio = await page.evaluate(async () => (await import('/js/richtext-format.js')).sanitizeRichText('<blockquote class="caja-dato raro">x</blockquote>'))
  check('el saneado deja la clase de la caja y quita las demás', /class="caja-dato"/.test(limpio) && !/raro/.test(limpio), limpio)
  await ctx.close()
}
{
  const { readFileSync } = await import('node:fs')
  const perfil = readFileSync(`${REPO}/js/perfil.js`, 'utf8')
  check('el foro y el perfil no piden las cajas (solo los editores de guías)', !/richTextToolbarHtml\(\{ cajas/.test(perfil))
}

await b.close()
console.log(fails ? `❌ ${fails} fallan` : '✅ TODO BIEN')
process.exit(fails ? 1 : 0)
