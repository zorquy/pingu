// Tanda 1327 — Cada imagen que se comparte invita (G1 del plan): la historia
// lleva tu dirección /r/<tú> y un QR a /r/<tú>/<qué> en la franja de abajo, y
// la llegada enseña lo que compartiste («Su reto de hoy · ¿Le ganas?»).
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const REPO = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const m = await import(`${REPO}/js/invitar-puro.js`)
const casos = { 'carta-del-dia-12': 'carta', 'quien-es-3': 'silueta', 'que-expansion-4': 'expansion', 'expansion-151': 'set', 'mas-caro-9': 'caro', 'ordena-precio-2': 'ordena', 'parejas-1': 'parejas', 'vitrina-ash': 'vitrina', 'partida-a-vs-b': 'partida', 'torneo-copa': 'torneo', 'logro-embajador': 'logro', 'nivel-5': null, pokedoc: null }
const mal = Object.entries(casos).filter(([n, de]) => m.compartidoDeNombre(n) !== de)
check('qué es cada imagen, por el nombre de su fichero («expansion-» no es el reto «que-expansion-»)', mal.length === 0, JSON.stringify(mal))
const e = m.enlaceDeImagen('Ash', 'carta')
check('la imagen dice pokedoc.es/r/Ash y su QR lleva a /r/Ash/carta', e.corto === 'pokedoc.es/r/Ash' && e.qr === 'https://pokedoc.es/r/Ash/carta')
check('  …sin saber qué es, el QR a /r/Ash a secas; sin usuario válido, nada', m.enlaceDeImagen('Ash', null).qr === 'https://pokedoc.es/r/Ash' && m.enlaceDeImagen('a b', 'carta') === null)
const l = m.llegadaDeCompartido('Ash', 'carta')
check('la llegada de un reto: la frase, «Jugar el reto» y a su página', l.reto && l.ruta === '/carta-del-dia' && l.boton === 'Jugar el reto' && m.llegadaDeCompartido('Ash', 'vitrina').ruta === '/usuario/Ash?ver=coleccion' && m.llegadaDeCompartido('Ash', 'xx') === null)
const retos = readFileSync(`${REPO}/js/retos-xp.js`, 'utf8')
check('las rutas de los retos son las de RETOS', ['carta', 'caro', 'silueta', 'ordena', 'expansion', 'parejas'].every((k) => retos.includes(`ruta: '${m.COMPARTIDO[k].ruta('x')}'`)))
const toml = readFileSync(`${REPO}/netlify.toml`, 'utf8')
check('/r/<usuario>/<qué> va al registro con ?de=, antes que /r/<usuario>', toml.indexOf('from = "/r/:username/:de"') > 0 && toml.indexOf('from = "/r/:username/:de"') < toml.indexOf('from = "/r/:username"\n') && /to = "\/auth\.html\?r=:username&de=:de"/.test(toml))
check('las que no son de quien comparte no invitan (la invitación, noticias, novedades)', ['invitar-hoja.js', 'noticia-compartir.js', 'novedad-imagen.js'].every((f) => /invitar: false/.test(readFileSync(`${REPO}/js/${f}`, 'utf8'))))

const b = await chromium.launch()
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' })
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'user-1' })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/retos.html`, { waitUntil: 'domcontentloaded' })
  const r = await p.evaluate(async () => {
    const h = await import('/js/compartir-hoja.js')
    await h.abrirHojaCompartir({ titulo: 'x', texto: 'x', nombre: 'carta-del-dia-5', imagen: async () => { const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; const x = c.getContext('2d'); x.fillStyle = '#c33'; x.fillRect(0, 0, 1080, 1350); return c } })
    for (let i = 0; i < 50 && !document.querySelector('#chPrevia img'); i++) await new Promise((r) => setTimeout(r, 100))
    const img = document.querySelector('#chPrevia img')
    if (!img) return null
    await img.decode().catch(() => {})
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
    const x = c.getContext('2d'); x.drawImage(img, 0, 0)
    // La franja de abajo: de lo que acaba la vertical al final.
    const banda = x.getImageData(0, 1640, c.width, 280).data
    let blancos = 0; let oscuros = 0
    for (let i = 0; i < banda.length; i += 4) { const s = banda[i] + banda[i + 1] + banda[i + 2]; if (s > 740) blancos++; else if (s < 120) oscuros++ }
    return { w: c.width, h: c.height, blancos, oscuros }
  })
  check('la historia (1080×1920) de un reto lleva abajo la píldora blanca con el QR', r && r.h === 1920 && r.blancos > 30000 && r.oscuros > 3000, JSON.stringify(r))
  await ctx.close()
}
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' })
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'none' })
  const p = await ctx.newPage()
  const r = await p.goto(`${BASE}/retos.html`, { waitUntil: 'domcontentloaded' }).then(() => p.evaluate(async () => {
    const h = await import('/js/compartir-hoja.js')
    await h.abrirHojaCompartir({ titulo: 'x', texto: 'x', nombre: 'carta-del-dia-5', imagen: async () => { const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; c.getContext('2d').fillStyle = '#c33'; c.getContext('2d').fillRect(0, 0, 1080, 1350); return c } })
    for (let i = 0; i < 50 && !document.querySelector('#chPrevia img'); i++) await new Promise((r) => setTimeout(r, 100))
    const img = document.querySelector('#chPrevia img'); await img?.decode().catch(() => {})
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1920; const x = c.getContext('2d'); x.drawImage(img, 0, 0)
    const d = x.getImageData(0, 1640, 1080, 280).data; let blancos = 0
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 740) blancos++
    return blancos
  }))
  check('sin cuenta, la historia sale como siempre (sin píldora)', r < 2000, r)
  await ctx.close()
}
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' })
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'none' })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/auth.html?r=Ash&de=carta`, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('#authPadrino:not([hidden])', { timeout: 6000 }).catch(() => {})
  const t = await p.locator('#authPadrino').textContent().catch(() => '')
  const href = await p.getAttribute('.auth-padrino-ir', 'href').catch(() => null)
  check('la llegada por /r/Ash/carta: «Ash te invita», su reto y «Jugar el reto» a /carta-del-dia', /Ash.*te invita/.test(t) && /¿Qué carta es\?.*¿Le ganas\?/.test(t) && href === '/carta-del-dia', t.replace(/\s+/g, ' '))
  await p.goto(`${BASE}/auth.html?r=Ash`, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('#authPadrino:not([hidden])', { timeout: 6000 }).catch(() => {})
  check('  …y por /r/Ash a secas, como antes (sin botón)', (await p.locator('.auth-padrino-ir').count()) === 0 && /te invita/.test(await p.locator('#authPadrino').textContent()))
  await ctx.close()
}
await b.close()

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
