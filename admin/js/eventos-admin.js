// /admin → Eventos (tanda 1192): dar de alta, editar, publicar y borrar los
// eventos de la agenda (/eventos). El equipo escribe directo en `eventos` (la
// política `eventos_equipo` de supabase-migration-1192-eventos.sql deja solo a
// un admin). El logo se sube al cubo del equipo (`guide-images`) y se guarda
// su dirección; sin logo, la agenda pinta las siglas en su color.
import { supabase } from '../../js/supabase.js'
import { escapeHtml, getSession, uploadGuideImage } from '../../js/app.js'
import { showToast } from '../../js/toast.js'
import { sinMigracion } from '../../js/sin-migracion.js'
import { TIPOS, MESES, slugDeEvento, siglasDe, webSegura } from '../../js/eventos-puro.js'
import { aLocal } from './avisos-admin.js'

const CAMPOS = ['nombre', 'tipo', 'sitio', 'direccion', 'ciudad', 'provincia', 'entrada', 'juegos', 'descripcion', 'web', 'instagram', 'tcgmap_url', 'logo_url', 'siglas', 'color']
let raiz = null
let eventos = []
let editando = null

const deLocal = (v) => (v ? new Date(v).toISOString() : null)

async function cargar() {
  const { data, error } = await supabase.from('eventos').select('*').order('empieza', { ascending: false })
  if (error) {
    raiz.innerHTML = sinMigracion(error)
      ? '<p class="admin-note av-mal">Falta ejecutar <code>supabase-migration-1192-eventos.sql</code> en el SQL Editor. Hasta entonces la agenda dice «llega muy pronto».</p>'
      : `<p class="admin-note av-mal">No se han podido cargar los eventos: ${escapeHtml(error.message || '')}</p>`
    return
  }
  eventos = data || []
  pintar()
}

function filaHtml(e) {
  const d = new Date(e.empieza)
  const pasado = new Date(e.termina || e.empieza) < new Date(new Date().setHours(0, 0, 0, 0))
  return `<div class="admin-card evadm-fila${pasado ? ' pasado' : ''}">
    <span class="evadm-fecha"><b>${d.getDate()}</b><small>${MESES[d.getMonth()]} ${d.getFullYear()}</small></span>
    <span class="evadm-cuerpo"><b>${escapeHtml(e.nombre)}</b><small>${escapeHtml([TIPOS[e.tipo], e.sitio, e.ciudad].filter(Boolean).join(' · '))}</small></span>
    ${e.publicado === false ? '<span class="evadm-chapa">Sin publicar</span>' : ''}
    <a class="btn-secondary" href="/eventos/${encodeURIComponent(e.slug)}" target="_blank" rel="noopener">Ver</a>
    <button type="button" class="btn-secondary" data-ev-editar="${escapeHtml(e.id)}">Editar</button>
  </div>`
}

function formHtml(e) {
  const v = (k) => escapeHtml(e?.[k] ?? '')
  const campo = (k, eti, extra = '') => `<label class="av-campo"><span class="av-eti">${eti}</span><input type="text" id="evf-${k}" value="${v(k)}" ${extra}></label>`
  return `<form class="admin-card evadm-form" id="evForm" novalidate>
    <h2>${e?.id ? 'Editar evento' : 'Nuevo evento'}</h2>
    <div class="evadm-rejilla">
      ${campo('nombre', 'Nombre *', 'maxlength="120" required placeholder="Iberian Card Show"')}
      <label class="av-campo"><span class="av-eti">Tipo</span><select id="evf-tipo">${Object.entries(TIPOS).map(([k, n]) => `<option value="${k}"${(e?.tipo || 'card_show') === k ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="av-campo"><span class="av-eti">Empieza *</span><input type="datetime-local" id="evf-empieza" value="${aLocal(e?.empieza)}" required></label>
      <label class="av-campo"><span class="av-eti">Acaba (opcional)</span><input type="datetime-local" id="evf-termina" value="${aLocal(e?.termina)}"></label>
      ${campo('sitio', 'Sitio', 'placeholder="Pabellón Cristal"')}
      ${campo('direccion', 'Dirección', 'placeholder="Casa de Campo"')}
      ${campo('ciudad', 'Ciudad', 'placeholder="Madrid"')}
      ${campo('provincia', 'Provincia', 'placeholder="Madrid"')}
      ${campo('entrada', 'Entrada', 'placeholder="5 € · menores gratis"')}
      ${campo('juegos', 'Juegos', 'placeholder="Pokémon · One Piece · Magic"')}
      ${campo('web', 'Web', 'placeholder="iberiancardshow.es"')}
      ${campo('instagram', 'Instagram', 'placeholder="@iberiancardshow"')}
      ${campo('tcgmap_url', 'Enlace a TCG Map Spain', 'placeholder="https://…"')}
      <label class="av-campo"><span class="av-eti">Dirección en PokeDoc</span><input type="text" id="evf-slug" value="${v('slug')}" placeholder="se pone sola con el nombre y el año" pattern="[a-z0-9-]+"></label>
    </div>
    <label class="av-campo"><span class="av-eti">Descripción</span><textarea id="evf-descripcion" rows="3" maxlength="1500">${v('descripcion')}</textarea></label>
    <div class="evadm-logo">
      <span class="ev-logo grande" id="evfLogoVista"></span>
      <div class="evadm-logo-mandos">
        <label class="av-campo"><span class="av-eti">Logo</span><input type="file" id="evf-logo" accept="image/*"></label>
        <input type="hidden" id="evf-logo_url" value="${v('logo_url')}">
        ${e?.logo_url ? '<button type="button" class="btn-secondary" id="evfQuitarLogo">Quitar el logo</button>' : ''}
        <div class="av-dos">
          ${campo('siglas', 'Siglas (sin logo)', 'maxlength="8" placeholder="IBE"')}
          <label class="av-campo"><span class="av-eti">Color</span><input type="color" id="evf-color" value="${/^#[0-9a-f]{6}$/i.test(e?.color || '') ? e.color : '#1f5175'}"></label>
        </div>
      </div>
    </div>
    <label class="av-interruptor"><input type="checkbox" id="evf-publicado" ${e?.publicado === false ? '' : 'checked'}> <span>Publicado (sale en la agenda)</span></label>
    <p class="av-nota av-mal" id="evfError" role="alert"></p>
    <div class="av-acciones">
      <button type="submit" class="btn-primary" id="evfGuardar">${e?.id ? 'Guardar' : 'Publicar el evento'}</button>
      <button type="button" class="btn-secondary" id="evfCancelar">Cancelar</button>
      ${e?.id ? `<button type="button" class="btn-secondary evadm-borrar" id="evfBorrar" data-paso="1">Borrar el evento</button>` : ''}
    </div>
  </form>`
}

function pintarLogo() {
  const vista = raiz.querySelector('#evfLogoVista')
  if (!vista) return
  const url = webSegura(raiz.querySelector('#evf-logo_url').value)
  const color = raiz.querySelector('#evf-color').value
  vista.style.setProperty('--ev-color', color)
  vista.innerHTML = `${url ? `<img src="${escapeHtml(url)}" alt="">` : ''}<b>${escapeHtml(siglasDe({ siglas: raiz.querySelector('#evf-siglas').value, nombre: raiz.querySelector('#evf-nombre').value }))}</b>`
}

function pintar() {
  const proximos = eventos.filter((e) => new Date(e.termina || e.empieza) >= new Date(new Date().setHours(0, 0, 0, 0))).reverse()
  const pasados = eventos.filter((e) => !proximos.includes(e))
  raiz.innerHTML = `
    ${editando ? formHtml(editando) : '<button type="button" class="btn-primary" id="evNuevo">+ Nuevo evento</button>'}
    <h2 class="evadm-titulo">Próximos <span class="subtext">${proximos.length}</span></h2>
    ${proximos.length ? proximos.map(filaHtml).join('') : '<p class="admin-note">No hay eventos próximos.</p>'}
    ${pasados.length ? `<h2 class="evadm-titulo">Pasados <span class="subtext">${pasados.length}</span></h2>${pasados.map(filaHtml).join('')}` : ''}`
  if (editando) pintarLogo()
}

async function guardar() {
  const val = (k) => raiz.querySelector(`#evf-${k}`)?.value.trim() || ''
  const err = raiz.querySelector('#evfError')
  const fila = Object.fromEntries(CAMPOS.map((k) => [k, val(k) || null]))
  fila.color = val('color') || null
  fila.siglas = fila.siglas ? fila.siglas.toUpperCase() : null
  fila.empieza = deLocal(val('empieza'))
  fila.termina = deLocal(val('termina'))
  fila.publicado = raiz.querySelector('#evf-publicado').checked
  fila.slug = val('slug') || slugDeEvento(fila.nombre, fila.empieza)
  if (!fila.nombre || fila.nombre.length < 2) return (err.textContent = 'Ponle un nombre.')
  if (!fila.empieza) return (err.textContent = 'Pon cuándo empieza.')
  if (fila.termina && fila.termina < fila.empieza) return (err.textContent = 'Acaba antes de empezar.')
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fila.slug)) return (err.textContent = 'La dirección solo lleva minúsculas, números y guiones.')
  const boton = raiz.querySelector('#evfGuardar')
  boton.disabled = true
  fila.updated_at = new Date().toISOString()
  const consulta = editando.id
    ? supabase.from('eventos').update(fila).eq('id', editando.id).select().single()
    : supabase.from('eventos').insert({ ...fila, creado_por: (await getSession())?.user?.id || null }).select().single()
  const { error } = await consulta
  boton.disabled = false
  if (error) {
    err.textContent = /duplicate|unique/i.test(error.message || '') ? 'Ya hay un evento con esa dirección: cámbiala.' : `No se ha podido guardar: ${error.message || ''}`
    return
  }
  showToast(editando.id ? 'Evento guardado.' : 'Evento publicado.', 'success')
  editando = null
  await cargar()
}

export async function montarEventos(panel) {
  raiz = panel
  raiz.addEventListener('click', async (ev) => {
    if (ev.target.closest('#evNuevo')) { editando = {}; pintar(); raiz.querySelector('#evf-nombre')?.focus(); return }
    const ed = ev.target.closest('[data-ev-editar]')
    if (ed) { editando = eventos.find((e) => e.id === ed.dataset.evEditar) || null; pintar(); raiz.scrollIntoView({ behavior: 'smooth' }); return }
    if (ev.target.closest('#evfCancelar')) { editando = null; pintar(); return }
    if (ev.target.closest('#evfQuitarLogo')) { raiz.querySelector('#evf-logo_url').value = ''; ev.target.closest('#evfQuitarLogo').remove(); pintarLogo(); return }
    const borrar = ev.target.closest('#evfBorrar')
    if (borrar) {
      // Dos pasos y en la página (confirm() no sale en todas partes).
      if (borrar.dataset.paso === '1') { borrar.dataset.paso = '2'; borrar.textContent = '¿Seguro? Se borra con quién iba'; return }
      const { error } = await supabase.from('eventos').delete().eq('id', editando.id)
      if (error) return showToast(`No se ha podido borrar: ${error.message || ''}`)
      showToast('Evento borrado.', 'success')
      editando = null
      await cargar()
    }
  })
  raiz.addEventListener('submit', (ev) => { ev.preventDefault(); guardar() })
  raiz.addEventListener('input', (ev) => { if (/^evf-(siglas|nombre|color)$/.test(ev.target.id)) pintarLogo() })
  raiz.addEventListener('change', async (ev) => {
    if (ev.target.id !== 'evf-logo' || !ev.target.files?.[0]) return
    const err = raiz.querySelector('#evfError')
    try {
      const sesion = await getSession()
      const url = await uploadGuideImage(sesion.user.id, ev.target.files[0])
      raiz.querySelector('#evf-logo_url').value = url
      err.textContent = ''
      pintarLogo()
    } catch (e) {
      err.textContent = `No se ha podido subir el logo: ${e.message || ''}`
    }
  })
  await cargar()
}
