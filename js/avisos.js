// /avisos (tanda 1168, M4 de «PokeDoc entera»): TODOS tus avisos, leídos y
// sin leer. La campana enseña solo lo sin leer (736) y en cuanto lees uno se
// va: no había ningún sitio donde volver a ver «quién me siguió la semana
// pasada» o «qué me dijeron en aquel tema». Esta página es ese sitio.
//
// La fila es LA DE LA CAMPANA (`tramosHtml` de avisos-grupos.js: agrupadas,
// por días —y por meses, más atrás—, con la etiqueta de su sección), que un
// aviso se pinta igual en toda la web. Lo propio de aquí: los chips por
// sección (con lo sin leer de cada una; lo puro en avisos-chips.js, que lo
// prueba Node), «Marcar todo como leído», y que la lista crece al bajar (de
// 60 en 60: Supabase corta a 1.000 y aquí nadie quiere mil filas de golpe).
// Marcar leído sigue el patrón de la 896: se pinta ya y se confirma después.
import { supabase } from './supabase.js'
import { requireAuth } from './app.js'
import { escapeHtml } from './html.js'
import { tramosHtml } from './avisos-grupos.js'
import { CHIPS, casaConChip, cuentasDeChips } from './avisos-chips.js'
import { icons } from './icons.js'

// Cada aviso con el icono de su sección en su color (1221, la maqueta de «La
// web como la portada»). La fila sigue siendo la de la campana (`tramosHtml`):
// aquí, después de pintarla, se le pone delante el icono y la sección pasa a
// la línea de la fecha («Comunidad · hace 3 h»). La campana no cambia.
const ICONO_DE_SECCION = { comunidad: icons.messageSquare, cartas: icons.refreshCw, jugar: icons.trophy, mensajes: icons.mail, ti: icons.users }
function vestirFilas(lista) {
  for (const fila of lista.querySelectorAll('.nav-bell-item')) {
    if (fila.querySelector('.av-ico')) continue
    const etiqueta = fila.querySelector('.nav-bell-seccion')
    const llave = etiqueta?.dataset.seccion || 'ti'
    fila.insertAdjacentHTML('afterbegin', `<span class="av-ico" data-seccion="${llave}" aria-hidden="true">${(ICONO_DE_SECCION[llave] || icons.bell)(16)}</span>`)
    const fecha = fila.querySelector('.nav-bell-item-date')
    if (fecha) fecha.textContent = `${etiqueta ? etiqueta.textContent : 'Para ti'} · ${fecha.textContent}`
    etiqueta?.remove()
  }
}

// «Esta semana»: los avisos de los últimos siete días que ya se han traído.
const deEstaSemana = (lista) => lista.filter((a) => Date.now() - new Date(a.created_at).getTime() < 7 * 864e5).length

export const TANDA = 60
const chipsHtml = (cuentas, activo) => CHIPS.map((c) => `
  <button type="button" class="chip-filtro av-chip" role="tab" data-chip="${c.id}"${c.llave ? ` data-seccion="${c.llave}"` : ''} aria-selected="${c.id === activo}">${escapeHtml(c.texto)}${cuentas[c.id] ? `<b class="av-chip-n">${cuentas[c.id]}</b>` : ''}</button>`).join('')

const vacioHtml = (chip) => `
  <div class="empty-state av-vacio">
    <p>${chip === 'todos' ? 'Todavía no tienes ningún aviso. Cuando te respondan en el foro, te sigan o pase algo con tus cartas o tus torneos, lo verás aquí.' : 'Ningún aviso de este tipo. Cuando pase algo, lo verás aquí.'}</p>
    <div class="av-salidas">
      <a class="btn-secondary" href="/ajustes?ver=avisos">Qué avisos recibir</a>
      ${chip === 'todos' ? '<a class="btn-secondary" href="/foro">Pasarte por el foro</a>' : '<button type="button" class="btn-secondary" data-chip="todos">Ver todos</button>'}
    </div>
  </div>`

// La campana y los números de la barra (1139) leen `window.__pdAvisos`: lo
// que se marca aquí se les quita de ahí y se les avisa.
function avisarALaCampana(cual) {
  window.__pdAvisos = (window.__pdAvisos || []).filter((a) => !cual(a))
  window.dispatchEvent(new Event('pd-avisos-cambiados'))
}

export async function montar() {
  const session = await requireAuth()
  if (!session) return
  const lista = document.getElementById('avLista')
  const chips = document.getElementById('avChips')
  const pie = document.getElementById('avPie')
  const leerTodo = document.getElementById('avLeerTodo')
  if (!lista || !chips || !pie) return

  let avisos = []
  let seAcabo = false
  let pidiendo = false
  let activo = ['todos', ...CHIPS.map((c) => c.id)].includes(new URLSearchParams(location.search).get('ver')) ? new URLSearchParams(location.search).get('ver') : 'todos'

  async function pedir() {
    if (pidiendo || seAcabo) return
    pidiendo = true
    const { data, error } = await supabase
      .from('user_notifications')
      .select('*')
      .eq('recipient_id', session.user.id)
      .order('created_at', { ascending: false })
      .range(avisos.length, avisos.length + TANDA - 1)
    pidiendo = false
    if (error) {
      // Tres finales distintos (510): esto es «no se ha podido preguntar».
      const { pintarSinRespuesta } = await import('./no-encontrado.js')
      pintarSinRespuesta(lista, 'No se han podido cargar tus avisos.')
      seAcabo = true
      return
    }
    const nuevos = (data || []).filter((a) => !avisos.some((b) => b.id === a.id))
    avisos = avisos.concat(nuevos)
    if ((data || []).length < TANDA) seAcabo = true
  }

  function pintar() {
    const cuentas = cuentasDeChips(avisos)
    chips.innerHTML = chipsHtml(cuentas, activo)
    leerTodo.hidden = !cuentas.todos
    const visibles = avisos.filter((a) => casaConChip(a, activo))
    lista.innerHTML = visibles.length ? tramosHtml(visibles, { porTramo: true, meses: true }) : seAcabo ? vacioHtml(activo) : ''
    vestirFilas(lista)
    const nSin = document.getElementById('avNSinLeer')
    if (nSin) {
      nSin.textContent = String(cuentas.todos || 0)
      document.getElementById('avNSemana').textContent = `${deEstaSemana(avisos)}${seAcabo ? '' : '+'}`
    }
    pie.innerHTML = seAcabo
      ? (visibles.length ? `<p class="av-fin">Eso es todo${avisos.length > TANDA ? ` · ${avisos.length} avisos` : ''}</p>` : '')
      : `<button type="button" class="btn-secondary av-mas" id="avMas">Cargar más</button>`
  }

  // Si el chip activo se queda sin filas pero quedan avisos por traer, se
  // siguen trayendo hasta que aparezca alguno o no quede nada: un filtro no
  // puede decir «nada» de lo que aún no se ha pedido.
  async function completar() {
    while (!seAcabo && !avisos.some((a) => casaConChip(a, activo))) await pedir()
  }

  await pedir()
  await completar()
  pintar()

  chips.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-chip]')
    if (!b) return
    activo = b.dataset.chip
    const url = new URL(location.href)
    if (activo === 'todos') url.searchParams.delete('ver')
    else url.searchParams.set('ver', activo)
    history.replaceState(null, '', url)
    pintar()
    await completar()
    pintar()
  })
  lista.addEventListener('click', (e) => {
    const b = e.target.closest('[data-chip]')
    if (b) { activo = b.dataset.chip; pintar(); return }
    const fila = e.target.closest('[data-notif-ids]')
    if (!fila) return
    const ids = fila.dataset.notifIds.split(',')
    const ahora = new Date().toISOString()
    // Se marca aquí y se confirma después (896); el enlace sigue su camino.
    for (const a of avisos) if (ids.includes(a.id) && !a.read_at) a.read_at = ahora
    fila.classList.remove('unread')
    supabase.from('user_notifications').update({ read_at: ahora }).in('id', ids).then(({ error }) => { if (error) console.warn('No se ha podido marcar el aviso:', error.message) })
    avisarALaCampana((a) => ids.includes(a.id))
    const href = fila.getAttribute('href')
    if (!href || href === '#') { e.preventDefault(); pintar() }
  })
  leerTodo.addEventListener('click', async () => {
    const ahora = new Date().toISOString()
    const antes = avisos.map((a) => a.read_at)
    for (const a of avisos) if (!a.read_at) a.read_at = ahora
    pintar()
    const { error } = await supabase.from('user_notifications').update({ read_at: ahora }).eq('recipient_id', session.user.id).is('read_at', null)
    if (error) {
      avisos.forEach((a, i) => { a.read_at = antes[i] })
      pintar()
      import('./toast.js').then((m) => m.showToast('No se ha podido marcar. Prueba otra vez.', 'error')).catch(() => {})
      return
    }
    avisarALaCampana(() => true)
  })

  // Crece al bajar; el botón queda para quien no llega al final o no tiene
  // IntersectionObserver.
  const masAlBajar = async () => { await pedir(); await completar(); pintar() }
  pie.addEventListener('click', (e) => { if (e.target.closest('#avMas')) masAlBajar() })
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entradas) => { if (entradas.some((x) => x.isIntersecting) && !seAcabo) masAlBajar() }, { rootMargin: '400px' }).observe(pie)
  }
}

if (typeof document !== 'undefined' && document.getElementById('avLista')) montar()
