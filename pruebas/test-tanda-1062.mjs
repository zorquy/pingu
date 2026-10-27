// Tanda 1062 — el histórico de precios, claro (PINGU: «faltan idiomas, los
// colores no coinciden… pone que hay una raya en inglés, otra en alemán…
// pero no hay nada»). Lo que se prueba es la FORMA de los fallos:
//   · una serie no cae al general cuando falta su idioma (eso decía +683 %);
//   · «inglés» no se ofrece: TCGGO lo da como el general;
//   · TCGplayer apagado de serie; las fechas con año en un tramo largo;
//   · un color por serie, el MISMO en la raya, los puntos y el botón.
import { readFileSync } from 'node:fs'
const RAIZ = '/home/user/pingu'
const m = await import(`${RAIZ}/js/carta-historial.js`)
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`) }

// Como la captura: un año de fechas sueltas de TCGGO sin español y dos
// semanas de foto diaria con él.
const filas = []
for (let i = 0; i < 30; i++) filas.push({ dia: new Date(Date.UTC(2025, 9, 14) + i * 12 * 864e5).toISOString().slice(0, 10), origen: 'tcggo', cm_low: 58, cm_low_en: 58, cm_low_de: 1700, cm_low_it: 1600, tp_market_eur: 1300 + i * 30 })
for (let i = 0; i < 14; i++) filas.push({ dia: new Date(Date.UTC(2026, 9, 14) + i * 864e5).toISOString().slice(0, 10), origen: 'foto', cm_low: 372, cm_low_en: 372, cm_low_es: 398, cm_low_de: 1710, cm_low_it: 1610, tp_market_eur: 2322.5 })
filas.sort((a, b) => a.dia.localeCompare(b.dia))

console.log('── 1. Sin mezclas ──')
check('el español solo con sus días (14), no con los 30 del general', m.serieDe(filas, (f) => m.valorDeFila(f, 'es')).length === 14)
check('la chapa de 30 días del español no se afirma (solo hay 14 días)', !/30 d/.test(m.chipsHtml(filas, 'es')) && /7 d/.test(m.chipsHtml(filas, 'es')), m.chipsHtml(filas, 'es'))
check('  …y no sale ningún «+5xx %» de mezclar', !/\+[1-9]\d{2,},/.test(m.chipsHtml(filas, 'es')), m.chipsHtml(filas, 'es'))

console.log('── 2. Qué series ──')
check('tu idioma, el general, el resto y TCGplayer al final; sin inglés', m.seriesDisponibles(filas, 'es').join() === 'es,todos,de,it,tp', m.seriesDisponibles(filas, 'es').join())
check('en inglés, el general pasa delante', m.seriesDisponibles(filas, 'en')[0] === 'todos')
const svg = m.svgDeHistorial(filas, { idioma: 'es' })
check('de serie, dos rayas y sin TCGplayer', (svg.match(/<polyline/g) || []).length === 2 && !/linea-tp/.test(svg))
check('un tramo de un año pone el año en las fechas', /14 oct 2025/.test(svg) && /27 oct 2026/.test(svg), (svg.match(/<text[^>]*>[^<]*/g) || []).join(' | '))
check('un tramo corto, sin año', !/2026/.test(m.svgDeHistorial(filas.slice(-14), { idioma: 'es' }).replace(/aria-label="[^"]*"/, '').replace(/data-puntos="[^"]*"/, '')))
check('el eje sin céntimos de 100 € para arriba (cabe en el móvil)', /398 €|410 €/.test(m.svgDeHistorial(filas.slice(-14), { idioma: 'es', visibles: ['es'] })) && !/2\.322,50 €/.test(m.svgDeHistorial(filas, { idioma: 'es', visibles: ['tp'] }).replace(/aria-label="[^"]*"/, '')))
const mandos = m.mandosHtml(filas, 'es', ['es', 'todos'])
check('los botones: con su bandera, el tuyo marcado y TCGplayer (EE. UU.) apagado', /data-serie="es" aria-pressed="true"><i><\/i><span class="pv-bandera" data-idioma="es">/.test(mandos) && /data-serie="tp" aria-pressed="false"/.test(mandos) && /\(la tuya\)/.test(mandos))
check('abajo, de dónde sale y desde cuándo', /una muestra al día; antes, las fechas sueltas que da TCGGO\. Desde el 14 oct 2025/.test(m.origenHtml(filas)), m.origenHtml(filas))

console.log('── 3. Un color por serie ──')
const css = readFileSync(`${RAIZ}/css/cardmarket.css`, 'utf8')
check('la raya, el punto y el botón leen el MISMO token (--serie)', /\.carta-historial-linea\[data-serie\] \{ stroke: var\(--serie\)/.test(css) && /\.carta-historial-punto \{ fill: var\(--serie\)/.test(css) && /\.carta-historial-serie i \{[^}]*background: var\(--serie\)/.test(css) && /\.carta-historial-serie\[aria-pressed='true'\] \{[^}]*border-color: var\(--serie\)/.test(css))
check('ningún color de leyenda vieja por idioma (la de TCGplayer estaba dos veces)', !/carta-historial-leyenda/.test(css) && !/carta-historial-linea\[data-idioma/.test(css))
const series = [...css.matchAll(/\[data-serie='([a-z]+)'\] \{ --serie: var\((--[a-z-]+)\)/g)].map((x) => x[1] + '=' + x[2])
check('cada serie su token y sin repetir entre las de Cardmarket', new Set(series.filter((s) => !s.startsWith('tp')).map((s) => s.split('=')[1])).size === series.filter((s) => !s.startsWith('tp')).length, series.join(' '))
check('sin rojo ni verde (dirían «baja» y «sube»)', !series.some((s) => /danger|success/.test(s)))

console.log(fails ? `❌ ${fails} FALLAN` : '✅ TODO BIEN')
process.exit(fails ? 1 : 0)
