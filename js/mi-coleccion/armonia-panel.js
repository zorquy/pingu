// «Sugerir» en un hueco, «Ordenar la página» y «Llenar los huecos» (tanda
// 1407). Entra por `import()` desde albumes.js al pulsar: ni Mi colección ni la
// portada bajan un byte más si no se usa. Lo puro está en armonia.js; aquí,
// qué cartas se miran, la hoja y lo que se guarda.
//
// PINGU eligió (1407): solo con TUS cartas y en el navegador (sin migración),
// verbos («Sugerir», «Ordenar»), y los colores de la página solo en la hoja.
import { escapeHtml } from '../html.js'
import { icons } from '../icons.js'
import { hojaInyectada } from '../hoja.js'
import { nombreDeSet } from '../catalogo-series.js'
import { sugerir, porqueDe, puntosDe, paletaDePagina, vecinasDe, ordenarPagina, huellasDe, huellaGuardada } from './armonia.js'

hojaInyectada('css/armonia.css')

// Cuántas de tus cartas se miran de golpe: cada una es una foto pequeña
// (unos 20 KB) que se lee una vez y queda guardada en el navegador.
const TANDA = 96

// Las que antes se miran: las del tipo de la página y las ilustraciones
// (lo que la gente pone en un binder), luego el resto.
const ARTE = /illustration|special|ultra|secret|hyper|full art|ilustraci|especial|alternat/i
function prioridad(carta, tipos) {
  const t = (carta.types || []).some((x) => tipos.has(x)) ? 0 : 2
  const a = ARTE.test(`${carta.rarity || ''} ${carta.rarity_en || ''}`) ? 0 : 1
  return t + a
}
function tiposDe(cartas) {
  const n = new Map()
  for (const c of cartas) for (const t of c?.types || []) n.set(t, (n.get(t) || 0) + 1)
  const max = Math.max(0, ...n.values())
  return new Set([...n].filter(([, v]) => v === max && max > 0).map(([k]) => k))
}

// Las cartas tuyas que pueden ir al álbum: las que no están ya en él, con
// su ficha (las que no se conocen se piden a la base, de 150 en 150).
async function candidatasDe(c, paginaCartas) {
  const dentro = new Set(c.album.cartas.map((x) => x?.id).filter(Boolean))
  const ids = c.misIds().filter((id) => !dentro.has(id))
  const cartas = (await c.traer(ids)).filter((x) => x && c.fotoDe(x))
  const tipos = tiposDe(paginaCartas)
  return cartas.map((x, i) => ({ x, i, p: prioridad(x, tipos) })).sort((a, b) => a.p - b.p || a.i - b.i).map((o) => o.x)
}

// Lo que el servidor ya tiene calculado (1419) no se lee de las fotos.
const delServidor = (cartas) => import('./colores-servidor.js').then((m) => m.huellasDelServidor(cartas))

const indicesDePagina = (p, porPagina) => Array.from({ length: porPagina }, (_, k) => p * porPagina + k)

// Las huellas de las cartas de una página (en su orden; null en un hueco).
async function huellasDePagina(c, p) {
  const { porPagina } = c.forma
  const items = indicesDePagina(p, porPagina).map((i) => c.album.cartas[i])
  const cartas = items.map((it) => (it?.id ? c.cartaDe(it.id) : null))
  const mapa = await huellasDe(cartas.filter(Boolean), c.fotoDe, { delServidor })
  return { items, cartas, huellas: cartas.map((x) => (x ? mapa.get(x.id) || null : null)) }
}

// ── La hoja de «Sugerir» ──
let dialogo = null
function crearDialogo() {
  if (dialogo) return dialogo
  dialogo = document.createElement('dialog')
  dialogo.className = 'mc-bandeja mc-armonia'
  dialogo.id = 'mcArmonia'
  dialogo.setAttribute('aria-labelledby', 'mcArmoniaTitulo')
  dialogo.innerHTML = `
    <div class="mc-panel-cabecera">
      <h2 id="mcArmoniaTitulo"><span class="arm-chispa" aria-hidden="true">${icons.sparkles(18)}</span><span><span id="mcArmoniaQue">Para el hueco</span><small>Lo que mejor queda en esta página, de tus cartas</small></span></h2>
      <button type="button" class="mc-panel-cerrar" data-arm-cerrar aria-label="Cerrar">✕</button>
    </div>
    <div class="mc-panel-cuerpo arm-cuerpo">
      <div class="mc-seg arm-modo" role="radiogroup" aria-label="Qué se mira">
        <button type="button" role="radio" data-arm-modo="las-dos" aria-checked="true">Las dos</button>
        <button type="button" role="radio" data-arm-modo="color" aria-checked="false">Color</button>
        <button type="button" role="radio" data-arm-modo="escena" aria-checked="false">Escena</button>
      </div>
      <div class="arm-paleta" id="mcArmoniaPaleta" aria-label="Los colores de la página"></div>
      <p class="arm-estado subtext" id="mcArmoniaEstado" role="status"></p>
      <ol class="arm-lista" id="mcArmoniaLista"></ol>
      <button type="button" class="btn-secondary arm-mas hidden" id="mcArmoniaMas"></button>
    </div>`
  document.body.appendChild(dialogo)
  dialogo.addEventListener('click', (e) => {
    if (e.target === dialogo || e.target.closest('[data-arm-cerrar]')) dialogo.close()
  })
  return dialogo
}

function filaHtml(s, c) {
  const carta = s.carta
  const puntos = puntosDe(s.nota)
  const set = nombreDeSet(carta.tcg_sets) || carta.set_id || ''
  return `<li class="arm-fila">
    <img src="${escapeHtml(c.fotoDe(carta))}" alt="" width="64" height="89" loading="lazy">
    <div class="arm-txt">
      <div class="arm-nom"><b>${escapeHtml(c.nombreDe(carta))}</b><span class="arm-puntos" role="img" aria-label="${puntos} de 5">${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= puntos ? 'on' : ''}"></i>`).join('')}</span></div>
      <span class="arm-set">${escapeHtml(set)}${carta.local_id ? ` · ${escapeHtml(carta.local_id)}` : ''}</span>
      <span class="arm-por">${escapeHtml(s.porque)}</span>
      <button type="button" class="btn-primary arm-poner" data-arm-poner="${escapeHtml(carta.id)}">Ponerla aquí</button>
    </div>
  </li>`
}

export async function abrirSugerir(c, indice) {
  const d = crearDialogo()
  const { columnas, porPagina } = c.forma
  const p = Math.floor(indice / porPagina)
  let modo = 'las-dos'
  let mirando = 0
  let turno = 0
  let candidatas = []
  let huellas = new Map()
  const $ = (id) => d.querySelector(`#${id}`)
  $('mcArmoniaQue').textContent = `Para el hueco ${indice + 1}`
  $('mcArmoniaLista').innerHTML = ''
  $('mcArmoniaPaleta').innerHTML = ''
  $('mcArmoniaMas').classList.add('hidden')
  d.querySelectorAll('[data-arm-modo]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.armModo === modo)))
  if (!d.open) d.showModal()
  const estado = (t) => ($('mcArmoniaEstado').textContent = t)
  estado('Mirando los colores de la página…')

  const pag = await huellasDePagina(c, p)
  const deLaPagina = pag.huellas.filter(Boolean)
  if (!deLaPagina.length) {
    estado('Pon antes alguna carta en esta página: las sugerencias salen de sus colores.')
    return
  }
  const paleta = paletaDePagina(deLaPagina)
  $('mcArmoniaPaleta').innerHTML = paleta.hex.map((h, i) => `<span class="${paleta.labs[i][0] > 0.72 ? 'claro' : ''}" style="--c:${h};flex-grow:${Math.max(0.6, paleta.pesos[i] * 3).toFixed(2)}">${h}</span>`).join('')
  const vecinas = vecinasDe(indice, columnas, porPagina).map((v) => ({ ...v, huella: pag.huellas[v.indice - p * porPagina] || null, nombre: pag.cartas[v.indice - p * porPagina] ? c.nombreDe(pag.cartas[v.indice - p * porPagina]) : null }))

  candidatas = await candidatasDe(c, pag.cartas.filter(Boolean))
  if (!candidatas.length) {
    estado('No tienes más cartas con foto fuera de este álbum.')
    return
  }
  // Las que ya se miraron otra vez (caché) entran sin esperar.
  for (const x of candidatas) {
    const h = huellaGuardada(x.id)
    if (h) huellas.set(x.id, h)
  }

  const pintar = () => {
    const lista = sugerir({ candidatas: candidatas.filter((x) => huellas.has(x.id)).map((x) => ({ id: x.id, carta: x, huella: huellas.get(x.id) })), huellasDePagina: pag.huellas, vecinas, modo })
      .slice(0, 8)
      .map((s) => ({ ...s, porque: porqueDe(s.huella, pag.huellas, vecinas, { color: modo !== 'escena', escena: modo !== 'color' }) }))
    $('mcArmoniaLista').innerHTML = lista.map((s) => filaHtml(s, c)).join('')
    const faltan = candidatas.filter((x) => !huellas.has(x.id)).length
    const mas = $('mcArmoniaMas')
    mas.classList.toggle('hidden', !faltan || mirando > 0)
    mas.textContent = `Mirar ${Math.min(TANDA, faltan)} cartas más (quedan ${faltan})`
    if (!mirando) estado(lista.length ? `De ${huellas.size} de tus cartas${faltan ? `; quedan ${faltan} por mirar` : ''}.` : 'Ninguna de tus cartas tiene una foto que se pueda mirar.')
  }

  const mirarMas = async () => {
    const mio = ++turno
    const lote = candidatas.filter((x) => !huellas.has(x.id)).slice(0, TANDA)
    if (!lote.length) return pintar()
    mirando = lote.length
    pintar()
    const nuevas = await huellasDe(lote, c.fotoDe, { delServidor, alAvanzar: (h, t) => estado(`Mirando tus cartas… ${h} de ${t}`) })
    if (mio !== turno) return
    for (const x of lote) if (nuevas.get(x.id)) huellas.set(x.id, nuevas.get(x.id))
    // Una carta cuya foto no se deja leer no vuelve a pedirse en esta hoja.
    const sinFoto = new Set(lote.filter((x) => !nuevas.get(x.id)).map((x) => x.id))
    if (sinFoto.size) candidatas = candidatas.filter((y) => !sinFoto.has(y.id))
    mirando = 0
    pintar()
  }

  $('mcArmoniaMas').onclick = () => void mirarMas()
  d.querySelector('.arm-modo').onclick = (e) => {
    const b = e.target.closest('[data-arm-modo]')
    if (!b) return
    modo = b.dataset.armModo
    d.querySelectorAll('[data-arm-modo]').forEach((x) => x.setAttribute('aria-checked', String(x === b)))
    pintar()
  }
  $('mcArmoniaLista').onclick = (e) => {
    const b = e.target.closest('[data-arm-poner]')
    if (!b) return
    const carta = candidatas.find((x) => x.id === b.dataset.armPoner)
    d.close()
    if (carta) c.poner(carta, indice)
  }
  // Con la caché llena se ve ya; si hay pocas miradas, se mira una tanda.
  pintar()
  if (huellas.size < 24) await mirarMas()
}

// ── Ordenar las páginas que se ven ──
export async function ordenarPaginas(c, paginas) {
  const { columnas, porPagina } = c.forma
  let cartas = [...c.album.cartas]
  let cambiadas = 0
  for (const p of paginas) {
    const pag = await huellasDePagina(c, p)
    // Una carta sin huella (foto que no se deja leer) se queda en su sitio:
    // contarla como hueco la dejaría quieta y sin vecinas, que es lo justo.
    if (pag.huellas.filter(Boolean).length < 3) continue
    const { orden, antes, despues } = ordenarPagina(pag.huellas, columnas)
    if (despues >= antes - 1e-6) continue
    const base = p * porPagina
    const nuevas = [...cartas]
    orden.forEach((de, k) => { if (pag.huellas[de]) nuevas[base + k] = cartas[base + de] })
    cartas = nuevas
    cambiadas++
  }
  return { cartas, cambiadas }
}

// ── Llenar los huecos de las páginas que se ven ──
// Con lo mejor de tus cartas, hueco a hueco: cada carta puesta cuenta ya para
// el siguiente (la página va cogiendo su color).
export async function llenarHuecos(c, paginas, { alAvanzar = null } = {}) {
  const { columnas, porPagina } = c.forma
  let cartas = [...c.album.cartas]
  const puestas = []
  const todas = []
  for (const p of paginas) {
    const pag = await huellasDePagina({ ...c, album: { ...c.album, cartas } }, p)
    if (!pag.huellas.some(Boolean)) continue
    todas.push(...pag.cartas.filter(Boolean))
  }
  if (!todas.length) return { cartas, puestas }
  const lista = (await candidatasDe(c, todas)).slice(0, TANDA * 2)
  const huellas = await huellasDe(lista, c.fotoDe, { delServidor, alAvanzar })
  const usadas = new Set()
  for (const p of paginas) {
    for (const i of indicesDePagina(p, porPagina)) {
      if (cartas[i]?.id) continue
      const pag = await huellasDePagina({ ...c, album: { ...c.album, cartas } }, p)
      if (!pag.huellas.some(Boolean)) break
      const vecinas = vecinasDe(i, columnas, porPagina).map((v) => ({ ...v, huella: pag.huellas[v.indice - p * porPagina] || null }))
      const mejor = sugerir({ candidatas: lista.filter((x) => !usadas.has(x.id) && huellas.get(x.id)).map((x) => ({ id: x.id, carta: x, huella: huellas.get(x.id) })), huellasDePagina: pag.huellas, vecinas })[0]
      if (!mejor) break
      usadas.add(mejor.id)
      while (cartas.length < i) cartas.push({})
      cartas[i] = { id: mejor.id, ...c.extraDe(mejor.carta) }
      puestas.push(mejor.carta)
    }
  }
  return { cartas, puestas }
}
