// «LA TIENES» Y «LA QUIERES», EN CUALQUIER SITIO DE LA WEB (tanda 943).
//
// PINGU: «los iconos de que la tienes, todo eso debería estar en todos los
// lados de la web». Dentro de Mi colección las marcas las pinta la propia
// pantalla, que tiene la colección en memoria; fuera (el buscador, la
// vitrina de otro, las cartas de una guía, las otras versiones de /carta)
// nadie la tiene, así que este módulo pregunta SOLO por las cartas que hay
// en pantalla y pinta lo mismo: el ✓ verde con cuántas, y el corazón rosa
// si te falta y la quieres.
//
// Quien pinta cartas pone `data-marca-carta="<id>"` en la caja de la foto
// (o en la fila, con `data-marca-forma="fila"`) y llama a `marcarCartas`
// con la raíz. Entra por `import()`: sin cuenta no se baja nada más que el
// propio módulo, y no pregunta nada.
import { supabase } from './supabase.js'
import { hojaInyectada } from './hoja.js'
import { ICONOS_COLECCION } from './mi-coleccion/iconos.js'

// Lo ya preguntado en esta página, por carta: cuántas tienes y si la quieres.
const tengo = new Map()
const quiero = new Set()
const preguntadas = new Set()
let sesionId

async function quienMira() {
  if (sesionId !== undefined) return sesionId
  const { data } = await supabase.auth.getSession().catch(() => ({ data: null }))
  sesionId = data?.session?.user?.id || null
  return sesionId
}

// De 150 en 150: un `in.(…)` largo es una URL larga.
async function preguntar(userId, ids) {
  for (let i = 0; i < ids.length; i += 150) {
    const trozo = ids.slice(i, i + 150)
    const [col, des] = await Promise.all([
      supabase.from('user_collection').select('card_id,cantidad').eq('user_id', userId).in('card_id', trozo),
      supabase.from('user_wants').select('card_id').eq('user_id', userId).in('card_id', trozo),
    ])
    // Si una de las dos falla, lo de esas cartas NO se sabe: no se apuntan
    // como preguntadas y no se pinta nada de ellas (un hueco no es un «no»).
    if (col.error || des.error) continue
    for (const f of col.data || []) tengo.set(f.card_id, (tengo.get(f.card_id) || 0) + (Number(f.cantidad) || 1))
    for (const f of des.data || []) quiero.add(f.card_id)
    for (const id of trozo) preguntadas.add(id)
  }
}

// El HTML de las marcas de una carta. Puro, para las pruebas.
export function marcasHtml({ n = 0, quiere = false, forma = 'foto' } = {}) {
  if (forma === 'fila') {
    if (n) return `<span class="mk-fila mk-fila-tengo" title="La tienes">✓${n > 1 ? ` ${n}` : ''}</span>`
    return quiere ? `<span class="mk-fila mk-fila-quiero" title="La quieres">${ICONOS_COLECCION.corazon(14)}</span>` : ''
  }
  // `<i>` y no `<span>`: quien pinta suele leer sus rótulos por `span` (la
  // vitrina lo hace), y el ✓ se colaba como el nombre de una carta.
  if (n) return `<i class="mk-tengo" aria-hidden="true">✓${n > 1 ? `<b>${n}</b>` : ''}</i>`
  return quiere ? `<i class="mk-quiero" aria-hidden="true">${ICONOS_COLECCION.corazon(14)}</i>` : ''
}

// Lo que se lee en voz alta, que se suma al nombre del enlace.
export const marcasTexto = ({ n = 0, quiere = false } = {}) => (n ? (n > 1 ? `tienes ${n}` : 'la tienes') : quiere ? 'la quieres' : '')

export async function marcarCartas(raiz = document) {
  const cajas = [...(raiz?.querySelectorAll?.('[data-marca-carta]:not([data-marcada])') || [])]
  if (!cajas.length) return
  const userId = await quienMira()
  if (!userId) return
  const ids = [...new Set(cajas.map((el) => el.dataset.marcaCarta).filter((id) => id && !preguntadas.has(id)))]
  await Promise.all([ids.length ? preguntar(userId, ids) : null, hojaInyectada('css/marcas-carta.css')])
  for (const el of cajas) {
    const id = el.dataset.marcaCarta
    if (!preguntadas.has(id) || !el.isConnected) continue
    el.dataset.marcada = ''
    const estado = { n: tengo.get(id) || 0, quiere: quiero.has(id), forma: el.dataset.marcaForma || 'foto' }
    const html = marcasHtml(estado)
    if (!html) continue
    el.insertAdjacentHTML('beforeend', html)
    el.classList.add(estado.n ? 'mk-la-tienes' : 'mk-la-quieres')
    // El enlace que la envuelve dice también lo que se ve.
    const enlace = el.closest('a')
    const texto = marcasTexto(estado)
    if (enlace && texto) enlace.setAttribute('aria-label', `${enlace.getAttribute('aria-label') || (enlace.innerText || enlace.textContent).trim().replace(/\s+/g, ' ')}, ${texto}`)
  }
}

// Para quien cambia la colección sin recargar (Mayús+Intro en la paleta):
// lo de esa carta se vuelve a preguntar.
export function olvidarCarta(id) {
  preguntadas.delete(id)
  tengo.delete(id)
  quiero.delete(id)
}

// Para las pruebas, que cambian de usuario sin recargar.
export function _reiniciar() {
  tengo.clear()
  quiero.clear()
  preguntadas.clear()
  sesionId = undefined
}
