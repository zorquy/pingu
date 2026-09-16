import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
// ¿Qué imágenes NO tienen su hueco reservado?
//
// No se cuentan atributos: se mira si la caja está decidida antes de que
// llegue la foto. Vale cualquiera de las tres formas — alto fijo por
// CSS, `aspect-ratio`, o los atributos width+height, que el navegador
// convierte en proporción él solo—. Si no hay ninguna, la caja mide 0 de
// alto hasta que la imagen aterriza y todo lo de abajo pega un salto.
const b = await chromium.launch()
const PAGINAS = ['/index.html','/aprender','/foro','/usuarios','/torneos','/perfil','/mis-partidas','/noticias','/lanzamientos','/guia','/curso','/tema','/torneo','/usuario','/categoria','/buscar','/guardados','/mensajes','/editor-guia']
const malas = new Map()
let total = 0
for (const ruta of PAGINAS) {
  const p = await b.newPage({ viewport: { width: 1100, height: 900 } })
  await p.addInitScript(() => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_CATEGORIAS__ = [{ id:'cat-1', name:'Mazos', slug:'mazos' }]
    window.__FAKE_GUIAS__ = [{ id:'g1', slug:'g1', title:'Guía', description:'x', category_id:'cat-1', level:'beginner', estimated_mins:8, cover_image:'/no-existe.png' }]
    window.__FAKE_NOTICIAS__ = [{ id:'n1', slug:'n1', title:'Noticia', description:'x', cover_image:'/no-existe.png' }]
    window.__FAKE_TORNEOS__ = [{ id:'t1', slug:'copa', name:'Copa', status:'registration_open', admin_id:'admin-1', max_players:8, swiss_rounds:3, image_url:'/no-existe.png' }]
  })
  await p.goto(`http://localhost:8892${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2200)
  const r = await p.evaluate(() => {
    const out = []
    for (const n of document.querySelectorAll('img')) {
      const s = getComputedStyle(n)
      const conAtributos = n.getAttribute('width') && n.getAttribute('height')
      const conRatio = s.aspectRatio && s.aspectRatio !== 'auto'
      const conAlto = s.height !== 'auto' && !s.height.startsWith('0')
      // El padre también vale: una caja con alto fijo y `object-fit`
      // reserva el hueco aunque la imagen no diga nada.
      const padre = n.parentElement ? getComputedStyle(n.parentElement) : null
      const padreReserva = padre && ((padre.aspectRatio && padre.aspectRatio !== 'auto') || (padre.height !== 'auto' && !padre.height.startsWith('0')))
      const reservado = conAtributos || conRatio || conAlto || padreReserva
      out.push({ ok: !!reservado, q: (n.className || '').toString().split(' ')[0] || n.id || '(sin clase)', alto: s.height, ratio: s.aspectRatio })
    }
    return out
  })
  total += r.length
  for (const x of r) if (!x.ok) malas.set(x.q, `${x.q} (${ruta}) alto=${x.alto} ratio=${x.ratio}`)
  await p.close()
}
console.log(`${total} imágenes vistas — ${malas.size} clases sin el hueco reservado`)
for (const v of malas.values()) console.log('  ', v)
await b.close()
