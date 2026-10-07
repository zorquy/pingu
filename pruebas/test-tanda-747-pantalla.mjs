// Tanda 747 — cuatro cosas de Mi colección en el móvil, de PINGU con sus
// capturas delante:
//
//   · «el panel en móvil se desborda con el gráfico, puedes echar para la
//     derecha o para la izquierda»: las cifras de la rejilla («15.042,36 €»)
//     no cabían en su canal y sacaban la página de ancho. Se mira la regla
//     de la cifra (sin céntimos desde mil, en corto desde cien mil, el punto
//     de los miles siempre) y que con una colección de cinco y de siete
//     cifras la página no se va de ancho ni el rótulo se sale;
//   · «la pantalla de agregar una carta rápido… hay muchísimo espacio»: la
//     caja de campos medía 360 px de alto por una regla de la ficha de
//     editar. Se mira que entre campo y campo no haya más que el hueco de la
//     escala, que copias y precio van en una fila y que la hoja cabe entera;
//   · «cuando cambias la pestaña… no te reinicia la posición»: otra pestaña
//     empieza arriba;
//   · «el escáner de cartas lo quitaría de buscar porque ya tienes el escáner
//     en el menú»: Buscar sin botón, y el de la burbuja sigue abriendo la
//     cámara.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const browser = await chromium.launch()

async function abrir(ruta, { valores = null, japonesa = false, camara = false } = {}) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES', ...(camara ? { permissions: ['camera'] } : {}) })
  await ctx.addInitScript(([vals, jp]) => {
    window.__FAKE_SESSION__ = 'admin-1'
    const m = jp ? 'JP' : 'WEST'
    const set = jp ? 'S8a' : 'xy5'
    window.__FAKE_SETS__ = [{ id: set, name: jp ? '25th Celebration' : 'Duelos Primigenios', serie_id: jp ? 'S' : 'xy', market: m, card_count_official: 4, card_count_total: 4 }]
    window.__FAKE_CARTAS__ = [1, 2, 3, 4].map((n) => ({ id: `${set}-${n}`, market: m, set_id: set, local_id: String(n), name: `Carta ${n}`, image_path: `x/${n}`, rarity: 'Rare', category: 'Pokemon', dex_ids: [n], variants: { normal: true }, tcg_sets: { id: set, name: 'Set', serie_id: 'xy' } }))
    window.__FAKE_COLECCION__ = jp ? [] : [1, 2, 3].map((n) => ({ id: `l${n}`, user_id: 'admin-1', card_id: `${set}-${n}`, market: m, cantidad: n, idioma: 'es', estado: 'NM', variante: 'normal', valor_manual: (vals?.[2] || 100) / 6, created_at: '2026-08-01T10:00:00Z' }))
    if (vals) {
      const hoy = Date.now()
      window.__FAKE_VALOR__ = vals.map((v, i) => ({ dia: new Date(hoy - (vals.length - 1 - i) * 86400000).toISOString().slice(0, 10), valor: v }))
    }
  }, [valores, japonesa])
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="837"><rect width="600" height="837" fill="#3a7bd5"/></svg>' }))
  await ctx.route(/r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  return { page, ctx, errores }
}

console.log('── 1. La cifra de la rejilla ──')
{
  const { page, ctx } = await abrir('/mi-coleccion.html')
  const r = await page.evaluate(async () => {
    const { rotuloDeEje } = await import('/js/mi-coleccion/grafica-valor.js')
    if (typeof rotuloDeEje !== 'function') return ['', '', '', '', '']
    return [rotuloDeEje(186.33), rotuloDeEje(8390.36, 15042.36), rotuloDeEje(15042.36), rotuloDeEje(600869, 1200000), rotuloDeEje(1200000)].map((t) => t.replace(/ | /g, ' '))
  })
  check('con céntimos por debajo de mil', r[0] === '186,33 €', r[0])
  check('sin céntimos desde mil, y el punto de los miles también a cuatro cifras', r[1] === '8.390 €' && r[2] === '15.042 €', r.join(' | '))
  check('en corto desde cien mil', r[3] === '600,9 mil €' && /^1,2 M ?€$/.test(r[4]), r.join(' | '))
  await ctx.close()
}

console.log('── 2. El Panel no se va de ancho ──')
for (const [nombre, valores] of [['cinco cifras', [1738.36, 9000, 15042.36]], ['siete cifras', [1738.36, 300000, 1200000]]]) {
  const { page, ctx, errores } = await abrir('/mi-coleccion.html', { valores })
  const m = await page.evaluate(() => {
    const W = document.documentElement.clientWidth
    // Desde la 748 la cartera va sin rejilla (la C1 de su maqueta): lo que
    // se mide son la cifra grande y el cambio, que son lo que puede crecer.
    const rot = [...document.querySelectorAll('#mcValorCaja .mc-cartera-cifra, #mcValorCaja .mc-valor-cambio')]
    return { W, sw: document.documentElement.scrollWidth, rotulos: rot.map((s) => ({ t: s.textContent.trim(), der: Math.round(s.getBoundingClientRect().right), alto: Math.round(s.getBoundingClientRect().height), lh: parseFloat(getComputedStyle(s).lineHeight) || parseFloat(getComputedStyle(s).fontSize) * 1.3 })) }
  })
  check(`[${nombre}] sin errores`, errores.length === 0, errores.join(' | '))
  check(`[${nombre}] la página mide lo que la pantalla (no se echa a los lados)`, m.sw <= m.W, JSON.stringify(m))
  check(`[${nombre}]   …la cifra y su cambio dentro y en un renglón`, m.rotulos.length === 2 && m.rotulos.every((x) => x.der <= m.W && x.alto < x.lh * 1.6 + 2), JSON.stringify(m.rotulos))
  await ctx.close()
}

console.log('── 3. La hoja de añadir, sin huecos ──')
{
  const { page, ctx, errores } = await abrir('/mi-coleccion.html?ver=album&set=S8a&catalogo=JP', { japonesa: true })
  await page.locator('.mc-mas[data-anadir]').first().click()
  await page.waitForTimeout(800)
  const m = await page.evaluate(() => {
    const d = document.getElementById('mcAnadirDialogo')
    const r = (e) => e.getBoundingClientRect()
    // Desde la 748 la hoja es UN formulario en columna (la C5 de su
    // maqueta): la caja es el formulario y las filas, lo que lleva dentro.
    const caja = d.querySelector('.mc-ad-form')
    const hijos = [...caja.children].filter((e) => r(e).height > 0)
    const copias = d.querySelector('.mc-ad-fila .mc-contador-mando')
    const pagado = document.getElementById('mcAdCompra')
    const filas = hijos
    let hueco = 0
    for (let i = 1; i < filas.length; i++) if (r(filas[i]).top > r(filas[i - 1]).bottom) hueco = Math.max(hueco, Math.round(r(filas[i]).top - r(filas[i - 1]).bottom))
    return { cajaAlto: Math.round(r(caja).height), sumaFilas: Math.round(Math.max(...hijos.map((h) => r(h).bottom)) - Math.min(...hijos.map((h) => r(h).top)) + parseFloat(getComputedStyle(caja).paddingBottom) + parseFloat(getComputedStyle(caja).paddingTop)), hueco, mismaFila: Math.abs(r(copias).bottom - r(pagado).bottom) <= 1 && r(pagado).left > r(copias).right, cabe: d.scrollHeight <= d.clientHeight + 1, botonAbajo: Math.round(r(document.getElementById('mcAdGuardar')).bottom), dlgAbajo: Math.round(r(d).bottom) }
  })
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('la caja de campos mide lo que lleva dentro (no 360 px)', m.cajaAlto <= m.sumaFilas + 1, JSON.stringify(m))
  check('  …y entre campo y campo no hay más que el paso de la escala', m.hueco <= 24, JSON.stringify(m))
  check('copias y «Lo que pagaste» en una fila', m.mismaFila, JSON.stringify(m))
  check('la hoja cabe entera, con el botón de añadir a la vista', m.cabe && m.botonAbajo <= m.dlgAbajo, JSON.stringify(m))
  await ctx.close()
}

console.log('── 4. Otra pestaña empieza arriba ──')
{
  const { page, ctx, errores } = await abrir('/mi-coleccion.html', { valores: [100, 120, 150] })
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForTimeout(400)
  const bajado = await page.evaluate(() => window.scrollY)
  for (const p of ['carpetas', 'buscar', 'pokedex']) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await page.waitForTimeout(300)
    await page.locator(`.mc-pestanias [data-pestania="${p}"]`).first().click()
    await page.waitForTimeout(400)
    const y = await page.evaluate(() => window.scrollY)
    check(`[${p}] al tocarla, arriba del todo`, bajado > 200 && y === 0, `bajado ${bajado}, después ${y}`)
  }
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 5. Buscar, sin el botón de escanear ──')
{
  const { page, ctx, errores } = await abrir('/mi-coleccion.html?ver=buscar', { camara: true })
  const b = await page.evaluate(() => ({ boton: !!document.getElementById('mcEscanear'), texto: document.getElementById('mcBuscarVacio')?.innerText || '', menu: !!document.querySelector('.mc-pestanias .bm-escanear') }))
  check('el vacío de Buscar no lleva escáner', !b.boton && !/Escanear|Enfoca la carta/.test(b.texto), JSON.stringify(b))
  check('  …y el menú sí', b.menu)
  await page.click('.mc-pestanias .bm-escanear')
  await page.waitForTimeout(1200)
  const abierto = await page.evaluate(() => { const c = document.getElementById('mcEscanerCaja'); return !!c && c.getBoundingClientRect().height > 0 && location.pathname.startsWith('/mi-coleccion') })
  check('el «Escanear» del menú abre la cámara ahí mismo', abierto)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
