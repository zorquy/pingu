// Las pestañas de una ficha de persona, en UNA fila (867): Vitrina, Guías,
// Foro, Torneos y Medallas. Hasta la 866 eran dos filas, una dentro de
// otra (tres «niveles» y, dentro de Actividad, cuatro «filtros»): nueve
// destinos para elegir uno, y el que se abría por defecto era un muro casi
// siempre vacío. El muro se fue con la 867; «Actividad» no era un sitio,
// era una carpeta, y desaparece con él.
//
// Lo que siguen haciendo (desde la 308):
//  · Enseñar CUÁNTO hay en cada una (`contarPestania`).
//  · Abrirse por la que TIENE algo (`abrirLaQueTengaAlgo`): en la ficha de
//    otra persona, su vitrina si tiene cartas y, si no, lo primero con
//    algo; en la tuya, siempre la vitrina (vacía, invita a elegir).
//  · Llegar con la pestaña puesta: `?ver=medallas` (859) o `#foro`.

const CONTENEDOR = 'profileTabs'

// Nombres viejos que siguen llegando por enlaces guardados: «about» eran
// los trofeos; «actividad», «wall» y «muro» ya no son nada y abren lo que
// toque.
const ALIAS = { about: 'medallas', actividad: null, wall: null, muro: null }

// El orden para «la que tenga algo» NO es el de la fila: lo que más dice de
// alguien es lo que escribe, luego lo que habla, luego lo que juega.
// «Cambios» (887) va delante: en la ficha de otra persona, lo que da y busca
// es lo que más sirve a quien entra (soyfedeegb lo pidió para eso).
const ORDEN = ['cambios', 'guides', 'foro', 'torneos', 'medallas']

const cuentas = {}
let laHaTocado = false
let alAbrir = null
let propia = false

const botones = () => [...document.querySelectorAll(`#${CONTENEDOR} .tab-btn`)]
const botonDe = (nombre) => botones().find((b) => b.dataset.ptab === nombre)
const pedidaEnDireccion = () => new URLSearchParams(location.search).get('ver') || window.location.hash.replace('#', '') || ''
const nombreReal = (nombre) => (nombre in ALIAS ? ALIAS[nombre] : nombre)

export function abrirPestania(nombre) {
  const n = nombreReal(nombre)
  if (!n) return false
  const btn = botonDe(n)
  if (!btn || btn.hidden) return false
  for (const b of botones()) {
    b.classList.toggle('active', b === btn)
    b.setAttribute('aria-selected', String(b === btn))
  }
  for (const p of document.querySelectorAll('.tab-panel[id^="ptab-"]')) p.classList.toggle('active', p.id === `ptab-${n}`)
  alAbrir?.(n)
  return true
}

// El número al lado del nombre. Se llama según va llegando cada cuenta:
// una pestaña sin contar todavía no enseña nada, que es mejor que
// enseñar un cero que a lo mejor no es cero. El cero tampoco se pinta:
// «Foro 0» ocupa sitio para decir que no hay nada, y para eso ya está el
// propio panel cuando entras.
export function contarPestania(nombre, n) {
  cuentas[nombre] = n
  const btn = botonDe(nombre)
  if (!btn) return
  btn.querySelector('.pest-cuenta')?.remove()
  if (!n) return
  const chapa = document.createElement('span')
  chapa.className = 'pest-cuenta'
  chapa.textContent = n > 99 ? '99+' : String(n)
  btn.appendChild(chapa)
}

// La vitrina, cuando llega (la pinta js/vitrina.js aparte): su pestaña sale
// si hay algo que enseñar —o si es la tuya, para elegir— y se abre si no
// has tocado nada: en la tuya siempre; en la de otro, si tiene cartas (una
// vitrina vacía no es «la que tiene algo»).
export function vitrinaLista({ visible, conCartas }) {
  const btn = botonDe('vitrina')
  if (!btn) return
  btn.hidden = !visible
  if (!visible && btn.classList.contains('active')) abrirLaQueTengaAlgo({ aunqueVacia: true })
  const pedida = nombreReal(pedidaEnDireccion())
  if (visible && !laHaTocado && (pedida === 'vitrina' || (!pedida && (conCartas || propia)))) abrirPestania('vitrina')
}

// Una pestaña que llega tarde y puede no tener nada (Cambios, 887): sale
// si hay algo que enseñar —o si es la tuya—, y si estaba abierta y se va,
// se abre la que tenga algo.
export function pestaniaLista(nombre, visible) {
  const btn = botonDe(nombre)
  if (!btn) return
  btn.hidden = !visible
  if (!visible && btn.classList.contains('active')) abrirLaQueTengaAlgo({ aunqueVacia: true })
  const pedida = nombreReal(pedidaEnDireccion())
  if (visible && pedida === nombre && !btn.classList.contains('active')) abrirPestania(nombre)
}

// Cuál se abre cuando han llegado las cuentas. Si ya has tocado tú una
// pestaña, o has llegado con `?ver=` o un #hash, mandas tú: cambiarte de
// sitio la página cuando ya estás leyendo es peor que dejarte donde
// estabas. Y si la vitrina ya se ha abierto (la tuya, o una con cartas),
// se queda.
export function abrirLaQueTengaAlgo({ aunqueVacia = false } = {}) {
  if (laHaTocado || nombreReal(pedidaEnDireccion())) return
  const vitrina = botonDe('vitrina')
  if (vitrina && !vitrina.hidden && vitrina.classList.contains('active')) return
  const conAlgo = ORDEN.find((n) => cuentas[n] > 0 && botonDe(n))
  if (conAlgo) abrirPestania(conAlgo)
  else if (aunqueVacia) abrirPestania(ORDEN.find((n) => botonDe(n)))
}

// `alAbrir` recibe el nombre de la pestaña: es donde cada página engancha
// lo que carga con pereza (el foro, los torneos). `propia` dice si es tu
// ficha, que abre por la vitrina aunque esté vacía.
export function montarPestanias({ alAbrir: cb, propia: esMia = false } = {}) {
  const caja = document.getElementById(CONTENEDOR)
  if (!caja) return
  alAbrir = cb
  propia = esMia
  for (const btn of botones()) {
    btn.addEventListener('click', (e) => {
      // `isTrusted` distingue el clic de una persona del `.click()` que
      // hace esta misma página: abrir una pestaña automáticamente no
      // cuenta como «la ha tocado».
      if (e.isTrusted) laHaTocado = true
      abrirPestania(btn.dataset.ptab)
      // La pestaña en la dirección (859, `?ver=medallas`), SUSTITUYENDO la
      // entrada: recargar o compartir enseña la misma, y atrás no pasa por
      // ella (la regla de la 856). Solo cuando la tocas tú.
      if (e.isTrusted) {
        const url = new URL(location.href)
        url.searchParams.set('ver', btn.dataset.ptab)
        url.hash = ''
        history.replaceState(null, '', url)
      }
    })
  }
  abrirLaDelHash()
}

// Llegar con la pestaña puesta: /perfil?ver=medallas, /usuario/x#foro…
// Genérico y no una lista de casos (tanda 253): cualquier pestaña que
// exista se abre por su nombre; una inventada no deja la página sin
// ninguna activa. La vitrina se abre cuando exista (`vitrinaLista`).
export function abrirLaDelHash() {
  const nombre = nombreReal(pedidaEnDireccion())
  if (nombre && nombre !== 'vitrina') abrirPestania(nombre)
}
