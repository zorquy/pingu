// /admin → Avisos (tanda 1260; antes, 1120). PINGU: «los avisos eran un
// poco pochos… cámbiame el panel para ponerlo más moderno». Antes era UN
// aviso (una franja de texto en site_settings); ahora es la tabla `avisos`
// (supabase-migration-1260-avisos.sql): varios a la vez, cada uno con dónde
// sale (pop-up, franja, tarjeta de Inicio, campanita), su imagen, su botón o
// «Me apunto», y sus cifras sin saber quién.
//
// Dos pantallas en la misma sección: la LISTA (pestañas por estado, con la
// miniatura, dónde sale y las cifras) y el EDITOR (un formulario con la
// vista previa al lado, pintada con las MISMAS piezas de la web:
// js/aviso-puro.js). Un aviso abierto enseña además sus cifras, los
// apuntados y «Sortear».
import { supabase } from '../../js/supabase.js'
import { escapeHtml } from '../../js/app.js'
import { icons, icon } from '../../js/icons.js'
import { showToast } from '../../js/toast.js'
import { comprimirImagen, extensionDe } from '../../js/imagen-comprimir.js'
import {
  TIPOS_DE_AVISO, SITIOS_DE_AVISO, PUBLICOS_DE_AVISO, PLANTILLAS, tipoDe, enlaceSeguro, estadoDeAviso,
  quedanTexto, fechaCorta, popHtml, franjaHtml, tarjetaHtml, campanitaHtml, sumarCifras,
} from '../../js/aviso-puro.js'

const CUBO = 'avisos'
const ESTADOS = { en_marcha: 'En marcha', programado: 'Programados', borrador: 'Borradores', terminado: 'Terminados' }
// Dibujos de los sitios (icons.js no tiene «pop-up» ni «franja»).
const ICONO_SITIO = {
  popup: icon('<rect x="3" y="4" width="18" height="16" rx="2"/><rect x="7" y="8" width="10" height="8" rx="1.5"/>', 16),
  franja: icon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/>', 16),
  inicio: icons.home(16),
  campanita: icons.bell(16),
}

let raiz = null
let avisos = []
let cifras = new Map()
let pestana = 'en_marcha'

// datetime-local habla en hora LOCAL y sin zona; la base guarda ISO.
export const aLocal = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const aIso = (local) => (local ? new Date(local).toISOString() : null)
const fechaHora = (iso) => new Date(iso).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
// «1.204» y no «1204»: es-ES no separa los miles de cuatro cifras.
const miles = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
const faltaTabla = (error) => /avisos|PGRST205|42P01|does not exist|Could not find the table/i.test(`${error?.code} ${error?.message}`)

// Lo que dice la chapa de estado de una fila.
export function fraseDeEstado(a, ahora = new Date()) {
  const e = estadoDeAviso(a, ahora)
  if (e === 'borrador') return 'Borrador'
  if (e === 'programado') return `Sale el ${fechaHora(a.desde)}`
  if (e === 'terminado') return a.hasta ? `Terminó el ${fechaCorta(a.hasta)}` : 'Terminado'
  const q = quedanTexto(a.hasta, ahora)
  return q ? `En marcha · ${q.toLowerCase()}` : 'En marcha'
}

async function cargar() {
  const { data, error } = await supabase.from('avisos').select('*').order('created_at', { ascending: false })
  if (error) return { error }
  avisos = data || []
  const c = await supabase.from('aviso_cifras').select('aviso_id, vistos, clics, cerrados')
  cifras = new Map()
  for (const f of c.data || []) cifras.set(f.aviso_id, [...(cifras.get(f.aviso_id) || []), f])
  return {}
}

const miniHtml = (a) => {
  const t = tipoDe(a)
  return `<span class="av-mini" data-tipo="${t}">${a.imagen ? `<img src="${escapeHtml(a.imagen)}" alt="" width="80" height="50" loading="lazy" />` : icons[TIPOS_DE_AVISO[t].icono](22)}</span>`
}

function filaHtml(a) {
  const e = estadoDeAviso(a)
  const s = sumarCifras(cifras.get(a.id))
  const cifrasHtml = e === 'borrador' || e === 'programado'
    ? '<span class="av-cifra-nada">Todavía no ha salido</span>'
    : `<span><b>${miles(s.vistos)}</b>lo vieron</span><span><b>${miles(s.clics)}</b>${a.participar ? 'se apuntaron' : 'pulsaron'}</span>${s.porcentaje != null ? `<span><b>${s.porcentaje} %</b>entran</span>` : ''}`
  return `<button type="button" class="av-fila" data-abrir="${a.id}">
    ${miniHtml(a)}
    <span class="av-fila-info">
      <span class="av-fila-titulo">${escapeHtml(a.titulo)}</span>
      <span class="av-fila-meta">
        <span class="av-estado" data-estado="${e}">${escapeHtml(fraseDeEstado(a))}</span>
        <span class="aviso-chapa" data-tipo="${tipoDe(a)}">${TIPOS_DE_AVISO[tipoDe(a)].nombre}</span>
        <span class="av-donde" title="${(a.sitios || []).map((x) => SITIOS_DE_AVISO[x]?.nombre).join(', ')}">${(a.sitios || []).map((x) => ICONO_SITIO[x] || '').join('')}</span>
      </span>
    </span>
    <span class="av-fila-cifras">${cifrasHtml}</span>
  </button>`
}

function pintarLista() {
  const por = Object.fromEntries(Object.keys(ESTADOS).map((k) => [k, []]))
  for (const a of avisos) por[estadoDeAviso(a)].push(a)
  if (!por[pestana].length && pestana === 'en_marcha') pestana = Object.keys(ESTADOS).find((k) => por[k].length) || 'en_marcha'
  const vacio = {
    en_marcha: 'Ahora no hay ningún aviso en la web.',
    programado: 'No hay nada programado.',
    borrador: 'No hay borradores.',
    terminado: 'Todavía no ha terminado ninguno.',
  }[pestana]
  raiz.innerHTML = `
    <div class="av-cab">
      <div class="av-pestanas" role="tablist">${Object.entries(ESTADOS).map(([k, v]) => `<button type="button" role="tab" class="av-pestana${k === pestana ? ' on' : ''}" aria-selected="${k === pestana}" data-pestana="${k}">${v} <b>${por[k].length}</b></button>`).join('')}</div>
      <button type="button" class="btn-primary av-nuevo" data-nuevo>${icons.edit(16)} Nuevo aviso</button>
    </div>
    <div class="av-lista">${por[pestana].map(filaHtml).join('') || `<p class="av-vacio">${vacio} <button type="button" class="link-btn" data-nuevo>Crear uno</button></p>`}</div>`
}

// ── El editor ──
const chipsHtml = (nombre, opciones, puesto) => `<div class="av-chips" role="radiogroup">${Object.entries(opciones).map(([k, v]) => `<button type="button" role="radio" class="av-chip${k === puesto ? ' on' : ''}" aria-checked="${k === puesto}" data-av-${nombre}="${k}"${nombre === 'tipo' ? ` data-tipo="${k}"` : ''}>${typeof v === 'string' ? escapeHtml(v) : `${icons[v.icono](14)} ${escapeHtml(v.nombre)}`}</button>`).join('')}</div>`

function editorHtml(a) {
  const nuevo = !a.id
  const e = estadoDeAviso(a)
  const sitio = (k) => `<label class="av-sitio"><input type="checkbox" data-sitio="${k}" ${(a.sitios || []).includes(k) ? 'checked' : ''} /> ${ICONO_SITIO[k]}<span><b>${SITIOS_DE_AVISO[k].nombre}</b><small>${SITIOS_DE_AVISO[k].ayuda}</small></span></label>`
  return `
    <div class="av-ed-cab">
      <button type="button" class="link-btn av-volver" data-volver>${icons.chevronLeft(16)} Avisos</button>
      <h2>${nuevo ? 'Nuevo aviso' : escapeHtml(a.titulo)}</h2>
      ${nuevo ? '' : `<span class="av-estado" data-estado="${e}">${escapeHtml(fraseDeEstado(a))}</span>`}
    </div>
    <div class="av-editor">
      <form class="av-form" id="avForm" novalidate>
        <fieldset class="av-bloque"><legend class="av-eti">Qué es</legend>${chipsHtml('tipo', TIPOS_DE_AVISO, tipoDe(a))}</fieldset>
        <fieldset class="av-bloque"><legend class="av-eti">Lo que dice</legend>
          <label class="av-campo"><span>Título</span><input type="text" id="avTitulo" maxlength="160" required placeholder="Gana la caja de Funko Pop de los iniciales de Kanto" value="${escapeHtml(a.titulo || '')}" /></label>
          <label class="av-campo"><span>Texto (opcional)</span><textarea id="avTexto" maxlength="500" rows="2" placeholder="Bulbasaur, Charmander y Squirtle pueden ser tuyos.">${escapeHtml(a.texto || '')}</textarea></label>
          <div class="av-imagen">
            <span class="av-imagen-mini" id="avImagenMini" data-tipo="${tipoDe(a)}">${a.imagen ? `<img src="${escapeHtml(a.imagen)}" alt="" width="96" height="60" loading="lazy" />` : icons.image(22)}</span>
            <span class="av-imagen-txt"><b id="avImagenNombre">${a.imagen ? 'Imagen puesta' : 'Sin imagen'}</b><small>Una foto del premio o de lo que anuncias. Se comprime al subirla.</small></span>
            <label class="btn-secondary av-imagen-subir">${icons.upload(16)} ${a.imagen ? 'Cambiar' : 'Subir'}<input type="file" id="avImagenArchivo" accept="image/*" hidden /></label>
            <button type="button" class="link-btn" id="avImagenQuitar" ${a.imagen ? '' : 'hidden'}>Quitar</button>
            <input type="hidden" id="avImagen" value="${escapeHtml(a.imagen || '')}" />
          </div>
          <label class="av-interruptor"><input type="checkbox" id="avParticipar" ${a.participar ? 'checked' : ''} /> <span><b>«Me apunto»</b> — la gente se apunta con su cuenta y tú sorteas aquí</span></label>
          <div class="av-dos" id="avBoton" ${a.participar ? 'hidden' : ''}>
            <label class="av-campo"><span>Botón</span><input type="text" id="avBotonTexto" maxlength="30" placeholder="Ver más" value="${escapeHtml(a.boton_texto || '')}" /></label>
            <label class="av-campo"><span>Lleva a</span><input type="text" id="avBotonEnlace" placeholder="/tema/… o https://…" value="${escapeHtml(a.boton_enlace || '')}" /></label>
          </div>
          <div class="av-dos">
            <label class="av-campo"><span>Enlace pequeño (opcional)</span><input type="text" id="avEnlaceTexto" maxlength="40" placeholder="Bases del concurso" value="${escapeHtml(a.enlace_texto || '')}" /></label>
            <label class="av-campo"><span>Lleva a</span><input type="text" id="avEnlace" placeholder="/tema/… o https://…" value="${escapeHtml(a.enlace || '')}" /></label>
          </div>
          <small class="av-nota av-mal" id="avEnlacesNota" hidden>Los enlaces empiezan por / (de PokeDoc) o por https://.</small>
        </fieldset>
        <fieldset class="av-bloque"><legend class="av-eti">Dónde sale</legend><div class="av-sitios">${Object.keys(SITIOS_DE_AVISO).map(sitio).join('')}</div>
          <label class="av-interruptor" id="avRecordarFila"><input type="checkbox" id="avRecordar" ${a.recordar ? 'checked' : ''} /> <span>Recordarlo a la campanita cuando falte menos de un día</span></label>
        </fieldset>
        <fieldset class="av-bloque"><legend class="av-eti">Cuándo y a quién</legend>
          <div class="av-dos">
            <label class="av-campo"><span>Desde (vacío: al publicar)</span><input type="datetime-local" id="avDesde" value="${aLocal(a.desde)}" /></label>
            <label class="av-campo"><span>Hasta</span><input type="datetime-local" id="avHasta" value="${aLocal(a.hasta)}" /></label>
          </div>
          <small class="av-nota av-mal" id="avFechasNota" hidden>«Hasta» va después de «Desde».</small>
          <label class="av-interruptor"><input type="checkbox" id="avCuenta" ${a.cuenta_atras ? 'checked' : ''} /> <span>Enseñar la cuenta atrás</span></label>
          ${chipsHtml('publico', PUBLICOS_DE_AVISO, PUBLICOS_DE_AVISO[a.publico] ? a.publico : 'todos')}
        </fieldset>
        <div class="av-pie">
          <small class="av-nota" id="avResumen"></small>
          ${a.publicado
            ? '<button type="submit" class="btn-primary" data-guardar="publicado">Guardar cambios</button>'
            : '<button type="submit" class="btn-secondary" data-guardar="borrador">Guardar borrador</button><button type="submit" class="btn-primary" data-guardar="publicar">Publicar</button>'}
        </div>
      </form>
      <aside class="av-previa">
        <span class="av-eti">Así se ve</span>
        <div class="av-seg" role="group" aria-label="Dónde mirar">${Object.entries({ popup: 'Pop-up', franja: 'Franja', inicio: 'Inicio', campanita: 'Campanita' }).map(([k, v], n) => `<button type="button" aria-pressed="${n === 0}" data-previa="${k}">${v}</button>`).join('')}</div>
        <div class="av-previa-caja" id="avPrevia"></div>
        ${nuevo ? '' : '<div class="av-detalle" id="avDetalle"></div>'}
      </aside>
    </div>`
}

function leer(form, base) {
  const v = (id) => form.querySelector(id).value.trim()
  const sitios = [...form.querySelectorAll('[data-sitio]:checked')].map((x) => x.dataset.sitio)
  const participar = form.querySelector('#avParticipar').checked
  return {
    ...base,
    tipo: form.querySelector('[data-av-tipo].on')?.dataset.avTipo || 'novedad',
    titulo: v('#avTitulo'),
    texto: v('#avTexto') || null,
    imagen: v('#avImagen') || null,
    participar,
    boton_texto: participar ? null : v('#avBotonTexto') || null,
    boton_enlace: participar ? null : v('#avBotonEnlace') || null,
    enlace_texto: v('#avEnlaceTexto') || null,
    enlace: v('#avEnlace') || null,
    sitios,
    recordar: sitios.includes('campanita') && form.querySelector('#avRecordar').checked,
    cuenta_atras: form.querySelector('#avCuenta').checked,
    desde: aIso(v('#avDesde')),
    hasta: aIso(v('#avHasta')),
    publico: form.querySelector('[data-av-publico].on')?.dataset.avPublico || 'todos',
  }
}

let previaSitio = 'popup'
function pintarPrevia(caja, a) {
  const vista = { ...a, id: a.id || 'previa', titulo: a.titulo || 'El título del aviso', publicado: true }
  const html = { popup: () => `<div class="av-previa-pop">${popHtml(vista)}</div>`, franja: () => franjaHtml(vista), inicio: () => tarjetaHtml(vista), campanita: () => campanitaHtml(vista) }[previaSitio]()
  caja.querySelector('#avPrevia').innerHTML = html
  const fuera = !(a.sitios || []).includes(previaSitio)
  caja.querySelector('#avPrevia').dataset.fuera = fuera ? 'si' : ''
  if (fuera) caja.querySelector('#avPrevia').insertAdjacentHTML('beforeend', '<p class="av-nota av-previa-fuera">Este aviso no sale aquí: enciéndelo en «Dónde sale».</p>')
}

function validar(form, a) {
  const malEnlace = [a.boton_enlace, a.enlace].some((e) => e && !enlaceSeguro(e))
  form.querySelector('#avEnlacesNota').hidden = !malEnlace
  const malFechas = a.desde && a.hasta && new Date(a.hasta) <= new Date(a.desde)
  form.querySelector('#avFechasNota').hidden = !malFechas
  form.querySelector('#avRecordarFila').hidden = !a.sitios.includes('campanita')
  form.querySelector('#avBoton').hidden = a.participar
  const r = []
  if (a.sitios.length) r.push(`Sale en: ${a.sitios.map((x) => SITIOS_DE_AVISO[x].nombre.toLowerCase()).join(', ')}.`)
  if (a.hasta) r.push(`Se apaga solo el ${fechaHora(a.hasta)}.`)
  const resumen = form.querySelector('#avResumen')
  resumen.textContent = r.join(' ')
  if (!a.titulo) return 'El aviso necesita un título.'
  if (!a.sitios.length) return 'Elige al menos un sitio donde salga.'
  if (malEnlace) return 'Los enlaces empiezan por / o por https://.'
  if (malFechas) return '«Hasta» va después de «Desde».'
  return null
}

async function subirImagen(file) {
  const { blob, tipo } = await comprimirImagen(file, { ladoMax: 1600 })
  const ruta = `${new Date().toISOString().slice(0, 10)}/${Math.random().toString(36).slice(2, 10)}.${extensionDe(tipo)}`
  const { error } = await supabase.storage.from(CUBO).upload(ruta, blob, { contentType: tipo, upsert: false })
  if (error) throw error
  return supabase.storage.from(CUBO).getPublicUrl(ruta).data.publicUrl
}

function abrirEditor(base) {
  let a = { tipo: 'concurso', sitios: [...PLANTILLAS.concurso.sitios], publico: 'todos', ...(base.id ? {} : PLANTILLAS[base.tipo || 'concurso']), ...base }
  raiz.innerHTML = editorHtml(a)
  const form = raiz.querySelector('#avForm')
  const repintar = () => {
    a = leer(form, a)
    validar(form, a)
    pintarPrevia(raiz, a)
  }
  repintar()
  if (a.id) pintarDetalle(a)

  form.addEventListener('input', repintar)
  form.addEventListener('change', repintar)
  raiz.querySelector('[data-volver]').addEventListener('click', () => volverALista())
  raiz.querySelector('.av-seg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-previa]')
    if (!b) return
    previaSitio = b.dataset.previa
    for (const x of b.parentElement.children) x.setAttribute('aria-pressed', String(x === b))
    pintarPrevia(raiz, a)
  })
  // En la vista previa nada navega ni se cierra.
  raiz.querySelector('#avPrevia').addEventListener('click', (e) => {
    if (e.target.closest('a, button')) e.preventDefault()
  })
  form.addEventListener('click', (e) => {
    const chip = e.target.closest('.av-chip')
    if (!chip) return
    for (const c of chip.parentElement.children) {
      c.classList.toggle('on', c === chip)
      c.setAttribute('aria-checked', String(c === chip))
    }
    // Un aviso NUEVO que cambia de tipo se rellena con su plantilla.
    if (chip.dataset.avTipo && !a.id) {
      const p = PLANTILLAS[chip.dataset.avTipo]
      form.querySelectorAll('[data-sitio]').forEach((x) => { x.checked = p.sitios.includes(x.dataset.sitio) })
      form.querySelector('#avParticipar').checked = p.participar
      form.querySelector('#avCuenta').checked = p.cuenta_atras
      form.querySelector('#avRecordar').checked = p.recordar
      if (!form.querySelector('#avBotonTexto').value) form.querySelector('#avBotonTexto').value = p.boton_texto
    }
    raiz.querySelector('#avImagenMini').dataset.tipo = chip.dataset.avTipo || raiz.querySelector('#avImagenMini').dataset.tipo
    repintar()
  })

  const archivo = form.querySelector('#avImagenArchivo')
  archivo.addEventListener('change', async () => {
    const f = archivo.files?.[0]
    if (!f) return
    const nombre = form.querySelector('#avImagenNombre')
    nombre.textContent = 'Subiendo…'
    try {
      const url = await subirImagen(f)
      form.querySelector('#avImagen').value = url
      form.querySelector('#avImagenMini').innerHTML = `<img src="${escapeHtml(url)}" alt="" width="96" height="60" loading="lazy" />`
      nombre.textContent = f.name
      form.querySelector('#avImagenQuitar').hidden = false
      repintar()
    } catch (e) {
      nombre.textContent = 'Sin imagen'
      showToast(`No se ha podido subir la imagen: ${e.message || e}`, 'error')
    } finally {
      archivo.value = ''
    }
  })
  form.querySelector('#avImagenQuitar').addEventListener('click', () => {
    form.querySelector('#avImagen').value = ''
    form.querySelector('#avImagenMini').innerHTML = icons.image(22)
    form.querySelector('#avImagenNombre').textContent = 'Sin imagen'
    form.querySelector('#avImagenQuitar').hidden = true
    repintar()
  })

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const que = e.submitter?.dataset.guardar || 'borrador'
    a = leer(form, a)
    const mal = validar(form, a)
    if (mal) return showToast(mal, 'error')
    const boton = e.submitter
    if (boton) boton.disabled = true
    try {
      const fila = {
        tipo: a.tipo, titulo: a.titulo, texto: a.texto, imagen: a.imagen, participar: a.participar,
        boton_texto: a.boton_texto, boton_enlace: a.boton_enlace, enlace_texto: a.enlace_texto, enlace: a.enlace,
        sitios: a.sitios, recordar: a.recordar, cuenta_atras: a.cuenta_atras, desde: a.desde, hasta: a.hasta, publico: a.publico,
        updated_at: new Date().toISOString(),
      }
      if (que === 'publicar') Object.assign(fila, { publicado: true, publicado_at: new Date().toISOString() })
      if (que === 'borrador') fila.publicado = false
      const r = a.id
        ? await supabase.from('avisos').update(fila).eq('id', a.id).select().single()
        : await supabase.from('avisos').insert(fila).select().single()
      if (r.error) return showToast(`No se ha podido guardar: ${r.error.message}`, 'error')
      const guardado = r.data
      document.dispatchEvent(new CustomEvent('pd-aviso-guardado'))
      // La campanita sale al publicar si ya está en marcha; si es para más
      // adelante, la manda la pasada de cada hora (avisos-recordatorio).
      if (guardado.publicado && guardado.sitios.includes('campanita') && estadoDeAviso(guardado) === 'en_marcha' && !guardado.avisado_at) {
        const c = await supabase.rpc('admin_aviso_avisar', { p_aviso: guardado.id })
        if (c.error) showToast(`Guardado, pero la campanita no: ${c.error.message}`, 'error')
        else showToast(c.data?.personas ? `Publicado y mandado a ${miles(c.data.personas)} personas.` : 'Publicado.', 'success')
      } else {
        showToast(que === 'publicar' ? (estadoDeAviso(guardado) === 'programado' ? `Programado: sale el ${fechaHora(guardado.desde)}.` : 'Publicado. Ya está en la web.') : que === 'borrador' ? 'Borrador guardado.' : 'Cambios guardados.', 'success')
      }
      await cargar()
      pestana = estadoDeAviso(guardado)
      abrirEditor(avisos.find((x) => x.id === guardado.id) || guardado)
    } finally {
      if (boton) boton.disabled = false
    }
  })
}

// Las cifras, los apuntados y lo que se hace con un aviso que ya existe.
async function pintarDetalle(a) {
  const caja = raiz.querySelector('#avDetalle')
  if (!caja) return
  const s = sumarCifras(cifras.get(a.id))
  const e = estadoDeAviso(a)
  caja.innerHTML = `
    <div class="av-cifras">
      <span><b>${miles(s.vistos)}</b>lo vieron</span>
      <span><b>${miles(s.clics)}</b>${a.participar ? 'pulsaron «Me apunto»' : 'pulsaron el botón'}</span>
      <span><b>${miles(s.cerrados)}</b>lo cerraron</span>
    </div>
    <p class="av-nota">Cada persona cuenta una vez por navegador. No se guarda quién.</p>
    ${a.participar ? '<div class="av-apuntados" id="avApuntados"><p class="av-nota">Cargando los apuntados…</p></div>' : ''}
    <div class="av-acciones">
      ${e === 'en_marcha' ? '<button type="button" class="btn-secondary" data-accion="apagar">Apagar ahora</button>' : ''}
      ${a.publicado && e !== 'terminado' ? '<button type="button" class="btn-secondary" data-accion="borrador">Pasar a borrador</button>' : ''}
      <button type="button" class="btn-secondary" data-accion="duplicar">Duplicar</button>
      <button type="button" class="btn-secondary av-borrar" data-accion="borrar">Borrar</button>
    </div>
    <p class="av-confirmar" id="avConfirmar" hidden>¿Borrar este aviso con sus cifras y sus apuntados? <button type="button" class="btn-secondary av-borrar" data-accion="borrar-si">Sí, borrar</button> <button type="button" class="link-btn" data-accion="borrar-no">No</button></p>`
  caja.addEventListener('click', (ev) => accion(ev, a))
  if (a.participar) pintarApuntados(a)
}

async function pintarApuntados(a) {
  const caja = raiz.querySelector('#avApuntados')
  if (!caja) return
  const { data, error } = await supabase.rpc('admin_aviso_participantes', { p_aviso: a.id })
  if (error) return (caja.innerHTML = `<p class="av-nota av-mal">No se ha podido leer la lista: ${escapeHtml(error.message)}</p>`)
  const lista = data || []
  const ganador = a.ganador_id && lista.find((p) => p.user_id === a.ganador_id)
  caja.innerHTML = `
    <div class="av-apuntados-cab"><b>${miles(lista.length)} ${lista.length === 1 ? 'apuntado' : 'apuntados'}</b>
      ${lista.length ? `<button type="button" class="btn-primary" data-accion="sortear">${icons.trophy(16)} ${a.ganador_id ? 'Sortear otra vez' : 'Sortear'}</button>` : ''}</div>
    ${ganador ? ganadorHtml(ganador, a) : ''}
    ${lista.length ? `<ul class="av-apuntados-lista">${lista.map((p) => `<li${p.user_id === a.ganador_id ? ' class="gana"' : ''}><a href="/usuario/${encodeURIComponent(p.username || '')}" target="_blank" rel="noopener">@${escapeHtml(p.username || '—')}</a><small>${escapeHtml(new Date(p.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }))}</small></li>`).join('')}</ul>` : '<p class="av-nota">Todavía no se ha apuntado nadie.</p>'}`
}

const ganadorHtml = (g, a) => `<div class="av-ganador">${icons.trophy(20)}<span><small>Ganador${a.sorteado_at ? ` · ${fechaHora(a.sorteado_at)}` : ''}</small><b>${escapeHtml(g.display_name || g.username || '')}</b> @${escapeHtml(g.username || '')}</span>
  <a class="btn-secondary" href="/mensajes?with=${encodeURIComponent(g.user_id || g.id)}&texto=${encodeURIComponent(`¡Hola! Has ganado «${a.titulo}». Escríbenos para que te lo hagamos llegar.`)}" target="_blank" rel="noopener">Escribirle</a></div>`

async function accion(ev, a) {
  const b = ev.target.closest('[data-accion]')
  if (!b) return
  const que = b.dataset.accion
  const recargar = async (msg) => {
    if (msg) showToast(msg, 'success')
    document.dispatchEvent(new CustomEvent('pd-aviso-guardado'))
    await cargar()
    const x = avisos.find((y) => y.id === a.id)
    x ? abrirEditor(x) : volverALista()
  }
  if (que === 'duplicar') {
    const { id, publicado, publicado_at, avisado_at, recordado_at, ganador_id, sorteado_at, created_at, updated_at, creado_por, desde, hasta, ...resto } = a
    return abrirEditor({ ...resto, titulo: `${a.titulo}`.slice(0, 150) })
  }
  if (que === 'borrar') return (raiz.querySelector('#avConfirmar').hidden = false)
  if (que === 'borrar-no') return (raiz.querySelector('#avConfirmar').hidden = true)
  b.disabled = true
  try {
    if (que === 'borrar-si') {
      const { error } = await supabase.from('avisos').delete().eq('id', a.id)
      if (error) return showToast(`No se ha podido borrar: ${error.message}`, 'error')
      showToast('Aviso borrado.', 'success')
      document.dispatchEvent(new CustomEvent('pd-aviso-guardado'))
      await cargar()
      return volverALista()
    }
    if (que === 'apagar') {
      const { error } = await supabase.from('avisos').update({ hasta: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', a.id)
      if (error) return showToast(error.message, 'error')
      return recargar('Apagado: ya no sale en la web.')
    }
    if (que === 'borrador') {
      const { error } = await supabase.from('avisos').update({ publicado: false, updated_at: new Date().toISOString() }).eq('id', a.id)
      if (error) return showToast(error.message, 'error')
      return recargar('Ahora es un borrador: no sale en la web.')
    }
    if (que === 'sortear') {
      const { data, error } = await supabase.rpc('admin_aviso_sortear', { p_aviso: a.id })
      if (error) return showToast(error.message, 'error')
      showToast(`Ha ganado @${data.ganador.username} (entre ${data.total}).`, 'success')
      return recargar()
    }
  } finally {
    b.disabled = false
  }
}

async function volverALista() {
  pintarLista()
}

export async function montarAvisos(caja) {
  if (!caja) return
  raiz = caja
  raiz.classList.add('av-panel')
  const { error } = await cargar()
  if (error) {
    raiz.innerHTML = faltaTabla(error)
      ? '<p class="admin-aviso-parada"><span>Para crear avisos hay que ejecutar <b>supabase-migration-1260-avisos.sql</b> en el SQL Editor de Supabase. Mientras tanto, la franja que hubiera sigue saliendo en la web.</span></p>'
      : `<p class="av-nota av-mal">No se han podido leer los avisos: ${escapeHtml(error.message)}</p>`
    return
  }
  pintarLista()
  raiz.addEventListener('click', (e) => {
    if (e.target.closest('[data-nuevo]')) return abrirEditor({ tipo: 'concurso' })
    const fila = e.target.closest('[data-abrir]')
    if (fila) return abrirEditor(avisos.find((a) => a.id === fila.dataset.abrir))
    const p = e.target.closest('[data-pestana]')
    if (p) {
      pestana = p.dataset.pestana
      pintarLista()
    }
  })
  // «Poner un aviso» desde Hoy abre uno nuevo.
  if (new URLSearchParams(location.search).get('aviso') === 'nuevo') abrirEditor({ tipo: 'concurso' })
}

// La línea de «Hoy»: cuántos hay en marcha y el primero.
export async function estadoParaHoy() {
  const { data, error } = await supabase.from('avisos').select('titulo, publicado, desde, hasta, publicado_at').eq('publicado', true)
  if (error) return null
  const en = (data || []).filter((a) => estadoDeAviso(a) === 'en_marcha')
  const prog = (data || []).filter((a) => estadoDeAviso(a) === 'programado')
  if (!en.length && !prog.length) return null
  if (en.length) return { e: 'activo', texto: en.length === 1 ? `En la web: «${en[0].titulo.slice(0, 60)}»` : `${en.length} avisos en la web` }
  return { e: 'programado', texto: prog.length === 1 ? `Programado: «${prog[0].titulo.slice(0, 60)}»` : `${prog.length} avisos programados` }
}
