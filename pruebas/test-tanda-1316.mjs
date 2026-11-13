// Tanda 1316 — R3: la lista de CSS que nadie pinta. Lo puro de la herramienta,
// con la lección de la 498 (los nombres compuestos se perdonan por prefijo).
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const H = await import(`${REPO}/herramientas/css-sin-usar.mjs`)
const clases = H.clasesDeCss(`/* .comentada {} */ .a, .b:hover > .c { background: url(x.y.png); } .medalla-oro{} @media (x){ .d{} } .e{width:1.5rem}`)
check('saca las clases de los selectores (no de comentarios, url() ni valores)', [...clases].sort().join() === 'a,b,c,d,e,medalla-oro', [...clases].join())
const uso = H.usoDelCodigo(['<div class="a b">', 'el.classList.add(`medalla-${m}`)', "x = 'data-c'"])
check('lo que aparece entero, usado; lo de un prefijo compuesto, perdonado', H.sinUsar(clases, uso).sort().join() === 'c,d,e', H.sinUsar(clases, uso).join())
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
