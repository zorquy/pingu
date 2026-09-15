import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const destino = process.argv[2] || 'antes'
const b = await chromium.launch()
const sembrar = () => {
  window.__FAKE_SESSION__ = 'user-1'
  window.__FAKE_CATEGORIAS__ = [{ id: 'cat-1', name: 'Básico', slug: 'basico' }]
  window.__FAKE_GUIAS__ = [1, 2, 3].map((i) => ({ id: `g${i}`, slug: `g${i}`, title: `Guía ${i}`, description: 'Un resumen corto para ver cómo respira la tarjeta.', category_id: 'cat-1' }))
  window.__FAKE_NOTICIAS__ = [1, 2, 3, 4].map((i) => ({ id: `n${i}`, slug: `n${i}`, title: `Noticia ${i}` }))
  window.__FAKE_TORNEOS__ = [{ id: 't1', slug: 'copa', name: 'Copa de Prueba', status: 'registration_open', admin_id: 'admin-1', max_players: 8, swiss_rounds: 3, description: 'Ven a jugar.' }]
  window.__FAKE_INSCRIPCIONES__ = [{ id: 'i1', tournament_id: 't1', user_id: 'user-2', status: 'active' }]
  window.__FAKE_MURO__ = []
}
const tiros = [
  ['/torneos', 'torneos', 1100, 620, 'light'],
  ['/torneos', 'torneos-oscuro', 1100, 620, 'dark'],
  ['/index.html', 'portada', 1100, 900, 'light'],
  ['/perfil', 'perfil', 1000, 760, 'dark'],
  ['/aprender', 'aprender', 1100, 620, 'light'],
  ['/guardados', 'guardados', 1000, 520, 'light'],
]
for (const [ruta, etiq, ancho, alto, tema] of tiros) {
  const p = await b.newPage({ viewport: { width: ancho, height: alto } })
  await p.addInitScript((t) => { localStorage.setItem('pokedoc-theme', t) }, tema)
  await p.addInitScript(sembrar)
  await p.goto(`http://localhost:8892${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2400)
  await p.screenshot({ path: `/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/${destino}/${etiq}.png` })
  await p.close()
}
await b.close()
console.log(destino, 'capturado')
