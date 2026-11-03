// Tanda 1204 — la franja del próximo evento en la portada, en una línea (PINGU:
// «ocupa más en vertical… solo dejaría el título… y las fechas… y los que van
// de PokeDoc, con sus avatares… y donde va el 7 de noviembre, el logo»; eligió
// «caras y 2 van» y la flecha redonda en el móvil). El logo en lugar del día,
// el nombre, y debajo la fecha corta con las caras y «N van». Lleva a la
// agenda; en el móvil el botón es una flecha y la franja no pasa de ~80 px.
import { chromium, contexto, BASE } from './fixtures-app.mjs'
import { fechaCorta } from '/home/user/pingu/js/eventos-puro.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── La fecha corta ──')
{
  const f = (...dias) => fechaCorta({ horario: dias.map((dia) => ({ dia })) })
  check('un día: «7 nov»', f('2026-11-07') === '7 nov', f('2026-11-07'))
  check('dos seguidos: «14 y 15 nov»', f('2026-11-14', '2026-11-15') === '14 y 15 nov')
  check('tres seguidos: «Del 13 al 15 nov»', f('2026-11-13', '2026-11-14', '2026-11-15') === 'Del 13 al 15 nov')
  check('entre dos meses: «30 nov – 1 dic»', f('2026-11-30', '2026-12-01') === '30 nov – 1 dic')
  check('sueltos: «7 y 14 nov»', f('2026-11-07', '2026-11-14') === '7 y 14 nov')
  check('sin horario, de `empieza`', fechaCorta({ empieza: new Date(2026, 10, 21, 10).toISOString() }) === '21 nov')
}

const b = await chromium.launch()
const dia = (n) => { const d = new Date(); d.setDate(d.getDate() + n); const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }
const sembrar = (ev) => (dias) => {
  window.__FAKE_EVENTOS__ = [{ ...JSON.parse(ev), horario: dias.map((d) => ({ dia: d, desde: '10:00', hasta: '20:00' })), empieza: new Date(dias[0] + 'T10:00').toISOString(), termina: new Date(dias.at(-1) + 'T20:00').toISOString() }]
}
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const EV = { id: 'e1', slug: 'castellon', nombre: 'CASTELLON CARD SHOW', tipo: 'card_show', ciudad: 'Oropesa del Mar', sitio: 'Carpa Multiusos', color: '#8a8a14', logo_url: 'https://logo.test/ccs.png', publicado: true, asistentes: [{ user_id: 'user-2' }, { user_id: 'mod-1' }] }

for (const [nombre, movil, ev] of [['PC', false, EV], ['móvil', true, EV], ['móvil, sin logo ni gente', true, { ...EV, logo_url: null, siglas: 'CCS', asistentes: [] }]]) {
  console.log(`── ${nombre} ──`)
  const ctx = await contexto(b, movil, 'user-1')
  await ctx.route(/logo\.test/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(PNG.split(',')[1], 'base64') }))
  await ctx.addInitScript(`(${sembrar.toString()})(${JSON.stringify(JSON.stringify(ev))})(${JSON.stringify([dia(4), dia(5)])})`)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#eventoPortada .portada-evento', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(600)
  const r = await page.$eval('#eventoPortada .portada-evento', (a) => {
    const vis = (el) => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0
    return {
      href: a.getAttribute('href'),
      alto: Math.round(a.getBoundingClientRect().height),
      nombre: a.querySelector('.pe-nombre')?.textContent,
      linea: a.querySelector('.pe-linea')?.textContent.replace(/\s+/g, ' ').trim(),
      caras: a.querySelectorAll('.pe-caras .pb-cara').length,
      logo: a.querySelector('.pe-logo img')?.getAttribute('src') || '',
      siglas: a.querySelector('.pe-logo b')?.textContent || '',
      largo: vis(a.querySelector('.pe-largo')),
      flecha: vis(a.querySelector('.pe-flecha svg')),
      textoViejo: /Card show|Oropesa|El sábado|Carpa/.test(a.textContent),
      dosLineas: (() => { const c = a.querySelector('.portada-torneo-cuerpo'); return c ? Math.round(c.getBoundingClientRect().height) : 0 })(),
    }
  })
  const fecha = `${Number(dia(4).slice(8))} y ${Number(dia(5).slice(8))}`
  check('lleva a la agenda (1202)', r.href === '/eventos', r.href)
  check('el nombre, y debajo solo la fecha corta y quién va', r.nombre === 'CASTELLON CARD SHOW' && !r.textoViejo && (dia(4).slice(5, 7) !== dia(5).slice(5, 7) || r.linea.startsWith(fecha)), JSON.stringify(r))
  if (ev.asistentes.length) {
    check('  …con sus caras y «2 van»', r.caras === 2 && /2 van$/.test(r.linea), r.linea)
    check('el logo en lugar del día', r.logo === 'https://logo.test/ccs.png' && !r.siglas)
  } else {
    check('  …sin nadie, «sé el primero» y sin caras', r.caras === 0 && /sé el primero$/.test(r.linea), r.linea)
    check('sin logo, su sigla', r.siglas === 'CCS' && !r.logo, r.siglas)
  }
  if (movil) {
    check('en el móvil, una flecha redonda (sin «Ver eventos»)', r.flecha && !r.largo)
    check('  …y la franja mide como mucho 80 px (antes ~150)', r.alto <= 80, r.alto)
  } else {
    check('en el PC, «Ver eventos» entero', r.largo && !r.flecha)
  }
  check('sin errores', !errores.length, errores.join(' | '))
  if (nombre !== 'móvil, sin logo ni gente') await page.locator('#eventoPortada').screenshot({ path: `/tmp/1204-${movil ? 'movil' : 'pc'}.png` })
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
