// Tanda 1339 — «Pegar lista» con un set SIN números (PINGU: el 10th Movie
// Commemoration Set, que en Bulbapedia lleva «—» en la columna «No.» y en la
// de rareza; ni el texto ni la captura entraban: «no empieza por un número»).
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const { filasDeLista, planDeLista } = await import(`${RAIZ}/admin/js/lista-set-puro.js`)

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const ver = (r) => JSON.stringify(r.filas.map((f) => [f.local_id, f.name, f.rarity]))

console.log('── 1. La tabla de Bulbapedia copiada (guion en «No.» y en «Rarity») ──')
{
  const t = ['10th Movie Commemoration Set', 'No.\tCard name\tType\tRarity', '—\tStriking Back Mewtwo\t\t—', '—\tExplosive Birth Lugia\t\t—', "—\tCrystal Tower's Entei\t\t—"].join('\n')
  const r = filasDeLista(t)
  check('las tres cartas, numeradas por orden y sin rareza', ver(r) === JSON.stringify([['1', 'Striking Back Mewtwo', null], ['2', 'Explosive Birth Lugia', null], ['3', "Crystal Tower's Entei", null]]), ver(r))
  check('  …marcadas como «sin número» (el panel lo dice)', r.filas.every((f) => f.sinNumero))
  check('  …y el título del set no es una carta', r.filas.every((f) => !/Commemoration/.test(f.name)) && r.raras.some((x) => /título/.test(x.motivo)), JSON.stringify(r.raras))
}

console.log('── 2. Lo que lee el OCR de la captura ──')
{
  // Con espacios en vez de tabuladores, y a veces sin el guion de delante.
  const r1 = filasDeLista("— Striking Back Mewtwo —\n— Timeless Celebi —\n— Alto Mare's Latias —")
  check('con el guion delante y detrás: el nombre limpio', ver(r1) === JSON.stringify([['1', 'Striking Back Mewtwo', null], ['2', 'Timeless Celebi', null], ['3', "Alto Mare's Latias", null]]), ver(r1))
  const r2 = filasDeLista('10th Movie Commemoration Set\nNo. Card name Type Rarity\nStriking Back Mewtwo\n—\nTimeless Celebi\n—')
  check('sin ningún número en todo lo pegado: cada línea es una carta, los guiones sueltos no', ver(r2) === JSON.stringify([['1', 'Striking Back Mewtwo', null], ['2', 'Timeless Celebi', null]]), ver(r2))
}

console.log('── 3. Lo de siempre no cambia ──')
{
  const r = filasDeLista('001/198 · Pineco · Grass · Common\n002/198 · Shiftry ex · Darkness · RR\nesto no es una carta')
  check('con números: los suyos, y una línea sin número sigue sin entrar', ver(r) === JSON.stringify([['001', 'Pineco', 'Common'], ['002', 'Shiftry ex', 'Double Rare']]) && r.raras.length === 1 && /número/.test(r.raras[0].motivo), ver(r) + JSON.stringify(r.raras))
  const m = filasDeLista('1 Pikachu\n— Raichu\n3 Mew\n— Mewtwo')
  check('mezcladas: las de guion toman los números libres por orden', ver(m) === JSON.stringify([['1', 'Pikachu', null], ['2', 'Raichu', null], ['3', 'Mew', null], ['4', 'Mewtwo', null]]), ver(m))
}

console.log('── 4. Contra lo que el set ya tiene ──')
{
  // Pegar la misma lista otra vez: el número por orden casa con lo creado.
  const r = filasDeLista('— Striking Back Mewtwo\n— Explosive Birth Lugia')
  const plan = planDeLista(r.filas, [{ id: 'mano-x-1', local_id: '1', name: 'Striking Back Mewtwo' }])
  check('la que ya está, «igual»; la otra, «nueva»', plan.map((p) => p.estado).join() === 'igual,nueva', plan.map((p) => p.estado).join())
}

console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
