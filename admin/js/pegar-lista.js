// «Pegar lista» (1300): en el editor de las cartas de un set (/admin →
// Colecciones → «Ver y editar sus cartas»), pegar la lista del set —texto o una
// captura— y crear lo que falta sin pedírselo a nadie. Nada se escribe hasta
// pulsar el botón: antes, una tabla con cada carta y lo que se va a hacer
// (nueva, completa lo vacío o igual), con todo editable.
//
// Lo puro está en lista-set-puro.js; la captura la lee la función leer-lista
// (el mismo lector del escáner de cartas) y su texto cae en la caja de texto,
// donde se corrige como si se hubiera pegado. Crear y completar pasan por
// `catalogo_corregir`, como «Nueva carta» y la ficha: es una corrección, y la
// pasada siguiente no la pisa.
import { supabase } from '../../js/supabase.js'
import { escapeHtml } from '../../js/app.js'
import { showToast } from '../../js/toast.js'
import { avisarALaWeb } from './avisar-web.js'
import { filasDeLista, planDeLista, cambiosDeNueva, idDeNueva, cuentaDelPlan, SIGLAS_DE_RAREZA } from './lista-set-puro.js'
import { rarezaEs } from '../../js/rarezas-nombres.js'

const $ = (id) => document.getElementById(id)
const RAREZAS = [...new Set(['Common', 'Uncommon', 'Rare', 'Rare Holo', 'Double Rare', 'Ultra Rare', 'Illustration Rare', 'Special Illustration Rare', 'Hyper Rare', 'Shiny Rare', 'Shiny Ultra Rare', 'ACE SPEC Rare', 'Promo', ...Object.values(SIGLAS_DE_RAREZA)])]
const ESTADOS = { nueva: ['Nueva', 'pl-nueva'], completa: ['Completa lo vacío', 'pl-completa'], igual: ['Ya está', 'pl-igual'] }

export function abrirPegarLista({ set, mercado, cartas, hoja, volver }) {
  let plan = []
  let modo = 'texto'
  hoja.abrir(`
    <div class="cat-cab">
      <button class="btn-secondary btn-small" id="plVolver">← Cartas</button>
      <h3>Pegar lista · ${escapeHtml(set.name_en || set.name || set.id)}</h3>
    </div>
    <p class="admin-note">${cartas.length} cartas ahora${set.card_count_official ? ` de ${set.card_count_official}` : ''}. Pega la tabla del set (Bulbapedia, Serebii, Limitless, Cardmarket…) o una captura. Lo que ya existe solo se COMPLETA en lo que tenga vacío; nada se escribe hasta que pulses el botón.</p>
    <div class="pl-modos" role="tablist">
      <button type="button" class="pl-modo activo" data-pl-modo="texto" role="tab" aria-selected="true">Pegar texto</button>
      <button type="button" class="pl-modo" data-pl-modo="captura" role="tab" aria-selected="false">Pegar captura</button>
    </div>
    <div class="pl-captura" id="plCaptura" hidden>
      <p class="admin-note">Pega la captura aquí con Ctrl+V (o elígela). Se lee en el servidor y su texto aparece abajo, para corregirlo antes de nada.</p>
      <label class="pl-soltar" id="plSoltar" tabindex="0">
        <input type="file" id="plFichero" accept="image/*" hidden>
        <span id="plSoltarTexto">Pega o elige la captura de la lista</span>
      </label>
      <label class="cat-campo cat-campo-medio">Idioma de la captura
        <select id="plIdioma"><option value="en">Inglés</option><option value="es">Español</option><option value="ja">Japonés</option></select></label>
    </div>
    <label class="cat-campo">La lista <small>(una carta por línea: número, nombre y, si hay, nombre en inglés, rareza y tipo)</small>
      <textarea id="plTexto" rows="8" placeholder="001/198 · Pineco · Grass · Common&#10;002/198 · Shiftry ex · Darkness · RR&#10;(sin número, una por línea: se numeran por orden)"></textarea></label>
    <p class="admin-note" id="plResumen" aria-live="polite"></p>
    <div id="plRaras"></div>
    <div class="pl-tabla-caja"><table class="pl-tabla" id="plTabla"></table></div>
    <div class="col-hoja-pie">
      <span style="flex:1"></span>
      <button class="btn-secondary" id="plCancelar">Cancelar</button>
      <button class="btn-primary" id="plCrear" disabled>Crear</button>
    </div>`)

  const leer = () => {
    const { filas, raras } = filasDeLista($('plTexto').value)
    plan = planDeLista(filas, cartas)
    pintarTabla(raras)
  }

  const fila = (p, i) => `<tr class="${p.estado === 'igual' ? 'pl-apagada' : ''}" data-i="${i}">
      <td><input type="checkbox" data-pl-incluir${p.estado === 'igual' ? ' disabled' : ' checked'} aria-label="Incluir la ${escapeHtml(p.local_id)}"></td>
      <td><input data-pl="local_id" value="${escapeHtml(p.local_id)}" size="5"${p.estado !== 'nueva' ? ' readonly' : ''}></td>
      <td><input data-pl="name" value="${escapeHtml(p.name)}"${p.estado !== 'nueva' ? ' readonly' : ''}>${p.otroNombre ? `<small class="pl-aviso">La que hay se llama «${escapeHtml(p.carta.name)}»</small>` : ''}</td>
      <td><input data-pl="name_en" value="${escapeHtml(p.name_en || '')}" placeholder="—"></td>
      <td><select data-pl="rarity"><option value="">—</option>${[...new Set([p.rarity, ...RAREZAS].filter(Boolean))].map((r) => `<option value="${escapeHtml(r)}"${r === p.rarity ? ' selected' : ''}>${escapeHtml(rarezaEs(r))}</option>`).join('')}</select></td>
      <td><input data-pl="types" value="${escapeHtml((p.types || []).join(', '))}" placeholder="—" size="8"></td>
      <td><span class="pl-estado ${ESTADOS[p.estado][1]}">${ESTADOS[p.estado][0]}</span>${p.estado === 'completa' ? `<small>${escapeHtml(Object.keys(p.cambios).map((k) => ({ rarity: 'rareza', name_en: 'inglés', types: 'tipo', category: 'categoría', trainer_type: 'tipo de entrenador', energy_type: 'tipo de energía', image_path: 'foto' }[k] || k)).join(', '))}</small>` : ''}</td>
    </tr>`

  const pintarTabla = (raras = []) => {
    const n = cuentaDelPlan(plan)
    // Un set sin números (1339): se numeran por orden y se dice, que el número es la llave de la carta.
    const sinNumero = plan.filter((p) => p.sinNumero).length
    $('plResumen').textContent = plan.length
      ? `${plan.length} ${plan.length === 1 ? 'carta leída' : 'cartas leídas'}: ${n.nuevas} ${n.nuevas === 1 ? 'nueva' : 'nuevas'}, ${n.completa} que ${n.completa === 1 ? 'se completa' : 'se completan'} y ${n.igual} que ya ${n.igual === 1 ? 'está' : 'están'}.${n.otroNombre ? ` Ojo: ${n.otroNombre} con el número de una que se llama distinto.` : ''}${sinNumero ? ` ${sinNumero === plan.length ? 'Ninguna trae' : `${sinNumero} no traen`} número: van numeradas por orden (1, 2, 3…); cámbialo en la columna Nº si hace falta.` : ''}`
      : ''
    $('plRaras').innerHTML = raras.length ? `<details class="pl-raras"><summary>${raras.length} ${raras.length === 1 ? 'línea no se entiende' : 'líneas no se entienden'}</summary><ul>${raras.map((r) => `<li>Línea ${r.linea}: «${escapeHtml(r.texto.slice(0, 60))}» — ${escapeHtml(r.motivo)}</li>`).join('')}</ul></details>` : ''
    $('plTabla').innerHTML = plan.length ? `<thead><tr><th></th><th>Nº</th><th>Nombre</th><th>Inglés</th><th>Rareza</th><th>Tipo</th><th>Qué se hace</th></tr></thead><tbody>${plan.map(fila).join('')}</tbody>` : ''
    contarBoton()
  }

  const elegidas = () => [...$('plTabla').querySelectorAll('tbody tr')].filter((tr) => tr.querySelector('[data-pl-incluir]')?.checked).map((tr) => {
    const p = { ...plan[Number(tr.dataset.i)] }
    for (const el of tr.querySelectorAll('[data-pl]')) {
      const v = el.value.trim()
      p[el.dataset.pl] = el.dataset.pl === 'types' ? v.split(/\s*,\s*/).filter(Boolean) : v || null
    }
    return p
  })

  const contarBoton = () => {
    const e = elegidas()
    const nuevas = e.filter((p) => p.estado === 'nueva').length
    const completa = e.length - nuevas
    $('plCrear').disabled = !e.length
    $('plCrear').textContent = !e.length ? 'Crear' : [nuevas ? `Crear ${nuevas}` : '', completa ? `${nuevas ? 'y completar' : 'Completar'} ${completa}` : ''].filter(Boolean).join(' ')
  }

  $('plTexto').addEventListener('input', leer)
  $('plTabla').addEventListener('change', contarBoton)
  $('plVolver').addEventListener('click', volver)
  $('plCancelar').addEventListener('click', volver)

  // ── La captura ──
  for (const b of document.querySelectorAll('[data-pl-modo]')) {
    b.addEventListener('click', () => {
      modo = b.dataset.plModo
      for (const x of document.querySelectorAll('[data-pl-modo]')) { x.classList.toggle('activo', x === b); x.setAttribute('aria-selected', String(x === b)) }
      $('plCaptura').hidden = modo !== 'captura'
      if (modo === 'captura') $('plSoltar').focus()
    })
  }
  const leerCaptura = async (fichero) => {
    if (!fichero || !/^image\//.test(fichero.type)) return showToast('Eso no es una imagen.', 'error')
    $('plSoltarTexto').textContent = 'Leyendo la captura…'
    try {
      const imagen = await aDataUrl(fichero)
      const { data: { session } = {} } = await supabase.auth.getSession()
      const res = await fetch('/.netlify/functions/leer-lista', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ imagen, idioma: $('plIdioma').value }),
      })
      const r = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(r.error || `El lector contestó ${res.status}`)
      const texto = String(r.texto || '').trim()
      if (!texto) throw new Error('No he leído nada en la captura.')
      $('plTexto').value = [$('plTexto').value.trim(), texto].filter(Boolean).join('\n')
      leer()
      $('plSoltarTexto').textContent = 'Leída. Revisa el texto y la tabla; puedes pegar otra captura.'
    } catch (e) {
      $('plSoltarTexto').textContent = 'Pega o elige la captura de la lista'
      showToast(String(e?.message || e).slice(0, 200), 'error')
    }
  }
  $('plFichero').addEventListener('change', (e) => leerCaptura(e.target.files?.[0]))
  $('plSoltar').addEventListener('paste', (e) => {
    const f = [...(e.clipboardData?.files || [])].find((x) => /^image\//.test(x.type))
    if (f) { e.preventDefault(); leerCaptura(f) }
  })
  // Pegar una imagen en la caja de texto también vale (es lo natural).
  $('plTexto').addEventListener('paste', (e) => {
    const f = [...(e.clipboardData?.files || [])].find((x) => /^image\//.test(x.type))
    if (f) { e.preventDefault(); leerCaptura(f) }
  })

  // ── Crear y completar ──
  $('plCrear').addEventListener('click', async () => {
    const e = elegidas()
    if (!e.length) return
    const boton = $('plCrear')
    boton.disabled = true
    let hechas = 0
    const fallos = []
    for (const p of e) {
      if (p.estado === 'nueva') {
        if (!p.local_id || !p.name) { fallos.push(`${p.local_id || '?'}: falta número o nombre`); continue }
        const { error } = await supabase.rpc('catalogo_corregir', { p_tabla: 'tcg_cards', p_id: idDeNueva(set.id, p.local_id), p_market: mercado, p_cambios: cambiosDeNueva(p, set.id), p_crear: true })
        if (error) fallos.push(`${p.local_id}: ${error.message.slice(0, 80)}`)
        else hechas++
      } else {
        // Completar: lo que la tabla trae y la carta tiene vacío (no se pisa nada).
        const cambios = {}
        for (const k of Object.keys(p.cambios || {})) if (p[k] != null && !(Array.isArray(p[k]) && !p[k].length)) cambios[k] = p[k]
        if (!Object.keys(cambios).length) continue
        const { error } = await supabase.rpc('catalogo_corregir', { p_tabla: 'tcg_cards', p_id: p.carta.id, p_market: mercado, p_cambios: cambios })
        if (error) fallos.push(`${p.local_id}: ${error.message.slice(0, 80)}`)
        else hechas++
      }
      boton.textContent = `Guardando… ${hechas}/${e.length}`
    }
    if (hechas) avisarALaWeb()
    if (fallos.length) showToast(`Hechas ${hechas}. No se pudieron ${fallos.length}: ${fallos.slice(0, 3).join(' · ')}`, 'error')
    else showToast(`Listo: ${hechas} ${hechas === 1 ? 'carta' : 'cartas'}`, 'success')
    volver({ recargar: true })
  })
}

function aDataUrl(fichero) {
  // Más de ~1 MB no lo lee el plan gratuito: se reduce antes a JPEG.
  return new Promise((ok, mal) => {
    const img = new Image()
    const url = URL.createObjectURL(fichero)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let escala = Math.min(1, 2000 / Math.max(img.width, img.height))
      const lienzo = document.createElement('canvas')
      const pintar = () => {
        lienzo.width = Math.round(img.width * escala)
        lienzo.height = Math.round(img.height * escala)
        const ctx = lienzo.getContext('2d')
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, lienzo.width, lienzo.height)
        ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height)
        return lienzo.toDataURL('image/jpeg', 0.85)
      }
      let d = pintar()
      while (d.length > 1.3 * 1024 * 1024 && escala > 0.3) { escala *= 0.8; d = pintar() }
      ok(d)
    }
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('No he podido abrir la imagen.')) }
    img.src = url
  })
}
