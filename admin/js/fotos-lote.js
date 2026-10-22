// ── Las fotos de todas las cartas de un set a la vez (961) ──
//
// PINGU: «es un poco tedioso tener que descargarme 60 imágenes y meterlas
// una a una». Dos caminos, los dos desde la lista de cartas del set:
//   · soltar (o elegir) todas las fotos de golpe: cada una va a su carta por
//     el número del nombre del fichero, se comprime en el navegador (la 891)
//     y se sube al cubo de las guías, como la foto de una carta suelta;
//   · una dirección con el número dentro ({n}): el navegador prueba cada una
//     y solo se guardan las que de verdad cargan (una foto inventada en la
//     base es una foto rota que nadie distingue de una buena).
// Lo que se guarda es una corrección de `image_path` (`catalogo_corregir`),
// como al editar la carta. Entra por `import()`: lo usa el admin y poco.
import { supabase } from '../../js/supabase.js'
import { escapeHtml, validateImageFile } from '../../js/app.js'
import { showToast } from '../../js/toast.js'
import { comprimirImagen, extensionDe } from '../../js/imagen-comprimir.js'
import { faltaLaMigracion, AVISO_MIGRACION } from './catalogo-puro.js'
import { casarFicheros, urlDePatron, tieneFotoAMano } from './fotos-lote-puro.js'

const $ = (id) => document.getElementById(id)
const ESPERA_MS = 8000

// ¿Carga esta dirección? Con `<img>`, que es lo que hará la web: un 404, una
// red cerrada o un servidor que no contesta (la 888) son «no».
function carga(url) {
  return new Promise((listo) => {
    const img = new Image()
    const t = setTimeout(() => { img.src = ''; listo(false) }, ESPERA_MS)
    img.onload = () => { clearTimeout(t); listo(img.naturalWidth > 0) }
    img.onerror = () => { clearTimeout(t); listo(false) }
    img.src = url
  })
}

async function subir(userId, fichero) {
  validateImageFile(fichero, 15)
  const { blob, tipo } = await comprimirImagen(fichero)
  const ruta = `${userId}/cartas/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensionDe(tipo)}`
  const { error } = await supabase.storage.from('guide-images').upload(ruta, blob, { contentType: tipo, upsert: false })
  if (error) throw error
  return supabase.storage.from('guide-images').getPublicUrl(ruta).data.publicUrl
}

const guardar = (carta, mercado, url) => supabase.rpc('catalogo_corregir', { p_tabla: 'tcg_cards', p_id: carta.id, p_market: mercado, p_cambios: { image_path: url } })

export function abrirFotosDeTodas({ set, mercado, cartas, hoja, volver }) {
  let ficheros = []
  let casadas = []
  let ocupado = false
  const sinFoto = cartas.filter((c) => !tieneFotoAMano(c)).length
  hoja.abrir(`
    <div class="cat-cab">
      <button class="btn-secondary btn-small" id="flVolver">← Cartas</button>
      <h3>Fotos de todas · ${escapeHtml(set.name_en || set.name || set.id)}</h3>
    </div>
    <p class="admin-note">${cartas.length} cartas, ${sinFoto} sin foto puesta a mano.</p>
    <section class="fl-bloque">
      <h4>Subir las fotos de golpe</h4>
      <p class="admin-note">Cada foto va a su carta por el número del nombre del fichero: <code>4.jpg</code>, <code>004.png</code>, <code>Jolteon 4.webp</code>, <code>jungle-4-64.jpg</code> o <code>SH2.png</code>. Se comprimen antes de subir.</p>
      <label class="fl-soltar" id="flSoltar">
        <input type="file" id="flFicheros" accept="image/*" multiple>
        <span>Suelta aquí las fotos o toca para elegirlas</span>
      </label>
      <ul class="fl-casadas" id="flCasadas"></ul>
      <p><button class="btn-primary btn-small hidden" id="flSubir">Subir y poner</button></p>
    </section>
    <section class="fl-bloque">
      <h4>Desde una dirección con el número dentro</h4>
      <p class="admin-note">Pega la dirección de la foto de una carta cambiando su número por <code>{n}</code> (o <code>{n3}</code> si va con ceros, «004»). El navegador prueba cada carta y solo se guardan las que cargan. Por ejemplo, de TCGdex: <code>https://assets.tcgdex.net/ja/S/SLL/{n3}/high.webp</code>.</p>
      <input type="url" id="flPatron" class="fl-patron" placeholder="https://…/{n}.png" aria-label="Dirección de las fotos con el número">
      <label class="fl-tambien"><input type="checkbox" id="flTambien"> También las que ya tienen foto a mano</label>
      <p><button class="btn-secondary btn-small" id="flProbar">Probar y poner</button></p>
      <p class="admin-note" id="flPatronEstado" aria-live="polite"></p>
    </section>`)
  $('flVolver').addEventListener('click', () => { if (!ocupado) volver() })

  const pintarCasadas = () => {
    const buenas = casadas.filter((f) => !f.motivo)
    $('flCasadas').innerHTML = casadas.map((f) => `<li class="${f.motivo ? 'fl-mal' : 'fl-bien'}" data-fichero="${escapeHtml(f.nombre)}">
      <span>${escapeHtml(f.nombre)}</span>
      <span>${f.carta ? `→ ${escapeHtml(f.carta.local_id)} · ${escapeHtml(f.carta.name_es || f.carta.name_en || f.carta.name || '')}` : ''}${f.motivo ? ` <strong>${escapeHtml(f.motivo)}</strong>` : ''}${f.estado ? ` · ${escapeHtml(f.estado)}` : ''}</span>
    </li>`).join('')
    $('flSubir').classList.toggle('hidden', !buenas.length)
    $('flSubir').textContent = `Subir y poner ${buenas.length} ${buenas.length === 1 ? 'foto' : 'fotos'}`
  }
  const recibir = (lista) => {
    ficheros = [...lista].filter((f) => f.type?.startsWith('image/'))
    casadas = casarFicheros(ficheros.map((f) => f.name), cartas).map((f, i) => ({ ...f, fichero: ficheros[i] }))
    pintarCasadas()
  }
  $('flFicheros').addEventListener('change', (e) => recibir(e.target.files || []))
  const zona = $('flSoltar')
  zona.addEventListener('dragover', (e) => { e.preventDefault(); zona.classList.add('fl-encima') })
  zona.addEventListener('dragleave', () => zona.classList.remove('fl-encima'))
  zona.addEventListener('drop', (e) => { e.preventDefault(); zona.classList.remove('fl-encima'); recibir(e.dataTransfer?.files || []) })

  $('flSubir').addEventListener('click', async () => {
    if (ocupado) return
    const { data: { session } = {} } = await supabase.auth.getSession()
    if (!session) return showToast('Hay que entrar para subir fotos.', 'error')
    ocupado = true
    $('flSubir').disabled = true
    let hechas = 0
    for (const f of casadas.filter((x) => !x.motivo)) {
      f.estado = 'subiendo…'
      pintarCasadas()
      try {
        const url = await subir(session.user.id, f.fichero)
        const { error } = await guardar(f.carta, mercado, url)
        if (error) throw new Error(faltaLaMigracion(error) ? AVISO_MIGRACION : error.message)
        f.carta.image_path = url
        f.estado = 'puesta'
        hechas++
      } catch (err) {
        f.estado = `no se ha podido: ${String(err?.message || err).slice(0, 80)}`
      }
      pintarCasadas()
    }
    ocupado = false
    $('flSubir').disabled = false
    const total = casadas.filter((x) => !x.motivo).length
    showToast(`${hechas} de ${total} fotos puestas`, hechas === total ? 'success' : 'error')
  })

  $('flProbar').addEventListener('click', async () => {
    if (ocupado) return
    const patron = $('flPatron').value.trim()
    const estado = $('flPatronEstado')
    if (!urlDePatron(patron, cartas[0] || { local_id: '1' }, set.id)) {
      estado.textContent = 'La dirección tiene que empezar por https:// y llevar {n}, {n2}, {n3} o {id} donde va el número.'
      return
    }
    const tambien = $('flTambien').checked
    const cuales = cartas.filter((c) => tambien || !tieneFotoAMano(c))
    if (!cuales.length) { estado.textContent = 'Todas tienen ya foto a mano: marca la casilla para cambiarlas.'; return }
    ocupado = true
    $('flProbar').disabled = true
    let puestas = 0
    const faltan = []
    // De cuatro en cuatro: probar 60 a la vez satura al servidor de fuera, y
    // de una en una son minutos.
    for (let i = 0; i < cuales.length; i += 4) {
      await Promise.all(cuales.slice(i, i + 4).map(async (c) => {
        const url = urlDePatron(patron, c, set.id)
        if (!(await carga(url))) { faltan.push(c.local_id); return }
        const { error } = await guardar(c, mercado, url)
        if (error) { faltan.push(c.local_id); return }
        c.image_path = url
        puestas++
      }))
      estado.textContent = `Probadas ${Math.min(i + 4, cuales.length)} de ${cuales.length} · puestas ${puestas}`
    }
    ocupado = false
    $('flProbar').disabled = false
    estado.textContent = `Puestas ${puestas} de ${cuales.length}.${faltan.length ? ` Sin foto en esa dirección: ${faltan.slice(0, 30).join(', ')}${faltan.length > 30 ? '…' : ''}.` : ''}`
    showToast(`${puestas} fotos puestas`, puestas ? 'success' : 'error')
  })
}
