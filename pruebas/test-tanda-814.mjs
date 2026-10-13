// Tanda 814 (CK1 + CK2) — lo que PokeDoc guarda en tu dispositivo, contado
// entero, y un botón para borrarlo sin cerrar la sesión.
import { readFileSync } from 'node:fs'
const RAIZ = '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const html = readFileSync(`${RAIZ}/privacidad.html`, 'utf8')
const s9 = html.slice(html.indexOf('<h2>9.'), html.indexOf('<h2>10.'))
console.log('── 1. La sección 9 ──')
check('ya no dice que solo se guarda la sesión y el tema', !/únicamente para recordar tu sesión y tu tema/.test(html))
check('  …cuenta las cuatro cosas: sesión, preferencias, copia de la web y avisos', /Tu sesión/.test(s9) && /Tus preferencias/.test(s9) && /copia de los ficheros/.test(s9) && /notificaciones/.test(s9))
check('  …y lleva el botón de borrar, con su aviso que se lee', /id="borrarLocal"/.test(s9) && /id="borrarLocalAviso" role="status"/.test(s9))
check('  …y la página carga el módulo', /<script type="module" src="js\/privacidad\.js"><\/script>/.test(html))

console.log('\n── 2. Borrar ──')
const m = await import(`${RAIZ}/js/privacidad.js`)
check('la sesión de Supabase (sb-…) no se borra; lo demás sí', m.clavesABorrar(['sb-zq-auth-token', 'pokedoc-theme', 'mc-split']).join() === 'pokedoc-theme,mc-split')
{
  const datos = new Map([['sb-x-auth-token', '1'], ['pokedoc-theme', 'dark'], ['mc-split', '1']])
  const almacen = { get length() { return datos.size }, key: (i) => [...datos.keys()][i], removeItem: (k) => datos.delete(k) }
  let sesionVacia = false
  const borradas = []
  const cachesImpl = { keys: async () => ['pokedoc-ficheros-1', 'pokedoc-sin-conexion-1', 'otra-cosa'], delete: async (k) => { borradas.push(k); return true } }
  const r = await m.borrarLoGuardado({ almacen, sesion: { clear: () => { sesionVacia = true } }, cachesImpl })
  check('borra las preferencias (y no se salta ninguna al ir quitando)', r.preferencias === 2 && [...datos.keys()].join() === 'sb-x-auth-token', [...datos.keys()].join())
  check('  …vacía las copias de PokeDoc y solo esas', borradas.join() === 'pokedoc-ficheros-1,pokedoc-sin-conexion-1' && r.copias === 2)
  check('  …y la sesión de la pestaña', sesionVacia)
}

console.log('\n── 3. En la página ──')
{
  const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')
  const nav = await chromium.launch()
  const page = await nav.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(e.message))
  await page.goto(`${BASE}/privacidad`)
  await page.evaluate(() => { localStorage.setItem('sb-prueba-auth-token', 'x'); localStorage.setItem('mc-split', '1') })
  await page.click('#borrarLocal')
  await page.waitForFunction(() => document.getElementById('borrarLocalAviso').textContent.length > 0)
  const r = await page.evaluate(() => ({ sb: localStorage.getItem('sb-prueba-auth-token'), mc: localStorage.getItem('mc-split'), aviso: document.getElementById('borrarLocalAviso').textContent }))
  check('pulsar borra y lo dice, con la sesión intacta', r.sb === 'x' && r.mc === null && /Tu sesión sigue abierta/.test(r.aviso), JSON.stringify(r))
  check('  …sin errores en la página', errores.length === 0, errores.join(' | '))
  await nav.close()
}
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
