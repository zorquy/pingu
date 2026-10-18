// ── El editor de cartas del catálogo (tanda 885) ──
//
// PINGU: «méteme el catálogo de cartas y expansiones en el admin para poder
// editar todos los datos de expansiones y cartas por si alguna está mal.
// Debería ser reemplazable lo que meto a mano sobre lo que está
// automático, para correcciones manuales».
//
// Esta hoja es la lista de cartas de UNA colección —se entra desde el
// editor de la colección— y la ficha editable de cada una. Lo que se
// guarda no es un `update`: es una CORRECCIÓN (`catalogo_corregir`), que
// la base apunta aparte y vuelve a poner encima de lo que escriba cualquier
// pasada automática (el calco japonés, los precios, cartas-detalle). Por
// eso solo se mandan las columnas que han CAMBIADO respecto a lo que se
// cargó: una corrección sobre una columna que no se ha tocado la dejaría
// clavada para siempre en el valor de hoy.
//
// La foto subida a mano va como dirección entera en `image_path` (la
// cadena de escaneos la pone la primera, ver `urlDeImagen`): así ningún
// `select` de la web tiene que pedir una columna nueva (la 523).
import { supabase } from '../../js/supabase.js'
import { escapeHtml, validateImageFile, uploadGuideImage } from '../../js/app.js'
import { showToast } from '../../js/toast.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from '../../js/escaneo-carta.js'

const $ = (id) => document.getElementById(id)

// Lo puro (qué se manda, cómo se leen las cajas, los campos) vive aparte,
// sin DOM ni Supabase, para que una prueba lo importe en Node (la 471).
import { faltaLaMigracion, loQueCambia, leerCampo, variantesDe, CAMPOS, AVISO_MIGRACION } from './catalogo-puro.js'
export { faltaLaMigracion, loQueCambia, leerCampo, variantesDe, CAMPOS }

// ── Estado ──
let set = null
let mercado = 'WEST'
let cartas = []
let correcciones = new Map() // id → Map(columna → { valor, anterior })
let filtro = ''
let hoja = { abrir: () => {}, cerrar: () => {} }
let alVolver = () => {}

async function cargar() {
  // `*` a propósito: una lista de columnas que nombre una que aún no
  // existe tumba la consulta entera (la 624), y esta pantalla tiene que
  // enseñar lo que haya.
  const { data, error } = await supabase
    .from('tcg_cards')
    .select('*')
    .eq('set_id', set.id)
    .eq('market', mercado)
    .limit(1000)
  if (error) { showToast(error.message.slice(0, 120), 'error'); cartas = []; return }
  cartas = (data || []).slice().sort(porNumero)
  correcciones = new Map()
  const { data: corr, error: e2 } = await supabase
    .from('tcg_correcciones')
    .select('id,columna,valor,anterior')
    .eq('tabla', 'tcg_cards')
    .eq('market', mercado)
    .in('id', cartas.map((c) => c.id))
  if (!e2) {
    for (const c of corr || []) {
      if (!correcciones.has(c.id)) correcciones.set(c.id, new Map())
      correcciones.get(c.id).set(c.columna, { valor: c.valor, anterior: c.anterior })
    }
  }
}

function porNumero(a, b) {
  const na = parseInt(a.local_id, 10)
  const nb = parseInt(b.local_id, 10)
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb
  return String(a.local_id).localeCompare(String(b.local_id), 'es', { numeric: true })
}

function nombreDe(c) {
  return c.name_es || c.name_en || c.name || c.id
}

function casa(c) {
  if (!filtro) return true
  const t = filtro.toLowerCase()
  return [c.id, c.local_id, c.name, c.name_en, c.name_es].filter(Boolean).some((x) => String(x).toLowerCase().includes(t))
}

function chapaDe(c) {
  const n = correcciones.get(c.id)?.size || 0
  if (c.origen === 'mano') return '<span class="cat-chapa cat-chapa-mano">a mano</span>'
  if (n) return `<span class="cat-chapa cat-chapa-corregida">${n === 1 ? '1 corrección' : `${n} correcciones`}</span>`
  return ''
}

function filaDeCarta(c) {
  const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c)) || ''
  return `<li class="cat-carta" data-carta="${escapeHtml(c.id)}">
    <span class="cat-carta-foto">${escaneo ? `<img ${escaneo} alt="" loading="lazy" width="36" height="48">` : ''}</span>
    <span class="cat-carta-nombre">
      <strong>${escapeHtml(c.local_id)} · ${escapeHtml(nombreDe(c))}</strong>
      <small>${escapeHtml(c.id)}${c.rarity ? ` · ${escapeHtml(c.rarity)}` : ''}${c.hp ? ` · ${c.hp} PS` : ''} ${chapaDe(c)}</small>
    </span>
    <button class="btn-outline btn-small" data-editar-carta="${escapeHtml(c.id)}">Editar</button>
  </li>`
}

export function pintarLista() {
  const visibles = cartas.filter(casa)
  const corregidas = cartas.filter((c) => correcciones.get(c.id)?.size).length
  const aMano = cartas.filter((c) => c.origen === 'mano').length
  hoja.abrir(`
    <div class="cat-cab">
      <button class="btn-secondary btn-small" id="catVolver">← Colección</button>
      <h3>${escapeHtml(set.name_en || set.name || set.id)}</h3>
    </div>
    <p class="admin-note">${cartas.length} cartas${corregidas ? ` · ${corregidas} con correcciones` : ''}${aMano ? ` · ${aMano} a mano` : ''}. Lo que corrijas aquí manda sobre lo que traigan las pasadas automáticas.</p>
    <div class="cat-barra">
      <input type="search" id="catFiltro" placeholder="Número o nombre…" aria-label="Buscar una carta" value="${escapeHtml(filtro)}">
      <button class="btn-primary btn-small" id="catNueva">Nueva carta</button>
    </div>
    <ul class="cat-lista" id="catLista">${visibles.map(filaDeCarta).join('') || '<li class="empty-state">Ninguna carta coincide.</li>'}</ul>`)
  $('catVolver').addEventListener('click', () => alVolver())
  $('catFiltro').addEventListener('input', (e) => {
    filtro = e.target.value.trim()
    $('catLista').innerHTML = cartas.filter(casa).map(filaDeCarta).join('') || '<li class="empty-state">Ninguna carta coincide.</li>'
    escucharLista()
  })
  $('catNueva').addEventListener('click', () => abrirFicha(null))
  escucharLista()
  $('catFiltro').focus()
}

function escucharLista() {
  document.querySelectorAll('[data-editar-carta]').forEach((b) =>
    b.addEventListener('click', () => abrirFicha(b.dataset.editarCarta))
  )
}

// ── La ficha ──

function valorEnCaja(campo, v) {
  if (v === null || v === undefined) return ''
  if (campo.tipo === 'json') return JSON.stringify(v, null, 1)
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
}

function cajaDe(campo, c, corregida) {
  const id = `cat_${campo.col}`
  const v = valorEnCaja(campo, c?.[campo.col])
  const chapa = corregida ? ` <button type="button" class="cat-quitar" data-quitar="${escapeHtml(campo.col)}" title="Quitar la corrección y volver a lo que traía el catálogo">corregida · quitar</button>` : ''
  const caja = campo.largo
    ? `<textarea id="${id}" rows="${campo.tipo === 'json' ? 4 : 2}" placeholder="${escapeHtml(campo.pista || '')}">${escapeHtml(v)}</textarea>`
    : `<input id="${id}" type="${campo.tipo === 'numero' ? 'number' : 'text'}" value="${escapeHtml(v)}" placeholder="${escapeHtml(campo.pista || '')}">`
  return `<label class="cat-campo${campo.ancho === 'medio' ? ' cat-campo-medio' : ''}${corregida ? ' cat-campo-corregida' : ''}">${escapeHtml(campo.rotulo)}${chapa}${caja}</label>`
}

function abrirFicha(id) {
  const c = id ? cartas.find((x) => x.id === id) : null
  const corr = (c && correcciones.get(c.id)) || new Map()
  const variantes = c?.variants && typeof c.variants === 'object' ? c.variants : {}
  const cadena = c ? cadenaDeEscaneo(c, null, 'high') : []
  const foto = cadena[0] || ''
  const nueva = !c
  const basicos = CAMPOS.filter((f) => !f.avanzado)
  const avanzados = CAMPOS.filter((f) => f.avanzado)
  hoja.abrir(`
    <div class="cat-cab">
      <button class="btn-secondary btn-small" id="catAtras">← Cartas</button>
      <h3>${nueva ? 'Nueva carta' : escapeHtml(`${c.local_id} · ${nombreDe(c)}`)}</h3>
    </div>
    ${nueva
      ? `<p class="admin-note">Nace con origen «a mano»: ninguna pasada automática la tocará ni la borrará. Id: <code>mano-${escapeHtml(set.id)}-<em>número</em></code>.</p>`
      : `<p class="admin-note"><code>${escapeHtml(c.id)}</code> · ${escapeHtml(mercado)}${c.origen ? ` · origen ${escapeHtml(c.origen)}` : ''}${corr.size ? ` · ${corr.size} ${corr.size === 1 ? 'corrección' : 'correcciones'}` : ''}</p>`}
    <div class="cat-foto-caja">
      <span class="cat-foto-ver" id="catFotoVer">${foto ? `<img src="${escapeHtml(foto)}" alt="">` : '<span class="col-set-sinlogo">sin foto</span>'}</span>
      <span class="cat-foto-acciones">
        <input type="file" id="catFotoFichero" accept="image/*" aria-label="Subir una foto de la carta">
        <input id="cat_foto" type="url" value="${escapeHtml(/^https?:\/\//.test(c?.image_path || '') ? c.image_path : '')}" placeholder="…o pega la dirección de una foto" aria-label="Dirección de la foto">
        ${corr.has('image_path') ? '<button type="button" class="cat-quitar" data-quitar="image_path">foto corregida · quitar</button>' : ''}
      </span>
    </div>
    <div class="cat-campos">${basicos.map((f) => cajaDe(f, c, corr.has(f.col))).join('')}</div>
    <fieldset class="cat-impresiones${corr.has('variants') ? ' cat-campo-corregida' : ''}">
      <legend>Impresiones${corr.has('variants') ? ' <button type="button" class="cat-quitar" data-quitar="variants">corregidas · quitar</button>' : ''}</legend>
      ${[['normal', 'Normal'], ['reverse', 'Reverse'], ['holo', 'Holo'], ['firstEdition', '1.ª edición']].map(([k, r]) =>
        `<label class="col-check"><input type="checkbox" id="catVar_${k}"${variantes[k] ? ' checked' : ''}> ${r}</label>`).join('')}
    </fieldset>
    <details class="cat-avanzado"><summary>Ataques, habilidades, debilidades y resistencias (JSON)</summary>
      <div class="cat-campos">${avanzados.map((f) => cajaDe(f, c, corr.has(f.col))).join('')}</div>
    </details>
    <div class="col-hoja-pie">
      ${!nueva && c.origen === 'mano' ? '<button class="btn-danger btn-small" id="catBorrar">Borrar la carta…</button>' : ''}
      <span style="flex:1"></span>
      <button class="btn-secondary" id="catCancelar">Cancelar</button>
      <button class="btn-primary" id="catGuardar">${nueva ? 'Crear' : 'Guardar'}</button>
    </div>`)

  $('catAtras').addEventListener('click', pintarLista)
  $('catCancelar').addEventListener('click', pintarLista)

  // La foto: se sube al cubo de las guías (público, ya existe) y RELLENA
  // la caja de la dirección; se guarda al dar a Guardar, como el logo.
  $('catFotoFichero').addEventListener('change', async (e) => {
    const fichero = e.target.files?.[0]
    if (!fichero) return
    const ver = $('catFotoVer')
    try {
      validateImageFile(fichero)
      ver.innerHTML = '<span class="col-set-sinlogo">subiendo…</span>'
      const { data: { session } = {} } = await supabase.auth.getSession()
      if (!session) throw new Error('Hay que entrar para subir una imagen.')
      const url = await uploadGuideImage(session.user.id, fichero)
      $('cat_foto').value = url
      ver.innerHTML = `<img src="${escapeHtml(url)}" alt="">`
      showToast('Foto subida. Dale a Guardar para dejarla puesta.', 'success')
    } catch (err) {
      ver.innerHTML = foto ? `<img src="${escapeHtml(foto)}" alt="">` : '<span class="col-set-sinlogo">sin foto</span>'
      showToast(String(err?.message || err).slice(0, 140), 'error')
    } finally {
      e.target.value = ''
    }
  })

  document.querySelectorAll('[data-quitar]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!c) return
      const { error } = await supabase.rpc('catalogo_descorregir', { p_tabla: 'tcg_cards', p_id: c.id, p_market: mercado, p_columna: b.dataset.quitar })
      if (error) return showToast(faltaLaMigracion(error) ? AVISO_MIGRACION : error.message.slice(0, 140), 'error')
      showToast('Corrección quitada: vuelve lo del catálogo', 'success')
      await cargar()
      abrirFicha(c.id)
    })
  )

  $('catGuardar').addEventListener('click', async () => {
    let valores
    try {
      valores = leerFicha()
    } catch (err) {
      return showToast(`Hay un JSON mal escrito: ${String(err?.message || err).slice(0, 100)}`, 'error')
    }
    // La foto: la dirección de la caja si hay; vacía, se deja lo que haya
    // (quitar la de a mano es «quitar la corrección», no borrar la caja).
    const urlFoto = $('cat_foto').value.trim()
    if (urlFoto) valores.image_path = urlFoto
    if (nueva) {
      const numero = String(valores.local_id || '').trim()
      if (!numero || !valores.name) return showToast('Una carta nueva necesita al menos número y nombre.', 'error')
      const idNuevo = `mano-${set.id}-${numero}`.toLowerCase().replace(/[^a-z0-9_-]+/g, '-')
      if (cartas.some((x) => x.id === idNuevo || x.local_id === numero)) return showToast(`Ya hay una carta con el número ${numero} en esta colección.`, 'error')
      const cambios = Object.fromEntries(Object.entries(valores).filter(([, v]) => v !== null))
      cambios.set_id = set.id
      const { error } = await supabase.rpc('catalogo_corregir', { p_tabla: 'tcg_cards', p_id: idNuevo, p_market: mercado, p_cambios: cambios, p_crear: true })
      if (error) return showToast(faltaLaMigracion(error) ? AVISO_MIGRACION : error.message.slice(0, 140), 'error')
      showToast('Carta creada', 'success')
    } else {
      const cambios = loQueCambia(c, valores)
      if (!Object.keys(cambios).length) return showToast('No has cambiado nada.')
      const { error } = await supabase.rpc('catalogo_corregir', { p_tabla: 'tcg_cards', p_id: c.id, p_market: mercado, p_cambios: cambios })
      if (error) return showToast(faltaLaMigracion(error) ? AVISO_MIGRACION : error.message.slice(0, 140), 'error')
      showToast(`Guardado: ${Object.keys(cambios).length === 1 ? '1 corrección' : `${Object.keys(cambios).length} correcciones`}`, 'success')
    }
    await cargar()
    pintarLista()
  })

  $('catBorrar')?.addEventListener('click', async () => {
    const dicho = window.prompt(`Se va a borrar «${nombreDe(c)}» (${c.id}). Solo se puede si nadie la tiene apuntada.\n\nEscribe el número (${c.local_id}) para confirmar:`)
    if (dicho !== String(c.local_id)) return showToast('No se ha borrado nada.')
    const { error } = await supabase.rpc('catalogo_borrar_carta', { p_id: c.id, p_market: mercado })
    if (error) return showToast(faltaLaMigracion(error) ? AVISO_MIGRACION : error.message.slice(0, 140), 'error')
    showToast('Carta borrada', 'success')
    await cargar()
    pintarLista()
  })
}

function leerFicha() {
  const valores = {}
  for (const f of CAMPOS) {
    const caja = $(`cat_${f.col}`)
    if (!caja) continue
    valores[f.col] = leerCampo(f.tipo, caja.value)
  }
  valores.variants = variantesDe({
    normal: $('catVar_normal')?.checked, reverse: $('catVar_reverse')?.checked,
    holo: $('catVar_holo')?.checked, firstEdition: $('catVar_firstEdition')?.checked,
  })
  return valores
}

// La puerta: desde el editor de la colección. `hojaDe` son las dos
// funciones de la hoja lateral de colecciones (abrir con un HTML, cerrar);
// `volver` repinta el editor de la colección al salir.
export async function abrirCartasDeSet(elSet, elMercado, hojaDe, volver) {
  set = elSet
  mercado = elMercado
  hoja = hojaDe
  alVolver = volver
  filtro = ''
  hoja.abrir('<p class="admin-note">Cargando las cartas…</p>')
  await cargar()
  pintarLista()
}
