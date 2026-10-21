// Lee las cartas de los sets de Wizards de tcgdex/cards-database (los .ts
// son literales de objeto) y saca sus variantes.
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import vm from 'node:vm'
const RAIZ = '/tmp/tcgdex-db/data'
const SETS = { base1: 'Base/Base Set', base2: 'Base/Jungle', base3: 'Base/Fossil', base4: 'Base/Base Set 2', base5: 'Base/Team Rocket', gym1: 'Gym/Gym Heroes', gym2: 'Gym/Gym Challenge', neo1: 'Neo/Neo Genesis', neo2: 'Neo/Neo Discovery', neo3: 'Neo/Neo Revelation', neo4: 'Neo/Neo Destiny', si1: 'Neo/Southern Islands' }
const evaluar = (texto) => {
  const js = texto.replace(/^import .*$/gm, '').replace(/const card: Card =/, 'card =').replace(/export default card/, '').replace(/set: Set,/, 'set: null,')
  const ctx = { card: null }
  vm.runInNewContext(js, ctx)
  return ctx.card
}
export function cartas() {
  const fuera = []
  for (const [id, ruta] of Object.entries(SETS)) {
    const dir = `${RAIZ}/${ruta}`
    if (!existsSync(dir)) { console.error('falta', dir); continue }
    const setTxt = readFileSync(`${dir}.ts`, 'utf8')
    const setId = (setTxt.match(/id: ["']([^"']+)/) || [])[1]
    if (setId !== id) console.error('id distinto', id, setId)
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts'))) {
      const c = evaluar(readFileSync(`${dir}/${f}`, 'utf8'))
      fuera.push({ set: id, numero: f.replace(/\.ts$/, ''), nombre: c.name?.en, rareza: c.rarity, variants: c.variants })
    }
  }
  return fuera
}
if (process.argv[2] === 'vocab') {
  const todas = cartas()
  const cuenta = new Map()
  let sinArray = 0
  for (const c of todas) {
    if (!Array.isArray(c.variants)) { sinArray++; continue }
    const k = c.set + ' ' + c.variants.map((v) => `${v.type}/${v.subtype || '-'}${v.stamp ? '+' + v.stamp.join('+') : ''}`).join(' | ')
    cuenta.set(k, (cuenta.get(k) || 0) + 1)
  }
  console.log('cartas', todas.length, 'sin array', sinArray)
  for (const [k, n] of [...cuenta].sort()) console.log(n, k)
}
