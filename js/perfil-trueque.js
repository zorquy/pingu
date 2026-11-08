// LA TARJETA DE CAMBIOS DEL PERFIL (tanda 1270). PINGU: «la reputación por
// hacer tratos en la web es muy importante, pero está como ahí, es otra
// información más», y «lo de cambia da 25 busca 229 también está ahí como en
// bloque». Eligió la recomendada: UNA tarjeta, debajo de quién es (a la
// izquierda en el PC), con la reputación y su escudo arriba, lo que da y lo que
// busca en dos cifras grandes y, si has entrado, lo que tenéis en común. Junta
// lo que hasta la 1269 eran dos chapas sueltas en la cabecera: el sello de la
// 1105 (`ponerSello`) y «Cambia · da N · busca M» de la 887 (`ponerChapa`).
//
// Le llegan tres cosas por separado y a destiempo: la reputación (la pide ella
// al montarse), las cuentas de lo que da y busca (`ponerCuentas`, desde la
// pestaña Cambios, que ya las calcula) y el cruce (`ponerComun`, cuando lo pinta
// la pestaña). Cada una repinta; sin tratos ni nada que dar o buscar, no sale.
import { escapeHtml } from './html.js'
import { icons } from './icons.js'
import { reputacionDe, nivelDe, textoDeConfianza, NOMBRE_DE_NIVEL } from './cambios-hechos.js'
import { abrirPestania } from './perfil-pestanias.js'

const estado = { caja: null, persona: null, sesion: null, propia: false, rep: null, cuentas: null, comun: null }

const n = (v) => (Number(v) || 0).toLocaleString('es-ES')
const mesYAnio = (iso) => new Date(iso).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

// Puro: lo prueba node. `rep` de `reputacionDe`, `cuentas` { da, busca },
// `comun` { teDa, leDas } o null (no se sabe todavía / sin sesión).
export function truequeHtml({ rep = null, cuentas = null, comun = null, propia = false, conSesion = false, nombre = '' } = {}) {
  const hechos = Number(rep?.hechos) || 0
  const da = Number(cuentas?.da) || 0
  const busca = Number(cuentas?.busca) || 0
  if (!hechos && !da && !busca) return ''
  const nivel = nivelDe(rep)
  const titulo = NOMBRE_DE_NIVEL[nivel] || (hechos === 1 ? '1 trato hecho' : `${n(hechos)} tratos hechos`)
  const detalle = [hechos ? textoDeConfianza(rep).split(' · ').filter((x) => x !== titulo && x !== NOMBRE_DE_NIVEL[nivel]).join(' · ') || null : 'Aún sin tratos en PokeDoc', rep?.primero ? `desde ${mesYAnio(rep.primero)}` : null]
    .filter(Boolean)
    .join(' · ')
  const escudo = `<svg class="pt-escudo" viewBox="0 0 44 48" aria-hidden="true"><path d="M22 2 4 9v13c0 12 8 21 18 24 10-3 18-12 18-24V9L22 2Z"/>${hechos ? '<path class="pt-ok" d="m14 24 6 6 11-12"/>' : ''}</svg>`
  const accion = propia
    ? '<a class="btn-secondary pt-accion" href="/mi-coleccion?ver=cambios">Tus cambios</a>'
    : conSesion
      ? `<button type="button" class="btn-primary pt-accion" data-pt-proponer>${icons.refreshCw(15)}<span>Proponer</span></button>`
      : `<a class="btn-secondary pt-accion" href="/auth.html?registro=1&amp;volver=${encodeURIComponent(typeof location !== 'undefined' ? location.pathname + location.search : '/')}">Entra para cambiar</a>`
  const cifra = (valor, texto) => `<button type="button" class="pt-cifra" data-pt-ver><b>${n(valor)}</b><small>${texto}</small></button>`
  const teDa = Number(comun?.teDa) || 0
  const leDas = Number(comun?.leDas) || 0
  const partes = [teDa ? `Tiene ${n(teDa)} ${teDa === 1 ? 'carta' : 'cartas'} que buscas` : '', leDas ? `${teDa ? 'tú tienes' : 'Tienes'} ${n(leDas)} que busca` : ''].filter(Boolean)
  const lineaComun = comun && !propia && partes.length ? `<p class="pt-comun">${partes.join(' · ')}</p>` : ''
  return `<div class="pt-rep" data-nivel="${nivel}">
      <button type="button" class="pt-rep-boton" data-pt-ver title="Sus tratos y lo que da y busca">${escudo}<span class="pt-rep-t"><b>${escapeHtml(titulo)}</b><small>${escapeHtml(detalle)}</small></span></button>
      ${accion}
    </div>
    ${da || busca ? `<div class="pt-dabusca">${cifra(da, `${da === 1 ? 'carta' : 'cartas'} que ${propia ? 'das' : 'da'}`)}${cifra(busca, `${busca === 1 ? 'carta' : 'cartas'} que ${propia ? 'buscas' : 'busca'}`)}</div>` : ''}
    ${lineaComun}`
}

function pintar() {
  const { caja } = estado
  if (!caja) return
  const html = truequeHtml({
    rep: estado.rep,
    cuentas: estado.cuentas,
    comun: estado.comun,
    propia: estado.propia,
    conSesion: Boolean(estado.sesion?.user?.id),
    nombre: estado.persona?.display_name || estado.persona?.username || '',
  })
  caja.innerHTML = html
  caja.hidden = !html
}

const irACambios = () => {
  abrirPestania('cambios')
  document.getElementById('ptab-cambios')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export async function montarTrueque(caja, { persona, sesion = null, propia = false } = {}) {
  if (!caja || !persona?.id) return
  Object.assign(estado, { caja, persona, sesion, propia })
  caja.addEventListener('click', (e) => {
    if (e.target.closest('[data-pt-ver]')) return irACambios()
    if (e.target.closest('[data-pt-proponer]')) {
      import('./cambio-propuesta.js').then((m) => m.abrirPropuesta({ sesion, otro: persona })).catch(() => {})
    }
  })
  pintar()
  estado.rep = await reputacionDe(persona.id).catch(() => null)
  pintar()
}

export function ponerCuentas(cuentas) {
  estado.cuentas = cuentas
  pintar()
}

export function ponerComun(comun) {
  estado.comun = comun
  pintar()
}
