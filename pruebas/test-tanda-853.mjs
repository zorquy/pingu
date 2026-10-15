// Tanda 853 — tres cosas de PINGU con las promos y las galerías, sin navegador:
//
//  · «Pikachu XY1 me saca otras tantas, pero el XY124 no está; XY12
//    tampoco»: con letras delante, el número es el PRINCIPIO del impreso
//    (`filtroDeNumero`), y «Pikachu XY» —las letras solas— tiene su segunda
//    pasada (`prefijoSuelto`).
//  · «XY10 y de repente viene XY100, XY101»: `porNumero` ordenaba los que
//    llevan letras como texto.
//  · «las Trainer Gallery las tenemos dos veces»: `setsHermanos` dice qué
//    sets nuestros van dentro de una expansión de TCGGO, para que el
//    catálogo case contra ellos antes de crear nada y la pasada de precios
//    no los deje fuera. Y la migración que funde lo ya duplicado va
//    sentencia a sentencia, sin tablas temporales (la 631).
import { readFileSync } from 'node:fs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const { filtroDeNumero, prefijoSuelto, partirBusqueda } = await import(`${RAIZ}/js/mi-coleccion/busqueda.js`)
const { porNumero, ordenar } = await import(`${RAIZ}/js/mi-coleccion/orden.js`)
const { setsHermanos } = await import(`${RAIZ}/js/catalogo-series.js`)
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const pg = (patron, flags = '') => new RegExp(patron.replace(/^local_id\.imatch\./, ''), flags + 'i')

console.log('── 1. Con letras delante, el número es el principio ──')
{
  const f = filtroDeNumero('1', 'xy')
  check('«xy1» no cierra con $: casa XY1, XY10 y XY124', !f.endsWith('$') && ['XY1', 'XY10', 'XY124', 'XY01'].every((x) => pg(f).test(x)), f)
  check('  …y no TG1 ni SWSH1', !pg(f).test('TG1') && !pg(f).test('SWSH1'))
  check('«xy12» casa XY12 y XY124, no XY1', pg(filtroDeNumero('12', 'xy')).test('XY124') && pg(filtroDeNumero('12', 'xy')).test('XY12') && !pg(filtroDeNumero('12', 'xy')).test('XY1'))
  const sin = filtroDeNumero('64').split(',')[0]
  check('sin letras sigue siendo exacto: «64» es la 64 y no la 640', sin.endsWith('$') && pg(sin).test('064') && !pg(sin).test('640'), sin)
  const s = prefijoSuelto('pikachu xy')
  check('«pikachu xy» → nombre «pikachu» y número que empieza por xy', s?.texto === 'pikachu' && pg(s.filtro).test('XY124') && !pg(s.filtro).test('124') && !pg(s.filtro).test('TG05'), JSON.stringify(s))
  check('  …«pikachu» solo, nada; y «pikachu x» también pasa por aquí (una letra)', prefijoSuelto('pikachu') === null && prefijoSuelto('pikachu x')?.texto === 'pikachu')
  check('  …con dígitos ya no es suelto: lo lee partirBusqueda', prefijoSuelto('pikachu xy1') === null && partirBusqueda('pikachu xy1').prefijo === 'xy')
}

console.log('── 2. Las promos se ordenan como en el álbum ──')
{
  const l = ['XY100', 'XY2', 'XY11', 'XY10', 'XY124', 'XY1', '10', '2', 'TG1', 'SV045'].map((x) => ({ local_id: x }))
  const orden = l.sort(porNumero).map((x) => x.local_id).join(' ')
  check('2 10 · XY1 XY2 XY10 XY11 XY100 XY124 (y las letras detrás de los números)', orden === '2 10 SV045 TG1 XY1 XY2 XY10 XY11 XY100 XY124', orden)
  const por = ordenar([{ local_id: 'XY100', name: 'a' }, { local_id: 'XY10', name: 'a' }], 'numero').map((c) => c.local_id).join(' ')
  check('  …también por `ordenar`', por === 'XY10 XY100', por)
}

console.log('── 3. Qué sets van dentro de una expansión de TCGGO ──')
{
  const ids = ['swsh11', 'swsh11tg', 'swsh11.5tg', 'swsh12', 'swsh12tg', 'swsh12.5', 'swsh12.5gg', 'swsh45', 'swsh45sv', 'bw11', 'rc', 'sv3.5', 'sv3', 'sv35']
  check('Lost Origin: su Trainer Gallery (y la copia .5tg de TCGdex)', setsHermanos('swsh11', ids).join() === 'swsh11tg,swsh11.5tg', setsHermanos('swsh11', ids).join())
  check('Crown Zenith: la Galarian Gallery; Shining Fates: la Shiny Vault', setsHermanos('swsh12.5', ids).join() === 'swsh12.5gg' && setsHermanos('swsh45', ids).join() === 'swsh45sv')
  check('Legendary Treasures: la Radiant Collection, por la lista a mano', setsHermanos('bw11', ids).join() === 'rc')
  check('un id con punto no casa con otro parecido (sv3.5 ≠ sv35, sv3)', setsHermanos('sv3.5', ids).length === 0 && setsHermanos('sv3', ids).length === 0)
  check('sin padre, nada', setsHermanos('', ids).length === 0 && setsHermanos(null, ids).length === 0)
}

console.log('── 4. El catálogo y los precios lo usan ──')
{
  const cat = readFileSync(`${RAIZ}/netlify/functions/tcggo-catalogo.mjs`, 'utf8')
  const pre = readFileSync(`${RAIZ}/netlify/functions/tcggo-precios.mjs`, 'utf8')
  check('el catálogo mete los hermanos en `destinos` ANTES de pedir nuestras cartas', /setsHermanos\(destinos\[0\]/.test(cat) && cat.indexOf('setsHermanos(destinos[0]') < cat.indexOf('nuestras = (await pedir('), '')
  check('la pasada de precios los mete en los sets de cada expansión', /setsHermanos\(setId, idsWest\)/.test(pre) && pre.indexOf('setsHermanos(setId') < pre.indexOf('const enSets'))
}

console.log('── 5. La migración, sentencia a sentencia ──')
{
  const sql = readFileSync(`${RAIZ}/supabase-migration-trainer-gallery-duplicados.sql`, 'utf8')
  check('sin tablas temporales (la 631)', !/create temp/i.test(sql))
  check('funde por el número impreso sin ceros ni mayúsculas, en los seis sufijos y las parejas a mano', /\|\| 'tg'/.test(sql) && /\|\| '\.5gg'/.test(sql) && /'bw11', 'rc'/.test(sql) && /regexp_replace\(g\.local_id/.test(sql))
  for (const t of ['user_collection', 'user_wants', 'user_albums', 'user_price_alerts', 'user_showcase', 'tcg_card_versions', 'tcg_card_prices', 'tcg_card_history', 'carta_del_dia', 'mas_caro_del_dia', 'collection_folder_cards']) {
    check(`  …mueve ${t}`, new RegExp(`(update|delete from) public\\.${t}\\b`).test(sql))
  }
  check('la gemela se queda con el id de TCGGO y el de Cardmarket (para que los precios sigan)', /tcggo_id = coalesce\(g\.tcggo_id, r\.tcggo_id\)/.test(sql) && /cm_id_product_propio = coalesce/.test(sql))
  check('y borra solo la de TCGGO', /delete from public\.tcg_cards where id = r\.id_tcggo/.test(sql) && !/delete from public\.tcg_cards where id = r\.id_gemela/.test(sql))
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
