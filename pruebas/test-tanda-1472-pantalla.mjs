// Tanda 1472 — Arena limpia: la lista de /torneos (PINGU: «me gusta, adelante
// con todo»): tres pestañas del mismo ancho, una fila por torneo con su imagen
// cuadrada y su banner, el destacado arriba, por meses, y en el móvil la fila
// entera es el botón.
import { chromium, contexto, BASE } from './fixtures-app.mjs'
import { datosArena, sembrarArena } from './fixture-arena.mjs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'

let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── Lo puro ──')
{
  const { inicialesDe, porMeses, elegirDestacado, filaArenaHtml } = await import(`${REPO}/js/torneos/arena-lista.js`)
  check('iniciales sin las palabras vacías: «Sábado en Madrid» → SM, «Liga FDN [Oct-Dic]» → LF', inicialesDe('Sábado en Madrid') === 'SM' && inicialesDe('Liga FDN [Oct-Dic]') === 'LF')
  const g = porMeses([{ start_at: '2026-12-06T10:00:00Z' }, { start_at: '2026-11-27T10:00:00Z' }, { start_at: '2026-11-28T10:00:00Z' }], { ahora: new Date('2026-11-26') })
  check('por meses, del primero al último: Noviembre (2), Diciembre (1)', g.map((x) => `${x.texto}:${x.torneos.length}`).join(',') === 'Noviembre:2,Diciembre:1', g.map((x) => x.texto).join(','))
  const r = porMeses([{ start_at: '2025-11-01T10:00:00Z' }, { start_at: '2026-10-01T10:00:00Z' }], { recientes: true, ahora: new Date('2026-11-26') })
  check('los terminados, del último al primero, y el año si no es este', r.map((x) => x.texto).join(',') === 'Octubre,Noviembre 2025', r.map((x) => x.texto).join(','))
  const a = { id: 'a', status: 'registration_open' }, o = { id: 'o', status: 'registration_open' }, c = { id: 'c', status: 'registration_open', banner_url: '/x.jpg' }
  check('el destacado: el tuyo antes que el oficial', elegirDestacado([o, a], { mio: (t) => t === a, oficial: (t) => t === o })?.t === a)
  check('…sin tuyo, el oficial; sin oficial, el primero con banner; si no, ninguno', elegirDestacado([c, o], { oficial: (t) => t === o })?.t === o && elegirDestacado([a, c])?.t === c && elegirDestacado([a]) === null)
  const f = filaArenaHtml({ id: 't', slug: 't', name: 'Sábado en Madrid', status: 'registration_open', start_at: '2026-12-08T10:00:00Z', modalidad: 'presencial', max_players: 24 }, { ocupadas: 8 })
  check('sin imagen, las iniciales en su color; sin banner, el velo', /class="tf-avatar sin-imagen" data-tipo-torneo="persona"[^>]*>SM</.test(f) && /tf-banner sin-banner/.test(f))
  check('las plazas: «8/24» y «quedan 16»', /8\/24/.test(f) && /quedan 16/.test(f))
}

// Con imagen y banner en dos (salen de /fotos, que la copia de pruebas trae).
function datos() {
  const d = datosArena()
  const bil = d.torneos.find((t) => t.id === 't-bilbao')
  bil.image_url = '/fotos/carta1.svg'
  bil.banner_url = '/fotos/foto1.svg'
  d.torneos.find((t) => t.id === 't-copa').banner_url = '/fotos/foto2.svg'
  return d
}
const b = await chromium.launch()
async function abrir({ movil = false, ruta = '/torneos' } = {}) {
  const ctx = await contexto(b, movil, 'user-1')
  await ctx.addInitScript(sembrarArena, datos())
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.tf', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1200)
  await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()))
  return { ctx, page, errores }
}

console.log('── PC ──')
{
  const { ctx, page, errores } = await abrir()
  const r = await page.evaluate(() => ({
    pestanas: [...document.querySelectorAll('.tseg-btn')].map((p) => ({ t: p.textContent.replace(/\s+/g, ' ').trim(), w: Math.round(p.getBoundingClientRect().width), on: p.classList.contains('activa') })),
    banda: Boolean(document.querySelector('.banda-s-cifras, #torneosTemporada, .t-carteles, .t-campeon')),
    destacado: document.querySelector('.tdest .tdest-nombre')?.textContent.trim(),
    meses: [...document.querySelectorAll('.torneos-tramo-cab')].map((h) => h.firstChild?.textContent.trim()),
    bilbao: (() => {
      const f = document.querySelector('.tf[data-torneo-id="t-bilbao"]')
      return f && { img: f.querySelector('.tf-avatar img')?.getAttribute('src'), banner: f.querySelector('.tf-banner')?.style.backgroundImage, tipo: f.dataset.tipoTorneo, caras: f.querySelectorAll('.tf-caras .torneo-cara').length, plazas: f.querySelector('.tf-plazas')?.textContent.replace(/\s+/g, ' ').trim(), boton: f.querySelector('.tf-der .torneo-pie-accion')?.textContent.trim() }
    })(),
    madrid: document.querySelector('.tf[data-torneo-id="t-madrid"] .tf-avatar')?.textContent.trim(),
    alturas: [...document.querySelectorAll('.tf')].map((f) => Math.round(f.getBoundingClientRect().height)),
  }))
  check('tres pestañas: Próximos, En juego, Terminados', r.pestanas.map((p) => p.t.replace(/\s*\d+$/, '')).join('|') === 'Próximos|En juego|Terminados', r.pestanas.map((p) => p.t).join('|'))
  check('…del mismo ancho, y Próximos abierta', Math.max(...r.pestanas.map((p) => p.w)) - Math.min(...r.pestanas.map((p) => p.w)) <= 2 && r.pestanas[0].on, r.pestanas.map((p) => p.w).join(','))
  check('fuera la banda, la temporada, los carteles y los campeones dorados', !r.banda)
  check('el destacado es la Copa (oficial, sin nada tuyo abierto)', r.destacado === 'Copa PokeDoc de Diciembre', r.destacado)
  check('por meses', r.meses.length >= 1 && r.meses.every((m) => /^[A-ZÁÉÍÓÚ][a-záéíóú]+( \d{4})?$/.test(m)), r.meses.join(','))
  check('Cartas Bilbao: su imagen cuadrada y su banner', r.bilbao?.img === '/fotos/carta1.svg' && /foto1\.svg/.test(r.bilbao?.banner || ''), JSON.stringify(r.bilbao))
  check('…en verde (en persona), con las caras de quien va y «10/16 quedan 6»', r.bilbao?.tipo === 'persona' && r.bilbao?.caras === 3 && /10\/16/.test(r.bilbao?.plazas) && /quedan 6/.test(r.bilbao?.plazas), JSON.stringify(r.bilbao))
  check('…y «Pedir plaza»', r.bilbao?.boton === 'Pedir plaza', r.bilbao?.boton)
  check('Sábado en Madrid, sin imagen: «SM»', r.madrid === 'SM', r.madrid)
  check('todas las filas, del mismo alto', r.alturas.length >= 3 && Math.max(...r.alturas) - Math.min(...r.alturas) <= 4, r.alturas.join(','))
  await page.click('[data-vista-lista="hechos"]')
  await page.waitForTimeout(800)
  const h = await page.evaluate(() => ({
    hash: location.hash,
    filas: [...document.querySelectorAll('.tf')].map((f) => ({ n: f.querySelector('.torneo-nombre')?.textContent.trim(), campeon: f.querySelector('.tf-campeon b')?.textContent.trim(), tu: f.querySelector('.tf-chapa.tuya, .tf-chapa.oro')?.textContent.trim() })),
  }))
  check('Terminados: #terminados y cada fila con su campeón', h.hash === '#terminados' && h.filas.length === 3 && h.filas.every((f) => f.campeon), JSON.stringify(h))
  check('…y tu puesto: «Quedaste 3.º» en el Tardeo', h.filas.find((f) => /Tardeo/.test(f.n))?.tu === 'Quedaste 3.º', JSON.stringify(h.filas))
  await page.click('[data-vista-lista="vivo"]')
  await page.waitForTimeout(600)
  const v = await page.evaluate(() => document.getElementById('torneosAgenda')?.textContent.replace(/\s+/g, ' ').trim())
  check('En juego sin nada en juego: lo dice y cuál es el siguiente', /no se juega ningún torneo/.test(v) && /El siguiente/.test(v), v)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── Móvil ──')
{
  const { ctx, page, errores } = await abrir({ movil: true })
  const r = await page.evaluate(() => {
    const f = document.querySelector('.tf[data-torneo-id="t-madrid"]')
    return {
      ancho: document.documentElement.scrollWidth - innerWidth,
      fecha: f ? getComputedStyle(f.querySelector('.tf-fecha')).display : 'no',
      cuando: f?.querySelector('.tf-sub-cuando')?.textContent.trim(),
      boton: f ? [...f.querySelectorAll('.tf-der .torneo-pie-accion')].filter((a) => a.getClientRects().length).length : -1,
      pestanas: [...document.querySelectorAll('.tseg-btn')].map((p) => Math.round(p.getBoundingClientRect().width)),
    }
  })
  check('no ensancha la página', r.ancho <= 0, r.ancho)
  check('la losa de la fecha se va y el cuándo abre la línea de abajo', r.fecha === 'none' && /^[a-zé]{3} \d+ · \d\d:\d\d$/.test(r.cuando || ''), JSON.stringify(r))
  check('la fila entera es el botón (sin «Pedir plaza» suelto)', r.boton === 0, r.boton)
  check('las tres pestañas, iguales también aquí', Math.max(...r.pestanas) - Math.min(...r.pestanas) <= 2, r.pestanas.join(','))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ todo bien')
process.exit(fails ? 1 : 0)
