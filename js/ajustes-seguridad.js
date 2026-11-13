// Ajustes › Seguridad (tanda 1307): el doble factor y tus sesiones abiertas.
// Entra por `import()` desde ajustes.js: solo lo baja quien abre el apartado.
//
// El doble factor se apoya en js/doble-factor.js (la ventana del código, el
// alta y la baja). Las sesiones salen de `mis_sesiones()` y se cierran con
// `cerrar_sesion()` o, todas las demás a la vez, con `signOut({ scope:
// 'others' })`, que Supabase trae de serie. Sin la migración 1307 no hay lista
// de sesiones, pero «Cerrar las demás» funciona igual.
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { icons } from './icons.js'
import { showToast } from './toast.js'
import { estadoMfa, empezarAlta, verificar, quitar, textoDeError, limpiarCodigo, pedirCodigo, nombreDeNavegador } from './doble-factor.js'

const fecha = (f) => {
  const d = new Date(f)
  if (Number.isNaN(d.getTime())) return ''
  const min = Math.round((Date.now() - d.getTime()) / 60000)
  if (min < 2) return 'ahora'
  if (min < 60) return `hace ${min} min`
  if (min < 60 * 24) return `hace ${Math.round(min / 60)} h`
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')
}

export function seguridadHtml() {
  return `
    <h2>Seguridad</h2>
    <h3>Doble factor</h3>
    <div id="ajDobleFactor" class="aj-seg-caja"><p class="aj-nota">Mirando cómo está…</p></div>
    <h3>Tus sesiones</h3>
    <p class="aj-nota">Dónde tienes PokeDoc abierto. Si ves uno que no es tuyo, ciérralo y cambia la contraseña.</p>
    <div id="ajSesiones" class="aj-seg-caja"><p class="aj-nota">Cargando…</p></div>`
}

async function pintarDobleFactor(caja) {
  const e = await estadoMfa(supabase)
  if (e.factores.length) {
    caja.innerHTML = `<p class="aj-seg-estado">${icons.shield(18)} <b>Activado.</b> Al entrar con tu contraseña te pediremos el código de tu app.</p>
      <button type="button" class="btn-secondary" data-df-quitar>Quitar el doble factor</button>`
    caja.querySelector('[data-df-quitar]').addEventListener('click', async () => {
      // Quitarlo pide el código: si alguien te roba la sesión, no te lo apaga.
      if (e.actual !== 'aal2' && !(await pedirCodigo(supabase, { factorId: e.factores[0].id, titulo: 'Escribe tu código para quitarlo' }))) return
      const error = await quitar(supabase, e.factores[0].id)
      showToast(error ? 'No se ha podido quitar. Vuelve a intentarlo.' : 'Doble factor quitado.', error ? 'error' : 'success')
      pintarDobleFactor(caja)
    })
    return
  }
  caja.innerHTML = `<p class="aj-nota">Además de la contraseña, un código de 6 cifras de una app (Google Authenticator, 1Password, Authy…). Si alguien se entera de tu contraseña, sin tu móvil no entra.</p>
    <button type="button" class="btn-primary" data-df-activar>${icons.shield(16)} Activar el doble factor</button>`
  caja.querySelector('[data-df-activar]').addEventListener('click', async (ev) => {
    ev.currentTarget.disabled = true
    const alta = await empezarAlta(supabase)
    if (alta.error) {
      ev.currentTarget.disabled = false
      showToast('No se ha podido empezar. Si sigue, es que falta activarlo en Supabase.', 'error')
      return
    }
    caja.innerHTML = `<ol class="aj-seg-pasos">
        <li>Abre tu app de códigos y escanea esto:<br><img class="aj-seg-qr" src="${escapeHtml(alta.qr)}" width="176" height="176" loading="lazy" alt="Código QR para tu app de códigos" /></li>
        <li>¿No puedes escanear? Escribe esta clave a mano: <code class="aj-seg-clave">${escapeHtml(alta.secreto)}</code></li>
        <li><label for="ajDfCodigo">Escribe el código que te da la app:</label>
          <input id="ajDfCodigo" class="campo aj-seg-codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="000000" /></li>
      </ol>
      <p class="aj-seg-error" role="alert"></p>
      <div class="aj-seg-botones"><button type="button" class="btn-secondary" data-df-cancelar>Cancelar</button><button type="button" class="btn-primary" data-df-confirmar>Confirmar</button></div>`
    const campo = caja.querySelector('#ajDfCodigo')
    const error = caja.querySelector('.aj-seg-error')
    campo.addEventListener('input', () => { campo.value = limpiarCodigo(campo.value); error.textContent = '' })
    caja.querySelector('[data-df-cancelar]').addEventListener('click', async () => { await quitar(supabase, alta.factorId); pintarDobleFactor(caja) })
    caja.querySelector('[data-df-confirmar]').addEventListener('click', async (b) => {
      if (limpiarCodigo(campo.value).length !== 6) { error.textContent = 'Son 6 cifras.'; return }
      b.currentTarget.disabled = true
      const fallo = await verificar(supabase, alta.factorId, campo.value)
      b.currentTarget.disabled = false
      if (fallo) { error.textContent = textoDeError(fallo); campo.select(); return }
      showToast('Doble factor activado. La próxima vez que entres te pediremos el código.', 'success')
      pintarDobleFactor(caja)
    })
    campo.focus()
  })
}

async function pintarSesiones(caja) {
  const { data, error } = await supabase.rpc('mis_sesiones')
  const lista = !error && Array.isArray(data) ? data : null
  const filas = lista
    ? lista.map((s) => `<li class="aj-seg-sesion">
        <span class="aj-seg-quien"><b>${escapeHtml(nombreDeNavegador(s.navegador))}</b>${s.esta ? ' <span class="aj-seg-esta">Esta</span>' : ''}<small>Desde ${escapeHtml(fecha(s.creada))} · último uso ${escapeHtml(fecha(s.ultima))}</small></span>
        ${s.esta ? '' : `<button type="button" class="btn-secondary" data-cerrar-sesion="${escapeHtml(String(s.id))}">Cerrar</button>`}
      </li>`).join('')
    : ''
  const otras = lista ? lista.filter((s) => !s.esta).length : null
  caja.innerHTML = `${lista ? `<ul class="aj-seg-sesiones">${filas}</ul>` : '<p class="aj-nota">La lista de sesiones llega con la próxima actualización de la base. Mientras, puedes cerrarlas todas menos esta.</p>'}
    ${otras === 0 ? '' : '<button type="button" class="btn-secondary" data-cerrar-otras>Cerrar todas menos esta</button>'}`
  caja.querySelectorAll('[data-cerrar-sesion]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true
    const r = await supabase.rpc('cerrar_sesion', { p_id: b.dataset.cerrarSesion })
    showToast(r.error || !r.data ? 'No se ha podido cerrar esa sesión.' : 'Sesión cerrada. En menos de una hora deja de funcionar del todo.', r.error || !r.data ? 'error' : 'success')
    pintarSesiones(caja)
  }))
  caja.querySelector('[data-cerrar-otras]')?.addEventListener('click', async (ev) => {
    ev.currentTarget.disabled = true
    const { error: e } = await supabase.auth.signOut({ scope: 'others' })
    showToast(e ? 'No se han podido cerrar. Vuelve a intentarlo.' : 'Listo: solo queda abierta esta.', e ? 'error' : 'success')
    pintarSesiones(caja)
  })
}

export function montarSeguridad(panel) {
  pintarDobleFactor(panel.querySelector('#ajDobleFactor'))
  pintarSesiones(panel.querySelector('#ajSesiones'))
}
