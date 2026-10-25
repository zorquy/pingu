// Tanda 1014 — las guías, de la propuesta del repaso: V2 un color por
// CATEGORÍA en las tarjetas sin portada (con el icono de la categoría en la
// chapa), L5 una sola llamada al curso, arriba, con el borde azul de la casa,
// L4 el icono de portada se elige en una rejilla a la vista, con su nombre.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const browser = await chromium.launch()
const guia = { id: 'g-1', slug: 'mi-guia', title: 'Empezar en el TCG', description: 'Lo básico.', kind: 'guide', author_id: 'admin-1', review_status: 'published', published_at: '2026-08-01T10:00:00Z', reference_blocks: [{ type: 'heading', text: 'Cómo se juega' }, { type: 'paragraph', text: 'Robas siete cartas.' }], category_id: 'cat-1', estimated_mins: 5, blocks: [{ type: 'hook', text: '¿Sabías?' }, { type: 'quiz', question: '¿Cuántos premios?', options: ['3', '6'], answer: 1 }] }
const abrir = async (ruta, sesion = 'none') => {
  const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) window[k] = v }, { __FAKE_SESSION__: sesion, __FAKE_CATEGORIAS__: [{ id: 'cat-1', name: 'Básico', slug: 'basico', emoji: 'bookOpen' }], __FAKE_GUIAS__: [guia] })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores }
}

console.log('── 1. Aprender: un color por categoría y el icono en la chapa ──')
{
  const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript(() => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_CATEGORIAS__ = [
      { id: 'cat-mazos', name: 'Competitivo', slug: 'competitivo', emoji: 'trophy', order_pos: 1, guide_count: 2 },
      { id: 'cat-reglas', name: 'Empezar', slug: 'empezar', emoji: 'bookOpen', order_pos: 2, guide_count: 1 },
    ]
    const g = (i, titulo, cat) => ({ id: `g-${i}`, slug: `guia-${i}`, title: titulo, description: `Descripción ${i}`, published_at: `2026-10-${String(i).padStart(2, '0')}T10:00:00Z`, category_id: cat, level: 'beginner', estimated_mins: 4, blocks: [{ type: 'paragraph', text: 'Un párrafo.' }], reference_blocks: [{ type: 'paragraph', text: 'Texto.' }], author_id: 'admin-1', review_status: 'published' })
    window.__FAKE_GUIAS__ = [g(1, 'Charizard ex para Estándar', 'cat-mazos'), g(2, 'Gardevoir ex', 'cat-mazos'), g(3, 'Cómo empezar a jugar', 'cat-reglas')]
    window.__FAKE_PROGRESO__ = []
  })
  await page.goto(`${BASE}/aprender.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  const r = await page.$$eval('.guia-tarjeta', (xs) => xs.map((x) => ({ id: x.dataset.guideId, arte: [...x.querySelector('.guia-arte').classList].find((c) => /^arte-\d$/.test(c)), icono: !!x.querySelector('.guia-chapa-cat svg'), chapa: x.querySelector('.guia-chapa-cat')?.textContent.trim() })))
  const de = (id) => r.find((x) => x.id === id)
  check('V2: dos guías de Competitivo llevan el mismo color, y la de Empezar otro', r.length >= 3 && de('g-1')?.arte && de('g-1').arte === de('g-2')?.arte && de('g-3')?.arte !== de('g-1').arte && !errores.length, JSON.stringify(r) + errores.join(' | '))
  check('  …y la chapa del tema lleva el icono de la categoría (SVG) con su nombre', r.every((x) => x.icono) && de('g-1')?.chapa === 'Competitivo' && de('g-3')?.chapa === 'Empezar', JSON.stringify(r.map((x) => [x.icono, x.chapa])))
  await page.close()
}

console.log('\n── 2. La guía con curso: UNA llamada, arriba, en azul ──')
{
  const { page, errores } = await abrir('/guia?slug=mi-guia')
  const r = await page.evaluate(() => {
    const caja = document.querySelector('.guia-cta-curso')
    const cuerpo = document.querySelector('.article-body')
    const cs = caja && getComputedStyle(caja)
    return {
      llamadas: (document.body.innerText.match(/Hacer el curso/g) || []).length,
      cajas: document.querySelectorAll('.guia-cta-curso').length,
      antesDelTexto: caja && cuerpo ? caja.getBoundingClientRect().top < cuerpo.getBoundingClientRect().top : null,
      titulo: caja?.querySelector('h2')?.textContent,
      fondo: cs?.backgroundImage, borde: cs?.borderTopColor,
      frase: /se aprende jugando/.test(document.body.innerText),
      href: document.querySelector('.guia-cta-curso a.guia-ir-al-curso')?.getAttribute('href'),
    }
  })
  check('L5: «Hacer el curso» sale UNA vez, en una tarjeta antes del texto, sin degradado y con el borde de la casa', r.llamadas === 1 && r.cajas === 1 && r.antesDelTexto && r.titulo === 'Esta guía tiene curso' && r.fondo === 'none' && r.borde !== 'rgba(0, 0, 0, 0)' && !r.frase && r.href === '/curso.html?slug=mi-guia' && !errores.length, JSON.stringify(r) + errores.join(' | '))
  await page.close()
}

console.log('\n── 3. El editor: el icono de portada en rejilla ──')
{
  const { page, errores } = await abrir('/editor-guia.html', 'admin-1')
  const r = await page.evaluate(() => {
    const panel = document.querySelector('.emoji-picker-fijo')
    return { visible: !!panel && panel.getClientRects().length > 0 && !panel.classList.contains('hidden'), opciones: panel?.querySelectorAll('.emoji-picker-option').length || 0, boton: document.querySelector('.emoji-picker-btn')?.getClientRects().length || 0, campoVisible: (document.getElementById('mgCoverEmoji')?.getBoundingClientRect().width || 0) > 4, nombre: panel?.querySelector('[data-icon="bookOpen"]')?.getAttribute('aria-label') }
  })
  check('L4: la rejilla de iconos está a la vista, sin botón ni campo de texto, y cada icono se llama por su nombre', r.visible && r.opciones >= 30 && r.boton === 0 && !r.campoVisible && r.nombre === 'Libro' && !errores.length, JSON.stringify(r) + errores.join(' | '))
  await page.click('.emoji-picker-fijo [data-icon="trophy"]')
  const t = await page.evaluate(() => ({ valor: document.getElementById('mgCoverEmoji').value, etiqueta: document.querySelector('.emoji-picker-etiqueta')?.textContent, elegido: document.querySelector('.emoji-picker-option.selected')?.dataset.icon }))
  check('  …se toca uno y queda elegido, dicho con su nombre', t.valor === 'trophy' && /^Trofeo · elegido/.test(t.etiqueta || '') && t.elegido === 'trophy', JSON.stringify(t))
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
