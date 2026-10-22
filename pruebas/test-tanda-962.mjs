// Tanda 962 — la tabla de un set de Bulbapedia, copiada tal cual, vale en el
// cuadro de «Nueva colección»: el número con su cuenta, sin las columnas de
// tipo y rareza y sin la fila de los títulos.
import { join } from 'node:path'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const { cartasDeLista } = await import(join(RAIZ, 'admin/js/lista-cartas-puro.js'))
const tabla = 'No.\tName\tType\tRarity\n001/049\tBulbasaur\tGrass\tC\n003/049\tVenusaur ex\tGrass\tRR\n015/049\tProfessor\'s Research\t\tU\n050/049\tBulbasaur\tGrass\tAR\n'
const r = cartasDeLista(tabla)
check('la fila de los títulos no es una carta ni un error', r.errores.length === 0 && r.cartas.length === 4, JSON.stringify(r))
check('«001/049» es la 001', r.cartas[0].local_id === '001' && r.cartas[3].local_id === '050')
check('el tipo y la rareza no se toman por el nombre en inglés', r.cartas.every((c) => !c.name_en) && r.cartas[1].name === 'Venusaur ex' && r.cartas[2].name === "Professor's Research", JSON.stringify(r.cartas))
const japo = cartasDeLista('001 · フシギダネ · Bulbasaur · Grass · C')
check('con nombre japonés e inglés, los dos (y el tipo fuera)', japo.cartas[0].name === 'フシギダネ' && japo.cartas[0].name_en === 'Bulbasaur', JSON.stringify(japo))
check('lo de siempre sigue: número repetido y línea sin número son error', cartasDeLista('1 · A\n1 · B\nhola').errores.length === 2)
console.log(fails ? `\n❌ ${fails} fallo(s)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
