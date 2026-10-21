// Las versiones de Ball (y el patrón de energía) de tcgdex/cards-database
// (tanda 945): las `variants` con `foil` y su producto de Cardmarket. Sobre un
// clon en /tmp/tcgdex-db (sparse: data/Scarlet & Violet y data/Mega Evolution).
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import vm from 'node:vm'
const RAIZ = '/tmp/tcgdex-db/data'
export const SETS = {
  'sv10.5b': 'Scarlet & Violet/Black Bolt',
  'sv10.5w': 'Scarlet & Violet/White Flare',
  'sv08.5': 'Scarlet & Violet/Prismatic Evolutions',
  'me02.5': 'Mega Evolution/Ascended Heroes',
}
// El `foil` de TCGdex, con la etiqueta que TCGGO le da a la misma versión
// (ETIQUETA_DE_TIPO en netlify/lib/tcggo.mjs y la respuesta real del Lunatone,
// fixtures-930): así su id en la web es el mismo y no salen dos.
export const ETIQUETAS = {
  pokeball: 'Poké Ball',
  masterball: 'Master Ball',
  duskball: 'Dusk Ball',
  loveball: 'Love Ball',
  friendball: 'Friend Ball',
  quickball: 'Quick Ball',
  energy: 'Energy Symbol Pattern',
}
const evaluar = (texto) => {
  const js = texto.replace(/^import .*$/gm, '').replace(/const card: Card =/, 'card =').replace(/export default card/, '').replace(/set: Set,/, 'set: null,')
  const ctx = { card: null }
  vm.runInNewContext(js, ctx)
  return ctx.card
}
export function versiones() {
  const fuera = []
  for (const [id, ruta] of Object.entries(SETS)) {
    const dir = `${RAIZ}/${ruta}`
    if (!existsSync(dir)) throw new Error(`falta ${dir}`)
    const setId = (readFileSync(`${dir}.ts`, 'utf8').match(/id: ["']([^"']+)/) || [])[1]
    if (setId !== id) throw new Error(`id distinto: ${id} / ${setId}`)
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts')).sort()) {
      const c = evaluar(readFileSync(`${dir}/${f}`, 'utf8'))
      const vs = []
      for (const v of Array.isArray(c.variants) ? c.variants : []) {
        const etiqueta = ETIQUETAS[v.foil]
        if (!etiqueta || vs.some((x) => x[0] === etiqueta)) continue
        vs.push([etiqueta, Number(v.thirdParty?.cardmarket) || null])
      }
      if (vs.length) fuera.push({ s: id, n: f.replace(/\.ts$/, ''), en: c.name?.en || '', v: vs })
    }
  }
  return fuera
}
if (process.argv[2] === 'cuenta') {
  const t = versiones()
  const por = {}
  for (const c of t) for (const [e] of c.v) por[`${c.s} ${e}`] = (por[`${c.s} ${e}`] || 0) + 1
  console.log(t.length, 'cartas'); console.log(por)
  console.log('sin producto:', t.flatMap((c) => c.v.filter((v) => !v[1]).map((v) => `${c.s}-${c.n} ${v[0]}`)).slice(0, 20))
}
