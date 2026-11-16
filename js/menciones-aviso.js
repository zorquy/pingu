// Las @menciones que no llevan a nadie, avisadas MIENTRAS escribes (tanda
// 1383, PINGU: «no sé si todas las menciones funcionan, porque hay algunas
// que sí y otras no»). Antes solo se veía al publicar: el nombre salía en
// texto plano y nadie recibía el aviso. Ahora, al parar de escribir un
// momento, el nombre que no es de nadie lleva un subrayado ondulado (la
// Custom Highlight API: no toca el texto, así que no puede acabar guardado)
// y debajo de la caja una línea lo dice y, si hay alguien parecido, lo
// propone con un botón que lo cambia.
//
// Se engancha desde `engancharAutocompletarMenciones`, solo en las cajas del
// editor (`.rte-surface`), y pide a la base solo los nombres nuevos.
import { supabase } from './supabase.js'
import { nombresMencionados, perfilesMencionados, porNombre, encajeDe } from './menciones.js'

const NOMBRE_RESALTE = 'mencion-sin-nadie'
// Los resaltes de cada caja: el registro de CSS es uno para toda la página.
const resaltes = new Map()

function repintarResaltes() {
  if (typeof CSS === 'undefined' || !CSS.highlights || typeof Highlight === 'undefined') return
  const todos = [...resaltes.values()].flat()
  if (todos.length) CSS.highlights.set(NOMBRE_RESALTE, new Highlight(...todos))
  else CSS.highlights.delete(NOMBRE_RESALTE)
}

// Distancia de edición, para «¿querías decir…?» (nombres cortos: barato).
export function distancia(a, b) {
  const fila = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let previo = fila[0]
    fila[0] = i
    for (let j = 1; j <= b.length; j++) {
      const guardado = fila[j]
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, previo + (a[i - 1] === b[j - 1] ? 0 : 1))
      previo = guardado
    }
  }
  return fila[b.length]
}

// El usuario más parecido a un nombre que no existe, o null.
export function elMasParecido(nombre, usuarios) {
  const n = nombre.toLowerCase().replace(/\./g, '-')
  let mejor = null
  for (const u of usuarios) {
    const d = distancia(n, u.toLowerCase())
    if (d <= Math.max(1, Math.min(2, Math.floor(n.length / 3))) && (!mejor || d < mejor.d)) mejor = { u, d }
  }
  return mejor?.u || null
}

// Los rangos de cada «@nombre» escrito en la caja (sin distinguir mayúsculas).
function rangosDe(superficie, nombres) {
  const rangos = []
  if (!nombres.length) return rangos
  const quitarPunto = (x) => x.replace(/[.\\^$*+?()[\]{}|]/g, '\\$&')
  const re = new RegExp(`(^|[^a-z0-9@._-])@(${nombres.map(quitarPunto).join('|')})(?![a-z0-9_-])`, 'gi')
  const paseo = document.createTreeWalker(superficie, NodeFilter.SHOW_TEXT)
  while (paseo.nextNode()) {
    const nodo = paseo.currentNode
    for (const m of nodo.data.matchAll(re)) {
      const r = document.createRange()
      const desde = m.index + m[1].length
      r.setStart(nodo, desde)
      r.setEnd(nodo, desde + 1 + m[2].length)
      rangos.push(r)
    }
  }
  return rangos
}

// Cambia cada «@malo» escrito por «@bueno» y avisa al editor (su `input`).
function cambiarEnLaCaja(superficie, malo, bueno) {
  for (const r of rangosDe(superficie, [malo]).reverse()) {
    r.deleteContents()
    r.insertNode(document.createTextNode(`@${bueno}`))
  }
  superficie.normalize()
  superficie.dispatchEvent(new Event('input', { bubbles: true }))
}

export function vigilarMenciones(superficie) {
  if (!superficie || superficie.__vigilaMenciones) return
  superficie.__vigilaMenciones = true
  const linea = document.createElement('p')
  linea.className = 'rte-aviso-menciones hidden'
  linea.setAttribute('role', 'status')
  linea.setAttribute('aria-live', 'polite')
  ;(superficie.closest('.rte-wrap') || superficie).after(linea)

  // nombre → { bien: bool, parecido: string|null }; se pregunta una vez.
  const sabidos = new Map()
  let vuelta = 0
  let espera = null

  async function revisar() {
    const esta = ++vuelta
    const nombres = nombresMencionados(superficie.textContent || '', { tope: 400 })
    const nuevos = nombres.filter((n) => !sabidos.has(n))
    if (nuevos.length) {
      const mapa = porNombre(await perfilesMencionados(nuevos.map((n) => `@${n}`).join(' ')))
      const malos = []
      for (const n of nuevos) {
        const e = encajeDe(n, mapa)
        // Con punto y solo lo de antes del punto encaja: tampoco es quien se
        // escribió (se enlazaría «@sergio» y «.m» en texto).
        if (e?.entero) sabidos.set(n, { bien: true })
        else malos.push(n)
      }
      // ¿Alguien parecido? Una consulta por nombre, con sus tres primeras letras.
      await Promise.all(
        malos.slice(0, 5).map(async (n) => {
          let parecido = null
          try {
            const { data } = await supabase.from('user_profiles').select('username').ilike('username', `${n.slice(0, 3).replace(/[%_]/g, '')}%`).limit(40)
            parecido = elMasParecido(n, (data || []).map((d) => d.username).filter(Boolean))
          } catch {
            parecido = null
          }
          sabidos.set(n, { bien: false, parecido })
        })
      )
      for (const n of malos.slice(5)) sabidos.set(n, { bien: false, parecido: null })
      if (esta !== vuelta) return
    }
    pintar(nombres.filter((n) => sabidos.get(n)?.bien === false))
  }

  function pintar(malos) {
    resaltes.set(superficie, rangosDe(superficie, malos))
    repintarResaltes()
    linea.classList.toggle('hidden', !malos.length)
    linea.replaceChildren()
    malos.slice(0, 3).forEach((n, i) => {
      if (i) linea.append(' ')
      linea.append(`«@${n}» no es nadie de PokeDoc.`)
      const parecido = sabidos.get(n)?.parecido
      if (parecido) {
        linea.append(' ¿Querías decir ')
        const b = document.createElement('button')
        b.type = 'button'
        b.textContent = `@${parecido}`
        b.addEventListener('click', () => {
          cambiarEnLaCaja(superficie, n, parecido)
          sabidos.set(parecido.toLowerCase(), { bien: true })
          revisar()
        })
        linea.append(b, '?')
      }
    })
    if (malos.length > 3) linea.append(` Y ${malos.length - 3} más.`)
  }

  superficie.addEventListener('input', () => {
    clearTimeout(espera)
    espera = setTimeout(revisar, 700)
  })
  // Lo que ya venía escrito (editar un mensaje, un borrador recuperado).
  if (/@/.test(superficie.textContent || '')) revisar()
}
