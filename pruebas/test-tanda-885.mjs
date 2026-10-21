// Tanda 885 — el catálogo editable en /admin, y lo corregido a mano MANDA.
//
// PINGU: «méteme el catálogo de cartas y expansiones en el admin para poder
// editar todos los datos de expansiones y cartas por si alguna está mal.
// Debería ser reemplazable lo que meto a mano sobre lo que está
// automático, para correcciones manuales».
//
// Tres mitades:
//   1. La BASE (PostgreSQL de verdad): una corrección se apunta aparte y un
//      disparador la vuelve a poner encima de cualquier escritura —un
//      update, un upsert, el rotulado del calco—; quitarla devuelve lo de
//      antes; crear a mano nace con origen «mano»; borrar solo lo de mano
//      y sin dueño; y solo el admin.
//   2. Lo PURO y las PASADAS: la foto a mano es una dirección entera en
//      `image_path` y la cadena de escaneos la pone la primera; el calco
//      japonés no esconde lo de mano; el reemplazo no lo borra ni se lleva
//      sus líneas.
//   3. La PANTALLA: desde el editor de la colección a sus cartas, corregir
//      una (solo lo que cambia), subir una foto, quitar una corrección,
//      crear una carta y una colección a mano, esconder como corrección.
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const leer = (p) => readFileSync(`${RAIZ}/${p}`, 'utf8')

console.log('\n── 1. La base ──')
{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
  const hay = psql(['-c', 'select 1'])
  check('hay un PostgreSQL en /var/tmp:5433 donde probar', hay.status === 0, (hay.stderr || '').slice(0, 120))
  if (hay.status === 0) {
    psql(['-c', 'drop database if exists prueba_885'])
    psql(['-c', 'create database prueba_885'])
    for (const f of [join(AQUI, 'sql-tanda-885.sql'), join(RAIZ, 'supabase-migration-885-catalogo-correcciones.sql')]) {
      const r = psql(['-d', 'prueba_885', '-f', f])
      check(`carga ${f.split('/').pop()}`, r.status === 0, (r.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || '')
    }
    // Y una segunda vez: la migración se puede volver a ejecutar sin
    // romper nada (create … if not exists, create or replace).
    const otra = psql(['-d', 'prueba_885', '-f', join(RAIZ, 'supabase-migration-885-catalogo-correcciones.sql')])
    check('la migración se puede ejecutar dos veces', otra.status === 0, (otra.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || '')
    const r = psql(['-t', '-A', '-d', 'prueba_885', '-f', join(AQUI, 'sql-tanda-885-casos.sql')])
    const lineas = (r.stdout || '').split('\n').filter((l) => /^(ok|MAL) /.test(l))
    check('los casos se ejecutan', r.status === 0 && lineas.length >= 20, (r.stderr || '').slice(0, 300))
    for (const l of lineas) check(l.slice(4), l.startsWith('ok'))
    psql(['-c', 'drop database if exists prueba_885'])
  }
}

console.log('\n── 2. Lo puro ──')
{
  const { urlDeImagen } = await import(`${RAIZ}/js/carta-ruta.js`)
  const { cadenaDeEscaneo } = await import(`${RAIZ}/js/escaneo-carta.js`)
  check('un trozo de ruta de TCGdex se monta como siempre', urlDeImagen('ex/ex7/15', 'low') === 'https://assets.tcgdex.net/en/ex/ex7/15/low.webp', urlDeImagen('ex/ex7/15', 'low'))
  const subida = 'https://zqamujmfavwrsqlgbead.supabase.co/storage/v1/object/public/guide-images/a/foto.png'
  check('una dirección entera (la foto subida a mano) va tal cual', urlDeImagen(subida, 'high', 'JP') === subida)
  const cadena = cadenaDeEscaneo({ id: 'pcg-silver_ja-014', market: 'JP', set_id: 'pcg-silver_ja', local_id: '014', image_path: subida, image_tcggo: 'https://tcggo/otra.png' })
  check('  …y en la cadena de escaneos va LA PRIMERA', cadena[0] === subida, cadena.join(' | '))
  check('  …sin estropear la de TCGGO detrás', cadena.includes('https://tcggo/otra.png'))

  const { loQueCambia, leerCampo, variantesDe, faltaLaMigracion, CAMPOS } = await import(`${RAIZ}/admin/js/catalogo-puro.js`)
  const fila = { name: 'Dark Dragonite', name_en: 'Dark Dragonite', hp: 120, types: ['Darkness'], dex_ids: [149], variants: { holo: true }, rarity: null }
  const cambios = loQueCambia(fila, { name: 'Dark Dragonite', name_en: 'Dark Dragonite (bien)', hp: 120, types: ['Darkness'], dex_ids: [149], variants: { holo: true }, rarity: null })
  check('solo se manda lo que CAMBIA (una de siete)', Object.keys(cambios).join() === 'name_en', JSON.stringify(cambios))
  check('  …comparando listas por valor, no por referencia', !('types' in cambios) && !('dex_ids' in cambios))
  check('  …y null contra una columna que no viene es «nada»', Object.keys(loQueCambia({ name: 'x' }, { rarity: null })).length === 0)
  check('  …pero poner algo donde no había sí cuenta', 'rarity' in loQueCambia(fila, { rarity: 'Rare Holo' }))
  check('la caja vacía es null, no la cadena vacía', leerCampo('texto', '  ') === null)
  check('un número se lee como número', leerCampo('numero', '120') === 120)
  check('una lista por comas', leerCampo('lista', 'Darkness, Dragon').join() === 'Darkness,Dragon')
  check('una lista de números', leerCampo('numeros', '149, x, 148').join() === '149,148')
  check('un JSON se lee', leerCampo('json', '[{"name":"Claw Swipe"}]')[0].name === 'Claw Swipe')
  check('las impresiones: solo las marcadas, y ninguna es null', JSON.stringify(variantesDe({ holo: true, normal: false })) === '{"holo":true}' && variantesDe({}) === null)
  check('«no existe esa función» se reconoce (PGRST202 y el texto)', faltaLaMigracion({ code: 'PGRST202' }) && faltaLaMigracion({ message: 'Could not find the function public.catalogo_corregir' }) && !faltaLaMigracion({ message: 'permission denied' }))
  // Todo campo de la ficha es una columna que la base deja corregir: un
  // campo que no estuviera en la lista guardaría con un 22023 a secas.
  const sql = leer('supabase-migration-885-catalogo-correcciones.sql')
  const listaCartas = (sql.match(/when 'tcg_cards' then array\[([^\]]+)\]/) || [])[1] || ''
  const permitidas = new Set([...listaCartas.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]))
  const fuera = CAMPOS.map((f) => f.col).filter((c) => !permitidas.has(c))
  check('cada campo de la ficha está en la lista de columnas corregibles', !fuera.length, fuera.join())
  check('  …y la foto y las impresiones también', permitidas.has('image_path') && permitidas.has('variants'))
}

console.log('\n── 3. Las pasadas respetan lo de mano ──')
{
  const calco = leer('netlify/functions/tcggo-calco-jp.mjs')
  check('el calco japonés aparta `origen = mano` en el mismo filtro que los conservados', /sinConservados =[\s\S]*?origen\.is\.null,origen\.neq\.mano/.test(calco))
  const codigo = calco.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')
  check('  …como `or`, no como `neq` a secas (un <> contra null no es verdadero)', !/origen=neq\.mano/.test(codigo))
  const consultasQueEsconden = calco.split('\n').filter((l) => /tcg_sets\?.*tcggo_id=is\.null&oculto=is\.false/.test(l))
  check('  …y lo lleva CADA consulta que busca sets sin tcggo_id para esconder', consultasQueEsconden.length >= 3 && consultasQueEsconden.every((l) => l.includes('${sinConservados}')), consultasQueEsconden.filter((l) => !l.includes('${sinConservados}')).join(' | '))

  // El reemplazo, de verdad (el doble de la 806): una carta hecha a mano
  // en el set que se reemplaza ENTERO y con borrado.
  const { procesar } = await import(`${RAIZ}/netlify/functions/tcggo-reemplazar-set.mjs`)
  const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', TCGGO_PAUSA_MS: '0' }
  const db = {
    sets: [{ id: 's12a', market: 'JP', tcggo_id: 913 }],
    cartas: [
      { id: 'tcggo-1', set_id: 's12a', local_id: '1', name: 'A', name_en: 'A', tcggo_id: 1, origen: 'tcggo' },
      { id: 'mano-s12a-999', set_id: 's12a', local_id: '999', name: 'Mano', name_en: 'Hecha a mano', tcggo_id: null, origen: 'mano' },
      { id: 'vieja-2', set_id: 's12a', local_id: '2', name: 'B', name_en: 'B', tcggo_id: null, origen: 'scrydex' },
    ],
    lineas: [{ id: 'l1', card_id: 'mano-s12a-999', user_id: 'u', cantidad: 1 }, { id: 'l2', card_id: 'vieja-2', user_id: 'u', cantidad: 1 }],
  }
  const llamadas = []
  const restImpl = async (ruta, opciones = null) => {
    const r = decodeURIComponent(ruta)
    llamadas.push({ ruta: r, metodo: opciones?.method || 'GET' })
    const ids = (k) => ((r.match(new RegExp(`${k}=in\\.\\(([^)]*)\\)`)) || [])[1] || '').split(',').map((x) => x.replace(/"/g, '')).filter(Boolean)
    if (!opciones || !opciones.method || opciones.method === 'GET') {
      if (r.startsWith('tcg_sets?')) return db.sets.filter((s) => ids('id').includes(s.id))
      if (r.startsWith('tcg_cards?')) return db.cartas.filter((c) => ids('set_id').includes(c.set_id))
      if (r.startsWith('user_collection?')) return db.lineas.filter((l) => ids('card_id').includes(l.card_id))
      return []
    }
    if (opciones.method === 'DELETE' && r.startsWith('user_collection?')) { const id = r.match(/id=eq\.([^&]+)/)[1]; db.lineas = db.lineas.filter((l) => l.id !== id) }
    if (opciones.method === 'DELETE' && r.startsWith('tcg_cards?')) db.cartas = db.cartas.filter((c) => !ids('id').includes(c.id))
    return null
  }
  const guardarCartasImpl = async (filas) => { for (const f of filas) if (!db.cartas.some((c) => c.id === f.id)) db.cartas.push({ ...f }); return filas.length }
  const SUYAS = [{ id: 1, name: 'A', card_number: '1', cardmarket_id: 7001, type: 'singles' }, { id: 3, name: 'C', card_number: '3', cardmarket_id: 7003, type: 'singles' }]
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ data: SUYAS, paging: { current: 1, total: 1 } }) })
  const r = await procesar({ env: ENV, fetchImpl, restImpl, guardarCartasImpl, sets: ['s12a'], destino: 's12a', mercado: 'JP', episodio: 913, entero: true, recolocarPorNumero: true, borrarSinDestino: true, mismaExpansion: true, pausa: async () => {} })
  check('el reemplazo sale bien', r.ok, JSON.stringify(r).slice(0, 300))
  check('la carta vieja de Scrydex sin pareja SÍ se va (modo entero con borrado)', !db.cartas.some((c) => c.id === 'vieja-2'), db.cartas.map((c) => c.id).join())
  check('la carta hecha a mano NO se borra', db.cartas.some((c) => c.id === 'mano-s12a-999'), db.cartas.map((c) => c.id).join())
  check('  …y se apunta entre las que se quedan, diciendo por qué', (r.seQuedan || []).some((q) => q.id === 'mano-s12a-999' && /a mano/.test(q.motivo)), JSON.stringify(r.seQuedan))
  check('  …ni se lleva la línea de colección de quien la tiene', db.lineas.some((l) => l.id === 'l1') && !(r.lineasSinDestino || []).some((l) => l.carta === 'mano-s12a-999'), JSON.stringify({ lineas: db.lineas, sin: r.lineasSinDestino }))
  check('  …mientras la de la carta vieja sí se apunta como borrada', (r.lineasSinDestino || []).some((l) => l.carta === 'vieja-2'))
}

console.log('\n── 4. La pantalla ──')
const SETS = [
  { id: 's12a', market: 'JP', name: 'VSTARユニバース', name_en: 'VSTAR Universe', serie_id: 's', release_date: '2022-12-02', card_count_total: 262, tcggo_id: 913, logo_tcggo: 'https://tcggo/logo.png', logo_scrydex: null, logo_path: null, oculto: false, orden: null, origen: 'tcggo' },
]
const CARTAS = [
  { id: 'tcggo-1', market: 'JP', set_id: 's12a', local_id: '173', name: 'ヒスイのビリリダマ', name_en: 'Hisuian Voltorb', name_es: null, image_path: null, image_tcggo: 'https://tcggo/1.png', hp: 60, types: ['Lightning'], dex_ids: [100], variants: { normal: true }, rarity: 'Common', origen: 'tcggo', tcggo_id: 55001 },
  { id: 'tcggo-2', market: 'JP', set_id: 's12a', local_id: '2', name: 'カイリュー', name_en: 'Dragonite', name_es: null, image_path: null, image_tcggo: 'https://tcggo/2.png', hp: 160, types: ['Dragon'], dex_ids: [149], variants: null, rarity: 'Rare', origen: 'tcggo', tcggo_id: 55002 },
]
const b = await chromium.launch()
async function abrir({ sesion = 'admin-1', fallos = null } = {}) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } })
  await ctx.addInitScript(([s, c, quien, f]) => {
    window.__FAKE_SESSION__ = quien
    window.__FAKE_SETS__ = s
    window.__FAKE_CARTAS__ = c
    window.__FAKE_ERAS__ = []
    if (f) window.__RPC_ERRORES__ = f
  }, [SETS, CARTAS, sesion, fallos])
  const p = await ctx.newPage()
  // Las fotos de fuera (TCGGO, el cubo) no se alcanzan desde aquí: se sirve
  // un PNG de mentira, que si no el `onerror` agota la cadena y quita el
  // <img> (la 441: una pantalla con las fotos rotas es OTRA pantalla).
  await p.route(/^https:\/\/(tcggo|ejemplo\.supabase\.co)\//, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') }))
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}/admin/`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1800)
  // A quien no es admin el panel lo echa: la sección puede no estar.
  await p.locator('[data-section="colecciones"]').click({ timeout: 3000 }).catch(() => {})
  await p.waitForTimeout(500)
  await p.locator('#coleccionesMercado').selectOption('JP', { timeout: 3000 }).catch(() => {})
  await p.waitForTimeout(500)
  return { p, ctx, errores }
}
const rpcs = (p, nombre) => p.evaluate((n) => (window.__RPCS__ || []).filter((r) => r.nombre === n), nombre)
const tabla = (p, t) => p.evaluate((n) => window.__TABLAS__[n], t)

{
  const { p, ctx, errores } = await abrir()
  check('la colección japonesa sale en la lista', await p.locator('[data-set="s12a"]').count() === 1)
  check('hay un botón de «Nueva colección»', await p.locator('#coleccionesNueva').isVisible())

  // ── El editor de la colección: solo lo que cambia, y como corrección ──
  await p.locator('[data-editar="s12a"]').click()
  await p.waitForTimeout(300)
  check('el editor enseña la fecha, el código y las cuentas', await p.locator('#colFecha').inputValue() === '2022-12-02' && (await p.locator('#colCuentaTotal').inputValue()) === '262')
  check('  …y el logo que trae TCGGO', (await p.locator('#colLogo').inputValue()) === 'https://tcggo/logo.png')
  await p.locator('#colNombreEn').fill('VSTAR Universe (High Class)')
  await p.locator('#colGuardar').click()
  await p.waitForTimeout(500)
  let llamadas = await rpcs(p, 'catalogo_corregir')
  check('guardar el set llama a catalogo_corregir', llamadas.length === 1, JSON.stringify(llamadas))
  check('  …con SOLO la columna que cambió', llamadas.length === 1 && Object.keys(llamadas[0].args.p_cambios).join() === 'name_en', JSON.stringify(llamadas[0]?.args))
  check('  …sobre tcg_sets, JP, s12a', llamadas[0]?.args.p_tabla === 'tcg_sets' && llamadas[0]?.args.p_market === 'JP' && llamadas[0]?.args.p_id === 's12a')
  let correcciones = await tabla(p, 'tcg_correcciones')
  check('  …y la corrección queda apuntada con lo de antes', correcciones.some((c) => c.id === 's12a' && c.columna === 'name_en' && c.anterior === 'VSTAR Universe' && c.valor === 'VSTAR Universe (High Class)'), JSON.stringify(correcciones))
  check('la fila de la lista enseña la chapa «1 corrección»', /1 corrección/.test(await p.locator('[data-set="s12a"]').innerText()))

  // Volver a abrir: el campo corregido se ve, y se puede quitar.
  await p.locator('[data-editar="s12a"]').click()
  await p.waitForTimeout(300)
  check('el campo corregido lleva su marca y su «quitar»', await p.locator('[data-quitar-set="name_en"]').isVisible())
  await p.locator('[data-quitar-set="name_en"]').click()
  await p.waitForTimeout(500)
  llamadas = await rpcs(p, 'catalogo_descorregir')
  check('quitar llama a catalogo_descorregir con esa columna', llamadas.length === 1 && llamadas[0].args.p_columna === 'name_en', JSON.stringify(llamadas))
  check('  …y vuelve el nombre de antes en el editor', (await p.locator('#colNombreEn').inputValue()) === 'VSTAR Universe')

  // El logo subido: en LAS DOS columnas.
  await p.locator('#colLogoFichero').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from('89504e470d0a1a0a', 'hex') })
  await p.waitForTimeout(400)
  check('subir un logo rellena la caja con la dirección pública', /^https:\/\/ejemplo\.supabase\.co\/storage\/v1\/object\/public\/guide-images\//.test(await p.locator('#colLogo').inputValue()), await p.locator('#colLogo').inputValue())
  await p.locator('#colGuardar').click()
  await p.waitForTimeout(500)
  llamadas = await rpcs(p, 'catalogo_corregir')
  const delLogo = llamadas[llamadas.length - 1]?.args.p_cambios || {}
  check('guardar escribe el logo en logo_tcggo Y logo_scrydex (y nada más)', Object.keys(delLogo).sort().join() === 'logo_scrydex,logo_tcggo' && delLogo.logo_tcggo === delLogo.logo_scrydex, JSON.stringify(delLogo))

  // Esconder desde la lista también es una corrección: el calco no lo pisa.
  await p.locator('[data-ocultar="s12a"]').click()
  await p.waitForTimeout(500)
  llamadas = await rpcs(p, 'catalogo_corregir')
  check('«Esconder» va como corrección de `oculto`', JSON.stringify(llamadas[llamadas.length - 1]?.args.p_cambios) === '{"oculto":true}', JSON.stringify(llamadas[llamadas.length - 1]?.args))

  // ── Las cartas ──
  await p.locator('[data-editar="s12a"]').click()
  await p.waitForTimeout(300)
  await p.locator('#colCartas').click()
  await p.waitForTimeout(800)
  check('la lista de cartas sale con sus dos cartas', await p.locator('.cat-carta').count() === 2, String(await p.locator('.cat-carta').count()))
  check('  …ordenadas por número (la 2 antes que la 173)', (await p.locator('.cat-carta').first().getAttribute('data-carta')) === 'tcggo-2')
  check('  …con la foto de TCGGO en la miniatura', (await p.locator('[data-carta="tcggo-2"] img').getAttribute('src')) === 'https://tcggo/2.png')
  await p.locator('#catFiltro').fill('volt')
  await p.waitForTimeout(200)
  check('el filtro busca por el nombre inglés', await p.locator('.cat-carta').count() === 1 && (await p.locator('.cat-carta').first().getAttribute('data-carta')) === 'tcggo-1')
  await p.locator('#catFiltro').fill('')
  await p.waitForTimeout(200)

  // Corregir una carta: tres cambios, y SOLO esos tres se mandan.
  await p.locator('[data-editar-carta="tcggo-2"]').click()
  await p.waitForTimeout(300)
  check('la ficha enseña los datos de la carta', (await p.locator('#cat_hp').inputValue()) === '160' && (await p.locator('#cat_types').inputValue()) === 'Dragon' && (await p.locator('#cat_dex_ids').inputValue()) === '149')
  await p.locator('#cat_name_es').fill('Dragonite')
  await p.locator('#cat_hp').fill('170')
  await p.locator('#catVar_holo').check()
  await p.locator('#cat_cm_id_product_propio').fill('123456')
  await p.locator('#catGuardar').click()
  await p.waitForTimeout(500)
  llamadas = await rpcs(p, 'catalogo_corregir')
  const deCarta = llamadas.filter((l) => l.args.p_tabla === 'tcg_cards')
  check('guardar la carta llama a catalogo_corregir sobre tcg_cards', deCarta.length === 1, JSON.stringify(deCarta))
  const cambios = deCarta[0]?.args.p_cambios || {}
  check('  …con SOLO las cuatro columnas tocadas', Object.keys(cambios).sort().join() === 'cm_id_product_propio,hp,name_es,variants', JSON.stringify(cambios))
  check('  …con el número como número y las impresiones como objeto', cambios.hp === 170 && cambios.cm_id_product_propio === 123456 && JSON.stringify(cambios.variants) === '{"holo":true}')
  check('  …sin p_crear', !deCarta[0]?.args.p_crear)
  check('vuelve a la lista con la chapa de correcciones', /4 correcciones/.test(await p.locator('[data-carta="tcggo-2"]').innerText()), await p.locator('[data-carta="tcggo-2"]').innerText())
  let cartas = await tabla(p, 'tcg_cards')
  check('  …y la fila lleva lo corregido', cartas.find((c) => c.id === 'tcggo-2')?.hp === 170 && cartas.find((c) => c.id === 'tcggo-2')?.name_es === 'Dragonite')

  // Subir una foto: va a image_path como dirección entera.
  await p.locator('[data-editar-carta="tcggo-2"]').click()
  await p.waitForTimeout(300)
  check('la ficha marca los campos corregidos', await p.locator('#cat_hp').locator('xpath=..').evaluate((el) => el.classList.contains('cat-campo-corregida')))
  await p.locator('#catFotoFichero').setInputFiles({ name: 'carta.png', mimeType: 'image/png', buffer: Buffer.from('89504e470d0a1a0a', 'hex') })
  await p.waitForTimeout(400)
  const urlFoto = await p.locator('#cat_foto').inputValue()
  check('subir la foto rellena la dirección', /guide-images\/admin-1\//.test(urlFoto), urlFoto)
  await p.locator('#catGuardar').click()
  await p.waitForTimeout(500)
  llamadas = await rpcs(p, 'catalogo_corregir')
  const deFoto = llamadas[llamadas.length - 1]?.args.p_cambios || {}
  check('guardar manda SOLO image_path con la dirección entera', Object.keys(deFoto).join() === 'image_path' && deFoto.image_path === urlFoto, JSON.stringify(deFoto))
  check('  …y la miniatura de la lista ya es esa foto', (await p.locator('[data-carta="tcggo-2"] img').getAttribute('src')) === urlFoto)

  // Quitar la corrección de la foto.
  await p.locator('[data-editar-carta="tcggo-2"]').click()
  await p.waitForTimeout(300)
  check('la foto corregida tiene su «quitar»', await p.locator('[data-quitar="image_path"]').isVisible())
  await p.locator('[data-quitar="image_path"]').click()
  await p.waitForTimeout(500)
  llamadas = await rpcs(p, 'catalogo_descorregir')
  check('quitar la foto llama a descorregir con image_path', llamadas.some((l) => l.args.p_tabla === 'tcg_cards' && l.args.p_columna === 'image_path'))
  cartas = await tabla(p, 'tcg_cards')
  check('  …y vuelve a no tener foto propia (la de TCGGO sigue)', cartas.find((c) => c.id === 'tcggo-2')?.image_path === null)
  check('  …mientras las otras cuatro siguen corregidas', (await tabla(p, 'tcg_correcciones')).filter((c) => c.id === 'tcggo-2').length === 4, JSON.stringify((await tabla(p, 'tcg_correcciones')).map((c) => c.columna)))

  // Guardar sin tocar nada no escribe nada.
  const antes = (await rpcs(p, 'catalogo_corregir')).length
  await p.locator('#catGuardar').click()
  await p.waitForTimeout(300)
  check('guardar sin cambios no llama a nada', (await rpcs(p, 'catalogo_corregir')).length === antes)

  // Nueva carta a mano.
  await p.locator('#catAtras').click()
  await p.waitForTimeout(300)
  await p.locator('#catNueva').click()
  await p.waitForTimeout(300)
  check('la ficha nueva no ofrece borrar ni quitar', (await p.locator('#catBorrar').count()) === 0 && (await p.locator('[data-quitar]').count()) === 0)
  await p.locator('#catGuardar').click()
  await p.waitForTimeout(200)
  check('sin número ni nombre no crea', (await rpcs(p, 'catalogo_corregir')).filter((l) => l.args.p_crear).length === 0)
  await p.locator('#cat_local_id').fill('014')
  await p.locator('#cat_name').fill('わるいカイリュー')
  await p.locator('#cat_name_en').fill('Dark Dragonite')
  await p.locator('#cat_hp').fill('120')
  await p.locator('#cat_types').fill('Darkness')
  await p.locator('#cat_dex_ids').fill('149')
  await p.locator('#catVar_holo').check()
  await p.locator('#catGuardar').click()
  await p.waitForTimeout(500)
  const creadas = (await rpcs(p, 'catalogo_corregir')).filter((l) => l.args.p_crear)
  check('crear llama a catalogo_corregir con p_crear', creadas.length === 1, JSON.stringify(creadas))
  check('  …con el id «mano-<set>-<número>» y el set', creadas[0]?.args.p_id === 'mano-s12a-014' && creadas[0]?.args.p_cambios.set_id === 's12a', JSON.stringify(creadas[0]?.args))
  check('  …y sin columnas vacías (lo que no se escribió no se manda)', creadas.length === 1 && !('rarity' in creadas[0].args.p_cambios) && !('name_es' in creadas[0].args.p_cambios), JSON.stringify(creadas[0]?.args.p_cambios))
  cartas = await tabla(p, 'tcg_cards')
  const nueva = cartas.find((c) => c.id === 'mano-s12a-014')
  check('la carta nueva está, con origen «mano»', nueva?.origen === 'mano' && nueva?.hp === 120 && nueva?.dex_ids?.[0] === 149, JSON.stringify(nueva))
  check('  …y sale en la lista con la chapa «a mano»', /a mano/.test(await p.locator('[data-carta="mano-s12a-014"]').innerText()))

  // Repetir el número no crea otra.
  await p.locator('#catNueva').click()
  await p.waitForTimeout(300)
  await p.locator('#cat_local_id').fill('014')
  await p.locator('#cat_name').fill('Otra')
  await p.locator('#catGuardar').click()
  await p.waitForTimeout(300)
  check('un número repetido no crea otra carta', (await rpcs(p, 'catalogo_corregir')).filter((l) => l.args.p_crear).length === 1)
  await p.locator('#catCancelar').click()
  await p.waitForTimeout(200)

  // Borrar la de mano (solo ella ofrece el botón).
  await p.locator('[data-editar-carta="tcggo-2"]').click()
  await p.waitForTimeout(300)
  // Desde la 934 se ofrece en todas (con lápida si es de una API).
  check('una carta de una API también ofrece borrar (934)', (await p.locator('#catBorrar').count()) === 1)
  await p.locator('#catAtras').click()
  await p.waitForTimeout(200)
  await p.locator('[data-editar-carta="mano-s12a-014"]').click()
  await p.waitForTimeout(300)
  check('la de mano sí', await p.locator('#catBorrar').isVisible())
  await p.locator('#catBorrar').click()
  await p.waitForTimeout(400)
  await p.locator('#catBorrarYa').click()
  await p.waitForTimeout(500)
  check('borrar llama a catalogo_borrar_carta', (await rpcs(p, 'catalogo_borrar_carta')).length === 1)
  check('  …y ya no está', !(await tabla(p, 'tcg_cards')).some((c) => c.id === 'mano-s12a-014') && (await p.locator('.cat-carta').count()) === 2)

  // ── Nueva colección a mano ──
  await p.locator('#catVolver').click()
  await p.waitForTimeout(200)
  await p.locator('[data-cerrar-hoja]').first().click()
  await p.locator('#coleccionesNueva').click()
  await p.waitForTimeout(300)
  await p.locator('#colNuevoId').fill('PCG Silver')
  await p.locator('#colNuevoNombre').fill('Silver')
  await p.locator('#colNuevoCrear').click()
  await p.waitForTimeout(200)
  check('un identificador con espacios no crea', !(await rpcs(p, 'catalogo_corregir')).some((l) => l.args.p_tabla === 'tcg_sets' && l.args.p_crear))
  await p.locator('#colNuevoId').fill('pcg-silver_ja')
  await p.locator('#colNuevoNombre').fill('ロケット団ハーフデッキW -silver-')
  await p.locator('#colNuevoNombreEn').fill('Silver Deck Kit')
  await p.locator('#colNuevoFecha').fill('2004-10-15')
  await p.locator('#colNuevoCuenta').fill('20')
  await p.locator('#colNuevoEra').fill('pcg')
  await p.locator('#colNuevoCrear').click()
  await p.waitForTimeout(600)
  const setNuevo = (await rpcs(p, 'catalogo_corregir')).find((l) => l.args.p_tabla === 'tcg_sets' && l.args.p_crear)
  check('crear la colección llama a catalogo_corregir con p_crear', !!setNuevo, JSON.stringify(setNuevo))
  check('  …con nombre, fecha, cuenta y era', setNuevo?.args.p_id === 'pcg-silver_ja' && setNuevo?.args.p_cambios.release_date === '2004-10-15' && setNuevo?.args.p_cambios.card_count_total === 20 && setNuevo?.args.p_cambios.serie_id === 'pcg', JSON.stringify(setNuevo?.args))
  check('  …y se abre su editor directamente', await p.locator('#colCartas').isVisible() && /pcg-silver_ja/.test(await p.locator('#coleccionesHoja').innerText()))
  check('la colección nueva sale en la lista con la chapa «a mano»', /a mano/.test(await p.locator('[data-set="pcg-silver_ja"]').innerText()))

  check('sin errores de JavaScript en todo el recorrido', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 5. Sin la migración, y sin ser admin ──')
{
  const { p, ctx } = await abrir({ fallos: { catalogo_corregir: { code: 'PGRST202', message: 'Could not find the function public.catalogo_corregir(p_cambios, p_id, p_market, p_tabla) in the schema cache' } } })
  await p.locator('[data-editar="s12a"]').click()
  await p.waitForTimeout(300)
  await p.locator('#colNombreEn').fill('Otro nombre')
  await p.locator('#colGuardar').click()
  await p.waitForTimeout(500)
  const avisos = async () => (await p.locator('.toast').allInnerTexts()).join(' | ')
  check('sin la RPC, el set se guarda igual (directo)', (await tabla(p, 'tcg_sets')).find((s) => s.id === 's12a')?.name_en === 'Otro nombre')
  check('  …y se avisa de que falta la migración', /885/.test(await avisos()), await avisos())
  await p.locator('[data-editar="s12a"]').click()
  await p.waitForTimeout(300)
  await p.locator('#colCartas').click()
  await p.waitForTimeout(600)
  await p.locator('[data-editar-carta="tcggo-2"]').click()
  await p.waitForTimeout(300)
  await p.locator('#cat_hp').fill('170')
  await p.locator('#catGuardar').click()
  await p.waitForTimeout(400)
  check('sin la RPC, la carta NO se escribe a pelo', (await tabla(p, 'tcg_cards')).find((c) => c.id === 'tcggo-2')?.hp === 160, String((await tabla(p, 'tcg_cards')).find((c) => c.id === 'tcggo-2')?.hp))
  check('  …y el aviso nombra la migración', /885/.test(await avisos()), await avisos())
  await ctx.close()
}
{
  // Un usuario normal: la RPC dice que no, y la pantalla lo cuenta.
  const { p, ctx } = await abrir({ sesion: 'user-1' })
  const hayLista = await p.locator('[data-set="s12a"]').count()
  if (hayLista) {
    await p.locator('[data-editar="s12a"]').click()
    await p.waitForTimeout(300)
    await p.locator('#colNombreEn').fill('Me lo cambio')
    await p.locator('#colGuardar').click()
    await p.waitForTimeout(400)
    check('alguien que no es admin no corrige (la RPC dice que no)', (await tabla(p, 'tcg_correcciones')).length === 0 && /admin/i.test(await p.locator('.toast').last().innerText().catch(() => '')))
  } else {
    check('a quien no es admin el panel no le enseña las colecciones', true)
  }
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
