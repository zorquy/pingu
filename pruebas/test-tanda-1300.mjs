// Tanda 1300 — «Pegar lista» de un set en /admin. Lo puro (lista-set-puro.js):
// una tabla de Bulbapedia con tabuladores, una línea con espacios y siglas, una
// japonesa con «·», un precio de Cardmarket, la fila de títulos y la basura; y
// el plan contra las cartas que hay (nueva / completa SOLO lo vacío / igual, y
// el aviso de nombre distinto). Y la función leer-lista: solo admin, sin clave
// lo dice, y con clave pide la tabla a OCR.space y devuelve el texto.
import { filasDeLista, planDeLista, cambiosDeNueva, idDeNueva, rarezaDe, numeroComparable } from '/home/user/pingu/admin/js/lista-set-puro.js'
import { responder } from '/home/user/pingu/netlify/functions/leer-lista.mjs'

let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── Entender la lista ──')
const TEXTO = `No.\tName\tType\tRarity
001/198\tPineco\tGrass\tCommon
002/198\tShiftry ex\tDarkness\tDouble Rare
189/198\tRare Candy\tItem\tUncommon
003 Pikachu ex RR
004 · ピカチュウ · Pikachu · SAR
TG05 Charizard Special Illustration Rare
basura sin número
005\tIono\tSupporter\tRare
007 Ditto 3,50 €
003 Repetida`
const { filas, raras } = filasDeLista(TEXTO)
const de = (n) => filas.find((f) => f.local_id === n)
check('la fila de títulos no es una carta', !filas.some((f) => /name/i.test(f.name)))
check('Bulbapedia con tabuladores: número sin «/198», tipo y rareza', de('001')?.name === 'Pineco' && de('001').types.join() === 'Grass' && de('001').rarity === 'Common' && de('002').rarity === 'Double Rare', JSON.stringify(de('002')))
check('«Rare Candy» es un nombre, no una rareza; «Item» lo hace Entrenador', de('189')?.name === 'Rare Candy' && de('189').rarity === 'Uncommon' && de('189').category === 'Trainer' && de('189').trainer_type === 'Item', JSON.stringify(de('189')))
check('siglas pegadas con un espacio: «RR» es Double Rare', de('003')?.name === 'Pikachu ex' && de('003').rarity === 'Double Rare', JSON.stringify(de('003')))
check('japonesa con «·»: nombre, inglés y SAR', de('004')?.name === 'ピカチュウ' && de('004').name_en === 'Pikachu' && de('004').rarity === 'Special Illustration Rare', JSON.stringify(de('004')))
check('«TG05 Charizard Special Illustration Rare»', de('TG05')?.name === 'Charizard' && de('TG05').rarity === 'Special Illustration Rare', JSON.stringify(de('TG05')))
check('un precio al final no es del nombre', de('007')?.name === 'Ditto', JSON.stringify(de('007')))
check('lo que no se entiende, aparte y con su línea (basura y el número repetido)', raras.length === 2 && raras.some((r) => r.linea === 8) && raras.some((r) => /ya está en la línea/.test(r.motivo)), JSON.stringify(raras))
check('siglas: AR, UR, ACE, S', rarezaDe('AR') === 'Illustration Rare' && rarezaDe('UR') === 'Hyper Rare' && rarezaDe('ACE') === 'ACE SPEC Rare' && rarezaDe('s') === 'Shiny Rare')
check('números comparables: 001 = 1, TG05 = tg5', numeroComparable('001') === '1' && numeroComparable('TG05') === 'tg5')

console.log('── El plan contra lo que hay ──')
const CARTAS = [
  { id: 'x-1', local_id: '1', name: 'Pineco', rarity: null, types: [] },
  { id: 'x-5', local_id: '005', name: 'Iono', rarity: 'Rare', category: 'Trainer', trainer_type: 'Supporter' },
  { id: 'x-7', local_id: '7', name: 'Mew', rarity: 'Rare' },
]
const plan = planDeLista(filas, CARTAS)
const p = (n) => plan.find((x) => x.local_id === n)
check('la 001 existe sin rareza ni tipo: se COMPLETA solo eso', p('001').estado === 'completa' && JSON.stringify(p('001').cambios) === JSON.stringify({ rarity: 'Common', types: ['Grass'] }), JSON.stringify(p('001').cambios))
check('la 005 lo tiene todo: igual (nada se pisa)', p('005').estado === 'igual')
check('la 007 existe con otro nombre: lo avisa, y no cambia el nombre', p('007').otroNombre === true && !('name' in (p('007').cambios || {})))
check('la 002 es nueva', p('002').estado === 'nueva' && p('002').carta === null)
const c = cambiosDeNueva(de('002'), 'sv4')
check('lo que se crea: set, número, nombre, rareza, tipos y «Pokemon» por tener tipo', c.set_id === 'sv4' && c.local_id === '002' && c.name === 'Shiftry ex' && c.rarity === 'Double Rare' && c.types.join() === 'Darkness' && c.category === 'Pokemon', JSON.stringify(c))
check('el id, el de «Nueva carta»', idDeNueva('sv4', 'TG05') === 'mano-sv4-tg05')

console.log('── La función que lee capturas ──')
const IMG = 'data:image/jpeg;base64,' + 'A'.repeat(200)
const pedir = (cuerpo, token = 'tok') => new Request('https://x/.netlify/functions/leer-lista', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) })
let r = await responder(pedir({ imagen: IMG }), { env: { OCR_API_KEY: 'k' }, esAdmin: async () => null })
check('sin ser admin: 401', r.status === 401)
r = await responder(pedir({ imagen: IMG }), { env: {}, esAdmin: async () => 'admin' })
const sin = await r.json()
check('sin clave: 503 y lo dice', r.status === 503 && sin.sinConfigurar && /OCR_API_KEY/.test(sin.error))
r = await responder(pedir({ imagen: 'hola' }), { env: { OCR_API_KEY: 'k' }, esAdmin: async () => 'admin' })
check('sin captura: 400', r.status === 400)
let enviado = null
r = await responder(pedir({ imagen: IMG, idioma: 'ja' }), {
  env: { OCR_API_KEY: 'k' }, esAdmin: async () => 'admin',
  fetchImpl: async (url, op) => { enviado = { url, op, form: new URLSearchParams(op.body) }; return new Response(JSON.stringify({ ParsedResults: [{ ParsedText: '001\tPineco\tGrass\tC  \r\n\r\n002\tShiftry ex\tRR\r\n' }] }), { status: 200 }) },
})
const leido = await r.json()
check('con clave: pide la tabla (isTable) en su idioma y con su clave', enviado?.form.get('isTable') === 'true' && enviado.form.get('language') === 'jpn' && enviado.op.headers.apikey === 'k')
check('  …y devuelve el texto línea a línea, sin vacías', r.status === 200 && leido.texto === '001\tPineco\tGrass\tC\n002\tShiftry ex\tRR', JSON.stringify(leido))
check('  …que la lista entiende', filasDeLista(leido.texto).filas.length === 2 && filasDeLista(leido.texto).filas[1].rarity === 'Double Rare')
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
