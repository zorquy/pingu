import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
const modo = process.argv[2] // 'antes' | 'despues'

// El «antes» no toca ningún fichero: se reinyectan encima los valores
// viejos, que es exactamente lo que había. Así se puede comparar con la
// suite corriendo y sin arriesgar el árbol.
const VIEJO = `
  :root[data-theme='dark'] { --navy: #4a90c2; --danger: #dc2626; --danger-bg: #fee2e2; }
  :root[data-theme='dark'] .torneo-estado-jugando { color: #7db6dd; }
  .torneo-arte .torneo-estado-jugando, .torneo-cabecera .torneo-estado-jugando { background: #e8342e; }
  .report-btn, .forum-reply-btn, .forum-delete-btn, .tema-borrar, .torneo-borrar,
  .peticion-borrar, .foro-copiar-enlace, .foro-mod-menu-btn, .torneo-pestana,
  .unsave-btn, .sugerencia-btn, .reto-flecha, .wall-empty { color: var(--text-dim) !important; }
`

const b = await chromium.launch()
const tiros = [
  ['/torneos', 'col-torneos-oscuro', 1000, 700, 'dark', 'En juego'],
  ['/perfil', 'col-perfil-oscuro', 900, 700, 'dark', null],
  ['/foro', 'col-foro-oscuro', 1000, 700, 'dark', null],
]
for (const [ruta, etiq, ancho, alto, tema, filtro] of tiros) {
  const p = await b.newPage({ viewport: { width: ancho, height: alto } })
  await p.addInitScript((t) => {
    localStorage.setItem('pokedoc-theme', t)
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_TORNEOS__ = [{ id: 't1', slug: 'copa', name: 'Copa en marcha', status: 'in_progress', admin_id: 'admin-1', max_players: 8, swiss_rounds: 3, description: 'Ya se juega.' }]
    window.__FAKE_INSCRIPCIONES__ = [{ id: 'i1', tournament_id: 't1', user_id: 'user-2', status: 'active' }]
  }, tema)
  await p.goto(`http://localhost:8892${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2600)
  if (filtro) {
    const chip = p.locator('button', { hasText: filtro }).first()
    if (await chip.count()) { await chip.click(); await p.waitForTimeout(700) }
  }
  if (modo === 'antes') await p.addStyleTag({ content: VIEJO })
  await p.waitForTimeout(400)
  await p.screenshot({ path: `${SC}/${modo}/${etiq}.png` })
  await p.close()
}
await b.close()
console.log(modo, 'listo')
