// Tanda 1312 — S5: la casilla de la edad y el «soy una persona» de Turnstile.
//  · Sin la casilla no se crea cuenta (ni con email ni con Google), en /auth y
//    en el alta de tiendas; con ella, la cuenta guarda cuándo se aceptó.
//  · Turnstile DORMIDO sin clave en site_settings: no carga nada y no manda
//    token. Con clave, el token va en entrar, crear cuenta y recuperar.
import { chromium, contexto, BASE } from './fixtures-app.mjs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── lo puro ──')
{
  const T = await import(`${REPO}/js/turnstile.js`)
  check('conToken pone el token solo si lo hay', JSON.stringify(T.conToken({ a: 1 }, 'x')) === '{"a":1,"captchaToken":"x"}' && JSON.stringify(T.conToken({ a: 1 }, undefined)) === '{"a":1}')
  const E = await import(`${REPO}/js/auth-errores.js`)
  check('un fallo del captcha se explica', /persona/.test(E.friendlyAuthError({ message: 'captcha verification process failed' })))
}

const b = await chromium.launch()
// Cloudflare de mentira: da un token al momento y cuenta los reinicios.
const turnstileFalso = `window.turnstile = { n: 0, resets: 0, render(caja, o) { this.n++; caja.dataset.pintado = '1'; setTimeout(() => o.callback('tok-' + this.n), 20); return this.n }, reset() { this.resets++ } }`
const abrir = async (ruta, { clave = null } = {}) => {
  const ctx = await contexto(b, true, 'none', clave ? new Function(`window.__FAKE_FILAS__ = { site_settings: [{ key: 'turnstile_site_key', value: ${JSON.stringify(clave)} }] }`) : undefined)
  const page = await ctx.newPage()
  const err = []
  page.on('pageerror', (e) => err.push(String(e).slice(0, 160)))
  const pedidasCf = []
  await page.route('https://challenges.cloudflare.com/**', (r) => { pedidasCf.push(r.request().url()); r.fulfill({ status: 200, contentType: 'text/javascript', body: turnstileFalso }) })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(700)
  return { ctx, page, err, pedidasCf, auth: () => page.evaluate(() => window.__AUTH__ || []) }
}

console.log('── /auth sin clave (dormido) ──')
{
  const { ctx, page, err, pedidasCf, auth } = await abrir('/auth.html?registro=1')
  check('no se pide nada a Cloudflare y no se ve ninguna caja', pedidasCf.length === 0 && (await page.$$eval('.auth-turnstile:not([hidden])', (x) => x.length)) === 0)
  check('la casilla de la edad está, con su enlace a la privacidad', await page.isVisible('#registerEdad') && (await page.getAttribute('.auth-edad a', 'href')) === '/privacidad')
  await page.fill('#registerName', 'Misty'); await page.fill('#registerEmail', 'misty@pruebas.test'); await page.fill('#registerPassword', 'Una-Clave-1234')
  await page.click('#btnRegister'); await page.waitForTimeout(300)
  const sinCasilla = await auth()
  check('sin la casilla, no se crea cuenta y se dice por qué', !sinCasilla.some((a) => a.que === 'signUp') && /14 años/.test(await page.textContent('#stepRegister .auth-error')))
  await page.click('#btnGoogleRegister'); await page.waitForTimeout(300)
  check('  …tampoco con Google', !(await auth()).some((a) => a.que === 'signInWithOAuth'))
  await page.check('#registerEdad')
  await page.click('#btnRegister'); await page.waitForTimeout(500)
  const alta = (await auth()).find((a) => a.que === 'signUp')
  check('con la casilla, la cuenta se crea con la fecha de la edad y sin token', alta && /^\d{4}-\d\d-\d\dT/.test(alta.options?.data?.edad_14_aceptada || '') && !('captchaToken' in (alta.options || {})), JSON.stringify(alta?.options))
  check('sin errores', !err.length, err.join(' | '))
  await ctx.close()
}

console.log('── /auth con clave ──')
{
  const { ctx, page, err, pedidasCf, auth } = await abrir('/auth.html', { clave: '0x4AAAAAAAprueba' })
  check('carga Cloudflare una vez y pinta las tres cajas', pedidasCf.length === 1 && (await page.evaluate(() => window.turnstile?.n)) === 3, pedidasCf.length)
  await page.fill('#loginEmail', 'ash@pruebas.test'); await page.fill('#loginPassword', 'unaclave')
  await page.click('#btnLogin'); await page.waitForTimeout(400)
  const entrar = (await auth()).find((a) => a.que === 'signInWithPassword')
  check('entrar lleva el token', /^tok-/.test(entrar?.options?.captchaToken || ''), JSON.stringify(entrar))
  check('  …y la caja se reinicia (cada token vale una vez)', (await page.evaluate(() => window.turnstile.resets)) >= 1)
  await page.click('#btnGoToForgot')
  await page.fill('#forgotEmail', 'ash@pruebas.test'); await page.click('#btnSendReset'); await page.waitForTimeout(400)
  const olvido = (await auth()).find((a) => a.que === 'resetPasswordForEmail')
  check('recuperar la contraseña lleva el token', /^tok-/.test(olvido?.captchaToken || ''), JSON.stringify(olvido))
  await page.click('#btnGoToLogin2'); await page.click('#btnGoToRegister')
  await page.check('#registerEdad')
  await page.fill('#registerName', 'Misty'); await page.fill('#registerEmail', 'misty@pruebas.test'); await page.fill('#registerPassword', 'Una-Clave-1234')
  await page.click('#btnRegister'); await page.waitForTimeout(400)
  const alta = (await auth()).find((a) => a.que === 'signUp')
  check('crear cuenta lleva el token', /^tok-/.test(alta?.options?.captchaToken || ''), JSON.stringify(alta?.options))
  check('sin errores', !err.length, err.join(' | '))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
