// Tanda 1487 — La portada sin cuenta, más visual y para que se registre
// (PINGU: «que la peña se enganche y que se registre»; con la propuesta «Inicio
// sin cuenta» delante, «dale con lo recomendado»). Se mira:
//   · todo al mismo ancho: el titular, las cifras y las puertas van de borde a
//     borde del mosaico de abajo («ves que el ancho no es igual»);
//   · cuatro puertas, una por sección, con su color; tres cifras;
//   · la mascota saluda en el titular y en el aviso final SOLO sin cuenta (con
//     sesión estos dos huecos no se montan);
//   · el reto se ofrece sin cuenta y, al acabar uno, se pide la cuenta con un
//     aviso y su botón (premiosHtml).
import { contexto, chromium } from './fixtures-app.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. Lo puro: el final de un reto sin cuenta ──')
{
  const { premiosHtml } = await import(`${RAIZ}/js/retos-ui.js`)
  const sin = premiosHtml({ sinCuenta: true }, { posible: 30, volver: '/carta-del-dia' })
  check('sin cuenta: «Guarda tu día» con sus XP y el botón al registro', /class="rj-cuenta"/.test(sin) && /y sus 30 XP/.test(sin) && /auth\.html\?registro=1&amp;volver=%2Fcarta-del-dia/.test(sin) && />Crear mi cuenta</.test(sin), sin)
  const con = premiosHtml({ nuevo: true, xp: 20 }, { posible: 30 })
  check('con cuenta, ni rastro del aviso', !/rj-cuenta/.test(con) && /\+20 XP/.test(con), con)
}

const b = await chromium.launch()
console.log('── 2. La portada sin cuenta en el PC ──')
{
  const ctx = await contexto(b, false, 'none')
  const p = await ctx.newPage()
  const errores = []; p.on('pageerror', (e) => errores.push(e.message))
  await p.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(3500)
  const r = await p.evaluate(() => {
    const caja = (s) => { const e = document.querySelector(s); if (!e) return null; const q = e.getBoundingClientRect(); return [Math.round(q.left), Math.round(q.right)] }
    return {
      titular: caja('.hero-portada .hero-grid'), cifras: caja('.hero-cifras'), puertas: caja('.hero-puertas'), mosaico: caja('#noticiaPortadaSeccion'), mosaicoDcha: caja('#foroVivoSeccion'), aviso: caja('#signupBanner .banner-signup'),
      secciones: [...document.querySelectorAll('.hero-puertas a')].map((a) => a.dataset.seccionColor).join(),
      cifrasN: document.querySelectorAll('.hero-cifras > div').length,
      mascotas: [...document.querySelectorAll('.hero-mascota, .banner-mascota')].map((m) => m.dataset.mascota || '').join(),
      reto: document.getElementById('retoTarjetas')?.textContent.replace(/\s+/g, ' ') || '',
      h1: document.querySelector('.hero-portada h1')?.textContent,
    }
  })
  check('el titular, las cifras y las puertas, al ancho del mosaico', r.titular && r.titular[0] === r.mosaico[0] && r.titular[1] === r.mosaicoDcha[1] && r.cifras[0] === r.mosaico[0] && r.puertas[1] === r.mosaicoDcha[1], JSON.stringify(r))
  check('…y el aviso final, también', r.aviso && r.aviso[0] === r.mosaico[0] && r.aviso[1] === r.mosaicoDcha[1], JSON.stringify(r.aviso))
  check('cuatro puertas, una por sección y con su color', r.secciones === 'cartas,aprender,comunidad,jugar', r.secciones)
  check('tres cifras', r.cifrasN === 3)
  check('la mascota saluda en el titular y en el aviso final', r.mascotas === 'saludar,saludar', r.mascotas)
  check('el titular nuevo', /lo que vale/.test(r.h1 || ''), r.h1)
  check('el reto se ofrece sin cuenta', /sin cuenta/.test(r.reto) && /Jugar el de hoy/.test(r.reto), r.reto)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
console.log('── 3. Con cuenta, la mascota del titular no se monta ──')
{
  const ctx = await contexto(b, false, 'user-1')
  const p = await ctx.newPage()
  const motor = []
  p.on('request', (q) => { if (/three\.min\.js/.test(q.url())) motor.push(q.url()) })
  await p.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(3500)
  const m = await p.evaluate(() => [...document.querySelectorAll('.hero-mascota, .banner-mascota')].map((x) => x.dataset.mascota || '').join())
  check('sin hueco de mascota en el titular ni en el aviso', m === ',', m)
  // (El motor sí se baja con cuenta: la banda de bienvenida tiene su propia
  // mascota desde la 1301. Lo que se mira es que estos dos no se monten.)
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
