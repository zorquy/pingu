import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, readdirSync } from 'node:fs'

// Tanda 305: la ESCALA TIPOGRÁFICA y los esqueletos con forma.
//
// De dónde viene: PINGU, «alguno me ha preguntado, oye, ¿esto está hecho
// con IA?… quiero una interfaz más moderna, que no se vea tan pocho» y
// «la manera que cargan los artículos, noticias y guías se puede
// mejorar».
//
// Había 36 tamaños de letra distintos en 596 declaraciones, con pasos de
// MEDIO PÍXEL: 13 px salía 105 veces, 12,5 px 55, 13,5 px 48. El ojo no
// distinguía jerarquía y todo se leía como «texto mediano» — que es
// buena parte de por qué la web parecía una plantilla.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

const RAIZ = '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const HOJAS = readdirSync(`${RAIZ}/css`).filter((f) => f.endsWith('.css')).map((f) => `css/${f}`)
// Sin comentarios: varios EXPLICAN el problema citando un tamaño («reglas
// como `.auth-input { font-size: 14px }` tienen más especificidad…») y
// eso no es una declaración.
const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '')
const BASE = 'http://localhost:8892'

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. La escala existe y tiene saltos que se ven ──')
{
  // Sin comentarios, y no es un detalle: el rigor comentó `--t-lg` y la
  // prueba siguió en verde porque leía el paso DENTRO del comentario.
  // Un `:root` al que le falta un escalón tiene que cantar.
  const style = sinComentarios(leer('css/style.css'))
  const pasos = ['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl']
  const valores = pasos.map((p) => {
    const m = style.match(new RegExp(`--t-${p}:\\s*([0-9.]+)px`))
    return m ? Number(m[1]) : null
  })
  check('están los ocho pasos', valores.every((v) => v !== null), JSON.stringify(valores))
  check('  …y van de menor a mayor', valores.every((v, i) => i === 0 || v > valores[i - 1]), JSON.stringify(valores))
  // Lo que se arreglaba era justo esto: saltos de medio píxel. Ninguno
  // puede quedarse por debajo de un píxel entero de diferencia.
  const saltos = valores.slice(1).map((v, i) => v - valores[i])
  check('  …sin saltos de medio píxel', saltos.every((s) => s >= 1), JSON.stringify(saltos))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Nadie se sale de la escala ──')
{
  // LA FORMA, no el caso: da igual QUÉ tamaño suelto sea, lo que no
  // puede es haber uno. Solo se admiten las cuatro piezas de display
  // sueltas (40, 42, 44 y 52 px), que no son texto de interfaz sino
  // números gigantes de portada.
  const PERMITIDOS = new Set([40, 42, 44, 52])
  const sueltos = []
  for (const hoja of HOJAS) {
    for (const m of sinComentarios(leer(hoja)).matchAll(/font-size:\s*([0-9.]+)px/g)) {
      if (!PERMITIDOS.has(Number(m[1]))) sueltos.push(`${hoja}: ${m[1]}px`)
    }
  }
  check('ninguna hoja declara un tamaño fuera de la escala', sueltos.length === 0, sueltos.slice(0, 8).join(', '))

  // Y que la escala se use de verdad: si alguien la borrara y volviera a
  // los números, lo de arriba cantaría, pero si la dejara puesta y sin
  // usar, no. Así que se cuenta.
  const conVar = HOJAS.reduce((n, h) => n + (leer(h).match(/font-size:\s*var\(--t-/g) || []).length, 0)
  check('y la usan más de 500 declaraciones', conVar > 500, String(conVar))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Un tamaño suelto tampoco se cuela por el HTML ──')
{
  // El atajo más fácil para saltarse la escala es `style="font-size:13px"`
  // en una plantilla de JavaScript, y por ahí se colaban 23.
  //
  // La excepción, a propósito: un avatar que se pinta a un tamaño
  // concreto lleva su `width` al lado y la inicial tiene que crecer CON
  // el círculo. Eso no es texto de interfaz y no sale de la escala: sale
  // del diámetro.
  const sueltos = []
  const ficheros = [
    ...readdirSync(RAIZ).filter((f) => f.endsWith('.html')),
    ...readdirSync(`${RAIZ}/js`).filter((f) => f.endsWith('.js')).map((f) => `js/${f}`),
    ...readdirSync(`${RAIZ}/js/torneos`).filter((f) => f.endsWith('.js')).map((f) => `js/torneos/${f}`),
  ]
  for (const f of ficheros) {
    const txt = sinComentarios(leer(f))
    for (const m of txt.matchAll(/font-size:\s*([0-9.]+)px/g)) {
      const alrededor = txt.slice(Math.max(0, m.index - 90), m.index + 30)
      if (/width:\s*\d+px/.test(alrededor)) continue
      sueltos.push(`${f}: ${m[1]}px`)
    }
  }
  check('ni el HTML ni los módulos ponen tamaños a mano', sueltos.length === 0, sueltos.slice(0, 6).join(', '))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. El artículo carga con la forma de un artículo ──')
{
  const browser = await chromium.launch()
  for (const [ruta, que] of [['/guia?slug=inexistente', 'la guía'], ['/curso?slug=inexistente', 'el curso']]) {
    // SIN JavaScript a propósito, y no con una carrera contra el
    // `waitUntil`: lo que se mira es lo que se ve ANTES de que llegue
    // nada de la base, y con el JS puesto eso dura lo que tarde el
    // módulo en pintar — a veces menos de lo que tarda la prueba en
    // mirar. Apagándolo, lo que queda en pantalla es exactamente el
    // primer fotograma que ve una persona.
    const page = await browser.newPage({ viewport: { width: 900, height: 900 }, javaScriptEnabled: false })
    await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
    const esqueleto = await page.locator('.esq-articulo').first()
    check(`${que}: lo primero que se ve tiene forma de artículo`, await esqueleto.isVisible())
    // Titular, firma y párrafos: no es un rectángulo gris, es la silueta
    // de lo que va a llegar.
    check(`  …con titular`, (await page.locator('.esq-titular').count()) >= 1)
    check(`  …con firma`, (await page.locator('.esq-firma').count()) >= 1)
    // DOS párrafos de TRES renglones, no «al menos cuatro líneas»: con
    // ese listón el rigor le quitó un párrafo entero al curso y la
    // prueba no se enteró (quedaban la firma y tres renglones, o sea
    // cuatro). La silueta de un artículo es varios párrafos, y eso es
    // lo que hay que comprobar.
    const parrafos = await page.locator('.esq-parrafo').count()
    check(`  …con dos párrafos`, parrafos >= 2, String(parrafos))
    const renglones = await page.locator('.esq-parrafo').evaluateAll((ns) => ns.map((n) => n.querySelectorAll('.esq-linea').length))
    check(`  …y cada uno con tres renglones`, renglones.every((n) => n === 3), JSON.stringify(renglones))
    // Y quien no ve la pantalla se entera de que está cargando: el
    // esqueleto es `aria-hidden`, así que hace falta decirlo aparte.
    const avisa = await page.locator('.sr-only').first().textContent()
    check(`  …y se anuncia a un lector de pantalla`, /cargando/i.test(avisa || ''), JSON.stringify(avisa))
    const oculto = await esqueleto.getAttribute('aria-hidden')
    check(`  …sin que el lector lea el esqueleto`, oculto === 'true', String(oculto))
    await page.close()
  }
  await browser.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. La vista previa al compartir sigue teniendo dónde entrar ──')
{
  // El esqueleto vive DENTRO de los marcadores que rellena la función de
  // meta-social. Si alguien los quita al tocar la plantilla, los enlaces
  // compartidos vuelven a salir sin título ni foto y nadie se entera
  // hasta que se comparte uno.
  const g = leer('guia.html')
  check('guia.html conserva los marcadores del artículo',
    g.includes('<!-- articulo:inicio -->') && g.includes('<!-- articulo:fin -->'))
  const dentro = g.slice(g.indexOf('<!-- articulo:inicio -->'), g.indexOf('<!-- articulo:fin -->'))
  check('  …y el esqueleto va dentro de ellos', dentro.includes('esq-articulo'))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. .sr-only esconde de verdad ──')
{
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 900, height: 900 }, javaScriptEnabled: false })
  await page.goto(`${BASE}/guia?slug=inexistente`, { waitUntil: 'domcontentloaded' })
  const caja = await page.locator('.sr-only').first().evaluate((n) => {
    const r = n.getBoundingClientRect()
    return { w: Math.round(r.width), h: Math.round(r.height) }
  })
  check('el texto para lectores no ocupa sitio en pantalla', caja.w <= 1 && caja.h <= 1, JSON.stringify(caja))
  // Pero sigue estando: `display:none` lo quitaría también del lector.
  const leible = await page.locator('.sr-only').first().evaluate((n) => getComputedStyle(n).display !== 'none')
  check('  …pero no está en display:none', leible)
  await page.close()
  await browser.close()
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
