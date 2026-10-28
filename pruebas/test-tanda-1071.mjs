// Tanda 1071 — la web de una tienda, lo puro: qué páginas puede abrir una
// cuenta de tienda (js/tienda-puertas.js), qué sección es cada página
// (js/tienda-marco.js), el contraste del color «Tienda» en los dos temas y
// que app.js echa a /tienda ANTES de esperar a la sesión.
import { readFileSync } from 'node:fs'

const RAIZ = (process.env.PD_RAIZ || '/home/user/pingu') + '/'
const leer = (f) => readFileSync(RAIZ + f, 'utf8')
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const { puedeAbrirTienda, MARCA_TIENDA } = await import(RAIZ + 'js/tienda-puertas.js')
const { seccionDeTienda, SECCIONES_DE_TIENDA, seccionesDeTienda, seccionesDelMovil, enlacesHtml } = await import(RAIZ + 'js/tienda-marco.js')

console.log('── Las puertas ──')
const T = { u: 'prueba', id: 'user-2' }
const si = [['/tienda', ''], ['/tienda.html', '?ver=stock'], ['/mensajes', ''], ['/mensajes.html', '?with=x'], ['/usuario/prueba', ''], ['/usuario/Prueba', ''], ['/usuario.html', '?u=prueba'], ['/usuario.html', '?id=user-2'], ['/auth.html', ''], ['/cartas', ''], ['/cartas', '?ver=pokedex'], ['/alta-tienda', '?i=1'], ['/reset-password.html', ''], ['/privacidad', ''], ['/terminos.html', '']]
const no = [['/', ''], ['/index.html', ''], ['/mi-coleccion', ''], ['/carta/sv8-1', ''], ['/carta.html', '?id=sv8-1'], ['/foro.html', ''], ['/retos', ''], ['/ajustes', ''], ['/perfil.html', ''], ['/usuario/misty', ''], ['/usuario.html', '?u=misty'], ['/usuario.html', '?id=user-1'], ['/usuario.html', ''], ['/torneos.html', ''], ['/tiendas', '']]
const malSi = si.filter(([r, q]) => !puedeAbrirTienda(r, q, T))
const malNo = no.filter(([r, q]) => puedeAbrirTienda(r, q, T))
check('abre su panel, sus mensajes, SU perfil (por nombre, sin mayúsculas, o por id) y las de entrar y legales', !malSi.length, JSON.stringify(malSi))
check('y nada más: ni la portada, ni la colección, ni el foro, ni Ajustes, ni el perfil de otra persona', !malNo.length, JSON.stringify(malNo))
check('sin saber quién es la tienda, ningún perfil', !puedeAbrirTienda('/usuario/prueba', '', null) && !puedeAbrirTienda('/usuario.html', '?id=user-2', {}))
check('la marca del navegador es una', MARCA_TIENDA === 'pd-tienda')

console.log('── Las secciones ──')
check('Panel, Colección, Stock, Ventas, Escaparate, Mensajes y Datos, en ese orden (1074 y 1075)', SECCIONES_DE_TIENDA.map((s) => s.nombre).join(',') === 'Panel,Colección,Stock,Ventas,Escaparate,Mensajes,Datos')
check('la Colección es /cartas (su modo tienda), con su menú colgado en la lateral', SECCIONES_DE_TIENDA[1].href === '/cartas' && seccionesDeTienda()[1].menu === true && seccionDeTienda('/cartas', '?ver=pokedex') === 'Colección')
check('  …y su enlace no se cambia por Mi colección (fija)', seccionesDeTienda().every((s) => s.fija === true))
check('en la forma de la barra: un enlace cada una y su icono', seccionesDeTienda().every((s) => s.enlaces.length === 1 && s.icono))
check('/tienda sin pestaña es el Panel', seccionDeTienda('/tienda', '') === 'Panel' && seccionDeTienda('/tienda.html', '?ver=raro') === 'Panel')
check('/tienda?ver=stock es Stock y ?ver=datos, Datos', seccionDeTienda('/tienda', '?ver=stock') === 'Stock' && seccionDeTienda('/tienda.html', '?ver=datos') === 'Datos')
check('el móvil: cinco huecos, Vender en el centro (1072)', seccionesDelMovil().map((s) => s.nombre).join(',') === 'Panel,Colección,Vender,Stock,Mensajes' && seccionesDelMovil()[2].clase === 'bm-vender' && seccionesDelMovil()[2].enlaces[0].href === '/tienda?vender=1')
check('/tienda?ver=ventas es Ventas', seccionDeTienda('/tienda', '?ver=ventas') === 'Ventas')
check('/mensajes es Mensajes; su perfil, ninguna', seccionDeTienda('/mensajes.html', '?with=x') === 'Mensajes' && seccionDeTienda('/usuario/prueba', '') === null)
const html = enlacesHtml('Stock')
check('los enlaces de arriba llevan su pestaña y marcan la activa', /<a href="\/tienda\?ver=stock" data-ver="stock" aria-current="page">Stock<\/a>/.test(html) && /<a href="\/mensajes">Mensajes<\/a>/.test(html), html)

console.log('── El color de la sección ──')
const css = leer('css/tienda-marco.css')
const claro = css.match(/html\[data-seccion='tienda'\] \{ --acento: (#[0-9a-f]{6}); --acento-texto: var\(--blanco-fijo\); \}/)?.[1]
const oscuro = css.match(/:root\[data-theme='dark'\]\[data-seccion='tienda'\] \{ --acento: (#[0-9a-f]{6}); --acento-texto: (#[0-9a-f]{6}); \}/)?.slice(1)
check('el color, en los dos temas y con su texto', Boolean(claro && oscuro), JSON.stringify({ claro, oscuro }))
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
if (claro && oscuro) {
  const medidas = {
    'blanco sobre el botón (claro)': ratio('#ffffff', claro),
    'como texto sobre la página (claro)': ratio(claro, '#f6f8fa'),
    'texto oscuro sobre el botón (oscuro)': ratio(oscuro[1], oscuro[0]),
    'como texto sobre la página (oscuro)': ratio(oscuro[0], '#0b1219'),
    'como texto sobre la lateral (oscuro)': ratio(oscuro[0], '#1a2733'),
  }
  const flojas = Object.entries(medidas).filter(([, v]) => v < 4.5)
  check('todas pasan 4,5:1 (SCHEMA 1018)', !flojas.length, JSON.stringify(Object.fromEntries(Object.entries(medidas).map(([k, v]) => [k, v.toFixed(2)]))))
}
check('el color no va en style.css (lo baja todo el mundo)', !/data-seccion='tienda'/.test(leer('css/style.css')))

console.log('── app.js ──')
const app = leer('js/app.js')
const puerta = app.indexOf('puedeAbrirTienda(location.pathname, location.search, marca)')
check('la puerta con la marca va ANTES de esperar a la sesión', puerta > 0 && puerta < app.indexOf('const session = await getSession()', app.indexOf('export async function initNavbar')))
check('y con el perfil, otra vez (por si no había marca)', /puedeAbrirTienda\(location\.pathname, location\.search, \{ u: profile\.username, id: profile\.id \}\)/.test(app))
check('una tienda no cuenta la racha ni baja la lupa de PokeDoc', /if \(!deTienda\) \{\s*import\('\.\/gamification\.js'\)/.test(app) && /deTienda \? null : import\('\.\/nav-search\.js'\)/.test(app))
check('salir borra la marca', /await supabase\.auth\.signOut\(\)\s*recordarTienda\(null\)/.test(app))

console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
