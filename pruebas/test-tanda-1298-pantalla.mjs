// Tanda 1298 — el enlace de invitación a la vista (PINGU: «recuperar el enlace
// referido», lo recomendado de la propuesta): la tarjeta «Invita a tus amigos»
// en TU perfil (enlace, Copiar, Compartir, a quién has traído y el camino a los
// logros de Embajador), la fila «Invita a un amigo» del menú del avatar (abre
// la hoja con la imagen) y la llegada por /r/<usuario> (quién te invita encima
// del registro). Y lo puro: invitar-puro.js.
import { chromium, contexto, BASE } from './fixtures-app.mjs'
import { enlaceDeInvitacion, progresoEmbajador, textoDeFalta, textoDeTraidos, usuarioValido } from '/home/user/pingu/js/invitar-puro.js'

let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── Lo puro ──')
check('el enlace', enlaceDeInvitacion('Pingu', 'https://pokedoc.es/') === 'https://pokedoc.es/r/Pingu')
check('un usuario raro no da enlace', enlaceDeInvitacion('a b') === null && !usuarioValido('ñ') && usuarioValido('ash_k-9'))
{
  const p0 = progresoEmbajador(0), p2 = progresoEmbajador(2), p5 = progresoEmbajador(7)
  check('0: falta uno para Embajador', p0.siguiente.id === 'embajador' && p0.faltan === 1 && p0.pct === 0 && textoDeFalta(p0) === 'Una más para «Embajador» · +50 XP', textoDeFalta(p0))
  check('2: 3 más para el de oro, al 40 %', p2.siguiente.id === 'embajador-oro' && p2.faltan === 3 && p2.pct === 40 && p2.ganados.length === 1, JSON.stringify(p2))
  check('7: los dos, barra llena', p5.siguiente === null && p5.pct === 100 && /los dos logros/.test(textoDeFalta(p5)))
  check('textos de traídos', textoDeTraidos(1) === 'Has traído a 1 persona' && /nadie/.test(textoDeTraidos(0)))
}

const TRAIDOS = `window.__FAKE_PERFILES__ = [{ id: 'user-2', referred_by: 'user-1' }, { id: 'mod-1', referred_by: 'user-1' }]`
const b = await chromium.launch()
async function abrir(ruta, movil, quien = 'user-1', extra = TRAIDOS) {
  const ctx = await contexto(b, movil, quien)
  if (extra) await ctx.addInitScript(extra)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  if (!movil) await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3200)
  return { ctx, page, errores }
}
const texto = (page, sel) => page.locator(sel).first().innerText().then((t) => t.replace(/\s+/g, ' ').trim()).catch(() => '')

for (const movil of [false, true]) {
  console.log(`── Tu perfil, ${movil ? 'móvil' : 'PC'} ──`)
  const { ctx, page, errores } = await abrir('/perfil.html', movil)
  const t = await texto(page, '#perfilInvitar')
  check('la tarjeta sale, con tu enlace', (await page.isVisible('#perfilInvitar')) && /Invita a tus amigos/.test(t) && /\/r\/Ash/i.test(t), t)
  check('  …«Has traído a 2» con sus caras', /Has traído a 2 personas/.test(t) && (await page.locator('#perfilInvitar .inv-caras .mini-avatar').count()) === 2, t)
  check('  …y «3 más para Embajador de oro»', /3 más para «Embajador de oro» · \+150 XP/.test(t))
  const sitio = await page.evaluate(() => {
    const r = (s) => document.querySelector(s)?.getBoundingClientRect()
    return { inv: r('#perfilInvitar'), tr: r('#perfilTrueque'), tabs: r('#profileTabs'), lado: getComputedStyle(document.querySelector('.perfil-lado')).display }
  })
  if (movil) check('  …en el móvil, antes de las pestañas y sin el texto largo', sitio.inv.bottom <= sitio.tabs.top + 1 && !(await page.isVisible('#perfilInvitar .inv-lema')), JSON.stringify(sitio))
  else check('  …en el PC, en la columna de la derecha', sitio.inv.left > sitio.tabs.right - 1, JSON.stringify(sitio))
  await page.screenshot({ path: `/tmp/1298-perfil-${movil ? 'movil' : 'pc'}.png`, fullPage: !movil })
  await page.click('[data-inv-compartir]')
  await page.waitForSelector('.ch-caja', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(1500)
  const hoja = await page.evaluate(() => ({ t: document.querySelector('.ch-titulo')?.textContent, lienzo: !!document.querySelector('.ch-caja canvas, .ch-caja img') }))
  check('«Compartir invitación» abre la hoja con la imagen', hoja.t === 'Invita a tus amigos' && hoja.lienzo, JSON.stringify(hoja))
  if (!movil) await page.screenshot({ path: '/tmp/1298-hoja.png' })
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── El perfil de otra persona: sin tarjeta ──')
{
  const { ctx, page } = await abrir('/usuario/Misty', false)
  check('no está', !(await page.$('#perfilInvitar')) || !(await page.isVisible('#perfilInvitar')))
  await ctx.close()
}

console.log('── El menú del avatar ──')
{
  const { ctx, page, errores } = await abrir('/', false)
  await page.evaluate(() => document.getElementById('navUserBtn').click())
  await page.waitForSelector('[data-tu="invitar"]', { timeout: 5000 }).catch(() => {})
  check('«Invita a un amigo» está', !!(await page.$('[data-tu="invitar"]')))
  await page.evaluate(() => document.querySelector('[data-tu="invitar"]')?.click())
  await page.waitForSelector('.ch-caja', { timeout: 8000 }).catch(() => {})
  check('  …y abre la hoja', (await texto(page, '.ch-titulo')) === 'Invita a tus amigos')
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── La llegada por /r/<usuario> ──')
for (const movil of [false, true]) {
  const { ctx, page, errores } = await abrir('/auth.html?r=Misty', movil, 'none', '')
  const t = await texto(page, '#authPadrino')
  check(`${movil ? 'móvil' : 'PC'}: el registro abierto, con «Misty te invita a PokeDoc» y el logro`, (await page.isVisible('#stepRegister')) && /Misty te invita a PokeDoc/.test(t) && /Invitado de honor/.test(t), t)
  check('  …y se apunta el padrino', (await page.evaluate(() => localStorage.getItem('pokedoc-referido'))) === 'Misty')
  await page.screenshot({ path: `/tmp/1298-llegada-${movil ? 'movil' : 'pc'}.png` })
  check('  sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, page } = await abrir('/auth.html?r=NoExiste', false, 'none', '')
  check('un usuario que no existe: registro de siempre, sin tarjeta', (await page.isVisible('#stepRegister')) && !(await page.isVisible('#authPadrino')))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
