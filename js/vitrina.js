// LA VITRINA DEL PERFIL (743, J4 de la lista de propuestas): seis cartas que
// eliges tú, en tu perfil y en el que ven los demás. Viven en su tabla
// (`user_showcase`, supabase-migration-vitrina.sql) y se leen aparte: si la
// migración no está, la vitrina no sale y el perfil sigue como estaba.
//
// Tres estados al leer, y cada uno dice una cosa (la 510): `ok` con las
// cartas (quizá ninguna), `sin-migracion` (no se pinta nada) y `error` (no
// se ha podido preguntar: tampoco se pinta, pero no se afirma «vacía»).
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { cadenaDeEscaneo } from './escaneo-carta.js'
import { nombreDeCarta, nombreDeSet } from './catalogo-series.js'
import { rutaDeCarta } from './carta-ruta.js'
import { icons } from './icons.js'
import { cartasPorClaves, claveDeCarta, lineasDeTodo, traducir } from './mi-coleccion/datos.js'

export const HUECOS = 6

// Las filas, en su orden y sin repetidas. Puro.
export function ordenDeVitrina(filas) {
  const vistas = new Set()
  return [...(filas || [])]
    .filter((f) => f?.card_id && Number(f.posicion) >= 1 && Number(f.posicion) <= HUECOS)
    .sort((a, b) => a.posicion - b.posicion)
    .filter((f) => {
      const k = claveDeCarta(f.card_id, f.market)
      if (vistas.has(k)) return false
      vistas.add(k)
      return true
    })
}

// Las filas que se guardan de una elección: posiciones 1…n. Puro.
export function filasDeEleccion(userId, claves) {
  return claves.slice(0, HUECOS).map((k, i) => {
    const [card_id, market] = k.split('|')
    return { user_id: userId, posicion: i + 1, card_id, market: market || 'WEST' }
  })
}

export async function leerVitrina(userId) {
  const { data, error } = await supabase.from('user_showcase').select('posicion, card_id, market').eq('user_id', userId).order('posicion')
  if (error) return { estado: traducir(error).sinMigracion ? 'sin-migracion' : 'error' }
  const filas = ordenDeVitrina(data)
  if (!filas.length) return { estado: 'ok', cartas: [] }
  const mapa = await cartasPorClaves(filas).catch(() => null)
  if (!mapa) return { estado: 'error' }
  return { estado: 'ok', cartas: filas.map((f) => mapa.get(claveDeCarta(f.card_id, f.market))).filter(Boolean) }
}

export async function guardarVitrina(userId, claves) {
  const { error: e1 } = await supabase.from('user_showcase').delete().eq('user_id', userId)
  if (e1) throw traducir(e1)
  const filas = filasDeEleccion(userId, claves)
  if (!filas.length) return
  const { error: e2 } = await supabase.from('user_showcase').insert(filas)
  if (e2) throw traducir(e2)
}

const foto = (c, ancho) => {
  const cadena = cadenaDeEscaneo(c)
  return `<img src="${escapeHtml(cadena[0] || '')}" data-cadena="${escapeHtml(JSON.stringify(cadena.slice(1)))}" width="${ancho}" height="${Math.round((ancho * 88) / 63)}" loading="lazy" alt="">`
}

// El HTML de la vitrina. La tuya enseña los huecos que quedan y «Elegir»;
// la de otro, solo lo que hay (y nada si no hay nada).
export function vitrinaHtml(cartas, { propia = false } = {}) {
  if (!propia && !cartas.length) return ''
  const llenos = cartas
    .map((c) => `<a class="vitrina-carta" href="${escapeHtml(rutaDeCarta(c))}" title="${escapeHtml(`${nombreDeCarta(c)} · ${nombreDeSet(c.tcg_sets) || ''}`)}">${foto(c, 120)}<span>${escapeHtml(nombreDeCarta(c))}</span></a>`)
    .join('')
  const vacios = propia ? Array.from({ length: HUECOS - cartas.length }, () => '<button type="button" class="vitrina-hueco" data-vitrina-elegir aria-label="Elegir una carta para la vitrina">+</button>').join('') : ''
  return `<div class="vitrina-cabeza"><h2 class="section-title">Vitrina</h2>${propia ? `<button type="button" class="link-btn vitrina-editar" data-vitrina-elegir>${icons.edit(14)}<span>${cartas.length ? 'Cambiar' : 'Elegir cartas'}</span></button>` : ''}</div>
    <div class="vitrina-rejilla">${llenos}${vacios}</div>`
}

// Una foto que no carga pasa a la siguiente de su cadena (la 441).
function engancharFotos(caja) {
  caja.addEventListener('error', (e) => {
    const img = e.target
    if (!(img instanceof HTMLImageElement)) return
    let resto = []
    try { resto = JSON.parse(img.dataset.cadena || '[]') } catch {}
    if (resto.length) {
      img.dataset.cadena = JSON.stringify(resto.slice(1))
      img.src = resto[0]
    } else img.style.visibility = 'hidden'
  }, true)
}

// Monta la vitrina en `caja`. Con `propia`, «Elegir» abre el selector con
// las cartas de TU colección.
export async function montarVitrina(caja, userId, { propia = false, avisar = () => {} } = {}) {
  if (!caja || !userId) return null
  const r = await leerVitrina(userId).catch(() => ({ estado: 'error' }))
  if (r.estado !== 'ok') {
    caja.hidden = true
    return r
  }
  let cartas = r.cartas
  const pintar = () => {
    caja.innerHTML = vitrinaHtml(cartas, { propia })
    caja.hidden = !caja.innerHTML
  }
  pintar()
  engancharFotos(caja)
  if (propia) {
    caja.addEventListener('click', async (e) => {
      if (!e.target.closest('[data-vitrina-elegir]')) return
      const elegidas = await elegirCartas(userId, cartas)
      if (!elegidas) return
      try {
        await guardarVitrina(userId, elegidas.map((c) => claveDeCarta(c.id, c.market)))
        cartas = elegidas
        pintar()
        avisar('Vitrina guardada.', 'success')
      } catch (err) {
        avisar(err.message, 'error')
      }
    })
  }
  return r
}

// El selector: tus cartas, con un buscador, marcas hasta seis y «Guardar».
// Devuelve las elegidas en el orden en que las marcaste, o null.
async function elegirCartas(userId, actuales, doc = document) {
  let d = doc.getElementById('vitrinaElegir')
  if (!d) {
    d = doc.createElement('dialog')
    d.id = 'vitrinaElegir'
    d.className = 'vitrina-dialogo'
    d.setAttribute('aria-labelledby', 'vitrinaElegirTitulo')
    doc.body.appendChild(d)
    engancharFotos(d)
  }
  d.innerHTML = `<header class="vitrina-dialogo-cabeza"><h2 id="vitrinaElegirTitulo">Tu vitrina</h2><button type="button" class="vitrina-cerrar" data-vitrina="cancelar" aria-label="Cerrar">✕</button></header>
    <p class="subtext" id="vitrinaCuenta" aria-live="polite"></p>
    <input type="search" enterkeyhint="search" class="vitrina-buscar" id="vitrinaBuscar" placeholder="Busca entre tus cartas…" aria-label="Buscar entre tus cartas" autocomplete="off">
    <div class="vitrina-opciones" id="vitrinaOpciones"><div class="skeleton" style="height:160px"></div></div>
    <footer class="vitrina-dialogo-pie"><button type="button" class="btn-secondary" data-vitrina="cancelar">Cancelar</button><button type="button" class="btn-primary" data-vitrina="guardar">Guardar</button></footer>`
  d.showModal()
  let todas = []
  try {
    const lineas = await lineasDeTodo(userId)
    const mapa = await cartasPorClaves(lineas)
    const vistas = new Set()
    for (const l of lineas) {
      const k = claveDeCarta(l.card_id, l.market)
      if (vistas.has(k) || !mapa.get(k)) continue
      vistas.add(k)
      todas.push(mapa.get(k))
    }
  } catch (err) {
    d.querySelector('#vitrinaOpciones').innerHTML = `<p class="empty-state">${escapeHtml(err.message)}</p>`
  }
  const elegidas = [...actuales.map((c) => claveDeCarta(c.id, c.market))]
  const porClave = new Map([...actuales, ...todas].map((c) => [claveDeCarta(c.id, c.market), c]))
  const pintar = () => {
    const q = d.querySelector('#vitrinaBuscar').value.trim().toLowerCase()
    const lista = todas.filter((c) => !q || `${nombreDeCarta(c)} ${nombreDeSet(c.tcg_sets) || ''}`.toLowerCase().includes(q)).slice(0, 120)
    d.querySelector('#vitrinaCuenta').textContent = `${elegidas.length} de ${HUECOS} elegidas`
    d.querySelector('#vitrinaOpciones').innerHTML = todas.length
      ? lista
          .map((c) => {
            const k = claveDeCarta(c.id, c.market)
            const i = elegidas.indexOf(k)
            return `<button type="button" class="vitrina-opcion" data-clave="${escapeHtml(k)}" aria-pressed="${i >= 0 ? 'true' : 'false'}"${i < 0 && elegidas.length >= HUECOS ? ' disabled' : ''}>${foto(c, 90)}${i >= 0 ? `<b class="vitrina-orden">${i + 1}</b>` : ''}<span>${escapeHtml(nombreDeCarta(c))}</span></button>`
          })
          .join('') || '<p class="empty-state">Ninguna de tus cartas se llama así.</p>'
      : '<p class="empty-state">Todavía no tienes cartas en tu colección.</p>'
  }
  pintar()
  d.querySelector('#vitrinaBuscar').addEventListener('input', pintar)
  return new Promise((resolver) => {
    let resultado = null
    d.onclick = (e) => {
      const o = e.target.closest('.vitrina-opcion')
      if (o) {
        const i = elegidas.indexOf(o.dataset.clave)
        if (i >= 0) elegidas.splice(i, 1)
        else if (elegidas.length < HUECOS) elegidas.push(o.dataset.clave)
        pintar()
        return
      }
      const a = e.target.closest('[data-vitrina]')?.dataset.vitrina
      if (a === 'guardar') {
        resultado = elegidas.map((k) => porClave.get(k)).filter(Boolean)
        d.close()
      } else if (a === 'cancelar') d.close()
    }
    d.addEventListener('close', () => resolver(resultado), { once: true })
  })
}
