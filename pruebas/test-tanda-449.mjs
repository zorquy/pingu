// Tanda 449 — ordenar y filtrar como en Dex.
//
// PINGU: «ordenado por fecha de salida, nombre, ilustrador, número de la
// Pokédex, precio, cuántas tienes y tipo de energía; y filtrar por estado,
// notas, tipo de carta, tipo de energía, tipo de entrenador y rareza».
//
// LA MITAD DE ESTA PRUEBA CORRE SIN NAVEGADOR, y es la que más vale: lo
// que decide un orden es aritmética, y la aritmética no necesita un
// navegador para equivocarse. `js/mi-coleccion/filtros.js` no importa nada
// del DOM justamente para esto.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import {
  ORDENES_COLECCION, GRUPOS_FILTRO, ordenarLineas, pasaLosFiltros, filtrosVacios, sentidoNatural,
} from '/home/user/pingu/js/mi-coleccion/filtros.js'

let fallos = 0
const ok = (b, msg, extra = '') => {
  console.log(`  ${b ? 'ok  ' : 'FALLA'} ${msg}${extra ? `  ${extra}` : ''}`)
  if (!b) fallos++
}
const BASE = 'http://localhost:8892'

// ═══════════════════════════════════════════════════════════════════
console.log('\n── 1. El orden, en Node ──')
{
  // Tres cartas: dos con ilustrador y número de Pokédex, y una SIN —que
  // es el caso que importa, porque esos datos los rellena la función
  // programada carta a carta y siempre hay cartas a medias—.
  const CARTAS = {
    a: { id: 'a', set_id: 's1', local_id: '1', name: 'Zapdos', illustrator: 'Arita', dex_ids: [145], types: ['Lightning'], rarity: 'Rare', tcg_sets: { name: 'Set B', release_date: '2024-01-01' } },
    b: { id: 'b', set_id: 's1', local_id: '2', name: 'Bulbasaur', illustrator: 'Kodama', dex_ids: [1], types: ['Grass'], rarity: 'Common', tcg_sets: { name: 'Set A', release_date: '2023-01-01' } },
    c: { id: 'c', set_id: 's1', local_id: '3', name: 'Profesor', tcg_sets: { name: 'Set C', release_date: '2025-01-01' } },
  }
  const L = [
    { id: 'la', card_id: 'a', cantidad: 3, created_at: '2026-01-03T00:00:00Z', notas: 'mía' },
    { id: 'lb', card_id: 'b', cantidad: 1, created_at: '2026-01-05T00:00:00Z' },
    { id: 'lc', card_id: 'c', cantidad: 2, created_at: '2026-01-01T00:00:00Z', notas: '  ' },
  ]
  const AYUDAS = {
    carta: (l) => CARTAS[l.card_id],
    nombre: (c) => c?.name || '',
    valor: (l) => ({ la: 10, lb: 2, lc: 5 })[l.id],
    rango: (r) => ({ Rare: 3, Common: 1 })[r] ?? null,
    porNumero: (a, b) => Number(a.local_id || 0) - Number(b.local_id || 0),
    categoriaEs: (v) => v, tipoEs: (v) => v, rarezaEs: (v) => v, entrenadorEs: (v) => v,
    varianteDe: (v) => ({ nombre: v || 'Normal' }), estadoDe: (v) => ({ nombre: v || 'Sin estado' }),
  }
  const ids = (orden, sentido) => ordenarLineas(L, orden, sentido, AYUDAS).map((l) => l.id).join(',')

  ok(ids('valor', 'desc') === 'la,lc,lb', 'por precio, de más caro a más barato', ids('valor', 'desc'))
  ok(ids('cantidad', 'desc') === 'la,lc,lb', 'por cuántas tienes', ids('cantidad', 'desc'))
  ok(ids('recientes', 'desc') === 'lb,la,lc', 'por añadidas hace poco', ids('recientes', 'desc'))
  ok(ids('nombre', 'asc') === 'lb,lc,la', 'por nombre, de la A a la Z', ids('nombre', 'asc'))
  ok(ids('salida', 'desc') === 'lc,la,lb', 'por fecha de salida', ids('salida', 'desc'))
  ok(ids('coleccion', 'asc') === 'lb,la,lc', 'por expansión', ids('coleccion', 'asc'))

  // ── LO QUE NO SE SABE VA AL FINAL, MIRE COMO SE MIRE ──
  //
  // Esto es lo que esta prueba existe para defender. `lc` no tiene
  // ilustrador ni número de Pokédex: no es que su ilustrador sea «», es
  // que no se sabe todavía. Si se ordenara como cadena vacía saldría LA
  // PRIMERA y quien mira entendería «estas son las de ese ilustrador».
  ok(ids('ilustrador', 'asc') === 'la,lb,lc', 'por ilustrador: la que no se sabe, al final', ids('ilustrador', 'asc'))
  ok(ids('ilustrador', 'desc') === 'lb,la,lc', '  …y al final TAMBIÉN al revés', ids('ilustrador', 'desc'))
  ok(ids('dex', 'asc') === 'lb,la,lc', 'por número de Pokédex: la que no lo tiene, al final', ids('dex', 'asc'))
  ok(ids('dex', 'desc') === 'la,lb,lc', '  …y al final TAMBIÉN al revés', ids('dex', 'desc'))
  ok(ids('energia', 'asc') === 'lb,la,lc', 'por tipo de energía, igual', ids('energia', 'asc'))
  ok(ids('rareza', 'desc') === 'la,lb,lc', 'por rareza, igual', ids('rareza', 'desc'))

  // Y la forma del fallo que esto sustituye: el botón «Al revés» hacía un
  // `reverse()` de la lista ya ordenada. Con eso, las que no se saben
  // acaban las PRIMERAS. Se comprueba que el sentido NO es un reverse.
  const alReves = ordenarLineas(L, 'dex', 'asc', AYUDAS).map((l) => l.id).reverse().join(',')
  ok(ids('dex', 'desc') !== alReves,
    'el sentido NO es dar la vuelta a la lista: eso subiría las que no se saben', `${ids('dex', 'desc')} vs ${alReves}`)

  // Dos cartas con el mismo valor no pueden salir en orden distinto cada
  // vez que se carga la página: una lista que se baraja sola parece rota.
  const empatadas = [{ id: 'x', card_id: 'a', cantidad: 1 }, { id: 'y', card_id: 'b', cantidad: 1 }]
  const una = ordenarLineas(empatadas, 'cantidad', 'desc', AYUDAS).map((l) => l.id).join(',')
  const otra = ordenarLineas([...empatadas].reverse(), 'cantidad', 'desc', AYUDAS).map((l) => l.id).join(',')
  ok(una === otra, 'un empate se desempata siempre igual', `${una} vs ${otra}`)

  // Ordenar NO toca la lista que le dan: `lineas` es la colección de
  // verdad y ordenarla en el sitio dejaría el orden siguiente dependiendo
  // del anterior.
  const copia = L.map((l) => l.id).join(',')
  ordenarLineas(L, 'nombre', 'asc', AYUDAS)
  ok(L.map((l) => l.id).join(',') === copia, 'y no muta la lista que recibe')

  // El sentido natural de cada criterio: el precio se mira de más caro a
  // más barato y el nombre de la A a la Z. Si no, hay que tocar dos
  // controles para ver lo normal.
  ok(sentidoNatural('valor') === 'desc' && sentidoNatural('nombre') === 'asc', 'cada criterio trae su sentido natural')
  ok(ORDENES_COLECCION.every((o) => ['asc', 'desc'].includes(sentidoNatural(o.id))),
    'y TODOS lo tienen, no solo los que había cuando se escribió esto')
}

// ═══════════════════════════════════════════════════════════════════
console.log('\n── 2. Los filtros, en Node ──')
{
  const A = {
    categoriaEs: (v) => ({ Pokemon: 'Pokémon', Trainer: 'Entrenador', Energy: 'Energía' })[v] || v,
    tipoEs: (v) => v, rarezaEs: (v) => v, entrenadorEs: (v) => ({ Supporter: 'Partidario', Item: 'Objeto' })[v] || v,
    varianteDe: (v) => ({ nombre: v || 'Normal' }), estadoDe: (v) => ({ nombre: v || 'Sin estado' }),
  }
  const grupo = (id) => GRUPOS_FILTRO.find((g) => g.id === id)
  // Los siete de la 449 y el de gradeo de la 564, que hasta que el gradeo
  // dejó de ser texto libre (563) no se podía ni plantear.
  // …el de gradeo (564) y el de ilustrador (574).
  const pide = ['tipo', 'energia', 'entrenador', 'rareza', 'variante', 'estado', 'notas', 'ilustrador', 'gradeo']
  ok(GRUPOS_FILTRO.map((g) => g.id).join(',') === pide.join(','), 'están los siete grupos que pidió PINGU, el de ilustrador y el de gradeo', GRUPOS_FILTRO.map((g) => g.id).join(','))
  ok(grupo('ilustrador').de({}, { illustrator: 'Mitsuhiro Arita' }, A).join() === 'Mitsuhiro Arita', 'el ilustrador sale tal cual')
  ok(grupo('ilustrador').de({}, {}, A).length === 0, '  …y sin ilustrador, nada (no es «sin ilustrador»)')

  ok(grupo('entrenador').de({}, { trainer_type: 'Supporter' }, A).join() === 'Partidario', 'el tipo de entrenador sale traducido')
  // Un dato de DETALLE que todavía no se ha curado no es un cajón: es una
  // laguna. Devolver [] hace que esa carta no case con ningún chip, que es
  // lo correcto — meterla en un «sin tipo» la mezclaría con las que de
  // verdad no llevan.
  ok(grupo('entrenador').de({}, { trainer_type: null }, A).length === 0, '  …y una carta sin curar no cae en ningún cajón')
  ok(grupo('energia').de({}, { types: null }, A).length === 0, 'una carta sin tipos tampoco')

  // Las notas SÍ son dos cajones de verdad: una nota la escribes tú, así
  // que «sin nota» es un hecho y no una laguna.
  ok(grupo('notas').de({ notas: 'hola' }, {}, A).join() === 'Con nota', 'con nota')
  ok(grupo('notas').de({ notas: '   ' }, {}, A).join() === 'Sin nota', 'y unos espacios NO son una nota')
  ok(grupo('notas').de({}, {}, A).join() === 'Sin nota', 'y sin el campo tampoco')

  // Dentro de un grupo SUMAN, entre grupos RESTAN. Al revés, elegir dos
  // rarezas daría cero resultados siempre.
  const f = filtrosVacios()
  f.energia.add('Grass').add('Fire')
  const hierba = { types: ['Grass'], rarity: 'Rare' }
  const agua = { types: ['Water'], rarity: 'Rare' }
  ok(pasaLosFiltros({}, hierba, f, A), 'dos chips del mismo grupo SUMAN')
  ok(!pasaLosFiltros({}, agua, f, A), '  …y lo que no es ninguno, fuera')
  f.rareza.add('Common')
  ok(!pasaLosFiltros({}, hierba, f, A), 'y entre grupos RESTAN')
  ok(pasaLosFiltros({}, { types: ['Grass'], rarity: 'Common' }, f, A), '  …y lo que cumple los dos, pasa')
  ok(pasaLosFiltros({}, agua, filtrosVacios(), A), 'sin filtros puestos pasa todo')
}

// ═══════════════════════════════════════════════════════════════════
console.log('\n── 3. La bandeja, en el navegador ──')
const navegador = await chromium.launch()
{
  const p = await navegador.newPage({ viewport: { width: 420, height: 900 } })
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 150)))
  await p.route('**assets.tcgdex.net/**', (r) => r.abort())
  await p.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'sv8', name: 'Chispas', serie_id: 'sv', market: 'WEST', card_count_official: 10, release_date: '2024-11-08' }]
    window.__FAKE_CARTAS__ = [
      { id: 'sv8-1', market: 'WEST', set_id: 'sv8', local_id: '1', name: 'Zapdos', name_es: 'Zapdos', image_path: 'x/1', rarity: 'Rare', category: 'Pokemon', types: ['Lightning'], dex_ids: [145], illustrator: 'Arita', variants: { normal: true } },
      { id: 'sv8-2', market: 'WEST', set_id: 'sv8', local_id: '2', name: 'Bulbasaur', name_es: 'Bulbasaur', image_path: 'x/2', rarity: 'Common', category: 'Pokemon', types: ['Grass'], dex_ids: [1], illustrator: 'Kodama', variants: { normal: true } },
      { id: 'sv8-3', market: 'WEST', set_id: 'sv8', local_id: '3', name: 'Profesor', name_es: 'Profesor', image_path: 'x/3', rarity: 'Uncommon', category: 'Trainer', trainer_type: 'Supporter', variants: { normal: true } },
    ]
    window.__FAKE_COLECCION__ = [
      { id: 'l1', card_id: 'sv8-1', market: 'WEST', cantidad: 3, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-09-01T00:00:00Z', notas: 'mía' },
      { id: 'l2', card_id: 'sv8-2', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-09-05T00:00:00Z' },
      { id: 'l3', card_id: 'sv8-3', market: 'WEST', cantidad: 2, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-09-03T00:00:00Z' },
    ]
  })
  await p.goto(`${BASE}/mi-coleccion.html?ver=cartas`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2800)
  ok(errores.length === 0, 'sin errores', errores.join(' | '))

  // EL BOTÓN DICE QUÉ ORDEN HAY PUESTO. Un control que guarda un estado y
  // no lo enseña obliga a abrirlo para saber qué pusiste.
  ok((await p.locator('#mcOrdenRotulo').textContent()).trim() === 'Precio', 'el botón dice el orden puesto',
    await p.locator('#mcOrdenRotulo').textContent())
  ok((await p.locator('#mcOrdenFlecha').textContent()).trim() === '↓', '  …y la flecha, el sentido')

  await p.click('#mcAbrirOrden')
  await p.waitForTimeout(400)
  const criterios = await p.locator('#mcOrdenLista [data-orden]').evaluateAll((ns) => ns.map((n) => n.dataset.orden))
  ok(criterios.join(',') === ORDENES_COLECCION.map((o) => o.id).join(','),
    'la bandeja enseña los mismos criterios que el módulo', criterios.join(','))
  // ACOTADO a `#mcOrdenLista`: desde la tanda 450 hay DOS bandejas en la
  // misma página —esta y la de Buscar— con la misma clase, y sin acotar
  // `.mc-orden-opcion.elegido` casa con dos. Es la lección de la 447 con
  // las tarjetas de colección, otra vez.
  ok((await p.locator('#mcOrdenLista .mc-orden-opcion.elegido').getAttribute('data-orden')) === 'valor', 'y marca el elegido')
  // Cada criterio con su icono: una lista de diez renglones de texto a
  // secas es la que no se puede recorrer de un vistazo.
  const sinIcono = await p.locator('#mcOrdenLista .mc-orden-icono svg').count()
  ok(sinIcono === criterios.length, 'todos llevan su icono', `${sinIcono} de ${criterios.length}`)

  await p.click('[data-orden="dex"]')
  await p.waitForTimeout(600)
  ok((await p.locator('#mcHojaOrden').evaluate((n) => n.open)) === false, 'elegir un criterio cierra la bandeja')
  ok((await p.locator('#mcOrdenRotulo').textContent()).trim() === 'Número de Pokédex', 'y el botón lo dice')
  // El sentido NATURAL del criterio nuevo, no el que arrastrara el viejo.
  ok((await p.locator('#mcOrdenFlecha').textContent()).trim() === '↑', '  …con su sentido natural, no el anterior')
  const orden = () => p.locator('#mcCartas [data-linea]').evaluateAll((ns) => ns.map((n) => n.dataset.linea).join(','))
  ok((await orden()) === 'l2,l1,l3', 'y ordena: Bulbasaur (1), Zapdos (145) y la que no tiene, al final', await orden())

  await p.click('#mcAbrirOrden')
  await p.waitForTimeout(350)
  await p.click('[data-sentido="desc"]')
  await p.waitForTimeout(500)
  ok((await p.locator('#mcHojaOrden').evaluate((n) => n.open)) === true,
    'cambiar el sentido NO cierra la bandeja: es un ajuste del mismo criterio')
  ok((await orden()) === 'l1,l2,l3', 'al revés, y la que no se sabe SIGUE al final', await orden())
  await p.keyboard.press('Escape')
  await p.waitForTimeout(300)

  // Y los grupos de chips salen de lo que HAY: con un solo entrenador el
  // grupo no se pinta, porque un filtro con una opción no filtra nada.
  await p.click('#mcAbrirFiltros')
  await p.waitForTimeout(500)
  const grupos = await p.locator('#mcGruposChips h3').allTextContents()
  ok(grupos.includes('Notas'), 'el grupo de notas está', grupos.join(' | '))
  ok(!grupos.includes('Tipo de entrenador'), '  …y el de entrenador no, porque solo hay un valor', grupos.join(' | '))
  await p.click('.chip-filtro[data-grupo="notas"][data-valor="Con nota"]')
  await p.waitForTimeout(500)
  ok((await orden()) === 'l1', 'filtrar por «con nota» deja la que la lleva', await orden())
  await p.close()
}

// ═══════════════════════════════════════════════════════════════════
console.log('\n── 4. Lo que el módulo necesita, la consulta lo trae ──')
{
  // `trainer_type` es de DETALLE y no venía en la consulta de la
  // colección: el grupo habría salido siempre vacío y no habría dado
  // error en ninguna parte. Es la forma del fallo, no el caso.
  const datos = readFileSync('/home/user/pingu/js/mi-coleccion/datos.js', 'utf8')
  const cols = (datos.match(/const COLUMNAS_CARTA = '([^']+)'/) || [])[1] || ''
  for (const c of ['illustrator', 'types', 'dex_ids', 'trainer_type', 'rarity', 'category']) {
    ok(cols.split(',').includes(c), `la consulta trae ${c}`, cols.slice(0, 60))
  }
}

await navegador.close()
console.log(fallos ? `\n❌ ${fallos} FALLOS` : '\n✅ TODO BIEN')
process.exit(fallos ? 1 : 0)
