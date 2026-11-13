// /admin → Redes (tanda 1335). PINGU: «esto no es mejor que esté desde el
// panel de admin… y desde ahí sacar todo lo nuevo o todo lo que se puede
// sacar… lo de automático no». Es una lista de lo que se puede publicar en
// las redes oficiales de PokeDoc, lo más nuevo arriba, y de cada cosa lo que
// PINGU ya hacía a mano con las noticias:
//   · «X»: abre el cuadro de publicar con el texto y el enlace puestos (la
//     imagen la pone X sola con la tarjeta del enlace);
//   · «Instagram»: abre un cajón con las imágenes de la publicación (una, o
//     el carrusel de una guía), «Descargar», «Copiar texto» (el caption con
//     sus etiquetas) e «Historia» (la de 1080×1920).
// Al usarlas se apunta como hecho en esa red (tabla `redes_compartido`,
// migración 1335), y el filtro «Sin compartir» enseña lo que falta. Sin la
// migración el panel funciona igual y lo apunta en este navegador.
//
// Las piezas (textos e imágenes descritos como datos) las arma
// js/redes-textos.js; las imágenes las dibuja js/redes-piezas.js.
import { supabase } from '../../js/supabase.js'
import { escapeHtml } from '../../js/app.js'
import { icons, icon } from '../../js/icons.js'
import { showToast } from '../../js/toast.js'
import { cuandoFue } from '../../js/articulos.js'
import { direccionDeX } from '../../js/compartir-x.js'
import {
  TIPOS, REDES, piezaDeNoticia, piezaDeGuia, piezasDeTorneo, hechosDe, filtrarPiezas, ordenarPiezas, cuentasDe,
} from '../../js/redes-textos.js'

const iconoInstagram = (s) => icon('<rect x="2" y="2" width="20" height="20" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>', s)
const iconoDescargar = (s) => icon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>', s)
const ICONO_TIPO = { noticia: 'newspaper', guia: 'bookOpen', torneo: 'trophy' }

const LOCAL = 'pd-redes-hechos'
const faltaTabla = (e) => /redes_compartido|PGRST205|42P01|does not exist|Could not find the table/i.test(`${e?.code} ${e?.message}`)

let raiz = null
let piezas = []
let hechos = new Map()
let filtro = 'sin'
let sinTabla = false
let abierta = null
// Los lienzos ya dibujados, por pieza y tamaño: abrir y cerrar el cajón no
// vuelve a dibujar.
const lienzos = new Map()

function leerLocal() {
  try { return JSON.parse(localStorage.getItem(LOCAL) || '[]') } catch { return [] }
}
function guardarLocal() {
  try {
    const filas = []
    for (const [clave, h] of hechos) for (const red of Object.keys(REDES)) if (h[red]) filas.push({ clave, red, hecho_at: h[red] })
    localStorage.setItem(LOCAL, JSON.stringify(filas))
  } catch { /* sin almacenamiento: vale para esta visita */ }
}

// ── Los datos ──
async function cargarGuias() {
  const { data, error } = await supabase
    .from('guides')
    .select('id, kind, slug, title, description, cover_image, published_at, created_at, reference_blocks, estimated_mins')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(80)
  if (error) return []
  return (data || []).filter((g) => g.slug && g.title).map((g) => (g.kind === 'news' ? piezaDeNoticia(g) : piezaDeGuia(g)))
}

async function cargarTorneos() {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .in('status', ['registration_open', 'registration_closed', 'in_progress', 'finished'])
    .order('start_at', { ascending: false })
    .limit(40)
  if (error || !data?.length) return []
  const torneos = data.filter((t) => !t.is_private)
  const ids = torneos.map((t) => t.id)
  const podios = torneos.filter((t) => t.status === 'finished' && Array.isArray(t.podium) && t.podium.length)
  const quienes = [...new Set(podios.flatMap((t) => t.podium.slice(0, 3)).filter(Boolean))]
  const [ins, perfiles, listas] = await Promise.all([
    ids.length ? supabase.from('tournament_registrations').select('tournament_id, status').in('tournament_id', ids) : { data: [] },
    quienes.length ? supabase.from('user_profiles').select('id, username').in('id', quienes) : { data: [] },
    // El mazo del campeón (sus Pokémon encima del podio), solo si el torneo
    // enseña las listas al terminar.
    podios.some((t) => t.decklist_visibility !== 'nunca')
      ? supabase.from('tournament_decklists').select('tournament_id, user_id, parsed_cards').in('tournament_id', podios.filter((t) => t.decklist_visibility !== 'nunca').map((t) => t.id))
      : { data: [] },
  ])
  const inscritos = {}
  for (const r of ins.data || []) if (r.status !== 'dropped' && r.status !== 'waitlisted') inscritos[r.tournament_id] = (inscritos[r.tournament_id] || 0) + 1
  const nombres = Object.fromEntries((perfiles.data || []).map((p) => [p.id, p.username]))
  let urlsDelCampeon = null
  if ((listas.data || []).length) urlsDelCampeon = (await import('../../js/torneos/arte-meta.js').catch(() => null))?.urlsDelCampeon || null
  const salen = []
  for (const t of torneos) {
    for (const p of piezasDeTorneo(t, { inscritos: inscritos[t.id] || 0, nombres })) {
      const d = p.diapositivas[0]
      if (d.pintor === 'torneo-resultados' && urlsDelCampeon) {
        const lista = (listas.data || []).find((l) => l.tournament_id === t.id && l.user_id === d.datos.campeonId)
        try { d.datos.sprites = lista ? urlsDelCampeon(lista.parsed_cards).slice(0, 3) : [] } catch { d.datos.sprites = [] }
      }
      salen.push(p)
    }
  }
  return salen
}

async function cargarHechos() {
  const { data, error } = await supabase.from('redes_compartido').select('clave, red, hecho_at')
  if (error) {
    sinTabla = faltaTabla(error)
    return hechosDe(sinTabla ? leerLocal() : [])
  }
  sinTabla = false
  return hechosDe(data)
}

// ── Pintar ──
const fechaHecho = (v) => (typeof v === 'string' ? cuandoFue(v) : '')

function estadoHtml(p) {
  const h = hechos.get(p.clave) || {}
  return Object.entries(REDES).map(([red, nombre]) => `
    <button type="button" class="rd-hecho" data-rd-hecho="${red}" aria-pressed="${Boolean(h[red])}" title="${h[red] ? `Quitar la marca de ${nombre}` : `Marcar como compartido en ${nombre}`}">
      ${red === 'x' ? icons.xLogo(12) : iconoInstagram(12)}<span>${h[red] ? `${icons.checkCircle(12)} ${escapeHtml(fechaHecho(h[red]) || 'Hecho')}` : 'Sin compartir'}</span>
    </button>`).join('')
}

function filaHtml(p) {
  const abiertaEsta = abierta === p.clave
  const n = p.diapositivas.length
  return `
    <article class="rd-fila" data-clave="${escapeHtml(p.clave)}" data-tipo="${p.tipo}">
      <div class="rd-mini" aria-hidden="true">${p.miniatura ? `<img src="${escapeHtml(p.miniatura)}" alt="" width="96" height="60" loading="lazy" />` : icons[ICONO_TIPO[p.tipo]](22)}</div>
      <div class="rd-info">
        <div class="rd-arriba"><span class="rd-tipo">${escapeHtml(TIPOS[p.tipo]?.chapa || p.tipo)}</span>${p.fecha ? `<span class="rd-fecha">${escapeHtml(cuandoFue(p.fecha))}</span>` : ''}</div>
        <a class="rd-titulo" href="${escapeHtml(p.url)}" target="_blank" rel="noopener">${escapeHtml(p.titulo)}</a>
        <span class="rd-linea">${escapeHtml(p.linea)}</span>
        <div class="rd-estados">${estadoHtml(p)}</div>
      </div>
      <div class="rd-acciones">
        <a class="btn-secondary rd-x" data-rd-x href="${escapeHtml(direccionDeX(p.x))}" target="_blank" rel="noopener">${icons.xLogo(16)} Compartir en X</a>
        <button type="button" class="btn-primary rd-ig" data-rd-ig aria-expanded="${abiertaEsta}">${iconoInstagram(16)} Instagram${n > 1 ? ` · ${n}` : ''}</button>
      </div>
      <div class="rd-cajon" ${abiertaEsta ? '' : 'hidden'}>
        <div class="rd-previas" aria-label="Las imágenes de la publicación"></div>
        <div class="rd-lado">
          <pre class="rd-texto">${escapeHtml(p.caption)}</pre>
          <div class="rd-botones">
            <button type="button" class="btn-primary" data-rd-descargar>${iconoDescargar(16)} ${n > 1 ? `Descargar las ${n}` : 'Descargar'}</button>
            <button type="button" class="btn-secondary" data-rd-copiar>${icons.link(16)} Copiar texto</button>
            <button type="button" class="btn-secondary" data-rd-historia>${icons.image(16)} Historia</button>
          </div>
          <p class="rd-nota">Publicación de 1080×1350${n > 1 ? `, un carrusel de ${n}` : ''}. Al descargarla se marca como compartida en Instagram.</p>
        </div>
      </div>
    </article>`
}

function pintar() {
  const cuentas = cuentasDe(piezas, hechos)
  const filtros = { sin: 'Sin compartir', todo: 'Todo', ...Object.fromEntries(Object.entries(TIPOS).map(([k, v]) => [k, v.nombre])) }
  const lista = filtrarPiezas(piezas, filtro, hechos)
  raiz.innerHTML = `
    <div class="rd-panel">
      ${sinTabla ? '<p class="admin-note admin-note-warn rd-sin-tabla">Lo compartido se apunta solo en este navegador hasta que se ejecute <code>supabase-migration-1335-redes-compartido.sql</code>; con ella lo ve todo el equipo.</p>' : ''}
      <div class="av-pestanas rd-filtros" role="tablist" aria-label="Qué enseñar">
        ${Object.entries(filtros).map(([k, v]) => `<button type="button" role="tab" class="av-pestana${k === filtro ? ' on' : ''}" aria-selected="${k === filtro}" data-rd-filtro="${k}">${escapeHtml(v)} <b>${cuentas[k] ?? 0}</b></button>`).join('')}
      </div>
      <div class="rd-lista">
        ${lista.length ? lista.map(filaHtml).join('') : `<p class="av-vacio rd-vacio">${filtro === 'sin' ? 'Todo compartido: no queda nada pendiente.' : 'Aquí no hay nada todavía.'}</p>`}
      </div>
    </div>`
  if (abierta) pintarPrevias(abierta)
}

async function lienzosDe(p, formato) {
  const k = `${p.clave}|${formato}`
  if (!lienzos.has(k)) {
    const { lienzosDePieza } = await import('../../js/redes-piezas.js')
    lienzos.set(k, lienzosDePieza(p, formato).catch((e) => { lienzos.delete(k); throw e }))
  }
  return lienzos.get(k)
}

async function pintarPrevias(clave) {
  const p = piezas.find((x) => x.clave === clave)
  const caja = raiz.querySelector(`.rd-fila[data-clave="${CSS.escape(clave)}"] .rd-previas`)
  if (!p || !caja) return
  caja.innerHTML = '<p class="rd-cargando">Dibujando…</p>'
  try {
    const ls = await lienzosDe(p, 'historia')
    if (abierta !== clave || !caja.isConnected) return
    caja.innerHTML = ''
    ls.forEach((l, i) => {
      l.classList.add('rd-previa')
      l.setAttribute('role', 'img')
      l.setAttribute('aria-label', `Imagen ${i + 1} de ${ls.length}`)
      caja.append(l)
    })
  } catch (e) {
    caja.innerHTML = '<p class="rd-cargando">No se ha podido dibujar la imagen.</p>'
    console.warn('[redes]', e)
  }
}

const aBlob = (lienzo) => new Promise((res, rej) => {
  try { lienzo.toBlob((b) => (b ? res(b) : rej(new Error('sin imagen'))), 'image/png') } catch (e) { rej(e) }
})
const nombreDe = (p) => p.clave.replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()

// En el móvil, el menú del sistema con TODAS las imágenes (Instagram las
// recibe como carrusel); en el PC, una descarga por imagen.
async function descargar(lienzosLista, base) {
  const ficheros = await Promise.all(lienzosLista.map(async (l, i) => new File([await aBlob(l)], `${base}${lienzosLista.length > 1 ? `-${i + 1}` : ''}.png`, { type: 'image/png' })))
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: ficheros })) {
    try {
      await navigator.share({ files: ficheros })
      return true
    } catch (e) {
      if (e?.name === 'AbortError') return false
    }
  }
  for (const f of ficheros) {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(f)
    a.download = f.name
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    // Un respiro entre descargas: varios clics seguidos, algunos navegadores
    // se quedan solo con el primero.
    await new Promise((r) => setTimeout(r, 250))
  }
  return true
}

export async function marcar(clave, red, si) {
  const h = { ...(hechos.get(clave) || {}) }
  const cuando = new Date().toISOString()
  if (si) h[red] = cuando
  else delete h[red]
  hechos.set(clave, h)
  if (!sinTabla) {
    const r = si
      ? await supabase.from('redes_compartido').upsert({ clave, red, hecho_at: cuando }, { onConflict: 'clave,red' })
      : await supabase.from('redes_compartido').delete().eq('clave', clave).eq('red', red)
    if (r?.error) {
      if (faltaTabla(r.error)) sinTabla = true
      else showToast('No se ha podido guardar la marca. Vuelve a probar.', 'error')
    }
  }
  if (sinTabla) guardarLocal()
  // Solo los botones de esa fila: repintar la lista entera cerraría el cajón
  // a medio usar y movería la fila si el filtro es «Sin compartir».
  const fila = raiz.querySelector(`.rd-fila[data-clave="${CSS.escape(clave)}"] .rd-estados`)
  const p = piezas.find((x) => x.clave === clave)
  if (fila && p) fila.innerHTML = estadoHtml(p)
  const cuentas = cuentasDe(piezas, hechos)
  for (const b of raiz.querySelectorAll('[data-rd-filtro]')) {
    const n = b.querySelector('b')
    if (n) n.textContent = cuentas[b.dataset.rdFiltro] ?? 0
  }
}

function escuchar() {
  raiz.addEventListener('click', async (e) => {
    const f = e.target.closest('[data-rd-filtro]')
    if (f) {
      filtro = f.dataset.rdFiltro
      abierta = null
      return pintar()
    }
    const fila = e.target.closest('.rd-fila')
    if (!fila) return
    const clave = fila.dataset.clave
    const p = piezas.find((x) => x.clave === clave)
    if (!p) return
    if (e.target.closest('[data-rd-x]')) return marcar(clave, 'x', true)
    const hecho = e.target.closest('[data-rd-hecho]')
    if (hecho) return marcar(clave, hecho.dataset.rdHecho, hecho.getAttribute('aria-pressed') !== 'true')
    if (e.target.closest('[data-rd-ig]')) {
      abierta = abierta === clave ? null : clave
      for (const otra of raiz.querySelectorAll('.rd-fila')) {
        const si = otra.dataset.clave === abierta
        otra.querySelector('.rd-cajon').hidden = !si
        otra.querySelector('[data-rd-ig]').setAttribute('aria-expanded', String(si))
      }
      if (abierta) pintarPrevias(abierta)
      return
    }
    if (e.target.closest('[data-rd-copiar]')) {
      try {
        await navigator.clipboard.writeText(p.caption)
        showToast('Texto copiado: pégalo en Instagram.', 'success')
      } catch {
        const pre = fila.querySelector('.rd-texto')
        getSelection()?.selectAllChildren(pre)
        showToast('Selecciona el texto y cópialo.', 'info')
      }
      return
    }
    const boton = e.target.closest('[data-rd-descargar], [data-rd-historia]')
    if (boton) {
      boton.disabled = true
      try {
        const historia = boton.hasAttribute('data-rd-historia')
        const ls = historia ? (await lienzosDe(p, 'larga')).slice(0, 1) : await lienzosDe(p, 'historia')
        const ok = await descargar(ls, `pokedoc-${nombreDe(p)}${historia ? '-historia' : ''}`)
        if (ok) await marcar(clave, 'instagram', true)
      } catch (err) {
        console.warn('[redes]', err)
        showToast('No se ha podido generar la imagen.', 'error')
      } finally {
        boton.disabled = false
      }
    }
  })
}

export async function montarRedes(el) {
  raiz = el
  raiz.innerHTML = '<p class="admin-note">Cargando lo que se puede compartir…</p>'
  const [a, b, h] = await Promise.all([cargarGuias().catch(() => []), cargarTorneos().catch(() => []), cargarHechos().catch(() => new Map())])
  piezas = ordenarPiezas([...a, ...b])
  hechos = h
  escuchar()
  pintar()
}
