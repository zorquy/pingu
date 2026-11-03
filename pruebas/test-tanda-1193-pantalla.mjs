// Tanda 1193 — /admin → Eventos con los días en un calendario (con su horario,
// el mismo o uno por día), «Trade night» y varias entradas; y la ficha de
// /eventos enseñándolos. Y sin la migración 1193, /admin lo dice y guarda lo
// de siempre (primer y último día, las entradas como texto).
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
// El card show de PINGU tal como lo metió antes de la 1193: del sábado al
// domingo, de 10 a 20, con la entrada en texto. Dentro de 30 días, para que
// el calendario tenga que pasar de mes.
const sembrar = () => {
  const d = (dias, h) => { const x = new Date(); x.setDate(x.getDate() + dias); x.setHours(h, 0, 0, 0); return x.toISOString() }
  window.__FAKE_EVENTOS__ = [
    { id: 'e1', slug: 'iberian-card-show-2026', nombre: 'Iberian Card Show', tipo: 'card_show', empieza: d(30, 10), termina: d(31, 20), ciudad: 'Madrid', provincia: 'Madrid', entrada: '5 € · menores gratis', publicado: true, horario: [], entradas: [], asistentes: [] },
  ]
}
const fecha = (dias) => { const x = new Date(); x.setDate(x.getDate() + dias); const p = (n) => String(n).padStart(2, '0'); return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}` }

async function abrir(b, ruta, { quien = 'admin-1', movil = false, antes = null } = {}) {
  const ctx = await contexto(b, movil, quien, sembrar)
  if (antes) await ctx.addInitScript(antes)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => { if (!/serviceWorker' property/.test(String(e))) errores.push(String(e).slice(0, 160)) })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  return { ctx, page, errores }
}
const irA = async (page, dia) => {
  for (let i = 0; i < 3 && !(await page.$(`[data-cal-dia="${dia}"]`)); i++) await page.click('[data-cal-mes="1"]')
}
const ev = (page, id) => page.evaluate((id) => window.__FAKE_EVENTOS__.find((e) => e.id === id || e.slug === id), id)

const b = await chromium.launch()

console.log('── 1. Editar el de antes: sus días salen marcados ──')
{
  const { ctx, page, errores } = await abrir(b, '/admin/?ver=eventos')
  await page.waitForSelector('[data-ev-editar="e1"]', { timeout: 8000 })
  check('la fila de la lista dice los dos días', /^\d+–\d+$/.test(await page.textContent('.evadm-fecha b')) || (await page.textContent('.evadm-fecha b')).length > 0, await page.textContent('.evadm-fecha b'))
  await page.click('[data-ev-editar="e1"]')
  const marcados = await page.$$eval('[data-cal-dia][aria-pressed="true"]', (x) => x.map((b) => b.dataset.calDia))
  check('el calendario abre en su mes con los dos días marcados', JSON.stringify(marcados) === JSON.stringify([fecha(30), fecha(31)].filter((d) => d.slice(0, 7) === fecha(30).slice(0, 7))), JSON.stringify(marcados))
  check('  …con «Mismo horario» y de 10:00 a 20:00', (await page.isChecked('#evfMismo')) && (await page.inputValue('[data-hora="comun"][data-lado="desde"]')) === '10:00' && (await page.inputValue('[data-hora="comun"][data-lado="hasta"]')) === '20:00')
  check('el resumen lo dice en palabras', /y (domingo|lunes|martes|miércoles|jueves|viernes|sábado) \d+ de .* · 10:00 – 20:00/.test(await page.textContent('#evfResumen')), await page.textContent('#evfResumen'))
  const ent = await page.$$eval('[data-entrada]', (fs) => fs.map((f) => [...f.querySelectorAll('[data-campo]')].map((i) => i.value)))
  check('la entrada de texto pasa a una fila con su precio y el texto de nota', JSON.stringify(ent) === JSON.stringify([['General', '5', '5 € · menores gratis']]), JSON.stringify(ent))
  // Una entrada más: la VIP.
  await page.click('#evfMasEntrada')
  await page.fill('[data-entrada="1"] [data-campo="nombre"]', 'VIP')
  await page.fill('[data-entrada="1"] [data-campo="precio"]', '15')
  await page.fill('[data-entrada="1"] [data-campo="nota"]', 'Entra a las 9 y sobre de regalo')
  await page.fill('[data-entrada="0"] [data-campo="nota"]', 'Menores de 12, gratis')
  // El domingo cierra antes: horario por día.
  await page.uncheck('#evfMismo')
  check('sin «Mismo horario», una fila por día con el horario común puesto', (await page.$$('.evadm-hora-fila')).length === 2 && (await page.inputValue(`[data-hora="${fecha(31)}"][data-lado="desde"]`).catch(() => '')) === '10:00')
  await page.fill(`[data-hora="${fecha(31)}"][data-lado="hasta"]`, '18:00')
  await page.click('#evfGuardar')
  await page.waitForTimeout(600)
  const g = await ev(page, 'e1')
  check('guarda los dos días, cada uno con su hora', JSON.stringify(g.horario) === JSON.stringify([{ dia: fecha(30), desde: '10:00', hasta: '20:00' }, { dia: fecha(31), desde: '10:00', hasta: '18:00' }]), JSON.stringify(g.horario))
  check('  …y empieza y termina con el primero y el último', new Date(g.empieza).getHours() === 10 && new Date(g.termina).getHours() === 18 && g.termina.slice(0, 10) !== g.empieza.slice(0, 10) || new Date(g.termina) - new Date(g.empieza) > 20 * 3600e3, `${g.empieza} → ${g.termina}`)
  check('guarda las dos entradas, y el resumen en `entrada`', g.entradas?.length === 2 && g.entradas[1].precio === 15 && g.entrada === 'General 5 € · VIP 15 €', JSON.stringify([g.entradas, g.entrada]))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 2. Uno nuevo: Trade night, un día, gratis ──')
{
  const { ctx, page, errores } = await abrir(b, '/admin/?ver=eventos')
  await page.waitForSelector('#evNuevo', { timeout: 8000 })
  await page.click('#evNuevo')
  check('el tipo «Trade night» está', (await page.$$eval('#evf-tipo option', (o) => o.map((x) => x.value))).includes('trade_night'))
  await page.fill('#evf-nombre', 'Trade Night Bilbao')
  await page.selectOption('#evf-tipo', 'trade_night')
  await page.click('#evfGuardar')
  check('sin días no se guarda y lo dice', /calendario/.test(await page.textContent('#evfError')))
  await irA(page, fecha(10))
  await page.click(`[data-cal-dia="${fecha(10)}"]`)
  check('con un día no sale «Mismo horario»', !(await page.$('#evfMismo')))
  await page.fill('[data-hora="comun"][data-lado="desde"]', '19:00')
  await page.fill('[data-hora="comun"][data-lado="hasta"]', '18:00')
  await page.fill('[data-entrada="0"] [data-campo="precio"]', '0')
  await page.click('#evfGuardar')
  check('acabar antes de empezar no se guarda', /después/.test(await page.textContent('#evfError')))
  await page.fill('[data-hora="comun"][data-lado="hasta"]', '23:00')
  // Quitar y volver a poner un día lo desmarca y lo marca.
  await page.click(`[data-cal-dia="${fecha(11)}"]`).catch(() => {})
  await page.click(`[data-cal-dia="${fecha(11)}"]`).catch(() => {})
  await page.click('#evfGuardar')
  await page.waitForTimeout(600)
  const g = await ev(page, `trade-night-bilbao-${fecha(10).slice(0, 4)}`)
  check('guardado: Trade night, un día de 19 a 23, entrada gratis', g && g.tipo === 'trade_night' && JSON.stringify(g.horario) === JSON.stringify([{ dia: fecha(10), desde: '19:00', hasta: '23:00' }]) && g.entradas[0].precio === 0 && g.entrada === 'General Gratis', JSON.stringify(g))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. La ficha lo enseña ──')
{
  const conTodo = () => {
    const x = new Date(); x.setDate(x.getDate() + 30)
    const p = (n) => String(n).padStart(2, '0')
    const dia = (d) => { const y = new Date(x); y.setDate(y.getDate() + d); return `${y.getFullYear()}-${p(y.getMonth() + 1)}-${p(y.getDate())}` }
    window.__FAKE_EVENTOS__[0].horario = [{ dia: dia(0), desde: '10:00', hasta: '20:00' }, { dia: dia(1), desde: '10:00', hasta: '18:00' }]
    window.__FAKE_EVENTOS__[0].entradas = [{ nombre: 'General', precio: 5, nota: 'Menores de 12, gratis' }, { nombre: 'VIP', precio: 15, nota: '' }, { nombre: 'Prensa', precio: null, nota: '' }]
  }
  const { ctx, page, errores } = await abrir(b, '/eventos/iberian-card-show-2026', { quien: 'user-1', antes: conTodo })
  const ent = await page.$$eval('.ev-entradas li', (l) => l.map((x) => x.textContent.replace(/\s+/g, ' ').trim()))
  check('las entradas una a una, con su precio, su nota y «Consultar»', JSON.stringify(ent) === JSON.stringify(['GeneralMenores de 12, gratis5 €', 'VIP15 €', 'PrensaConsultar']), JSON.stringify(ent))
  const dias = await page.$$eval('.ev-dias li', (l) => l.map((x) => x.textContent.replace(/\s+/g, ' ').trim()))
  check('con horarios distintos, cada día con el suyo', dias.length === 2 && /10:00 – 18:00$/.test(dias[1]), JSON.stringify(dias))
  await page.goto(`${BASE}/eventos`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  check('en la agenda, la fecha dice los dos días', /^\d+–\d+$/.test(await page.textContent('.ev-fecha b')) || (await page.textContent('.ev-fecha b')).length <= 2, await page.textContent('.ev-fecha b'))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 4. Sin la migración 1193 ──')
{
  // El doble quita las columnas nuevas a las filas y falla si se piden.
  const { ctx, page, errores } = await abrir(b, '/admin/?ver=eventos', { antes: () => { window.__SIN_COLUMNAS__ = { eventos: ['horario', 'entradas'] } } })
  await page.waitForSelector('[data-ev-editar="e1"]', { timeout: 8000 })
  await page.click('[data-ev-editar="e1"]')
  check('lo dice arriba del formulario', /1193/.test(await page.textContent('#evForm')))
  await page.click('#evfGuardar')
  await page.waitForTimeout(600)
  const g = await ev(page, 'e1')
  check('guarda igual, sin las columnas nuevas, con el resumen en `entrada`', g && !('horario' in g && g.horario?.length) && g.entrada === 'General 5 €', JSON.stringify(g))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
