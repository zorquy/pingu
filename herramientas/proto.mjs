import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
const modo = process.argv[2]           // 'antes' | 'despues'
const solo = process.argv[3] || ''
const dir = modo === 'antes' ? 'prop-antes' : 'prop-despues'

const sembrar = () => {
  window.__FAKE_SESSION__ = 'user-1'
  window.__FAKE_CATEGORIAS__ = [{ id:'cat-1', name:'Empezar', slug:'empezar' }, { id:'cat-2', name:'Mazos', slug:'mazos' }, { id:'cat-3', name:'Torneos', slug:'torneos' }]
  window.__FAKE_GUIAS__ = [
    { id:'g1', slug:'g1', title:'Cómo montar tu primer mazo competitivo', description:'De las 60 cartas a una lista que aguanta una tarde de torneo.', category_id:'cat-2', level:'beginner', estimated_mins:8, guide_rarity:'bronze' },
    { id:'g2', slug:'g2', title:'Las reglas que todo el mundo se salta', description:'Premios, retiradas, estado especial: lo que más se juzga mal.', category_id:'cat-1', level:'intermediate', estimated_mins:5, guide_rarity:'silver' },
    { id:'g3', slug:'g3', title:'Tu primer torneo, paso a paso', description:'Qué llevar, cómo se apunta el resultado y qué pasa si pierdes.', category_id:'cat-3', level:'beginner', estimated_mins:12, guide_rarity:'gold' },
  ]
  window.__FAKE_NOTICIAS__ = [1,2,3,4,5,6].map((i)=>({ id:`n${i}`, slug:`n${i}`, title:`Mercari y Pokémon van a por los revendedores ${i}`, description:'La entradilla de la noticia, que ocupa un par de renglones largos.' }))
  window.__FAKE_TORNEOS__ = [{ id:'t1', slug:'copa', name:'Copa PokeDoc de Otoño', status:'registration_open', admin_id:'admin-1', max_players:16, swiss_rounds:4, description:'Ven a jugar.' }]
  window.__FAKE_INSCRIPCIONES__ = [{id:'i1',tournament_id:'t1',user_id:'user-2',status:'active'}]
}

// ─────────────────────────────────────────────────────────────────────
// A. La franja de color de la tarjeta de guía, aprovechada.
const A_CSS = `
.guia-arte { position: relative; }
.guia-arte-info {
  position: absolute; inset: 0; display: flex; align-items: flex-start;
  justify-content: space-between; padding: 12px; gap: 8px; pointer-events: none;
}
.guia-arte-info .der { display: flex; gap: 8px; }
.guia-chapa-clara, .guia-chapa-oscura {
  display: inline-flex; align-items: center; gap: 4px;
  border-radius: 999px; padding: 4px 12px;
  font-size: 12px; font-weight: 700; white-space: nowrap;
}
.guia-chapa-clara { background: rgba(255,255,255,0.94); color: #0d1b2a; }
.guia-chapa-oscura { background: rgba(13,27,42,0.46); color: #fff; }
/* Las etiquetas de abajo se van arriba: dejan de competir con el resumen. */
.guia-etiquetas { display: none !important; }
.guia-progreso {
  display: flex !important; align-items: center; justify-content: flex-start; gap: 12px;
  border-top: 1px solid var(--border); padding-top: 12px; margin-top: 4px;
}
.guia-progreso-texto { flex: 0 0 auto; width: auto !important; font-size: 12px; font-weight: 700; color: #52717f; white-space: nowrap; text-align: left; }
.guia-progreso::after {
  content: ''; flex: 1; height: 4px; border-radius: 999px; background: #e3eef2;
}
`
const A_JS = () => {
  const CATS = ['Mazos', 'Empezar', 'Torneos']
  const NIV = ['Principiante', 'Intermedio', 'Principiante']
  const MIN = ['8 min', '5 min', '12 min']
  document.querySelectorAll('.guia-tarjeta').forEach((t, i) => {
    const arte = t.querySelector('.guia-arte')
    if (!arte || arte.querySelector('.guia-arte-info')) return
    const d = document.createElement('span')
    d.className = 'guia-arte-info'
    d.innerHTML = `<span class="guia-chapa-clara">${CATS[i % 3]}</span>` +
      `<span class="der"><span class="guia-chapa-oscura">${MIN[i % 3]}</span></span>`
    arte.appendChild(d)
  })
}

// ─────────────────────────────────────────────────────────────────────
// B. Un pie de página de verdad.
const B_CSS = `
.footer { text-align: left !important; padding: 0 !important; margin-top: 48px !important; background: var(--white); }
.pie-rejilla {
  max-width: 1080px; margin: 0 auto; padding: 40px 24px 24px;
  display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr; gap: 32px;
}
.pie-marca { font-family: var(--font-display); font-size: 20px; font-weight: 800; color: var(--text); margin: 0 0 8px; }
.pie-marca span { color: var(--navy); }
.pie-lema { font-size: 13px; color: var(--text-mid); margin: 0; max-width: 240px; line-height: 1.5; }
.pie-col h4 { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: var(--text-mid); margin: 0 0 12px; }
.pie-col a { display: block; font-size: 14px; color: var(--text); text-decoration: none; padding: 4px 0; }
.pie-col a:hover { color: var(--navy); }
.pie-raya { border-top: 1px solid var(--border); }
.pie-abajo {
  max-width: 1080px; margin: 0 auto; padding: 16px 24px 24px;
  display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap;
  font-size: 13px; color: var(--text-mid);
}
.pie-abajo a { color: var(--text-mid); }
@media (max-width: 720px) { .pie-rejilla { grid-template-columns: 1fr 1fr; } }
`
const B_JS = () => {
  const f = document.querySelector('footer.footer')
  if (!f) return
  f.innerHTML = `
    <div class="pie-rejilla">
      <div>
        <p class="pie-marca">Poke<span>Doc</span></p>
        <p class="pie-lema">La comunidad española de Pokémon TCG. Guías, cursos, foro y torneos. Todo gratis.</p>
      </div>
      <div class="pie-col"><h4>Aprender</h4><a href="/aprender">Guías y cursos</a><a href="/guardados">Guardados</a><a href="/noticias">Noticias</a><a href="/lanzamientos">Lanzamientos</a></div>
      <div class="pie-col"><h4>Comunidad</h4><a href="/foro">Foro</a><a href="/usuarios">Gente</a><a href="/usuarios">Peticiones</a></div>
      <div class="pie-col"><h4>Jugar</h4><a href="/torneos">Torneos</a><a href="/mis-partidas">Mis partidas</a><a href="/reto">Reto de hoy</a></div>
    </div>
    <div class="pie-raya"></div>
    <div class="pie-abajo">
      <span>© 2026 PokeDoc — Hecho para coleccionistas y jugadores.</span>
      <span><a href="/sobre.html">Qué es PokeDoc</a> · <a href="/terminos.html">Términos</a> · <a href="/privacidad.html">Privacidad</a> · <a href="#">Escríbenos</a></span>
    </div>`
}

// ─────────────────────────────────────────────────────────────────────
// C. «Lo que acaba de pasar»: fuera la repetición.
const C_CSS = `
.act-tipo {
  display: inline-block; font-size: 11px; font-weight: 800; letter-spacing: .06em;
  text-transform: uppercase; color: var(--navy); background: var(--ice);
  border-radius: 999px; padding: 2px 8px; margin-bottom: 4px;
}
`
const C_JS = () => {
  document.querySelectorAll('.activity-item, .com-act-fila, .foro-act-fila').forEach((fila) => {
    const iconos = fila.querySelectorAll('svg')
    if (iconos.length > 1) iconos[iconos.length - 1].closest('span,div,i')?.remove()
    const fuerte = fila.querySelector('strong')
    if (fuerte && /:$/.test(fuerte.textContent.trim())) {
      const chip = document.createElement('span')
      chip.className = 'act-tipo'
      chip.textContent = fuerte.textContent.replace(/:$/, '').replace(/^Nueva /, '')
      fuerte.replaceWith(chip)
      chip.insertAdjacentHTML('afterend', '<br>')
    }
  })
}

// ─────────────────────────────────────────────────────────────────────
// D. La portada que falta en una noticia.
const D_CSS = `
.noticia-sin-portada {
  background: linear-gradient(135deg, #16405e 0%, #2a7fb5 55%, #3fa3c9 100%) !important;
  position: relative; overflow: hidden; opacity: 1 !important;
}
.noticia-sin-portada::after {
  content: ''; position: absolute; inset: 0;
  background-image: radial-gradient(rgba(255,255,255,.14) 1px, transparent 1px);
  background-size: 14px 14px;
}
.noticia-sin-portada svg {
  width: 52px !important; height: 52px !important; color: rgba(255,255,255,0.7) !important;
  stroke: rgba(255,255,255,0.7) !important; position: relative; z-index: 1; opacity: 1 !important;
}
.noticia-sello {
  position: absolute; left: 16px; bottom: 16px; color: #fff;
  font-family: var(--font-display); font-size: 17px; font-weight: 800;
  letter-spacing: .01em; z-index: 1; text-shadow: 0 1px 3px rgba(0,0,0,.25);
}
`
const D_JS = () => {
  document.querySelectorAll('.noticia-tarjeta, .noticia-destacada').forEach((t) => {
    const hueco = t.querySelector('svg')?.closest('div, span, a')
    if (hueco && !hueco.querySelector('img') && !hueco.querySelector('.noticia-sello')) {
      hueco.classList.add('noticia-sin-portada')
      hueco.insertAdjacentHTML('beforeend', '<span class="noticia-sello">PokeDoc</span>')
    }
  })
}

// ─────────────────────────────────────────────────────────────────────
// E. Los contadores de /comunidad, compactos.
const E_CSS = `
.com-cifras {
  display: flex !important; gap: 0 !important;
  background: var(--white); border: 1px solid var(--border);
  border-radius: var(--radius-lg); overflow: hidden;
}
.com-cifra {
  flex: 1; border: 0 !important; border-radius: 0 !important;
  border-right: 1px solid var(--border) !important;
  padding: 16px !important; margin: 0 !important; box-shadow: none !important;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
}
.com-cifra:last-child { border-right: 0 !important; }
.com-cifra b { font-size: 26px; line-height: 1.1; }
.com-cifra span { font-size: 12px; color: var(--text-mid); text-align: center; }
`

// ─────────────────────────────────────────────────────────────────────
// F. La barra de arriba en el móvil: objetivos de 44 px.
const F_CSS = `
/* Solo el TAMAÑO. Nada de tocar el display: forzar inline-flex aquí
   destapaba la chapa de racha, que en el móvil va escondida a propósito
   — y la comparación pasaba a comparar dos barras distintas. */
.nav-right button, .nav-right > a, .nav-toggle, .nav-user-avatar {
  min-width: 44px !important; min-height: 44px !important;
}
.nav-right { gap: 0 !important; }
.nav-logo { min-height: 44px; }
`

const RECETAS = {
  'guias':     { ruta:'/aprender',  css:A_CSS, js:A_JS, ancho:1100, alto:700, recorte:'.guia-rejilla, .guias-grid, main' },
  'pie':       { ruta:'/torneos',   css:B_CSS, js:B_JS, ancho:1100, alto:1000, recorte:'footer.footer' },
  'actividad': { ruta:'/usuarios',  css:C_CSS, js:C_JS, ancho:1100, alto:1000, recorte:'.com-lateral, aside' },
  'noticias':  { ruta:'/noticias',  css:D_CSS, js:D_JS, ancho:1100, alto:1000, recorte:'.noticias-rejilla, main' },
  'contadores':{ ruta:'/usuarios',  css:E_CSS, js:null, ancho:1100, alto:420, recorte:'.com-cifras' },
  'movil':     { ruta:'/index.html', css:F_CSS, js:null, ancho:393, alto:190, recorte:'.navbar, nav, header' },
}

const b = await chromium.launch()
for (const [etiq, r] of Object.entries(RECETAS)) {
  if (solo && solo !== etiq) continue
  const p = await b.newPage({ viewport: { width: r.ancho, height: r.alto } })
  await p.addInitScript(() => { localStorage.setItem('pokedoc-theme', 'light') })
  await p.addInitScript(sembrar)
  await p.goto(`http://localhost:8892${r.ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2600)
  if (modo === 'despues') {
    if (r.css) await p.addStyleTag({ content: r.css })
    if (r.js) await p.evaluate(r.js)
    await p.waitForTimeout(500)
  }
  await p.waitForTimeout(400)
  let hecho = false
  if (r.recorte) {
    for (const sel of r.recorte.split(',').map((s) => s.trim())) {
      const loc = p.locator(sel).first()
      if (await loc.count()) {
        await loc.screenshot({ path: `${SC}/${dir}/${etiq}.png` })
        hecho = true
        break
      }
    }
  }
  if (!hecho) await p.screenshot({ path: `${SC}/${dir}/${etiq}.png`, fullPage: true })
  await p.close()
  console.log('  ', modo, etiq)
}
await b.close()
