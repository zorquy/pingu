// /admin → Guía de estilo (tanda 1326b, D6 del plan 2027): lo común de la web
// pintado DE VERDAD, con las mismas funciones y hojas que lo pintan fuera, para
// ver qué existe antes de inventar otro y comprobar un cambio de un vistazo.
//
// Es «viva» en los dos sentidos: los tokens se leen del `:root` de style.css
// (uno nuevo sale aquí sin tocar nada) y cada pieza la dibuja su función
// (`chapaDeEstadoHtml`, `vacioHtml`…), así que si cambia fuera, cambia aquí.
import { escapeHtml } from '../../js/html.js'
import { icons } from '../../js/icons.js'
import { chapaDeEstadoHtml } from '../../js/estado-chapa.js'
import { ESTADOS } from '../../js/cardmarket.js'
import { chapaDeGradeoHtml } from '../../js/gradeo-elegir.js'
import { chapaDeVersionHtml } from '../../js/mi-coleccion/iconos-version.js'
import { banderaHtml } from '../../js/precio-vista.js'
import { atributosDeRango } from '../../js/rangos.js'
import { vacioHtml } from '../../js/vacio.js'
import { showToast } from '../../js/toast.js'

// ── Lo puro: los tokens de la hoja ──

// Las declaraciones del PRIMER `:root { … }` de una hoja (el tema claro; el
// oscuro las redefine debajo y se ve con el botón de tema).
export function tokensDeHoja(css) {
  const sin = String(css || '').replace(/\/\*[\s\S]*?\*\//g, '')
  const m = /(^|\n)\s*:root\s*\{([^}]*)\}/.exec(sin)
  if (!m) return []
  return [...m[2].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)].map((x) => ({ nombre: x[1], valor: x[2].trim() }))
}

// En qué apartado sale cada token. Por el NOMBRE, que es la convención de la
// casa (305, 310, 311); lo que no casa con ninguna familia y parece un color
// va con los colores, y lo demás a «Otros», que así no se pierde ninguno.
export function grupoDeToken({ nombre, valor }) {
  if (/^--t-/.test(nombre)) return 'letra'
  if (/^--e-/.test(nombre)) return 'espaciado'
  if (/^--radius-/.test(nombre)) return 'radios'
  if (/^--(shadow|sombra)/.test(nombre)) return 'sombras'
  if (/^--font-/.test(nombre)) return 'fuentes'
  if (/^(#|rgb|hsl|oklch|color-mix|var\(--)/i.test(valor) || /gradient/.test(valor)) return 'colores'
  return 'otros'
}

export const APARTADOS = [
  { id: 'colores', titulo: 'Color', donde: 'css/style.css, `:root` y su tema oscuro' },
  { id: 'letra', titulo: 'Escala de letra', donde: '`--t-2xs`…`--t-3xl` (305): nunca un tamaño suelto' },
  { id: 'espaciado', titulo: 'Espaciado', donde: '`--e-xs`…`--e-2xl` (310): hasta 32 px, uno de los seis pasos' },
  { id: 'radios', titulo: 'Esquinas', donde: '`--radius-*`' },
  { id: 'sombras', titulo: 'Sombras y foco', donde: '`--shadow-*`; el anillo de foco es `--shadow-ring` (737)' },
  { id: 'botones', titulo: 'Botones', donde: 'style.css (917, 1225): tres clases, en pastilla' },
  { id: 'chips', titulo: 'Chips, segmentos y pestañas', donde: 'components.css: `.chip-filtro`, `.seg`, `.tabs`' },
  { id: 'chapas', titulo: 'Chapas de una carta', donde: 'estado, gradeo, versión e idioma: sus funciones, en toda la web' },
  { id: 'nombres', titulo: 'Nombres con rango', donde: 'js/rangos.js, `atributosDeRango`' },
  { id: 'vacio', titulo: 'Una pantalla vacía', donde: 'js/vacio.js, `vacioHtml` (1325)' },
  { id: 'avisos', titulo: 'Avisos y pop-ups', donde: 'js/toast.js, `showToast`; `.modal-overlay` en components.css' },
  { id: 'iconos', titulo: 'Iconos', donde: 'js/icons.js: nunca un emoji suelto' },
]

// ── Las piezas ──

const codigo = (t) => escapeHtml(t).replace(/`([^`]+)`/g, '<code>$1</code>')
const caja = (a, cuerpo) => `<section class="gde-apartado" id="gde-${a.id}">
  <header><h2>${escapeHtml(a.titulo)}</h2><p>${codigo(a.donde)}</p></header>
  ${cuerpo}
</section>`

function coloresHtml(tokens) {
  return `<div class="gde-colores">${tokens.map((t) => `<div class="gde-color">
    <span class="gde-muestra" style="background:var(${t.nombre})"></span>
    <code>${escapeHtml(t.nombre)}</code><small data-valor="${escapeHtml(t.nombre)}">${escapeHtml(t.valor)}</small>
  </div>`).join('')}</div>`
}

const letraHtml = (tokens) => `<div class="gde-filas">${tokens.map((t) => `<div class="gde-fila">
  <code>${escapeHtml(t.nombre)}</code><span style="font-size:var(${t.nombre})">Pikachu ex · 1.234,50 €</span>
</div>`).join('')}
  <div class="gde-fila"><code>--font-display</code><span class="gde-display">Outfit para títulos y cifras</span></div></div>`

const espaciadoHtml = (tokens) => `<div class="gde-filas">${tokens.map((t) => `<div class="gde-fila">
  <code>${escapeHtml(t.nombre)}</code><span class="gde-barra" style="width:var(${t.nombre})"></span><small>${escapeHtml(t.valor.replace(/\s.*$/, ''))}</small>
</div>`).join('')}</div>`

const radiosHtml = (tokens) => `<div class="gde-radios">${tokens.map((t) => `<div><span class="gde-radio" style="border-radius:var(${t.nombre})"></span><code>${escapeHtml(t.nombre)}</code></div>`).join('')}</div>`

const sombrasHtml = (tokens) => `<div class="gde-radios">${tokens.map((t) => `<div><span class="gde-radio gde-sombra" style="box-shadow:var(${t.nombre})"></span><code>${escapeHtml(t.nombre)}</code></div>`).join('')}</div>`

const botonesHtml = () => `<div class="gde-fila-libre">
  <button type="button" class="btn-primary">Principal</button>
  <button type="button" class="btn-secondary">Suave</button>
  <button type="button" class="btn-primary">${icons.share(16)} Con icono</button>
  <button type="button" class="btn-primary" disabled>Desactivado</button>
  <button type="button" class="btn-secondary" disabled>Desactivado</button>
  <a class="link-btn" href="#gde-botones">Enlace suelto</a>
</div>
<p class="gde-nota">El de icono es <code>.mc-ficha-redondo</code> (círculo de 44 px, mi-coleccion.css). Un botón nuevo es de una de estas tres clases, sin bordes ni subtítulos dentro.</p>`

const chipsHtml = () => `<div class="gde-fila-libre">
  <button type="button" class="chip-filtro active" aria-pressed="true">Elegido</button>
  <button type="button" class="chip-filtro" aria-pressed="false">Otro</button>
  <button type="button" class="chip-filtro" aria-pressed="false">Y otro</button>
</div>
<div class="gde-fila-libre"><div class="seg" role="group"><button type="button" class="seg-btn active" aria-pressed="true">Todas</button><button type="button" class="seg-btn" aria-pressed="false">Tengo</button><button type="button" class="seg-btn" aria-pressed="false">Faltan</button></div></div>
<div class="tabs" role="tablist"><button type="button" class="tab-btn active" role="tab" aria-selected="true">Resumen</button><button type="button" class="tab-btn" role="tab" aria-selected="false">Colección</button><button type="button" class="tab-btn" role="tab" aria-selected="false">Cambios</button></div>`

const VERSIONES = ['normal', 'holo', 'reverse', 'primera', 'unlimited', 'shadowless', 'cosmos', 'sello', 'estrella']
const IDIOMAS = ['es', 'en', 'de', 'fr', 'it', 'pt', 'nl', 'ja', 'ko', 'zh']

const chapasHtml = () => `<div class="gde-filas">
  <div class="gde-fila"><code>chapaDeEstadoHtml</code><span class="gde-fila-libre">${ESTADOS.map((e) => chapaDeEstadoHtml(e.id)).join('')}</span></div>
  <div class="gde-fila"><code>chapaDeGradeoHtml</code><span class="gde-fila-libre">${['PSA 10', 'BGS 9.5', 'CGC 10'].map((g) => chapaDeGradeoHtml(g)).join('')}</span></div>
  <div class="gde-fila"><code>chapaDeVersionHtml</code><span class="gde-fila-libre">${VERSIONES.map((v) => chapaDeVersionHtml(v)).join('')}</span></div>
  <div class="gde-fila"><code>banderaHtml</code><span class="gde-fila-libre">${IDIOMAS.map((i) => `<span class="gde-idioma">${banderaHtml(i)}${i.toUpperCase()}</span>`).join('')}</span></div>
</div>`

const nombresHtml = () => `<div class="gde-fila-libre">${[
  { username: 'admin', display_name: 'Administración', is_admin: true },
  { username: 'mod', display_name: 'Moderación', is_moderator: true },
  { username: 'tienda', display_name: 'Una tienda', tipo: 'tienda' },
  { username: 'ana', display_name: 'Una persona' },
].map((p) => `<strong ${atributosDeRango(p)}>${escapeHtml(p.display_name)}</strong>`).join('<span aria-hidden="true">·</span>')}</div>`

const vacioDemo = () => `<div class="gde-marco">${vacioHtml({ titulo: 'Aún no hay nada aquí', texto: 'Qué irá aquí, en una frase.', salidas: [{ texto: 'La salida buena', href: '#gde-vacio' }, { texto: 'Otra', href: '#gde-vacio' }] })}</div>`

const avisosHtml = () => `<div class="gde-fila-libre">
  <button type="button" class="btn-secondary" data-gde-toast="success">Aviso de hecho</button>
  <button type="button" class="btn-secondary" data-gde-toast="error">Aviso de error</button>
  <button type="button" class="btn-secondary" data-gde-toast="deshacer">Con «Deshacer»</button>
  <button type="button" class="btn-secondary" data-gde-popup>Abrir un pop-up</button>
</div>
<div class="modal-overlay hidden" id="gdePopup" role="dialog" aria-modal="true" aria-labelledby="gdePopupTitulo">
  <div class="modal-box"><h3 id="gdePopupTitulo">Un pop-up</h3><p>Centrado, con tope de alto, y lo de dentro se desliza. En el móvil, hoja desde abajo.</p>
  <div class="modal-actions"><button type="button" class="btn-secondary" data-gde-cerrar>Cancelar</button><button type="button" class="btn-primary" data-gde-cerrar>Vale</button></div></div>
</div>`

const iconosHtml = () => `<div class="gde-iconos">${Object.entries(icons).filter(([, f]) => typeof f === 'function').map(([n, f]) => `<div class="gde-icono" title="${escapeHtml(n)}">${f(20)}<code>${escapeHtml(n)}</code></div>`).join('')}</div>`

export function guiaHtml(tokens) {
  const de = (g) => tokens.filter((t) => grupoDeToken(t) === g)
  const cuerpos = {
    colores: coloresHtml(de('colores')),
    letra: letraHtml(de('letra')),
    espaciado: espaciadoHtml(de('espaciado')),
    radios: radiosHtml(de('radios')),
    sombras: sombrasHtml(de('sombras')),
    botones: botonesHtml(),
    chips: chipsHtml(),
    chapas: chapasHtml(),
    nombres: nombresHtml(),
    vacio: vacioDemo(),
    avisos: avisosHtml(),
    iconos: iconosHtml(),
  }
  const indice = APARTADOS.map((a) => `<a href="#gde-${a.id}">${escapeHtml(a.titulo)}</a>`).join('')
  return `<div class="gde-barra-arriba">
    <nav class="gde-indice" aria-label="Apartados">${indice}</nav>
    <button type="button" class="btn-secondary" data-gde-tema>${icons.moon(16)} Ver en el otro tema</button>
  </div>
  ${APARTADOS.map((a) => caja(a, cuerpos[a.id])).join('')}`
}

// ── El montaje ──

export async function montarGuiaEstilo(raiz) {
  if (!raiz || raiz.dataset.montada) return
  raiz.dataset.montada = '1'
  let tokens = []
  try { tokens = tokensDeHoja(await (await fetch('/css/style.css')).text()) } catch { /* sin tokens: el resto sale igual */ }
  raiz.innerHTML = guiaHtml(tokens)
  // El valor de cada color, el que manda AHORA (en el tema que se ve).
  const pintarValores = () => {
    const cs = getComputedStyle(document.documentElement)
    raiz.querySelectorAll('[data-valor]').forEach((el) => { el.textContent = cs.getPropertyValue(el.dataset.valor).trim() || el.textContent })
  }
  pintarValores()
  const popup = raiz.querySelector('#gdePopup')
  raiz.addEventListener('click', (e) => {
    const t = e.target.closest('[data-gde-tema], [data-gde-toast], [data-gde-popup], [data-gde-cerrar]')
    if (!t) return
    if (t.hasAttribute('data-gde-tema')) {
      // Solo esta pestaña: no se guarda en el navegador (eso es del interruptor de siempre).
      const r = document.documentElement
      r.dataset.theme = r.dataset.theme === 'dark' ? 'light' : 'dark'
      pintarValores()
    } else if (t.dataset.gdeToast === 'deshacer') {
      showToast('Quitada de «La quiero».', 'success', { accion: { texto: 'Deshacer', alPulsar: () => showToast('Vuelve a estar.', 'success') } })
    } else if (t.dataset.gdeToast) {
      showToast(t.dataset.gdeToast === 'error' ? 'No se ha podido guardar. Prueba otra vez.' : 'Guardado.', t.dataset.gdeToast)
    } else if (t.hasAttribute('data-gde-popup')) {
      popup?.classList.remove('hidden')
    } else popup?.classList.add('hidden')
  })
}
