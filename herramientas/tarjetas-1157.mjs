// Rehace con el marco de redes (1156/1157) las tarjetas fijas de enlace:
// assets/social/reto-*.png (las de los retos, 872) y
// assets/images/og-default.png (la de la web). Se dibujan en el navegador
// con js/redes-marco.js, el mismo módulo que usa la web, sobre el sitio de
// pruebas (localhost:8892) para tener las letras de la casa.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { writeFileSync } from 'node:fs'
import { RETOS } from '/home/user/pingu/js/retos-xp.js'

const RAIZ = '/home/user/pingu'
const TIRAS = { reto: [1, 0, 1, 1, 1], carta: [0, 0, 1, 1], caro: [1, 1, 0, 1, 1], silueta: [0, 1], ordena: [1, 0, 1, 1], expansion: [1, 1, 1, 0, 1], parejas: [1, 0, 1, 1, 0, 1] }
const TARJETAS = [
  { fichero: 'assets/social/reto-retos.png', seccion: 'retos', chapa: 'Retos diarios', titulo: '*Seis retos* al día', entradilla: 'Los mismos para todo el mundo. Juega, comparte y vuelve mañana.', enlace: 'pokedoc.es/retos', tira: [1, 1, 0, 1, 1, 1] },
  ...RETOS.map((r) => ({ fichero: `assets/social/reto-${r.juego}.png`, seccion: 'retos', chapa: 'Reto diario', titulo: r.titulo, entradilla: r.texto, enlace: `pokedoc.es${r.ruta}`, tira: TIRAS[r.juego] || [1, 0, 1, 1] })),
  { fichero: 'assets/images/og-default.png', seccion: 'inicio', chapa: 'En español', titulo: 'Todo sobre *Pokémon TCG*, sin perder el tiempo', entradilla: 'Guías, retos, tu colección y comunidad para coleccionistas.', enlace: 'pokedoc.es', mascota: true },
]
const SOLO = process.env.SOLO ? process.env.SOLO.split(',') : null

const b = await chromium.launch()
const page = await b.newPage()
await page.goto('http://localhost:8892/novedades', { waitUntil: 'domcontentloaded' })
for (const t of TARJETAS.filter((x) => !SOLO || SOLO.some((s) => x.fichero.includes(s)))) {
  const url = await page.evaluate(async (t) => {
    const m = await import('/js/redes-marco.js')
    await m.prepararMarco()
    const { ctx, caja } = m.pintarMarco(document.createElement('canvas'), { formato: 'apaisada', seccion: t.seccion, chapa: t.chapa, titulo: t.titulo, entradilla: t.entradilla, enlace: t.enlace, maxLineas: 3 })
    if (t.tira) {
      const n = t.tira.length
      const lado = Math.min(84, Math.floor((caja.w - (n - 1) * 14) / n))
      const ancho = n * lado + (n - 1) * 14
      const x0 = caja.x + (caja.w - ancho) / 2
      const y0 = caja.y + (caja.h - lado) / 2
      t.tira.forEach((v, i) => {
        ctx.fillStyle = v ? '#2e9e5b' : '#d64545'
        ctx.beginPath(); ctx.roundRect(x0 + i * (lado + 14), y0, lado, lado, Math.round(lado / 5)); ctx.fill()
      })
    }
    if (t.mascota) {
      const img = new Image(); img.src = '/assets/images/mascota.webp'; await img.decode()
      const k = Math.min(caja.w / img.width, caja.h / img.height)
      const w = img.width * k, h = img.height * k
      ctx.drawImage(img, caja.x + (caja.w - w) / 2, caja.y + (caja.h - h) / 2, w, h)
    }
    return ctx.canvas.toDataURL('image/png')
  }, t)
  writeFileSync(`${RAIZ}/${t.fichero}`, Buffer.from(url.split(',')[1], 'base64'))
  console.log('ok', t.fichero)
}
await b.close()
