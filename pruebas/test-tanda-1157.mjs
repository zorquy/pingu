// Tanda 1157 — «Todas las imágenes de PokeDoc, con el mismo marco» (R3 y R4):
//   R3 · La tarjeta del enlace de una noticia con la marca: el editor la
//        dibuja al publicar (la apaisada del marco, en JPEG) y la guarda en
//        `guides.og_image`; meta-social la pone de og:image (con vuelta atrás
//        sin la migración). Las fijas de los retos y la de la web, rehechas.
//   R4 · «Imagen para redes» en las destacadas de /novedades, solo para el
//        equipo, en los tres tamaños, con el icono del tipo o una captura.
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { chromium, contexto, BASE } from './fixtures-app.mjs'
import { imagenDeArticulo, bloqueMeta } from '/home/user/pingu/netlify/edge-functions/meta-social.js'
import { tarjetaCaducada } from '/home/user/pingu/js/noticia-compartir.js'
import { seccionDeNovedad, textoDeNovedad } from '/home/user/pingu/js/novedad-imagen.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const RAIZ = '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')

console.log('── R3 · lo puro y lo estático ──')
{
  check('og_image va delante de la portada', imagenDeArticulo({ og_image: 'https://x.es/og.jpg', cover_image: 'https://x.es/p.jpg' }) === 'https://x.es/og.jpg')
  check('  …y sin ella, la portada de siempre', imagenDeArticulo({ cover_image: 'https://x.es/p.jpg' }) === 'https://x.es/p.jpg')
  const b = bloqueMeta({ url: 'https://pokedoc.es/noticias/a', titulo: 't', descripcion: 'd', imagen: 'https://x.es/og.jpg', imagenAncha: true })
  check('con la tarjeta, se declaran sus medidas (1200×630)', /og:image:width" content="1200"/.test(b) && /summary_large_image/.test(b))
  const ms = leer('netlify/edge-functions/meta-social.js')
  check('meta-social pide og_image y vuelve a la consulta de siempre si no está', /updated_at,og_image&limit=1`\)\)\s*\|\|\s*\(await pedirConVueltaAtras\(/.test(ms))
  check('tarjetaCaducada: sin tarjeta, toca', tarjetaCaducada({ title: 'a' }, { title: 'a' }) === true)
  check('  …con tarjeta y lo mismo, no', tarjetaCaducada({ og_image: 'u', title: 'a', description: 'b', cover_image: 'c' }, { title: 'a', description: 'b', cover_image: 'c' }) === false)
  check('  …si cambia el título o la portada, sí', tarjetaCaducada({ og_image: 'u', title: 'a' }, { title: 'b' }) && tarjetaCaducada({ og_image: 'u', title: 'a', cover_image: 'c' }, { title: 'a', cover_image: 'd' }))
  const ed = leer('admin/js/editor-guia.js')
  check('el editor la guarda tras guardar una noticia publicada, sin frenar el guardado', /payload\.kind === 'news' && payload\.published_at && tarjetaCaducada\(existingGuide, payload\)/.test(ed) && /update\(\{ og_image: url \}\)/.test(ed) && /catch \(e\) \{\s*console\.warn/.test(ed))
  check('  …y no mete og_image en el guardado de la guía (la columna puede no existir)', !/og_image/.test(ed.slice(ed.indexOf('function buildPayload'), ed.indexOf('let saving'))))
}

console.log('── R3 · la migración, en PostgreSQL ──')
{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-X', '-q', '-v', 'ON_ERROR_STOP=1']
  const psql = (args, input) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000, input })
  const hay = psql(['-c', 'select 1'])
  check('hay un PostgreSQL donde probar', hay.status === 0, (hay.stderr || '').slice(0, 160))
  if (hay.status === 0) {
    const BD = 'prueba_1157'
    psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
    psql(['-d', BD, '-c', 'create table public.guides (id uuid primary key, title text)'])
    const mig = leer('supabase-migration-1157-og-image.sql')
    const una = psql(['-d', BD], mig)
    const dos = psql(['-d', BD], mig)
    const col = psql(['-d', BD, '-At', '-c', "select data_type from information_schema.columns where table_name = 'guides' and column_name = 'og_image'"])
    check('la migración pone la columna y se puede repetir', una.status === 0 && dos.status === 0 && col.stdout.trim() === 'text', una.stderr + dos.stderr + col.stdout)
    psql(['-c', `drop database if exists ${BD}`])
  }
}

console.log('── R4 · lo puro ──')
{
  check('la sección sale de a dónde lleva', seccionDeNovedad('/parejas') === 'retos' && seccionDeNovedad('/cartas?catalogo=JP') === 'coleccion' && seccionDeNovedad('/foro') === 'comunidad' && seccionDeNovedad('/torneos') === 'jugar' && seccionDeNovedad('/ajustes') === 'inicio')
  check('el texto lleva título, texto y enlace', textoDeNovedad({ titulo: 'Parejas', texto: 'Doce cartas', enlace: '/parejas' }) === '✨ Parejas\nDoce cartas\npokedoc.es/parejas')
}

const b = await chromium.launch()
console.log('── R3 · la tarjeta, dibujada ──')
{
  const ctx = await contexto(b, false, 'admin-1')
  const page = await ctx.newPage()
  await page.goto(`${BASE}/noticias`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1000)
  const r = await page.evaluate(async () => {
    const { tarjetaDeEnlace } = await import('/js/noticia-compartir.js')
    const blob = await tarjetaDeEnlace({ title: 'Llega *Ascended Heroes*', description: 'Todo lo que sabemos.', cover_image: '', published_at: '2026-11-01' })
    const img = new Image(); img.src = URL.createObjectURL(blob); await img.decode()
    return { tipo: blob.type, w: img.naturalWidth, h: img.naturalHeight, kb: Math.round(blob.size / 1024) }
  })
  check('la tarjeta es un JPEG de 1200×630', r.tipo === 'image/jpeg' && r.w === 1200 && r.h === 630, JSON.stringify(r))
  await ctx.close()
}

console.log('── R4 · /novedades ──')
for (const [quien, ve] of [['admin-1', true], ['user-1', false]]) {
  const ctx = await contexto(b, false, quien)
  const page = await ctx.newPage()
  const err = []; page.on('pageerror', (e) => err.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/novedades`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  const n = await page.locator('[data-nv-redes]').count()
  const dest = await page.locator('#nvDestacadas .nv-dest').count()
  check(`${quien}: ${ve ? 've' : 'no ve'} «Imagen para redes» en cada destacada`, ve ? n === dest && n > 0 : n === 0, `${n} de ${dest}`)
  if (ve) {
    await page.click('[data-nv-redes="0"]')
    await page.waitForTimeout(1500)
    const medidas = []
    for (const [red, forma] of [['instagram', 'publicacion'], ['instagram', 'historia'], ['x', null]]) {
      await page.click(`[data-ch-red="${red}"]`); await page.waitForTimeout(500)
      if (forma) { await page.click(`[data-ch-forma="${forma}"]`); await page.waitForTimeout(700) }
      medidas.push(await page.locator('#chPrevia img').evaluate((i) => new Promise((res) => { const f = () => res(`${i.naturalWidth}x${i.naturalHeight}`); i.complete ? f() : (i.onload = f) })))
    }
    check('  …y saca la imagen en publicación, historia y la de X', medidas.join() === '1080x1350,1080x1920,1200x630', medidas.join())
    await page.locator('#chPrevia img').screenshot({ path: '/tmp/novedad-x.png' }).catch(() => {})
  }
  check(`${quien}: sin errores`, !err.length, err.join(' | '))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
