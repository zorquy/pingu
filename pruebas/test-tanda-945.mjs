// Tanda 945 — las versiones Poké Ball y Master Ball de Black Bolt (y de
// White Flare, Prismatic Evolutions y las Ball de Ascended Heroes), de TCGdex.
//
// Cosadfrikiis, en el foro: «en Black Bolt no se puede añadir Poké Ball o
// Master Ball… el Pansage 004 no sale… no son todas, pero hay en varias».
// Esas versiones son OTRO producto de Cardmarket (el Pansage es el 835910,
// su Poké Ball el 836261) y TCGGO a veces las da como otra carta: la pasada
// de precios no las casaba con ninguna nuestra.
//
// Lo que se prueba:
//   1. La BASE (PostgreSQL de verdad): la migración pone las versiones con
//      su producto, no repite las que TCGGO ya da, funde la colada como carta
//      (copias, deseo, foto, lápida) y se puede pasar dos veces.
//   2. Los DATOS: la lista es la de tcgdex/cards-database (se regenera del
//      clon si está) y el id de cada etiqueta es el mismo en la base y en la
//      web.
//   3. La WEB: la carta ofrece sus versiones de Ball con su nombre.
//   4. La PASADA de precios: la Poké Ball (otro producto) se lleva su precio.
import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const MIGRACION = join(RAIZ, 'supabase-migration-945-versiones-ball.sql')
const SQL = readFileSync(MIGRACION, 'utf8')
const DATOS = JSON.parse(SQL.match(/d jsonb := '(.*)';/)[1].replace(/''/g, "'"))
const v = await import(`${RAIZ}/js/mi-coleccion/variantes.js`)

console.log('── 1. La base ──')
{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 120000 })
  const hay = psql(['-c', 'select 1'])
  check('hay un PostgreSQL en /var/tmp:5433 donde probar', hay.status === 0, (hay.stderr || '').slice(0, 120))
  if (hay.status === 0) {
    psql(['-c', 'drop database if exists prueba_945'])
    psql(['-c', 'create database prueba_945'])
    const antes = [join(AQUI, 'sql-tanda-885.sql'), join(RAIZ, 'supabase-migration-885-catalogo-correcciones.sql'), join(AQUI, 'sql-tanda-934.sql'), join(RAIZ, 'supabase-migration-934-versiones-a-mano.sql'), join(AQUI, 'sql-tanda-935.sql'), join(RAIZ, 'supabase-migration-935-ediciones-wizards.sql'), join(AQUI, 'sql-tanda-945.sql')]
    for (const f of antes) {
      const r = psql(['-d', 'prueba_945', '-f', f])
      check(`carga ${f.split('/').pop()}`, r.status === 0, (r.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || '')
    }
    const una = spawnSync('psql', [...PG.filter((x) => x !== '-q'), '-d', 'prueba_945', '-f', MIGRACION], { encoding: 'utf8', timeout: 120000 })
    check('la migración pasa', una.status === 0, (una.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || '')
    const aviso = (una.stderr || '').match(/Versiones nuevas: (\d+), que ya estaban: (\d+)/)
    check('  …y dice cuántas ha puesto', aviso && Number(aviso[1]) === 7 && Number(aviso[2]) === 1, (una.stderr || '').split('\n').find((l) => /Versiones nuevas/.test(l)) || '(sin aviso)')
    const contar = () => psql(['-t', '-A', '-d', 'prueba_945', '-c', 'select count(*) from tcg_card_versions']).stdout.trim()
    const n1 = contar()
    const otra = psql(['-d', 'prueba_945', '-f', MIGRACION])
    check('la migración se puede ejecutar dos veces, y la segunda no pone nada', otra.status === 0 && contar() === n1, (otra.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || `${n1} → ${contar()}`)
    const r = psql(['-t', '-A', '-d', 'prueba_945', '-f', join(AQUI, 'sql-tanda-945-casos.sql')])
    const lineas = (r.stdout || '').split('\n').filter((l) => /^(ok|MAL) /.test(l))
    check('los casos se ejecutan', r.status === 0 && lineas.length >= 10, (r.stderr || '').slice(0, 300))
    for (const l of lineas) check(l.replace(/^(ok|MAL) /, ''), l.startsWith('ok'))
    const etiquetas = [...new Set(DATOS.flatMap((c) => c.v.map((e) => e[0])))]
    const q = psql(['-t', '-A', '-d', 'prueba_945', '-c', `select x || '|' || public.catalogo_id_de_version(x) from unnest(array[${etiquetas.map((e) => `'${e.replace(/'/g, "''")}'`).join(',')}]) x`])
    const distintas = (q.stdout || '').trim().split('\n').filter(Boolean).map((l) => l.split('|')).filter(([e, id]) => v.varianteDeEtiqueta(e) !== id)
    check(`las ${etiquetas.length} etiquetas tienen el MISMO id en la base y en la web (es lo que guarda la colección)`, q.status === 0 && !distintas.length && etiquetas.length === 7, distintas.map(([e, id]) => `${e}: base ${id}, web ${v.varianteDeEtiqueta(e)}`).join(' | ') || etiquetas.join())
    psql(['-c', 'drop database if exists prueba_945'])
  }
  check('la migración no usa tablas temporales entre sentencias (la 631)', !/create\s+temp/i.test(SQL))
  check('  …y pide la 935 antes de tocar nada', /Falta ejecutar antes supabase-migration-935/.test(SQL))
}

console.log('\n── 2. Los datos son los de tcgdex/cards-database ──')
{
  const de = (id) => DATOS.find((c) => `${c.s}-${c.n}` === id)
  const txt = (id) => (de(id)?.v || []).map((e) => `${e[0]}:${e[1]}`).join(' | ')
  check('el Pansage 004 de Black Bolt: Poké Ball 836261 y Master Ball 836271', txt('sv10.5b-004') === 'Poké Ball:836261 | Master Ball:836271' && de('sv10.5b-004').en === 'Pansage', txt('sv10.5b-004'))
  check('White Flare entra (Sewaddle 001)', txt('sv10.5w-001') === 'Poké Ball:836493 | Master Ball:836494', txt('sv10.5w-001'))
  check('Prismatic Evolutions también (Exeggcute 001)', txt('sv08.5-001') === 'Poké Ball:806408 | Master Ball:806409', txt('sv08.5-001'))
  check('Ascended Heroes: la Poké Ball y el patrón de energía del Oddish de Erika, con la etiqueta de TCGGO', txt('me02.5-001') === 'Poké Ball:870136 | Energy Symbol Pattern:870135', txt('me02.5-001'))
  const por = (s, e) => DATOS.filter((c) => c.s === s && c.v.some((x) => x[0] === e)).length
  check('Black Bolt y White Flare: 80 cartas con Poké Ball y 72 con Master Ball cada uno', por('sv10.5b', 'Poké Ball') === 80 && por('sv10.5b', 'Master Ball') === 72 && por('sv10.5w', 'Poké Ball') === 80 && por('sv10.5w', 'Master Ball') === 72)
  check('todas con su producto de Cardmarket (el precio va por él)', DATOS.every((c) => c.v.every((e) => Number.isInteger(e[1]) && e[1] > 0)))
  check('sin la Cosmos ni el resto de patrones que no son de Ball (no tienen etiqueta de TCGGO segura)', !DATOS.some((c) => c.v.some((e) => /cosmos|tinsel|rocket/i.test(e[0]))))
  if (existsSync('/tmp/tcgdex-db/data/Scarlet & Violet/Black Bolt/004.ts')) {
    const { versiones } = await import(join(AQUI, '..', 'herramientas', 'versiones-ball', 'leer.mjs'))
    check('generada otra vez desde el clon, la lista de la migración es la misma', JSON.stringify(versiones()) === JSON.stringify(DATOS))
  } else {
    console.log('  (sin /tmp/tcgdex-db no se vuelve a generar la lista)')
  }
}

console.log('\n── 3. La web ──')
{
  const fila = (tcggo_id, etiqueta, extra = {}) => ({ tcggo_id, card_id: 'sv10.5b-004', set_id: 'sv10.5b', etiqueta, ...extra })
  const pansage = { id: 'sv10.5b-004', set_id: 'sv10.5b', rarity: 'Common', variants: { normal: true, reverse: true } }
  v.pegarVersiones([pansage], [fila(70004, 'Standard'), fila(70005, 'Reverse Holo'), fila(-1, 'Poké Ball', { origen: 'tcgdex', clase: 'impresion', cm_id_product: 836261 }), fila(-2, 'Master Ball', { origen: 'tcgdex', clase: 'impresion', cm_id_product: 836271 })])
  const ids = v.variantesDeCarta(pansage).map((x) => x.nuestro).join()
  check('el Pansage ofrece Normal, Reverse, Poké Ball y Master Ball', ids === 'normal,reverse,poke-ball,master-ball', ids)
  check('  …con su nombre («Poké Ball», con su acento)', v.variantesDeCarta(pansage).slice(2).map((x) => x.nombre).join() === 'Poké Ball,Master Ball', v.variantesDeCarta(pansage).map((x) => x.nombre).join())
  check('  …y las dos cuentan para el maestro', v.variantesDeCarta(pansage).filter(v.cuentaParaMaestro).length === 4)
  // TCGGO también da la Poké Ball en la carta: una sola casilla.
  const snivy = { id: 'sv10.5b-001', set_id: 'sv10.5b', rarity: 'Common', variants: { normal: true, reverse: true } }
  v.pegarVersiones([snivy], [{ tcggo_id: 70000, card_id: 'sv10.5b-001', etiqueta: 'Standard' }, { tcggo_id: 70001, card_id: 'sv10.5b-001', etiqueta: 'Poké Ball' }, { tcggo_id: 70002, card_id: 'sv10.5b-001', etiqueta: 'Reverse Holo' }, { tcggo_id: -3, card_id: 'sv10.5b-001', etiqueta: 'Master Ball', origen: 'tcgdex', clase: 'impresion' }])
  const s = v.variantesDeCarta(snivy).map((x) => x.nuestro).join()
  check('con la Poké Ball de TCGGO y la Master Ball de TCGdex, cada una una vez', s === 'normal,reverse,poke-ball,master-ball', s)
  // Una de TCGdex no cuenta como «TCGGO ha hablado»: no le quita la Reverse.
  const solo = { id: 'sv10.5b-006', set_id: 'sv10.5b', rarity: 'Common', variants: { normal: true, reverse: true } }
  v.pegarVersiones([solo], [{ tcggo_id: -4, card_id: 'sv10.5b-006', etiqueta: 'Poké Ball', origen: 'tcgdex' }])
  check('una fila de TCGdex no le quita la Reverse a la carta (la regla de la 931 es de TCGGO)', v.variantesDeCarta(solo).map((x) => x.nuestro).join() === 'normal,reverse,poke-ball', v.variantesDeCarta(solo).map((x) => x.nuestro).join())
  const iv = await import(`${RAIZ}/js/mi-coleccion/iconos-version.js`)
  const html = iv.iconoDeVersion('poke-ball', 16) + iv.iconoDeVersion('master-ball', 16)
  check('la Poké Ball y la Master Ball se pintan con su sprite (930)', /poke-ball/.test(html) && /master-ball/.test(html), html.slice(0, 200))
}

console.log('\n── 4. La pasada de precios ──')
{
  const precios = readFileSync(join(RAIZ, 'netlify/functions/tcggo-precios.mjs'), 'utf8')
  check('pregunta por las versiones de TCGdex con las ediciones, por producto', /origen=in\.\(edicion,tcgdex\)&cm_id_product=in\.\(/.test(precios))
  const { preciosDeEdiciones } = await import(`${RAIZ}/netlify/lib/tcggo.mjs`)
  const suya = { id: 99001, name: 'Pansage', card_number: '004', cardmarket_id: 836261, prices: { cardmarket: { lowest_near_mint: 1.75, lowest_near_mint_ES: 2.1 } } }
  const r = preciosDeEdiciones([{ tcggo_id: -1, card_id: 'sv10.5b-004', set_id: 'sv10.5b', etiqueta: 'Poké Ball', clase: 'impresion', cm_id_product: 836261 }], new Map([[836261, suya]]), { ahora: new Date('2026-10-22T10:00:00Z') })
  check('la Poké Ball del Pansage se lleva el precio de su producto', r.filas.length === 1 && r.filas[0].tcggo_id === -1 && r.filas[0].cm_low === 1.75 && r.filas[0].card_id === 'sv10.5b-004', JSON.stringify(r.filas))
  check('  …con las columnas que la fila ya tiene (la 526)', r.filas[0].etiqueta === 'Poké Ball' && r.filas[0].cm_id_product === 836261)
}

console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
