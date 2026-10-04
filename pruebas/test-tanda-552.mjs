// Tanda 552 — volver al orden del catálogo.
//
// PINGU: «recolócame todas las eras por orden de Scrydex, porque no sé qué
// he hecho aquí, he hecho un lío».
//
// ── QUÉ ES «EL ORDEN DE SCRYDEX» ──
//
// Su catálogo no publica un número de orden de las ERAS: publica el nombre
// de la serie de cada expansión y su fecha. El orden que se veía antes de
// tocar nada sale de ahí —cada era vale lo que su set más nuevo, y dentro
// de cada era mandan las fechas—, así que volver a él no es inventar un
// orden: es QUITAR el de a mano para que vuelva a mandar el del catálogo.
//
// Y lo que de verdad vigila esta prueba es lo que NO se pierde: los nombres
// que se les hayan puesto a las eras y las colecciones movidas de era son
// decisiones, no el lío. Un «deshacer» que se lleva por delante lo que
// estaba bien es peor que no tenerlo.
import { readFileSync } from 'node:fs'
import { gruposDeEstanteria } from '/home/user/pingu/js/mi-coleccion/estanteria.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 250) : ''}`)
}
const leer = (p) => readFileSync(`/home/user/pingu/${p}`, 'utf8')

console.log('── 1. Sin orden a mano, manda el catálogo ──')
{
  // Esto es lo que tiene que quedar después de la migración: ninguna
  // colección con número y todas las eras a 0.
  const sets = [
    { id: 'm6a', market: 'JP', name: 'Mega', serie_id: 'mega-evolution', serie_name_en: 'Mega Evolution', release_date: '2026-09-16', card_count_total: 10, orden: null },
    { id: 'sv1a', market: 'JP', name: 'SV', serie_id: 'sv', serie_name_en: 'Scarlet & Violet', release_date: '2023-03-10', card_count_total: 10, orden: null },
    { id: 's8b', market: 'JP', name: 'SS', serie_id: 'swsh', serie_name_en: 'Sword & Shield', release_date: '2021-12-03', card_count_total: 10, orden: null },
  ]
  const eras = new Map([
    ['mega-evolution', { nombre: 'Mega Evolution', orden: 0 }],
    ['sv', { nombre: 'Scarlet & Violet', orden: 0 }],
    ['swsh', { nombre: 'Sword & Shield', orden: 0 }],
  ])
  const g = gruposDeEstanteria(sets, new Set(), eras)
  check('las eras salen por su set más nuevo', g.map((x) => x.id).join() === 'mega-evolution,sv,swsh', JSON.stringify(g.map((x) => x.id)))
  // Y con todas a 0 el desempate es el de siempre: un 0 no es «colocada».
  check('  …o sea, igual que sin ninguna fila de era', gruposDeEstanteria(sets).map((x) => x.id).join() === g.map((x) => x.id).join())
  // Los NOMBRES puestos a mano siguen mandando: eso no es el lío.
  check('y los nombres puestos a mano se siguen enseñando', g[0].titulo === 'Mega Evolution', g[0].titulo)
}

console.log('── 2. La migración quita el orden y NO se lleva nada más ──')
{
  const mig = leer('supabase-migration-eras-recolocar.sql')
  const codigo = mig.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
  check('quita el orden de los sets japoneses', /update public\.tcg_sets set orden = null where market = 'JP'/.test(codigo))
  check('  …y de los occidentales', /update public\.tcg_sets set orden = null where market = 'WEST'/.test(codigo))
  check('deja las eras a 0', /update public\.tcg_eras set orden = 0/.test(codigo))
  // LO QUE NO PUEDE HACER: borrar los nombres de las eras ni mover ningún
  // set de era. Son las dos cosas que PINGU decidió a propósito.
  check('NO borra las eras', !/delete from public\.tcg_eras/.test(codigo), 'borra las eras')
  check('NO toca `serie_id` de ningún set', !/serie_id/.test(codigo), 'toca serie_id')
  check('ni ninguna otra tabla', !/update public\.(?!tcg_sets|tcg_eras)/.test(codigo))
  // El borrado de nombres existe, pero COMENTADO y dicho: es otra decisión.
  check('y deja escrito cómo perder también los nombres, si se quiere', /^-- delete from public\.tcg_eras;$/m.test(mig))
  // Enseña lo que hay ANTES de tocarlo.
  check('enseña el estado antes de cambiar nada', mig.indexOf('Lo que hay ahora') < mig.indexOf('update public.'))
}

console.log('── 3. Y un botón, para no tener que pedírmelo otra vez ──')
{
  const html = leer('admin/index.html')
  const js = leer('admin/js/colecciones.js')
  check('el botón está en el panel', /id="coleccionesReordenar"/.test(html))
  check('  …y hace lo mismo que la migración', /volverAlOrdenDelCatalogo/.test(js))
  check('  …pregunta antes', /window\.confirm/.test(js.split('volverAlOrdenDelCatalogo')[1] || ''))
  const cuerpo = js.split('async function volverAlOrdenDelCatalogo')[1]?.split('\n}')[0] || ''
  check('  …y dice cuántas va a tocar', /colocados\.length/.test(cuerpo), cuerpo.slice(0, 120))
  // Lo mismo que la migración: ni toca `serie_id` ni borra la fila de una era.
  check('no mueve ninguna colección de era', !/serie_id/.test(cuerpo), 'toca serie_id')
  check('no borra ninguna era', !/\.delete\(\)/.test(cuerpo), 'borra eras')
  check('y avisa de lo que NO se pierde', /NO se pierden/.test(cuerpo))
  // Si no hay nada que deshacer, lo dice en vez de escribir 231 filas con
  // el mismo valor que ya tienen.
  check('si no hay nada colocado, no escribe nada', /No hay nada colocado a mano/.test(cuerpo))
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
