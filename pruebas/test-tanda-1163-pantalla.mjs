// Tanda 1163 — botones y cabeceras (T2, T3 y T4 de «PokeDoc entera»): una
// palabra por acción («Apuntarme», «Borrar»/«Quitar», «Filtros»), los botones
// de peligro sin borde rojo, la acción principal a la derecha del título en el
// PC (Mis partidas y Mensajes como Foro y Torneos, verbo + qué), y migas solo
// en las fichas (fuera del índice del foro y del constructor).
import { readFileSync } from 'node:fs'
import { chromium, contexto, BASE } from './fixtures-app.mjs'

const REPO = process.env.REPO || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const leer = (f) => readFileSync(`${REPO}/${f}`, 'utf8')

console.log('── T2: los botones hablan igual ──')
check('Colabora dice «Apuntarme», como los torneos', (leer('colabora.html').match(/>Apuntarme<\/button>/g) || []).length === 4 && !/Me apunto</.test(leer('colabora.html')))
for (const f of ['js/mensajes.js', 'js/perfil.js', 'js/guide-forum.js']) check(`${f}: «Borrar», no «Eliminar»`, !/>Eliminar</.test(leer(f)) && !/title="Eliminar"/.test(leer(f)))
check('Mis partidas: «Filtros», un sustantivo (abre una hoja)', (leer('mis-partidas.html').match(/class="cab-palabra">Filtros</g) || []).length === 2 && !/>Filtrar</.test(leer('mis-partidas.html')))
check('ningún botón de peligro lleva borde rojo', !/\.aj-borrar \{[^}]*border-color: var\(--danger\)/.test(leer('css/ajustes.css')) && /\.torneo-borrar \{[^}]*border: 1px solid transparent/.test(leer('css/torneos.css')) && /\.tema-borrar \{[^}]*border: 1px solid transparent/.test(leer('css/foro.css')))

console.log('── T3 y T4: en el navegador ──')
const b = await chromium.launch()
const abrir = async (ruta, movil = false) => {
  const ctx = await contexto(b, movil, 'user-1')
  const p = await ctx.newPage()
  if (!movil) await p.setViewportSize({ width: 1280, height: 800 })
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2000)
  return { p, ctx, errores }
}
{
  const { p, ctx, errores } = await abrir('/mis-partidas?ver=sueltas')
  check('Mis partidas sin errores', errores.length === 0, errores.join(' | '))
  const r = await p.evaluate(() => {
    const h1 = document.querySelector('h1').getBoundingClientRect()
    const b = document.getElementById('btnApuntarPartida')
    const bb = b.getBoundingClientRect()
    const f = document.getElementById('listaFiltrar')
    const barra = document.querySelector('#vista-sueltas .partidas-barra')
    return { dondeBoton: b.parentElement.id, aLaDerecha: bb.left > h1.right, mismaLinea: Math.abs(bb.top - h1.top) < 40, filtros: f.parentElement.id, palabra: f.querySelector('.cab-palabra').getBoundingClientRect().width > 10, barraAlto: Math.round(barra.getBoundingClientRect().height), barraMargen: getComputedStyle(barra).marginBottom }
  })
  check('el botón principal a la derecha del título, en su línea', r.dondeBoton === 'partidasAcciones' && r.aLaDerecha && r.mismaLinea, JSON.stringify(r))
  check('  …y «Filtros» con su palabra en la fila de las pestañas, sin una barra vacía que ocupe', r.filtros === 'partidasMandosExtra' && r.palabra && r.barraAlto === 0 && r.barraMargen === '0px', JSON.stringify(r))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/mensajes')
  const r = await p.evaluate(() => {
    const a = document.querySelector('.msg-lista-cabeza .msg-nueva')
    const h = document.querySelector('.msg-lista-cabeza h1, .msg-lista-cabeza h2')
    return { texto: a?.getAttribute('aria-label') || a?.textContent.trim(), corto: a?.textContent.trim(), principal: a?.classList.contains('btn-primary'), cabe: a && h && a.getBoundingClientRect().left >= h.getBoundingClientRect().right && a.getBoundingClientRect().right <= innerWidth, unaLinea: a && a.getBoundingClientRect().height < 48 }
  })
  // Desde la 1221 en el PC dice «Nueva» (la maqueta), con lo largo para el lector.
  check('Mensajes: «Nueva conversación», principal, al lado del título y en una línea', r.texto === 'Nueva conversación' && /^Nueva/.test(r.corto || '') && r.principal && r.cabe && r.unaLinea, JSON.stringify(r))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/foro')
  const r = await p.evaluate(() => ({ migas: getComputedStyle(document.getElementById('foroMigas')).display, migasTexto: document.getElementById('foroMigas').textContent.trim(), escribir: document.getElementById('foroEscribir')?.textContent.replace(/\s+/g, ' ').trim() }))
  check('el índice del foro no lleva migas (ni su hueco)', r.migas === 'none' && r.migasTexto === '', JSON.stringify(r))
  check('  …y el botón dice «Escribir un tema»', r.escribir === 'Escribir un tema', r.escribir)
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tema/tema-1')
  const r = await p.evaluate(() => ({ pasos: [...document.querySelectorAll('.foro-migas a, .foro-migas span[aria-current]')].map((x) => x.textContent.trim()) }))
  check('un tema sigue con la ruta entera', r.pasos[0] === 'Inicio' && r.pasos[1] === 'Foro' && r.pasos.length >= 4, JSON.stringify(r))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/constructor')
  check('el constructor no lleva migas', (await p.locator('.breadcrumb').count()) === 0)
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/torneos')
  check('Torneos: «Crear un torneo»', (await p.locator('#btnNuevoTorneo .torneos-crear-texto').textContent()).trim() === 'Crear un torneo')
  await ctx.close()
}
await b.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
