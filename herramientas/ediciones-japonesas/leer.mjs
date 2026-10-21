// Las ediciones de las cartas JAPONESAS de tcgdex/cards-database (tanda 948).
//
// Desde la 806 el catálogo japonés es el de TCGGO, que da cada carta una vez
// y sin decir si tuvo 1.ª edición. Los ficheros de TCGdex (data-asia) sí lo
// dicen: `variants` con `stamp: ["1st edition"]` y la de `subtype:
// "unlimited"` (o sin subtipo). Se saca, por set, la lista de cartas que
// tienen LAS DOS (una sola no deja nada que elegir: BW8a solo tuvo la 1.ª).
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import vm from 'node:vm'

const RAIZ = process.env.TCGDEX_ASIA || '/tmp/tcgdex-db/data-asia'
const evaluar = (texto, nombre) => {
  const js = texto.replace(/^import .*$/gm, '').replace(/const (card|set): (Card|Set) =/, '$1 =').replace(/export default (card|set);?/, '').replace(/set: Set,/, 'set: null,').replace(/serie: serie,/, 'serie: null,')
  const ctx = { card: null, set: null }
  vm.runInNewContext(js, ctx, { filename: nombre })
  return ctx.card || ctx.set
}
const es1a = (v) => (v?.stamp || []).some((s) => /1st[\s-]?edition/i.test(s))
// Una ilimitada es la que no lleva sello (ni la 1.ª ni otro).
const esIlimitada = (v) => !(v?.stamp || []).length

export function sets() {
  const fuera = []
  if (!existsSync(RAIZ)) throw new Error(`No está ${RAIZ}: clona tcgdex/cards-database con data-asia.`)
  for (const serie of readdirSync(RAIZ).sort()) {
    const ds = `${RAIZ}/${serie}`
    if (!statSync(ds).isDirectory()) continue
    for (const s of readdirSync(ds).sort()) {
      const d = `${ds}/${s}`
      if (!statSync(d).isDirectory() || !existsSync(`${d}.ts`)) continue
      const set = evaluar(readFileSync(`${d}.ts`, 'utf8'), `${d}.ts`)
      const cartas = []
      for (const f of readdirSync(d).filter((x) => x.endsWith('.ts')).sort()) {
        const c = evaluar(readFileSync(`${d}/${f}`, 'utf8'), `${d}/${f}`)
        const vs = Array.isArray(c?.variants) ? c.variants : []
        if (!vs.some(es1a) || !vs.some(esIlimitada)) continue
        cartas.push({ n: f.replace(/\.ts$/, ''), nombre: c.name?.ja || null })
      }
      if (cartas.length) fuera.push({ s: set.id, nombre: set.name?.ja || null, fecha: set.releaseDate || null, oficial: set.cardCount?.official ?? null, cartas })
    }
  }
  return fuera
}

if (process.argv[2] === 'resumen') {
  const t = sets()
  console.log('sets', t.length, 'cartas', t.reduce((n, s) => n + s.cartas.length, 0))
  for (const s of t) console.log(s.s, s.nombre, s.fecha, `oficial ${s.oficial}`, `${s.cartas.length} con las dos`)
}
