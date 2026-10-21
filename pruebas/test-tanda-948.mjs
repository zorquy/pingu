// Tanda 948 — la 1.ª edición y la Unlimited de las japonesas antiguas.
//
// En el foro: «Wind from the Sea, existe 1.ª Edición y Unlimited, no me deja
// añadir 1.ª edición» (y cuatro sets más), con la captura del Scyther de
// Golden Sky, Silvery Ocean: «Versión: Normal — la única que existe». El
// catálogo japonés es de TCGGO (806), que no dice si una carta tuvo 1.ª
// edición; los ficheros de TCGdex sí.
//
//   1. La BASE (PostgreSQL de verdad): cómo casa los sets, qué ediciones
//      crea, qué copias mueve, qué se salta y que se puede repetir.
//   2. Los DATOS: la lista de dentro de la migración sale del clon de
//      tcgdex/cards-database (si está) y lleva los sets del foro.
//   3. Lo PURO: una japonesa con sus ediciones ofrece esas dos, la de por
//      defecto es la Unlimited, y el precio de cada una.
//   4. La PANTALLA: el «+» de una japonesa ofrece la 1.ª edición y la
//      Unlimited, y no «Normal».
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
// La 948b es la 948 con dos pasos más al casar: se prueba la que va a correr.
const MIGRACION = join(RAIZ, 'supabase-migration-948b-ediciones-japonesas-faltan.sql')
const SQL = readFileSync(MIGRACION, 'utf8')
const DATOS = JSON.parse(SQL.match(/d jsonb := '(.*)'::jsonb;/)[1].replace(/''/g, "'"))
const v = await import(`${RAIZ}/js/mi-coleccion/variantes.js`)
const datos = await import(`${RAIZ}/js/mi-coleccion/datos.js`)

console.log('── 1. La base ──')
{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 120000 })
  const hay = psql(['-c', 'select 1'])
  check('hay un PostgreSQL en /var/tmp:5433 donde probar', hay.status === 0, (hay.stderr || '').slice(0, 120))
  if (hay.status === 0) {
    psql(['-c', 'drop database if exists prueba_948'])
    psql(['-c', 'create database prueba_948'])
    const antes = [join(AQUI, 'sql-tanda-885.sql'), join(RAIZ, 'supabase-migration-885-catalogo-correcciones.sql'), join(AQUI, 'sql-tanda-934.sql'), join(RAIZ, 'supabase-migration-934-versiones-a-mano.sql'), join(AQUI, 'sql-tanda-935.sql'), join(RAIZ, 'supabase-migration-935-ediciones-wizards.sql'), join(AQUI, 'sql-tanda-948.sql')]
    for (const f of antes) {
      const r = psql(['-d', 'prueba_948', '-f', f])
      if (r.status !== 0) check(`carga ${f.split('/').pop()}`, false, (r.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || '')
    }
    const una = psql(['-d', 'prueba_948', '-f', MIGRACION])
    check('la migración se ejecuta', una.status === 0, (una.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || '')
    check('  …y acaba enseñando el informe, un renglón por set', /PCG4 .*金の空、銀の海/.test(una.stdout || '') && /\(16 rows\)/.test(una.stdout || ''), (una.stdout || '').slice(-200).replace(/\s+/g, ' '))
    const contar = () => psql(['-t', '-A', '-d', 'prueba_948', '-c', 'select count(*) from tcg_card_versions']).stdout.trim()
    const n1 = contar()
    const otra = psql(['-d', 'prueba_948', '-f', MIGRACION])
    check('se puede ejecutar dos veces sin repetir nada', otra.status === 0 && contar() === n1, `${n1} → ${contar()}`)
    const r = psql(['-t', '-A', '-d', 'prueba_948', '-f', join(AQUI, 'sql-tanda-948-casos.sql')])
    const lineas = (r.stdout || '').split('\n').filter((l) => /^(ok|MAL) /.test(l))
    check('los casos se ejecutan', r.status === 0 && lineas.length >= 23, (r.stderr || '').slice(0, 300))
    for (const l of lineas) check(l.replace(/^(ok|MAL) /, ''), l.startsWith('ok'))
    const id = psql(['-t', '-A', '-d', 'prueba_948', '-c', "select public.catalogo_id_de_version('1st Edition') || ',' || public.catalogo_id_de_version('Unlimited')"]).stdout.trim()
    check('las dos etiquetas tienen el MISMO id en la base y en la web', id === `${v.varianteDeEtiqueta('1st Edition')},${v.varianteDeEtiqueta('Unlimited')}`, id)
    psql(['-c', 'drop database if exists prueba_948'])
  }
  check('la migración no usa tablas temporales entre sentencias (la 631)', !/create\s+temp/i.test(SQL))
  check('  …casa también el id con «_ja» (los sets de antes, como «pcg4_ja»)', /lower\(r\.s\) \|\| '_ja'/.test(SQL))
  check('  …pide la 935 antes de tocar nada', /Falta ejecutar antes supabase-migration-935/.test(SQL))
  check('  …y no casa por el nombre (en estos sets TCGdex lo tiene mal)', !/normalize\(/.test(SQL))
}

console.log('\n── 2. Los datos ──')
{
  const de = (s) => DATOS.find((x) => x.s === s)
  check('los sets del foro: Wind from the Sea (E3), Flight of Legends (PCG1), Rocket Gang Strikes Back (PCG3) y Golden Sky, Silvery Ocean (PCG4)', ['E3', 'PCG1', 'PCG3', 'PCG4'].every((s) => de(s)?.cartas.length > 0), DATOS.map((x) => x.s).join())
  check('  …el Scyther (003) de Golden Sky, Silvery Ocean entre ellas', de('PCG4')?.cartas.includes('003') && de('PCG4')?.fecha === '2005-04-08' && de('PCG4')?.oficial === 106)
  check('16 sets y 1.370 cartas, cada set con su día', DATOS.length === 16 && DATOS.reduce((n, s) => n + s.cartas.length, 0) === 1370 && DATOS.every((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.fecha)))
  check('BW8a no va (solo tuvo la 1.ª edición: nada que elegir)', !de('BW8a'))
  if (existsSync('/tmp/tcgdex-db/data-asia/PCG')) {
    const { sets } = await import(join(AQUI, '..', 'herramientas', 'ediciones-japonesas', 'leer.mjs'))
    const otra = sets().map((s) => ({ s: s.s, nombre: s.nombre, fecha: s.fecha, oficial: s.oficial, cartas: s.cartas.map((c) => c.n) }))
    check('generada otra vez desde el clon, la lista de la migración es la misma', JSON.stringify(otra) === JSON.stringify(DATOS.map(({ en, ...x }) => x)))
    check('  …y cada set lleva su nombre inglés oficial para casar', DATOS.every((x) => x.en.length > 0) && DATOS.find((x) => x.s === 'E4').en.includes('splitearth'))
  } else console.log('  (sin el clon de tcgdex/cards-database en /tmp/tcgdex-db: no se regenera)')
}

console.log('\n── 3. Lo puro ──')
const edicion = (tcggo_id, card_id, etiqueta, cm) => ({ tcggo_id, market: 'JP', card_id, set_id: 'tg-900', numero: null, etiqueta, clase: 'impresion', cm_id_product: cm, imagen: null, origen: 'edicion', icono: null, salio_en: null, lanzamiento: null, cm_low: null })
const standard = (tcggo_id, card_id) => ({ tcggo_id, market: 'JP', card_id, set_id: 'tg-900', etiqueta: 'Standard', origen: null, cm_low: 4.27 })
{
  const sin = { id: 'tcggo-50003', market: 'JP', set_id: 'tg-900', rarity: 'Rare', versiones: [standard(50003, 'tcggo-50003')] }
  check('ANTES (solo la «Standard» de TCGGO): una sola versión, la normal — lo de la captura', v.variantesDeCarta(sin).map((x) => x.nuestro).join() === 'normal')
  const con = { ...sin, versiones: [standard(50003, 'tcggo-50003'), edicion(-2, 'tcggo-50003', 'Unlimited', 700003), edicion(-1, 'tcggo-50003', '1st Edition', null)] }
  const ids = v.variantesDeCarta(con).map((x) => x.nuestro).join()
  check('con sus ediciones: 1.ª edición y Unlimited, y nada más', ids === 'primera,unlimited', ids)
  check('  …con su nombre', v.variantesDeCarta(con).map((x) => x.nombre).join() === '1.ª edición,Unlimited', v.variantesDeCarta(con).map((x) => x.nombre).join())
  check('  …la que se pone sin preguntar es la Unlimited', v.varianteDeCarta(con) === 'unlimited')
  check('  …y se sabe cuáles tiene', v.seSabenVariantes(con))
  datos.registrarVersiones?.(con.versiones)
  const guardados = new Map([['tcggo-50003', { card_id: 'tcggo-50003', cm_id_product: 700003, cm_low: 4.27, cm_low_ja: 4.27 }]])
  const precio = (variante) => datos.precioDeLinea({ card_id: 'tcggo-50003', variante, cantidad: 1, idioma: 'ja' }, guardados, new Map())
  if (datos.registrarVersiones) {
    check('la Unlimited es el producto de la carta: su precio', precio('unlimited')?.desde === 4.27, JSON.stringify(precio('unlimited')))
    check('la 1.ª edición, sin cifra (no el de la carta)', !datos.tieneCifras(precio('primera')), JSON.stringify(precio('primera')))
  }
}

console.log('\n── 4. La pantalla ──')
const SETS = [{ id: 'tg-900', name: 'Golden Sky, Silvery Ocean', name_en: 'Golden Sky, Silvery Ocean', serie_id: 'pcg', market: 'JP', release_date: '2005-04-08', card_count_official: 106, card_count_total: 106, tcggo_id: 900 }]
const tcgSet = { id: 'tg-900', name: 'Golden Sky, Silvery Ocean', serie_id: 'pcg', release_date: '2005-04-08', card_count_official: 106 }
const CARTAS = [
  { id: 'tcggo-50003', market: 'JP', set_id: 'tg-900', local_id: '003', name: 'ストライク', name_en: 'Scyther', image_tcggo: 'https://images.tcggo.com/scyther.png', rarity: 'Rare', category: 'Pokemon', dex_ids: [123], cm_id_product_propio: 700003, tcggo_id: 50003, tcg_sets: tcgSet },
  { id: 'tcggo-50004', market: 'JP', set_id: 'tg-900', local_id: '004', name: 'メガニウム', name_en: 'Meganium', image_tcggo: 'https://images.tcggo.com/meganium.png', rarity: 'Rare', category: 'Pokemon', dex_ids: [154], cm_id_product_propio: 700004, tcggo_id: 50004, tcg_sets: tcgSet },
]
const PRECIOS = [{ card_id: 'tcggo-50003', market: 'JP', cm_id_product: 700003, cm_low: 4.27, checked_at: '2026-10-22T10:00:00Z' }]
const SOLO_STANDARD = [standard(50003, 'tcggo-50003'), standard(50004, 'tcggo-50004')]
const CON_EDICIONES = [...SOLO_STANDARD, edicion(-1, 'tcggo-50003', '1st Edition', null), edicion(-2, 'tcggo-50003', 'Unlimited', 700003), edicion(-3, 'tcggo-50004', '1st Edition', null), edicion(-4, 'tcggo-50004', 'Unlimited', 700004)]
const COLECCION = [{ id: 'a', user_id: 'user-1', card_id: 'tcggo-50003', market: 'JP', idioma: 'ja', estado: 'NM', variante: 'primera', cantidad: 1 }]
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
const browser = await chromium.launch()
async function opcionesAlAnadir(VERSIONES) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'user-1'
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
    Object.assign(window, { __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_PRECIOS__: d.PRECIOS, __FAKE_COLECCION__: d.COLECCION, __FAKE_VERSIONES__: d.VERSIONES, __FAKE_ERAS__: [] })
  }, { SETS, CARTAS, PRECIOS, COLECCION, VERSIONES })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|raw\.githubusercontent|api\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await p.goto(`${BASE}/mi-coleccion.html?ver=album&set=tg-900&catalogo=JP`, { waitUntil: 'domcontentloaded' })
  await p.waitForFunction(() => document.querySelectorAll('#mcAlbum [data-carta]').length > 0, null, { timeout: 10000 }).catch(() => {})
  await p.waitForTimeout(1200)
  await p.evaluate(() => document.querySelector('#mcAlbum .mc-bolsillo-enlace[data-carta="tcggo-50004"]')?.closest('.mc-bolsillo')?.querySelector('.mc-mas')?.click())
  await p.waitForTimeout(900)
  const r = await p.evaluate(() => ({
    abierta: Boolean(document.getElementById('mcAnadirDialogo')?.open),
    opciones: [...document.querySelectorAll('#mcAdVariante option')].map((o) => o.value).join(),
    puesta: document.getElementById('mcAdVariante')?.value,
  }))
  await ctx.close()
  return { ...r, errores }
}
{
  const antes = await opcionesAlAnadir(SOLO_STANDARD)
  check('ANTES de la migración, el «+» de una japonesa ofrece solo la normal (lo del foro)', antes.abierta && antes.opciones === 'normal', JSON.stringify(antes))
  const ahora = await opcionesAlAnadir(CON_EDICIONES)
  check('con sus ediciones, el «+» ofrece la 1.ª edición y la Unlimited', ahora.abierta && ahora.opciones === 'primera,unlimited', JSON.stringify(ahora))
  check('  …con la Unlimited puesta', ahora.puesta === 'unlimited', ahora.puesta)
  check('  …y sin errores', ahora.errores.length === 0 && antes.errores.length === 0, [...antes.errores, ...ahora.errores].join(' | '))
}
await browser.close()

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
