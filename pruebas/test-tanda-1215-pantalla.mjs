// Tanda 1215 — los huecos de la propuesta, página a página: «Tu próximo
// torneo» en la banda de Torneos, el orden de Aprender, las baldosas de «Ya en
// tiendas», el abanico de la cartera, las noticias viejas en filas, la cuenta
// de cada semana en Novedades, «por aquí hoy» en Gente y el puesto en Retos.
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const b = await chromium.launch()
const abrir = async (ruta, { movil = false, antes = null } = {}) => {
  const ctx = await contexto(b, movil, 'user-1')
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  if (antes) await p.addInitScript(antes)
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  return { ctx, p, errores }
}

console.log('── 1. Torneos: tu próximo torneo en la banda ──')
for (const movil of [false, true]) {
  const { ctx, p, errores } = await abrir('/torneos', { movil })
  const r = await p.evaluate(() => {
    const t = document.getElementById('torneosProximo')
    const caja = t?.getBoundingClientRect()
    return {
      visible: Boolean(t && !t.hidden && caja.height > 0),
      ceja: t?.querySelector('.t-proximo-ceja')?.textContent || '',
      nombre: t?.querySelector('.t-proximo-nombre')?.textContent || '',
      botones: [...(t?.querySelectorAll('.t-proximo-botones a') || [])].map((a) => [a.textContent.trim(), a.getAttribute('href')]),
      lemaEscondido: getComputedStyle(document.querySelector('.torneos-heroe .banda-s-lema') || document.body).display === 'none' || !document.querySelector('.torneos-heroe .banda-s-lema'),
    }
  })
  check(`${movil ? 'móvil' : 'PC'}: la banda dice «Tu próximo torneo · en N días» y su nombre`, r.visible && /Tu próximo torneo · en \d+ días?/.test(r.ceja) && r.nombre.length > 2, JSON.stringify(r))
  check('  …con «Tu lista» (a jugar) y «Ver el torneo»', r.botones.length === 2 && /ver=jugar/.test(r.botones[0][1]) && /^\/torneo\?slug=/.test(r.botones[1][1]), JSON.stringify(r.botones))
  if (!movil) check('  …y el lema deja su sitio', r.lemaEscondido, JSON.stringify(r))
  check('  …sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 2. Aprender: el orden y las baldosas con su color ──')
{
  const { ctx, p, errores } = await abrir('/aprender')
  const chips = p.locator('.ap-orden button')
  check('tres órdenes (recientes, útiles, cortas)', (await chips.count()) === 3, await chips.allTextContents())
  const antes = await p.locator('.ap-rejilla .guia-tarjeta h3, .ap-rejilla .guia-tarjeta .guia-titulo').allTextContents()
  await chips.nth(2).click()
  await p.waitForTimeout(500)
  const pulsado = await chips.nth(2).getAttribute('aria-pressed')
  check('  …el pulsado queda marcado', pulsado === 'true', pulsado)
  const despues = await p.locator('.ap-rejilla .guia-tarjeta h3, .ap-rejilla .guia-tarjeta .guia-titulo').allTextContents()
  check('  …y la rejilla se reordena con las mismas guías', despues.length === antes.length && [...despues].sort().join() === [...antes].sort().join(), JSON.stringify({ antes, despues }))
  const tintes = await p.$$eval('[class*="ap-baldosa-"]', (xs) => xs.length)
  check('las baldosas llevan su color', tintes > 0, tintes)
  check('  …sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
  const m = await abrir('/aprender', { movil: true })
  check('en el móvil el orden no ocupa otra fila', !(await m.p.locator('.ap-orden').isVisible()))
  await m.ctx.close()
}

console.log('── 3. Lanzamientos: «Ya en tiendas» en baldosas en el PC ──')
{
  const { ctx, p, errores } = await abrir('/lanzamientos')
  const r = await p.evaluate(() => {
    const filas = [...document.querySelectorAll('.lanz-fila')]
    return { n: filas.length, grid: filas.filter((f) => getComputedStyle(f).display === 'grid').length, iconos: document.querySelectorAll('.cab-bloque-ico svg').length }
  })
  check('las filas son baldosas (rejilla)', r.n === 0 || r.grid > 0, JSON.stringify(r))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 4. Noticias: lo de antes de esta semana, en filas ──')
{
  const { ctx, p, errores } = await abrir('/noticias')
  const r = await p.evaluate(() => {
    const out = []
    let grupo = null
    for (const n of document.querySelectorAll('.noticias-rejilla > *')) {
      if (n.matches('.noticias-grupo')) grupo = n.dataset.grupo
      else if (n.matches('.noticia-tarjeta')) out.push([grupo, n.classList.contains('noticia-fila')])
    }
    return out
  })
  const viejas = r.filter(([g]) => g && g !== 's0')
  check('las noticias de antes de esta semana son filas', viejas.length > 0 && viejas.every(([, f]) => f), JSON.stringify(r))
  check('  …y las de esta semana, tarjetas', r.filter(([g]) => g === 's0').every(([, f]) => !f), JSON.stringify(r))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 5. Novedades: la cuenta de cada semana ──')
{
  const { ctx, p, errores } = await abrir('/novedades')
  const r = await p.evaluate(() => {
    const s = document.querySelector('.nv-semana')
    const cuentas = [...(s?.querySelectorAll('.nv-cuenta') || [])].map((x) => x.textContent)
    const porTipo = (t) => s?.querySelectorAll(`.nv-fila[data-tipo="${t}"], .nv-fila .nv-tipo-${t}`).length
    return { cuentas, filas: s?.querySelectorAll('.nv-fila').length || 0, porTipo: { nuevo: porTipo('nuevo'), mejora: porTipo('mejora'), arreglo: porTipo('arreglo') } }
  })
  check('la semana dice cuántas nuevas, mejoras y arreglos', r.cuentas.length > 0 && r.cuentas.every((c) => /^\d+ (nueva|nuevas|mejora|mejoras|arreglo|arreglos)$/.test(c)), JSON.stringify(r))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
  const m = await abrir('/novedades', { movil: true })
  const tops = await m.p.$$eval('.nv-banda .banda-s-cifra', (xs) => xs.map((x) => Math.round(x.getBoundingClientRect().top)))
  check('en el móvil las tres cifras van en una fila', tops.length === 3 && new Set(tops).size === 1, tops.join())
  await m.ctx.close()
}

console.log('── 6. Gente: «por aquí hoy» es una cifra de la banda (1216) ──')
{
  const { ctx, p, errores } = await abrir('/usuarios')
  await p.waitForTimeout(800)
  const r = await p.evaluate(() => ({ hoy: document.getElementById('cifraHoy')?.textContent || '', rotulo: document.getElementById('cifraHoy')?.nextElementSibling?.textContent || '', caja: document.querySelector('#comHoy h3')?.textContent || '', cifras: document.querySelectorAll('.com-cifra').length }))
  check('la cifra dice cuántos andan por aquí hoy', /^\d+$/.test(r.hoy) && /por aquí hoy/.test(r.rotulo) && r.cifras === 4, JSON.stringify(r))
  check('  …con la misma cuenta que la caja de la derecha', r.caja.endsWith(`· ${r.hoy}`), JSON.stringify(r))
  const anima = await p.$eval('.com-cifra-hoy .gente-hoy', (x) => getComputedStyle(x).animationName)
  check('  …y su punto late', anima === 'seccion-late', anima)
  const frases = await p.$$eval('.com-persona-hizo', (xs) => xs.map((x) => x.textContent.trim()))
  check('cada tarjeta dice lo que hace esa persona, en una frase', frases.length > 3 && frases.every((f) => /^(Tiene \d+ cartas? que buscas|Ha escrito (una guía|\d+ guías)|Lleva \d+ días seguidos|\d+ mensajes? en el foro|Hoy por aquí|Acaba de llegar)$/.test(f)), JSON.stringify(frases))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 7. Retos: tu puesto en la liga, arriba ──')
for (const movil of [false, true]) {
  const { ctx, p, errores } = await abrir('/retos', { movil, antes: () => { window.__FAKE_CLASIFICACION__ = { ranking: [{ puesto: 1, xp: 300, display_name: 'Misty' }], tu: { puesto: 4, xp: 120 } } } })
  const t = await p.locator('#rtPuesto').textContent().catch(() => '')
  check(`${movil ? 'móvil' : 'PC'}: la píldora dice «Nº 4»`, /Nº 4/.test(t || ''), t)
  check('  …sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, p } = await abrir('/retos', { antes: () => { window.__FAKE_CLASIFICACION__ = { ranking: [], tu: null } } })
  check('sin puesto, la píldora no se lo inventa', (await p.locator('#rtPuesto').count()) === 0)
  await ctx.close()
}

console.log('── 8. Panel: las tres que más valen junto a la cifra ──')
{
  const { ctx, p, errores } = await abrir('/mi-coleccion')
  const r = await p.evaluate(() => {
    const a = document.querySelector('.mc-cartera-abanico')
    return { hay: Boolean(a), fotos: a?.querySelectorAll('img').length || 0 }
  })
  check('el abanico está y lleva fotos', r.hay && r.fotos > 0 && r.fotos <= 3, JSON.stringify(r))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n${fails} rojos` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
