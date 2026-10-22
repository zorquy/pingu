// Tanda 984 — Lo de la última vez, en las pantallas que faltaban (propuesta
// «Rápida al volver», C): la portada del miembro (con «Hoy»), tu perfil, el
// de otra persona, Aprender y Mis partidas. Con la base MUY lenta (1,5 s por
// consulta), la segunda visita tiene que enseñar lo de la vez anterior a los
// pocos cientos de ms, con el punto de «pidiendo lo nuevo», y quitarlo al
// llegar lo de ahora. Y la pieza (`vistaVigilada`), a mano: lo que no se
// vuelve a pintar se queda como estaba, y un esqueleto no se guarda nunca.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const b = await chromium.launch()

console.log('── 1. La pieza ──')
{
  const p = await b.newPage()
  await p.goto(`${BASE}/glosario`, { waitUntil: 'load' })
  const r = await p.evaluate(async () => {
    const { vistaVigilada, leerVista } = await import('/js/ultima-vista.js')
    const zona = document.createElement('div')
    zona.innerHTML = '<div id="t1"><i class="skeleton"></i></div><div id="t2"><i class="skeleton"></i></div><div id="t3" style="color: red" class="a"></div>'
    document.body.appendChild(zona)
    localStorage.removeItem('pokedoc-uv-prueba|u')
    vistaVigilada('pokedoc-uv-prueba|u', ['t1', 't2'], { atributos: ['t3'], espera: 50 })
    document.getElementById('t1').innerHTML = 'Hola de verdad'
    document.getElementById('t3').className = 'b'
    await new Promise((ok) => setTimeout(ok, 120))
    const primera = leerVista('pokedoc-uv-prueba|u')
    // Segunda visita: t2 no se vuelve a pintar; t1, sí.
    zona.innerHTML = '<div id="t1"><i class="skeleton"></i></div><div id="t2"><i class="skeleton"></i></div><div id="t3" class="a"></div>'
    vistaVigilada('pokedoc-uv-prueba|u', ['t1', 't2'], { atributos: ['t3'], espera: 50 })
    const pintado = { t1: document.getElementById('t1').innerHTML, t3: document.getElementById('t3').className, punto: document.documentElement.classList.contains('uv-actualizando') }
    document.getElementById('t1').innerHTML = 'Hola otra vez'
    window.dispatchEvent(new Event('pagehide'))
    const segunda = leerVista('pokedoc-uv-prueba|u')
    return { primera, pintado, segunda, puntoFin: document.documentElement.classList.contains('uv-actualizando') }
  })
  check('se guarda lo que se volvió a pintar, y su aspecto', r.primera?.partes?.t1 === 'Hola de verdad' && r.primera?.atributos?.t3?.clase === 'b', JSON.stringify(r.primera))
  check('  …y NO el esqueleto del que nadie pintó', !('t2' in (r.primera?.partes || {})), JSON.stringify(r.primera?.partes))
  check('al volver se pinta lo guardado, con su aspecto, y el punto de «pidiendo»', r.pintado.t1 === 'Hola de verdad' && r.pintado.t3 === 'b' && r.pintado.punto, JSON.stringify(r.pintado))
  check('al irse se guarda lo nuevo', r.segunda?.partes?.t1 === 'Hola otra vez')
  await p.close()
}

async function dosVisitas(ruta, mirar) {
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'user-1'
    try {
      localStorage.setItem('pokedoc-instalar-no', String(Date.now()))
      localStorage.setItem('sb-prueba-auth-token', '{}')
      const lenta = sessionStorage.getItem('lenta') === '1'
      const s = new Proxy({}, { get: () => (lenta ? 1500 : 0) })
      window.__FAKE_RETRASO__ = s
      window.__RPC_RETRASO__ = s
    } catch {}
  })
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await p.goto(BASE + ruta, { waitUntil: 'load' })
  await p.waitForTimeout(2500)
  await p.evaluate(() => sessionStorage.setItem('lenta', '1'))
  await p.goto(BASE + ruta, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(400)
  const pronto = await p.evaluate(mirar)
  const punto = await p.evaluate(() => document.documentElement.classList.contains('uv-actualizando'))
  await p.waitForTimeout(9000)
  const tarde = await p.evaluate(mirar)
  const puntoFin = await p.evaluate(() => document.documentElement.classList.contains('uv-actualizando'))
  await ctx.close()
  return { pronto, tarde, punto, puntoFin, errores }
}

console.log('\n── 2. La segunda visita, con la base a 1,5 s ──')
const CASOS = [
  ['/index.html', 'la portada: el saludo y «Hoy»', () => ({ saludo: !!document.querySelector('#bienvenida .bienvenida-texto strong'), hoy: document.querySelectorAll('#hoyPortada').length, fichas: !!document.querySelector('#hoyPortada .hoy-rejilla > :not(.skeleton)') })],
  ['/perfil', 'tu perfil: la cabecera y las cifras', () => ({ nombre: document.querySelector('#heroInfo h1')?.textContent || '', cifras: !!document.querySelector('#profileStats > *') })],
  ['/usuario?u=Ash', 'el perfil de otra persona', () => ({ nombre: document.querySelector('#heroInfo h1')?.textContent || '', cifras: !!document.querySelector('#profileStats > *') })],
  ['/aprender', 'Aprender: la lista', () => ({ lista: document.getElementById('categoriesList').textContent.trim().slice(0, 60), sinEsqueleto: !document.querySelector('#categoriesList .skeleton') })],
]
for (const [ruta, que, mirar] of CASOS) {
  const r = await dosVisitas(ruta, mirar)
  const ya = Object.values(r.pronto).every((v) => v === true || (typeof v === 'string' && v.length > 0) || (typeof v === 'number' && v > 0))
  check(`${que}: a los 0,4 s ya está, de la última vez`, ya, JSON.stringify(r.pronto))
  check('  …con el punto de «pidiendo lo nuevo», que se apaga al llegar', r.punto && !r.puntoFin, `${r.punto} → ${r.puntoFin}`)
  check('  …y lo de ahora lo sustituye sin duplicar', JSON.stringify(r.tarde) === JSON.stringify(r.pronto) || (r.tarde.hoy ?? 1) === 1, JSON.stringify(r.tarde))
  check('  …sin errores', !r.errores.length, r.errores.join(' | '))
}
await b.close()
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
