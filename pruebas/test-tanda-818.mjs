// Tanda 818 (VE3) — precargar al tocar YA estaba (723, js/precarga.js): la
// propuesta de la noche la daba por pendiente y no lo era. Lo único que le
// faltaba: la baja del correo es un GET que HACE algo, y no se precarga.
const RAIZ = '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const { sePuedePrecargar } = await import(`${RAIZ}/js/precarga.js`)
const O = 'https://pokedoc.es'
check('/baja-correo no se precarga', !sePuedePrecargar('/baja-correo?t=abc', O, `${O}/`))
check('  …y una página normal sí', sePuedePrecargar('/foro', O, `${O}/`))
let js = ''
{ const { readFileSync } = await import('node:fs'); js = readFileSync(`${RAIZ}/js/precarga.js`, 'utf8') }
check('  …también en las reglas de Chrome (salen de la misma lista)', /NUNCA\.map\(\(p\) => \(\{ not: \{ href_matches: `\$\{p\}\*` \} \}\)\)/.test(js) && /'\/baja-correo'/.test(js))
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
