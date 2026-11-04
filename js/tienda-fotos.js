// Las fotos de VERDAD de una carta del stock: delante y detrás (tanda 1235).
//
// PINGU: «agregar imágenes a cada carta, solo a cartas no a productos, que te
// deje meter imagen frontal y trasera, para ver. Es algo opcional». La foto
// del catálogo es la de la carta; la de la tienda es la de ESA copia (el
// centrado, el canto, el dorso, la cápsula). Se ponen desde el Stock (la
// columna «Fotos», la rejilla y la ficha de la línea) y se ven en el
// escaparate.
//
// Las rutas viven en `tienda_stock_fotos` (migración 1235) y los ficheros en
// el cubo PÚBLICO `tienda-fotos`, una carpeta por tienda. Se comprimen antes
// de subir (`imagen-comprimir.js`, la regla de la 891). Sin la migración, la
// consulta falla y `fotosDeStock` devuelve null: no hay columna ni botón (no
// es «no hay fotos», es «aún no se puede»).
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { showToast } from './toast.js'
import { icons } from './icons.js'
import { hojaInyectada } from './hoja.js'
import { comprimirImagen, extensionDe } from './imagen-comprimir.js'

export const CUBO_FOTOS = 'tienda-fotos'
export const LADOS = [
  { id: 'frente', nombre: 'Frontal' },
  { id: 'dorso', nombre: 'Trasera' },
]
// Lo que se acepta ANTES de comprimir: una foto de móvil pesa 3–8 MB.
const TOPE_ORIGINAL = 25 * 1024 * 1024

export const urlDeFotoDeTienda = (ruta) => (ruta ? supabase.storage.from(CUBO_FOTOS).getPublicUrl(ruta).data.publicUrl : '')
export const cuantasFotos = (f) => (f ? Number(Boolean(f.frente)) + Number(Boolean(f.dorso)) : 0)

// Las fotos de unas líneas: Map(stock_id → { frente, dorso }), o null si la
// tabla no está (la migración sin ejecutar).
export async function fotosDeStock(ids) {
  const lista = [...new Set((ids || []).filter(Boolean))]
  const mapa = new Map()
  for (let i = 0; i < lista.length; i += 200) {
    const { data, error } = await supabase.from('tienda_stock_fotos').select('stock_id,frente,dorso').in('stock_id', lista.slice(i, i + 200))
    if (error) return null
    for (const f of data || []) if (f.frente || f.dorso) mapa.set(f.stock_id, { frente: f.frente || null, dorso: f.dorso || null })
  }
  return mapa
}

// La miniatura del botón: la frontal pequeña con la cuenta, o la cámara.
export function botonFotosHtml(stockId, fotos, nombre = '') {
  const n = cuantasFotos(fotos)
  const ruta = fotos?.frente || fotos?.dorso
  const etiqueta = n ? `Fotos de ${nombre} (${n} de 2)` : `Añadir fotos de ${nombre}: frontal y trasera`
  return `<button type="button" class="tdf-boton${n ? ' tdf-boton-con' : ''}" data-fotos="${escapeHtml(stockId)}" aria-label="${escapeHtml(etiqueta)}" title="${escapeHtml(n ? `${n} de 2 fotos` : 'Añadir fotos')}">${ruta ? `<img src="${escapeHtml(urlDeFotoDeTienda(ruta))}" alt="" width="28" height="39" loading="lazy" onerror="this.remove()" /><span class="tdf-cuenta">${n}</span>` : icons.camera(18)}</button>`
}

function dialogo(id, html) {
  let d = document.getElementById(id)
  if (!d) {
    d = document.createElement('dialog')
    d.id = id
    d.className = 'tdf-dialogo'
    document.body.append(d)
    d.addEventListener('click', (e) => { if (e.target === d) d.close() })
  }
  d.innerHTML = html
  return d
}

function ladoHtml(lado, ruta, ocupado) {
  const url = urlDeFotoDeTienda(ruta)
  return `<figure class="tdf-lado${ocupado ? ' tdf-subiendo' : ''}" data-lado="${lado.id}">
    <label class="tdf-hueco${ruta ? ' tdf-hueco-lleno' : ''}">
      ${ruta ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(lado.nombre)}" width="245" height="342" />` : `<span class="tdf-vacio">${icons.camera(28)}<span>Añadir ${lado.nombre.toLowerCase()}</span></span>`}
      <input type="file" accept="image/*" class="sr-only" data-subir="${lado.id}" aria-label="${ruta ? 'Cambiar' : 'Añadir'} la foto ${lado.nombre.toLowerCase()}" />
      ${ocupado ? '<span class="tdf-cargando" aria-live="polite">Subiendo…</span>' : ''}
    </label>
    <figcaption><strong>${lado.nombre}</strong>${ruta ? `<button type="button" class="link-btn tdf-quitar" data-quitar-foto="${lado.id}">${icons.trash(14)}Quitar</button>` : '<small>Opcional</small>'}</figcaption>
  </figure>`
}

// El pop-up para ponerlas. `alCambiar(fotos)` se llama con lo que queda
// guardado (o null si no queda ninguna) para repintar quien lo abrió.
export async function abrirFotosDeStock({ stockId, tiendaId, nombre = 'la carta', detalle = '', fotos = null, alCambiar = () => {} }) {
  await hojaInyectada('css/tienda-fotos.css')
  let actual = { frente: fotos?.frente || null, dorso: fotos?.dorso || null }
  const ocupado = new Set()
  const d = dialogo('tdfDialogo', '')
  const pintar = () => {
    d.innerHTML = `<div class="tdf-cuerpo">
      <div class="tdf-cab"><div><h2>Fotos de tu copia</h2><p>${escapeHtml(nombre)}${detalle ? ` · ${escapeHtml(detalle)}` : ''}</p></div><button type="button" class="tdf-cerrar" data-cerrar aria-label="Cerrar">${icons.x(20)}</button></div>
      <p class="tdf-lema">Opcional. La copia que vendes, por delante y por detrás: quien mira tu escaparate las ve al tocar la carta.</p>
      <div class="tdf-lados">${LADOS.map((l) => ladoHtml(l, actual[l.id], ocupado.has(l.id))).join('')}</div>
      <div class="tdf-pie"><button type="button" class="btn-primary" data-cerrar>Hecho</button></div>
    </div>`
  }
  pintar()

  // Guarda la fila con lo que hay; sin ninguna, la borra.
  const guardarFila = async (nuevas) => {
    if (!nuevas.frente && !nuevas.dorso) return supabase.from('tienda_stock_fotos').delete().eq('stock_id', stockId)
    return supabase.from('tienda_stock_fotos').upsert({ stock_id: stockId, tienda_id: tiendaId, frente: nuevas.frente, dorso: nuevas.dorso, updated_at: new Date().toISOString() }, { onConflict: 'stock_id' })
  }

  const subir = async (lado, file) => {
    if (!file) return
    if (!/^image\//.test(file.type || '')) return showToast('Eso no es una foto.', 'error')
    if (file.size > TOPE_ORIGINAL) return showToast('Esa foto es demasiado grande (más de 25 MB).', 'error')
    ocupado.add(lado)
    pintar()
    try {
      const { blob, tipo } = await comprimirImagen(file)
      const ruta = `${tiendaId}/${stockId}-${lado}-${Date.now()}.${extensionDe(tipo)}`
      const sube = await supabase.storage.from(CUBO_FOTOS).upload(ruta, blob, { contentType: tipo, upsert: false })
      if (sube.error) throw sube.error
      const nuevas = { ...actual, [lado]: ruta }
      const { error } = await guardarFila(nuevas)
      if (error) {
        supabase.storage.from(CUBO_FOTOS).remove([ruta])
        throw error
      }
      const vieja = actual[lado]
      actual = nuevas
      // La de antes ya no la pide nadie: fuera, sin esperar (si falla, queda
      // un fichero huérfano, no una foto rota).
      if (vieja) supabase.storage.from(CUBO_FOTOS).remove([vieja])
      alCambiar(cuantasFotos(actual) ? { ...actual } : null)
    } catch (e) {
      showToast(`No se ha podido subir la foto: ${e?.message || 'sin motivo'}.`, 'error')
    } finally {
      ocupado.delete(lado)
      pintar()
    }
  }

  // Quitar cambia ya y vuelve si la base dice que no (la 896).
  const quitar = async (lado) => {
    const antes = actual
    const vieja = actual[lado]
    actual = { ...actual, [lado]: null }
    pintar()
    const { error } = await guardarFila(actual)
    if (error) {
      actual = antes
      pintar()
      return showToast('No se ha podido quitar la foto.', 'error')
    }
    if (vieja) supabase.storage.from(CUBO_FOTOS).remove([vieja])
    alCambiar(cuantasFotos(actual) ? { ...actual } : null)
    showToast(`Foto ${lado === 'frente' ? 'frontal' : 'trasera'} quitada.`, 'success')
  }

  d.onclick = (e) => {
    if (e.target === d || e.target.closest('[data-cerrar]')) return d.close()
    const q = e.target.closest('[data-quitar-foto]')
    if (q) return quitar(q.dataset.quitarFoto)
  }
  d.onchange = (e) => {
    const input = e.target.closest('[data-subir]')
    if (input) subir(input.dataset.subir, input.files?.[0])
  }
  // Soltar una foto encima de su hueco, en el PC.
  d.ondragover = (e) => { if (e.target.closest('.tdf-lado')) e.preventDefault() }
  d.ondrop = (e) => {
    const lado = e.target.closest('.tdf-lado')?.dataset.lado
    if (!lado) return
    e.preventDefault()
    subir(lado, e.dataTransfer?.files?.[0])
  }
  if (!d.open) d.showModal()
  return d
}

// Verlas (el escaparate): las dos a la vista, la frontal primero.
export async function verFotosDeStock({ nombre = '', detalle = '', fotos }) {
  await hojaInyectada('css/tienda-fotos.css')
  const lados = LADOS.filter((l) => fotos?.[l.id])
  if (!lados.length) return null
  const d = dialogo('tdfVer', `<div class="tdf-cuerpo">
    <div class="tdf-cab"><div><h2>${escapeHtml(nombre || 'Fotos de la copia')}</h2><p>${detalle ? `${escapeHtml(detalle)} · ` : ''}la copia que vende la tienda</p></div><button type="button" class="tdf-cerrar" data-cerrar aria-label="Cerrar">${icons.x(20)}</button></div>
    <div class="tdf-lados tdf-lados-ver${lados.length === 1 ? ' tdf-una' : ''}">${lados.map((l) => `<figure class="tdf-lado"><a class="tdf-hueco tdf-hueco-lleno" href="${escapeHtml(urlDeFotoDeTienda(fotos[l.id]))}" target="_blank" rel="noopener" aria-label="${escapeHtml(`Abrir la foto ${l.nombre.toLowerCase()} en grande`)}"><img src="${escapeHtml(urlDeFotoDeTienda(fotos[l.id]))}" alt="${escapeHtml(`${nombre}, ${l.nombre.toLowerCase()}`)}" width="245" height="342" /></a><figcaption><strong>${l.nombre}</strong></figcaption></figure>`).join('')}</div>
  </div>`)
  d.onclick = (e) => { if (e.target === d || e.target.closest('[data-cerrar]')) d.close() }
  if (!d.open) d.showModal()
  return d
}
