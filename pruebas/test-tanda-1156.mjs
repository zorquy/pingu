// Tanda 1156 — «Todas las imágenes de PokeDoc, con el mismo marco» (R1 y R2):
//   R1 · js/redes-marco.js: fondo con el color de la sección, logo + «PokeDoc»
//        y chapa arriba, título en Outfit, pieza en medio y la dirección
//        abajo, en tres tamaños. Fredoka fuera del todo (ni @font-face ni
//        lienzos): todo lo que se dibuja va en Outfit.
//   R2 · La noticia con el marco y su Historia de verdad (1080×1920).
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const RAIZ = '/home/user/pingu'
const SALIDA = process.env.PD_CAPTURAS || '/tmp/capturas-1156'
mkdirSync(SALIDA, { recursive: true })

console.log('── Fredoka fuera ──')
{
  const js = []
  const recorrer = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { if (e.isDirectory()) recorrer(`${d}/${e.name}`); else if (/\.(js|mjs|css|html)$/.test(e.name)) js.push(`${d}/${e.name}`) } }
  for (const d of ['js', 'css', 'admin']) recorrer(`${RAIZ}/${d}`)
  const conFredoka = js.filter((f) => !f.endsWith('/css/style.css') && !f.endsWith('/js/redes-marco.js') && /Fredoka/i.test(readFileSync(f, 'utf8')))
  check('ningún fichero de la web pide Fredoka', !conFredoka.length, conFredoka.join(' '))
  const css = readFileSync(`${RAIZ}/css/style.css`, 'utf8')
  check('style.css ya no declara su @font-face (la portada no la baja)', !/font-family:\s*'Fredoka'/.test(css))
  const marco = readFileSync(`${RAIZ}/js/redes-marco.js`, 'utf8')
  check('el marco pide Outfit y Inter antes de dibujar', /fonts\?\.load\(`800 80px Outfit`\)/.test(marco) && /fonts\?\.load\(`600 30px Inter`\)/.test(marco))
  const hoja = readFileSync(`${RAIZ}/js/compartir-hoja.js`, 'utf8')
  check('la hoja de compartir espera al marco antes de pedir la imagen', /await prepararMarco\(\)\s*\n\s*if \(f === 'historia' && historiaPropia\)/.test(hoja))
  for (const f of ['reto-imagen.js', 'partida-imagen.js', 'vitrina-imagen.js', 'noticia-compartir.js']) {
    check(`${f} usa el marco común`, /from '\.\/redes-marco\.js'/.test(readFileSync(`${RAIZ}/js/${f}`, 'utf8')))
  }
  check('la noticia y la vitrina dibujan su propia historia de 1080×1920', /historiaPropia: true/.test(readFileSync(`${RAIZ}/js/noticia-compartir.js`, 'utf8')) && /historiaPropia: true/.test(readFileSync(`${RAIZ}/js/vitrina-imagen.js`, 'utf8')))
}

console.log('── Dibujadas en el navegador ──')
const b = await chromium.launch()
{
  const ctx = await contexto(b, false, null)
  const page = await ctx.newPage()
  const err = []; page.on('pageerror', (e) => err.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/noticias`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  const r = await page.evaluate(async () => {
    const marco = await import('/js/redes-marco.js')
    await marco.prepararMarco()
    const fuentes = { outfit: document.fonts.check('800 40px Outfit'), inter: document.fonts.check('600 30px Inter') }
    // Una «portada» sin red: un lienzo de colores.
    const portada = document.createElement('canvas'); portada.width = 1200; portada.height = 630
    const pc = portada.getContext('2d'); const g = pc.createLinearGradient(0, 0, 1200, 630); g.addColorStop(0, '#f6c445'); g.addColorStop(1, '#d64545'); pc.fillStyle = g; pc.fillRect(0, 0, 1200, 630)
    const carta = document.createElement('canvas'); carta.width = 245; carta.height = 342
    const cc = carta.getContext('2d'); cc.fillStyle = '#2fb47c'; cc.fillRect(0, 0, 245, 342)
    const { pintarNoticia } = await import('/js/noticia-compartir.js')
    const { pintarResultadoReto } = await import('/js/reto-imagen.js')
    const { pintarVitrina } = await import('/js/vitrina-imagen.js')
    const { pintarPartida } = await import('/js/partida-imagen.js')
    const out = {}
    const datos = { titulo: 'Llega *Ascended Heroes*: todo lo que sabemos de la nueva expansión', descripcion: 'Fecha, cartas destacadas y dónde reservarla en España.', portada, fecha: '2026-11-01T10:00:00Z' }
    for (const f of ['historia', 'larga', 'apaisada']) {
      const c = pintarNoticia(document.createElement('canvas'), { ...datos, formato: f })
      out[`noticia-${f}`] = { w: c.width, h: c.height, url: c.toDataURL('image/png') }
    }
    for (const f of ['historia', 'apaisada']) {
      const c = pintarResultadoReto(document.createElement('canvas'), { titulo: '¿Qué carta es?', cuenta: '4/5', tira: [true, true, false, true, true], racha: 6, enlace: 'pokedoc.es/retos', numero: 412, lema: 'Adivina la carta del día', formato: f })
      out[`reto-${f}`] = { w: c.width, h: c.height, url: c.toDataURL('image/png') }
    }
    const fotos = Array.from({ length: 6 }, (_, i) => ({ img: carta, nombre: `Carta ${i + 1}` }))
    for (const f of ['historia', 'larga', 'apaisada']) {
      const c = pintarVitrina(document.createElement('canvas'), { fotos, usuario: 'pingu', formato: f })
      out[`vitrina-${f}`] = { w: c.width, h: c.height, url: c.toDataURL('image/png') }
    }
    const c = pintarPartida(document.createElement('canvas'), { mio: { nombre: 'Dragapult ex', sprites: [] }, rival: { nombre: 'Gardevoir ex', sprites: [] }, resultado: 'win', formato: 'bo1', donde: 'Liga', fecha: '2026-10-23' }, 'historia')
    out['partida-historia'] = { w: c.width, h: c.height, url: c.toDataURL('image/png') }
    // Un píxel del borde derecho, donde no hay texto: el brillo del color de la sección
    // tiñe el fondo (verde en un reto, azul en una noticia, ámbar en la vitrina).
    const muestra = (url) => new Promise((res) => { const i = new Image(); i.onload = () => { const k = document.createElement('canvas'); k.width = i.width; k.height = i.height; const x = k.getContext('2d'); x.drawImage(i, 0, 0); res([...x.getImageData(i.width - 16, Math.round(i.height * 0.36), 1, 1).data].slice(0, 3)) }; i.src = url })
    for (const k of Object.keys(out)) out[k].tono = await muestra(out[k].url)
    // «*Ascended Heroes*: todo…»: los dos puntos van pegados a lo destacado.
    const k = document.createElement('canvas').getContext('2d')
    const lineas = marco.lineasDeTitulo(k, 'Llega *Ascended Heroes*: todo', { ancho: 5000, cuerpo: 80 })
    const pegados = lineas.flat().filter((p) => p.pegada).map((p) => p.p)
    return { fuentes, out, pegados }
  })
  check('Outfit e Inter cargadas antes de dibujar', r.fuentes.outfit && r.fuentes.inter, JSON.stringify(r.fuentes))
  const t = (k) => r.out[k]
  check('noticia: publicación 1080×1350', t('noticia-historia').w === 1080 && t('noticia-historia').h === 1350)
  check('noticia: Historia de verdad, 1080×1920', t('noticia-larga').w === 1080 && t('noticia-larga').h === 1920)
  check('noticia: apaisada 1200×630', t('noticia-apaisada').w === 1200 && t('noticia-apaisada').h === 630)
  check('vitrina: los tres tamaños', t('vitrina-historia').h === 1350 && t('vitrina-larga').h === 1920 && t('vitrina-apaisada').w === 1200)
  const [rr, rg, rb] = t('reto-historia').tono
  const [vr, vg, vb] = t('vitrina-historia').tono
  check('el reto lleva el verde de su sección en el brillo', rg > rr && rg > 60, JSON.stringify(t('reto-historia').tono))
  const [nr] = t('noticia-historia').tono
  check('la vitrina, el ámbar de Colección (más rojo que la noticia y el reto)', vr > nr + 15 && vr > rr + 15, JSON.stringify([t('vitrina-historia').tono, t('noticia-historia').tono]))
  check('la puntuación detrás de lo destacado va pegada («Heroes:», no «Heroes :»)', JSON.stringify(r.pegados) === '[":"]', JSON.stringify(r.pegados))
  check('sin errores al dibujar', !err.length, err.join(' | '))
  for (const [k, v] of Object.entries(r.out)) writeFileSync(`${SALIDA}/${k}.png`, Buffer.from(v.url.split(',')[1], 'base64'))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
