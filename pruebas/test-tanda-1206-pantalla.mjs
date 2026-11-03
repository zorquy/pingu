// Tanda 1206 — la cifra de tu colección es UNA (PINGU: «no puede haber
// variaciones entre el panel del inicio y el panel de la colección. Haz lo que
// tengas que hacer»). La portada y el Panel piden la misma función
// (`valorComoElPanel`), que guarda el resultado con la firma de tus líneas
// durante 10 minutos: quien llega después lee LA MISMA cifra.
import { chromium, contexto, BASE } from './fixtures-app.mjs'
import { firmaDeLineas, VIGENCIA_VALOR_MS } from '/home/user/pingu/js/mi-coleccion/datos.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── La firma de tus líneas (puro) ──')
{
  const a = [{ card_id: 'x', variante: 'reverse', idioma: 'es', cantidad: 2 }, { card_id: 'y', idioma: 'en', cantidad: 1 }]
  check('no depende del orden', firmaDeLineas(a) === firmaDeLineas([...a].reverse()))
  check('cambia si cambia una copia, la versión o el idioma', firmaDeLineas(a) !== firmaDeLineas([{ ...a[0], cantidad: 3 }, a[1]]) && firmaDeLineas(a) !== firmaDeLineas([{ ...a[0], variante: 'normal' }, a[1]]) && firmaDeLineas(a) !== firmaDeLineas([a[0], { ...a[1], idioma: 'es' }]))
  check('vale 10 minutos, lo que tarda en volver la pasada de precios', VIGENCIA_VALOR_MS === 600000)
}

const b = await chromium.launch()
const numero = (t) => Number(String(t || '').replace(/[^\d,]/g, '').replace(',', '.'))
for (const [nombre, primero] of [['portada y luego Panel', 'portada'], ['Panel y luego portada', 'panel']]) {
  console.log(`── ${nombre} ──`)
  const ctx = await contexto(b, false, 'user-1')
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  const leerPortada = async () => {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.hoy-valor b', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(3000)
    return page.textContent('.hoy-valor b').catch(() => '')
  }
  const leerPanel = async () => {
    await page.goto(`${BASE}/mi-coleccion`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('#mcValorCaja .mc-cartera-cifra', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(4000)
    return page.textContent('#mcValorCaja .mc-cartera-cifra').catch(() => '')
  }
  const [x, y] = primero === 'portada' ? [await leerPortada(), await leerPanel()] : [await leerPanel(), await leerPortada()]
  const [portada, panel] = primero === 'portada' ? [x, y] : [y, x]
  check('la portada y el Panel enseñan LA MISMA cifra', numero(portada) > 0 && numero(portada) === numero(panel), `portada ${portada} · Panel ${panel}`)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
