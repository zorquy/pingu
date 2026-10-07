// Las pestañas de una ficha de persona (Muro, Guías, Foro, Torneos,
// Acerca), que hasta la tanda 308 estaban copiadas en perfil.js y en
// usuario.js con la misma lógica escrita dos veces.
//
// Hacen dos cosas que no hacían:
//
//  · Enseñar CUÁNTO hay en cada una. Cinco pestañas sin un número al
//    lado obligan a entrar en todas para saber dónde está lo que
//    buscas — y en la mayoría de los perfiles casi todas están vacías.
//  · Abrirse por la que TIENE algo. «Muro» era siempre la primera y en
//    casi todos los perfiles está vacía: quien entra se encuentra un
//    «todavía no hay nada escrito» aunque esa persona tenga 58 mensajes
//    en el foro, a una pestaña de distancia.

const CONTENEDOR = 'profileTabs'

// ── LOS TRES NIVELES (tanda 752, P1) ──
//
// Arriba van tres, como en la maqueta: Vitrina, Actividad y Medallas. Las
// pestañas de siempre (Muro, Guías, Foro, Torneos) no se pierden: son los
// filtros de Actividad. «Acerca» era los trofeos y los cursos, o sea las
// Medallas, y su panel (`ptab-about`) es el de ese nivel. Qué se ve lo
// decide `body[data-pnivel]` en css/perfil.css.
const NIVELES = 'perfilNiveles'
const NIVEL_DE = { about: 'medallas', medallas: 'medallas', vitrina: 'vitrina' }
let alAbrirNivel = null

export function abrirNivel(nivel) {
  const caja = document.getElementById(NIVELES)
  const btn = caja?.querySelector(`[data-pnivel="${nivel}"]`)
  if (!btn || btn.hidden) return false
  for (const b of caja.querySelectorAll('[data-pnivel]')) {
    b.classList.toggle('active', b === btn)
    b.setAttribute('aria-selected', String(b === btn))
  }
  document.body.dataset.pnivel = nivel
  alAbrirNivel?.(nivel === 'medallas' ? 'about' : nivel)
  return true
}

// La vitrina, cuando llega (la pinta js/vitrina.js aparte): su nivel sale
// si hay algo que enseñar —o si es la tuya, para elegir—, y se abre por
// ella si tiene cartas y no has tocado nada: es lo primero de la maqueta,
// pero una vitrina vacía no es «la que tiene algo».
export function vitrinaLista({ visible, conCartas }) {
  const btn = document.querySelector(`#${NIVELES} [data-pnivel="vitrina"]`)
  if (!btn) return
  btn.hidden = !visible
  if (!visible && document.body.dataset.pnivel === 'vitrina') abrirNivel('actividad')
  // Con #vitrina en la dirección, ahora que el nivel existe: el hash se
  // leyó al cargar, cuando todavía estaba escondido.
  if (visible && !laHaTocado && (window.location.hash === '#vitrina' || (conCartas && !window.location.hash))) abrirNivel('vitrina')
}

const botones = () => [...document.querySelectorAll(`#${CONTENEDOR} .tab-btn`)]
const botonDe = (nombre) => botones().find((b) => b.dataset.ptab === nombre)

// Lo que ya se ha contado, para poder decidir qué pestaña abrir cuando
// terminen de llegar las cuentas (llegan por separado).
const cuentas = {}
let laHaTocado = false

export function abrirPestania(nombre) {
  if (NIVEL_DE[nombre] || nombre === 'actividad') return abrirNivel(NIVEL_DE[nombre] || 'actividad')
  const btn = botonDe(nombre)
  if (!btn) return false
  abrirNivel('actividad')
  btn.click()
  return true
}

// El número al lado del nombre. Se llama según va llegando cada cuenta:
// una pestaña sin contar todavía no enseña nada, que es mejor que
// enseñar un cero que a lo mejor no es cero.
export function contarPestania(nombre, n) {
  cuentas[nombre] = n
  const btn = botonDe(nombre)
  if (!btn) return
  btn.querySelector('.pest-cuenta')?.remove()
  // El cero tampoco se pinta: «Muro 0» ocupa sitio para decir que no hay
  // nada, y para eso ya está el propio panel cuando entras.
  if (!n) return
  const chapa = document.createElement('span')
  chapa.className = 'pest-cuenta'
  chapa.textContent = n > 99 ? '99+' : String(n)
  btn.appendChild(chapa)
}

// Cuál se abre. El orden NO es el de las pestañas: el Muro va primero
// porque es donde se escribe a esa persona, pero si está vacío lo
// interesante es lo que ha hecho, y eso suele estar en el foro.
const ORDEN = ['wall', 'foro', 'guides', 'torneos']

export function abrirLaQueTengaAlgo() {
  // Si ya has tocado tú una pestaña, o has llegado con un #hash, mandas
  // tú: cambiarte de sitio la página cuando ya estás leyendo es peor que
  // dejarte donde estabas.
  if (laHaTocado || window.location.hash) return
  const conAlgo = ORDEN.find((n) => cuentas[n] > 0 && botonDe(n))
  // Solo el filtro de dentro: si la vitrina ya se ha abierto, se queda.
  if (conAlgo && conAlgo !== 'wall') botonDe(conAlgo)?.click()
}

// `alAbrir` recibe el nombre de la pestaña: es donde cada página engancha
// lo que carga con pereza (el foro, los torneos).
export function montarPestanias({ alAbrir } = {}) {
  const caja = document.getElementById(CONTENEDOR)
  if (!caja) return
  alAbrirNivel = alAbrir
  if (!document.body.dataset.pnivel) document.body.dataset.pnivel = 'actividad'
  for (const b of document.querySelectorAll(`#${NIVELES} [data-pnivel]`)) {
    b.addEventListener('click', (e) => {
      if (e.isTrusted) laHaTocado = true
      abrirNivel(b.dataset.pnivel)
    })
  }
  for (const btn of botones()) {
    btn.addEventListener('click', (e) => {
      // `isTrusted` distingue el clic de una persona del `.click()` que
      // hace esta misma página al abrir la pestaña que toca. Sin esto,
      // abrir una pestaña automáticamente contaría como «la ha tocado»
      // y el hash dejaría de funcionar.
      if (e.isTrusted) laHaTocado = true
      for (const b of botones()) b.classList.remove('active')
      for (const p of document.querySelectorAll('.tab-panel[id^="ptab-"]')) p.classList.remove('active')
      btn.classList.add('active')
      document.getElementById(`ptab-${btn.dataset.ptab}`)?.classList.add('active')
      alAbrir?.(btn.dataset.ptab)
    })
  }
}

// Llegar con la pestaña puesta: /perfil.html#torneos, #guides, #foro…
//
// Genérico y no una lista de casos (tanda 253): cualquier pestaña que
// exista se abre por su nombre, así que el siguiente aviso que enlace
// aquí ya funciona sin tocar nada. Se busca entre los botones que HAY,
// que además es lo que impide que un hash inventado deje la página sin
// ninguna pestaña activa.
export function abrirLaDelHash() {
  const nombre = window.location.hash.replace('#', '')
  if (nombre) abrirPestania(nombre)
}
