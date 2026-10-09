// Tanda 789 — bloque 10 de «PokeDoc al detalle»: la comunidad. PA10 el tema
// del foro sin enlaces subrayados ni emojis, PA11 Gente con la vitrina y el
// buscador en pastilla (SI7), PA12 el perfil a dos columnas con su rango en
// barra y su banner propio, PA13 Mensajes en dos paneles.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')

console.log('── 1. Estático ──')
const tema = leer('js/tema.js')
check('PA10: las reacciones con iconos de la casa, sin emojis', /\['love', 'heart', 'me encanta'\]/.test(tema) && !/'👍'|'❤️'|'😂'|'😮'/.test(tema))
check('  …Editar, Borrar, la solución y Reportar, en un «⋯»', /<details class="foro-mas">/.test(tema) && !/class="link-btn" data-editar/.test(tema))
check('  …y sin «0» visitas', /\$\{tema\.view_count \? /.test(tema))
check('PA11: Gente con la vitrina de cada persona (una consulta)', /from\('user_showcase'\)[^\n]*\.in\('user_id', ids\)/.test(leer('js/gente-vitrinas.js')))
check('SI7: el buscador en pastilla, con su lupa y ganándole a input[type=text]', /\.search-input-wrap \.search-input \{[^}]*border-radius: var\(--radius-pill\)/.test(leer('css/components.css')) && /\.search-input-wrap::before \{/.test(leer('css/components.css')))
check('PA12: el perfil a dos columnas en el PC', /class="page-content container perfil-pagina"/.test(leer('usuario.html')) && /class="page-content container perfil-pagina"/.test(leer('perfil.html')))
check('  …con el rango en barra', /barraDeRango\(xp\)/.test(leer('js/usuario.js')) && /barraDeRango\(xp\)/.test(leer('js/perfil.js')))
check('  …y el banner sin foto de un color propio, no el rosa de todos', /bannerPorDefecto\(profile\)/.test(leer('js/usuario.js')) && !/'var\(--arte-rosa\)'/.test(leer('js/usuario.js')))
check('PA13: Mensajes en dos paneles en el PC', /id="msgLista"/.test(leer('mensajes.html')) && /css\/mensajes\.css/.test(leer('mensajes.html')))


console.log('── 3. En el navegador ──')
const b = await chromium.launch()
{
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } })
  await p.addInitScript(() => { window.__FAKE_SESSION__ = 'admin-1' })
  await p.goto(`${BASE}/usuarios.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2000)
  const r = await p.evaluate(() => {
    const i = document.getElementById('userSearchInput')
    const cs = getComputedStyle(i)
    return { radio: parseFloat(cs.borderTopLeftRadius), izq: parseFloat(cs.paddingLeft) }
  })
  check('SI7: el campo de Gente es una pastilla con sitio para la lupa', r.radio >= 20 && r.izq >= 40, JSON.stringify(r))
  await p.goto(`${BASE}/perfil.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  const g = await p.evaluate(() => {
    const m = document.querySelector('.perfil-pagina'), h = document.getElementById('profileHero')
    return { columnas: getComputedStyle(m).gridTemplateColumns.split(' ').length, pegada: getComputedStyle(h).position, barra: !!document.querySelector('.rango-barra') }
  })
  check('PA12: en el PC, dos columnas y la identidad pegada', g.columnas === 2 && g.pegada === 'sticky', JSON.stringify(g))
  check('  …y la barra del rango', g.barra, JSON.stringify(g))
  const rango = await p.evaluate(async () => (await import('/js/rango-barra.js')).barraDeRango(5))
  check('el rango: «5 de 250 XP para Entrenador»', /5 de 250 XP para Entrenador/.test(rango), rango)
  const ban = await p.evaluate(async () => { const { bannerPorDefecto } = await import('/js/app.js'); return [bannerPorDefecto({ id: 'u1' }), bannerPorDefecto({ id: 'u1' }), bannerPorDefecto({ id: 'otra' })] })
  check('el banner sin foto es el mismo siempre para la misma persona', ban[0] === ban[1] && /^var\(--arte-/.test(ban[0]), JSON.stringify(ban))
  await p.close()
}
await b.close()

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
