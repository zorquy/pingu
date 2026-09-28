// Tanda 361 — la página de «Colabora».
//
// PINGU quiere delegar: gente que escriba noticias, que organice
// torneos, que eche una mano. Y quería un formulario abierto del tipo
// «cuéntanos qué te gustaría aportar».
//
// Lo que se monta es lo mismo pero con la lista delante: la gente no
// sabe qué puede ofrecerte hasta que ve lo que hace falta y lo que
// cuesta. Con la lista, el que encaja se reconoce solo.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const BASE = 'http://localhost:8892'
const RAIZ = '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const browser = await chromium.launch()

async function abrir(sesion) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 1200 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  // El doble entiende 'none' como «sin sesión»; sin gancho da por hecho
  // que hay alguien dentro.
  await page.addInitScript((s) => { window.__FAKE_SESSION__ = s }, sesion)
  await page.goto(`${BASE}/colabora.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  return { page, errores }
}

console.log('\n── 1. Lo que se ve sin cuenta ──')
{
  const { page, errores } = await abrir('none')
  // La página entera se lee sin sesión: es un escaparate, y quien no
  // tiene cuenta es justo a quien hay que convencer.
  check('los puestos se ven sin entrar', (await page.locator('.colabora-puesto').count()) === 6,
    String(await page.locator('.colabora-puesto').count()))
  check('y el trato también', /voluntario y no hay dinero/i.test(await page.locator('.colabora-trato').innerText()))
  // Pero el formulario no: pide sesión, y se dice POR QUÉ en vez de
  // enseñar campos que al enviar van a fallar.
  check('el formulario no sale', !(await page.locator('#colaboraForm').isVisible()))
  check('…y se explica que hace falta cuenta', await page.locator('#colaboraEntrar').isVisible())
  const href = await page.locator('#colaboraEntrarBtn').getAttribute('href')
  check('…con la vuelta puesta', /volver=%2Fcolabora/.test(href || ''), href)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('\n── 2. Con cuenta, el formulario ──')
{
  const { page, errores } = await abrir('user-1')
  check('sale el formulario', await page.locator('#colaboraForm').isVisible())
  // Las casillas se pintan desde el MISMO sitio que la lista de puestos:
  // una casilla que no está entre los puestos es una promesa que nadie
  // recuerda haber hecho.
  const opciones = await page.locator('.colabora-opcion').count()
  check('una casilla por puesto', opciones === (await page.locator('.colabora-puesto').count()), String(opciones))
  // Y lo que se pulsa se puede pulsar: la fila entera, no la casilla.
  const alto = await page.locator('.colabora-opcion').first().evaluate((n) => n.getBoundingClientRect().height)
  check('las casillas se pueden dar con el dedo', alto >= 44, `${Math.round(alto)}px`)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('\n── 3. Y no se envía media solicitud ──')
{
  const { page } = await abrir('user-1')
  await page.click('#colaboraEnviar')
  await page.waitForTimeout(300)
  check('sin marcar nada, no pasa', await page.locator('#colaboraForm').isVisible())
  await page.locator('.colabora-opcion input').first().check()
  await page.fill('#colaboraMuestra', 'corto')
  await page.click('#colaboraEnviar')
  await page.waitForTimeout(300)
  // La muestra es lo que más dice de quien escribe: cinco palabras no
  // son una muestra.
  check('con la muestra a medias, tampoco', await page.locator('#colaboraForm').isVisible())
  await page.fill('#colaboraMuestra', 'Llevo coleccionando desde pequeño y me gustaría escribir sobre el mercado de cartas en español, que es algo que casi nadie hace bien.')
  await page.click('#colaboraEnviar')
  await page.waitForTimeout(600)
  check('y entera, se envía', await page.locator('#colaboraGracias').isVisible())
  check('…y el formulario se va', !(await page.locator('#colaboraForm').isVisible()))
  await page.close()
}

console.log('\n── 4. La base decide lo mismo que la pantalla ──')
{
  const sql = leer('supabase-migration-colabora.sql')
  check('pide sesión de verdad', /user_id uuid not null references auth\.users/.test(sql))
  // Una solicitud viva por persona: si no, dos pestañas abiertas son dos
  // solicitudes iguales que hay que leer dos veces.
  check('una solicitud viva por persona',
    /create unique index[\s\S]{0,200}collab_applications \(user_id\)[\s\S]{0,120}where status in \('nueva', 'hablando'\)/.test(sql))
  check('y el cliente lo cuenta en vez de dar un error de índice',
    /duplicate key\|una_viva/.test(leer('js/colabora.js')))
  check('cada cual ve solo la suya', /for select to authenticated using \(auth\.uid\(\) = user_id\)/.test(sql))
  check('y el admin, todas', /collab_admin_ver[\s\S]{0,140}using \(is_admin\(\)\)/.test(sql))
  // Que PINGU se entere el mismo día: una solicitud sin contestar una
  // semana es un voluntario perdido.
  check('avisa al equipo por campanita y por correo',
    /insert into user_notifications/.test(sql) && /perform enqueue_email\(/.test(sql))
}

console.log('\n── 5. El correo nuevo, con su sitio en el catálogo ──')
{
  const plantilla = leer('js/email-plantilla.js')
  check('tiene verbo y motivo propios', /collab_application: \{ cta: 'Ver la solicitud'/.test(plantilla))
  check('y su ejemplo en /admin → Correos', /type: 'collab_application'/.test(plantilla))
  // Si se puede recibir, se tiene que poder apagar.
  check('se puede dar de baja', /collab_application:/.test(leer('netlify/functions/baja-correo.mjs')))
  check('y sale en las casillas del equipo', /collab_application:/.test(leer('js/notifications.js')))
}

console.log('\n── 6. Y se llega a la página ──')
{
  // Una página que no enlaza nadie es una página que no encuentra nadie.
  const paginas = ['index.html', 'foro.html', 'torneos.html', 'aprender.html', 'sobre.html']
  const sinEnlace = paginas.filter((p) => !/href="\/colabora"/.test(leer(p)))
  check('el pie la enlaza en todas', sinEnlace.length === 0, sinEnlace.join(', '))
  const { page } = await abrir('none')
  check('y el enlace del pie lleva a algún sitio',
    (await page.locator('footer a[href="/colabora"]').count()) === 1)
  await page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
