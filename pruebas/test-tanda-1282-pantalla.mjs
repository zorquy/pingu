// Tanda 1282 — Redacción en pantalla: el editor de quien tiene el rol dice
// «Publicar guía» y enseña «Publicado también en»; el de los demás, igual que
// siempre; y la guía de alguien de Redacción lleva la chapa en la firma y la
// caja «También en…» al final.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`) }
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const FOTOS = process.env.PD_FOTOS || null
const b = await chromium.launch()

const abrir = async (ruta, semillas, { ancho = 1200, alto = 1000 } = {}) => {
  const page = await b.newPage({ viewport: { width: ancho, height: alto } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) window[k] = v }, { __FAKE_CATEGORIAS__: [{ id: 'cat-1', name: 'Estrategia', slug: 'estrategia' }], ...semillas })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores }
}

console.log('── El editor ──')
{
  const { page, errores } = await abrir('/editor-guia', { __FAKE_SESSION__: 'user-2', __FAKE_PERFIL__: { is_writer: true, is_admin: false } }, { ancho: 390, alto: 844 })
  check('sin errores', errores.length === 0, errores[0])
  check('Redacción: el botón dice «Publicar guía»', (await page.locator('#btnSubmit').textContent()).trim() === 'Publicar guía', await page.locator('#btnSubmit').textContent())
  check('  …y el aviso dice que sale al momento', /sale en la web al momento/.test(await page.locator('#editorAvisoRevision').textContent()) && await page.locator('#editorAvisoRevision').isVisible())
  check('  …con «Guardar borrador» a mano', await page.locator('#btnSaveDraft').isVisible())
  check('  …y «Publicado también en» a la vista', await page.locator('#mgTambienCampo').isVisible())
  check('  …y el tipo Guía / Noticia', await page.locator('#mgKindCampo').isVisible())
  await page.selectOption('#mgKind', 'news')
  check('al pasar a Noticia: «Publicar noticia» y sin el aviso de la guía', (await page.locator('#btnSubmit').textContent()).trim() === 'Publicar noticia' && !(await page.locator('#editorAvisoRevision').isVisible()))
  await page.selectOption('#mgKind', 'guide')
  if (FOTOS) { await page.locator('#mgTambienCampo').scrollIntoViewIfNeeded(); await page.screenshot({ path: `${FOTOS}/1282-editor.png` }) }
  await page.close()
}
{
  const { page } = await abrir('/editor-guia', { __FAKE_SESSION__: 'user-3', __FAKE_PERFIL__: { is_writer: false, is_news_writer: false, is_admin: false } })
  check('sin el rol: «Enviar a revisión», como siempre', (await page.locator('#btnSubmit').textContent()).trim() === 'Enviar a revisión', await page.locator('#btnSubmit').textContent())
  check('  …y sin «Publicado también en»', !(await page.locator('#mgTambienCampo').isVisible()))
  await page.close()
}
{
  const { page } = await abrir('/editor-guia', { __FAKE_SESSION__: 'user-3', __FAKE_PERFIL__: { is_writer: false, is_news_writer: true, is_admin: false } })
  check('Redacción de noticias: su guía sigue yendo a revisión', (await page.locator('#btnSubmit').textContent()).trim() === 'Enviar a revisión')
  check('  …y no ve «Publicado también en»', !(await page.locator('#mgTambienCampo').isVisible()))
  await page.close()
}

console.log('── La guía ──')
const guia = (extra = {}) => ({
  id: 'g-1', slug: 'dragapult', title: 'Cómo jugar Dragapult ex tras la rotación', description: 'Listas y jugadas.', kind: 'guide',
  author_id: 'user-2', review_status: 'approved', published_at: '2026-11-10T10:00:00Z', category_id: 'cat-1',
  reference_blocks: [{ type: 'heading', text: 'La lista' }, { type: 'paragraph', text: 'Cuatro Dreepy y tres Drakloak.' }], ...extra,
})
{
  const { page, errores } = await abrir('/guia?slug=dragapult', {
    __FAKE_SESSION__: 'none', __FAKE_PERFILES__: [{ id: 'user-2', username: 'deckmasters', display_name: 'Deckmasters', is_writer: true }],
    __FAKE_GUIAS__: [guia({ tambien_en_url: 'https://deckmasters.es/dragapult', tambien_en_nombre: 'Deckmasters' })],
  })
  check('sin errores', errores.length === 0, errores[0])
  check('la firma lleva la chapa «Redacción»', (await page.locator('.guide-author .guia-chapa-redaccion').textContent().catch(() => '')) === 'Redacción')
  const caja = page.locator('a.guia-tambien')
  check('la caja «También en Deckmasters» sale', /También en Deckmasters/.test(await caja.textContent().catch(() => '')))
  check('  …con su enlace, en otra pestaña', (await caja.getAttribute('href')) === 'https://deckmasters.es/dragapult' && (await caja.getAttribute('target')) === '_blank' && /noopener/.test(await caja.getAttribute('rel')))
  const r = await caja.boundingBox()
  check('  …y se puede pulsar (44 px o más)', r && r.height >= 44, r && r.height)
  if (FOTOS) { await caja.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${FOTOS}/1282-guia.png` }) }
  await page.close()
}
{
  const { page } = await abrir('/guia?slug=dragapult', {
    __FAKE_SESSION__: 'none', __FAKE_PERFILES__: [{ id: 'user-2', username: 'ana', display_name: 'Ana', is_writer: false }],
    __FAKE_GUIAS__: [guia({ tambien_en_url: 'javascript:alert(1)' })],
  })
  check('sin el rol, sin chapa', (await page.locator('.guia-chapa-redaccion').count()) === 0)
  check('una dirección que no es https no se pinta', (await page.locator('a.guia-tambien').count()) === 0)
  await page.close()
}
{
  const { page } = await abrir('/guia?slug=dragapult', { __FAKE_SESSION__: 'none', __FAKE_GUIAS__: [guia()] })
  check('sin enlace, sin caja', (await page.locator('a.guia-tambien').count()) === 0)
  await page.close()
}

await b.close()
console.log(fails ? `❌ ${fails} fallan` : '✅ TODO BIEN')
process.exit(fails ? 1 : 0)
