// Doble factor (tanda 1307): los códigos de una app (Google Authenticator,
// 1Password…) que Supabase trae de serie. Aquí está todo lo que la web hace
// con ellos: saber cómo está la sesión, pedir el código, darlo de alta y
// quitarlo. Lo pintan /auth (al entrar), /admin (antes de abrir el panel) y
// Ajustes › Seguridad.
//
// Quien lo exige es la BASE (`is_admin()` pide `aal2` a quien lo tiene
// puesto, migración 1307): esto solo es la puerta para escribir el código.

// { actual, siguiente, factores } — `factores` son los TOTP ya confirmados.
// Si la base o el cliente no saben de esto, «nada puesto».
export async function estadoMfa(supabase) {
  try {
    const mfa = supabase.auth.mfa
    if (!mfa) return { actual: 'aal1', siguiente: 'aal1', factores: [] }
    const [nivel, lista] = await Promise.all([mfa.getAuthenticatorAssuranceLevel(), mfa.listFactors()])
    const factores = (lista.data?.totp || []).filter((f) => f.status === 'verified')
    return { actual: nivel.data?.currentLevel || 'aal1', siguiente: nivel.data?.nextLevel || 'aal1', factores }
  } catch {
    return { actual: 'aal1', siguiente: 'aal1', factores: [] }
  }
}

// ¿Hay que escribir el código en esta sesión?
export const faltaCodigo = (e) => e.factores.length > 0 && e.actual !== 'aal2'

// Un código de 6 cifras, sin espacios.
export const limpiarCodigo = (t) => String(t || '').replace(/\D/g, '').slice(0, 6)

// Comprobar un código contra un factor.
export async function verificar(supabase, factorId, codigo) {
  const c = await supabase.auth.mfa.challenge({ factorId })
  if (c.error) return c.error
  const v = await supabase.auth.mfa.verify({ factorId, challengeId: c.data.id, code: limpiarCodigo(codigo) })
  return v.error || null
}

// Dar de alta: devuelve { factorId, qr, secreto } o { error }.
export async function empezarAlta(supabase) {
  // Un alta a medias de antes (sin confirmar) estorba: se quita.
  const lista = await supabase.auth.mfa.listFactors()
  for (const f of lista.data?.all || []) {
    if (f.factor_type === 'totp' && f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id })
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `PokeDoc ${new Date().toISOString().slice(0, 10)}` })
  if (error) return { error }
  return { factorId: data.id, qr: data.totp?.qr_code || '', secreto: data.totp?.secret || '' }
}

export async function quitar(supabase, factorId) {
  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  return error || null
}

// Lo que dice un error de código, en cristiano.
export function textoDeError(e) {
  const m = String(e?.message || e || '')
  if (/invalid|incorrect|expired/i.test(m)) return 'Ese código no vale. Escribe el que sale ahora en tu app (cambia cada 30 segundos).'
  if (/rate|too many/i.test(m)) return 'Demasiados intentos. Espera un minuto y vuelve a probar.'
  return 'No se ha podido comprobar el código. Vuelve a intentarlo.'
}

// Su CSS va aquí: la ventana solo la ve quien tiene el doble factor puesto.
const CSS = `.df-dialogo{border:0;border-radius:var(--radius-xl);padding:var(--e-xl);max-width:min(380px,calc(100vw - 32px));background:var(--white);color:var(--text);box-shadow:var(--shadow-lg)}
.df-dialogo::backdrop{background:rgba(5,10,15,.55)}
.df-dialogo h2{font-family:var(--font-display);font-size:var(--t-xl);margin:0 0 var(--e-sm)}
.df-dialogo p{color:var(--text-mid);margin:0 0 var(--e-md)}
.df-codigo{width:100%;font:600 var(--t-2xl)/1.2 var(--font-display);letter-spacing:.3em;text-align:center;padding:var(--e-md);border:2px solid var(--border-strong);border-radius:var(--radius-md);background:var(--white);color:var(--text)}
.df-codigo:focus{outline:none;box-shadow:var(--shadow-ring)}
.df-error{color:var(--danger);min-height:1.4em;margin:var(--e-sm) 0 0;font-size:var(--t-sm)}
.df-botones{display:flex;gap:var(--e-sm);justify-content:flex-end;margin-top:var(--e-md)}`
function ponerCss() {
  if (document.getElementById('dfCss')) return
  const s = document.createElement('style')
  s.id = 'dfCss'
  s.textContent = CSS
  document.head.append(s)
}

// La ventana de «Escribe tu código». Resuelve true si se ha verificado y
// false si se cancela. `cancelable: false` para /admin (no hay otro camino).
export function pedirCodigo(supabase, { factorId, titulo = 'Escribe tu código', texto = 'Abre tu app de códigos y escribe el de PokeDoc.', cancelable = true, textoCancelar = 'Cancelar' } = {}) {
  ponerCss()
  return new Promise((resolver) => {
    const d = document.createElement('dialog')
    d.className = 'df-dialogo'
    d.innerHTML = `<form method="dialog" novalidate>
      <h2>${titulo}</h2>
      <p>${texto}</p>
      <label class="sr-only" for="dfCodigo">Código de 6 cifras</label>
      <input id="dfCodigo" class="df-codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="000000" required />
      <p class="df-error" role="alert"></p>
      <div class="df-botones">
        ${cancelable ? `<button type="button" class="btn-secondary" data-df-cancelar>${textoCancelar}</button>` : ''}
        <button type="submit" class="btn-primary" data-df-ok>Comprobar</button>
      </div>
    </form>`
    document.body.append(d)
    const campo = d.querySelector('#dfCodigo')
    const error = d.querySelector('.df-error')
    const ok = d.querySelector('[data-df-ok]')
    const acabar = (v) => { d.close(); d.remove(); resolver(v) }
    d.addEventListener('cancel', (e) => { e.preventDefault(); if (cancelable) acabar(false) })
    d.querySelector('[data-df-cancelar]')?.addEventListener('click', () => acabar(false))
    campo.addEventListener('input', () => {
      campo.value = limpiarCodigo(campo.value)
      error.textContent = ''
      if (campo.value.length === 6) d.querySelector('form').requestSubmit()
    })
    d.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault()
      if (limpiarCodigo(campo.value).length !== 6) { error.textContent = 'Son 6 cifras.'; return }
      ok.disabled = true
      ok.textContent = 'Comprobando…'
      const fallo = await verificar(supabase, factorId, campo.value)
      ok.disabled = false
      ok.textContent = 'Comprobar'
      if (fallo) { error.textContent = textoDeError(fallo); campo.select(); return }
      acabar(true)
    })
    d.showModal()
    campo.focus()
  })
}

// Si esta sesión necesita el código, lo pide. true = la sesión ya cumple.
export async function asegurarCodigo(supabase, opciones = {}) {
  const e = await estadoMfa(supabase)
  if (!faltaCodigo(e)) return true
  return pedirCodigo(supabase, { factorId: e.factores[0].id, ...opciones })
}

// Una sesión, para pintarla: «iPhone · Safari», «Windows · Chrome».
export function nombreDeNavegador(ua) {
  const t = String(ua || '')
  if (!t) return 'Un navegador'
  const sistema = /iPhone/.test(t) ? 'iPhone' : /iPad/.test(t) ? 'iPad' : /Android/.test(t) ? 'Android' : /Windows/.test(t) ? 'Windows' : /Mac OS X|Macintosh/.test(t) ? 'Mac' : /Linux/.test(t) ? 'Linux' : ''
  const nav = /Edg\//.test(t) ? 'Edge' : /OPR\/|Opera/.test(t) ? 'Opera' : /Firefox\//.test(t) ? 'Firefox' : /CriOS|Chrome\//.test(t) ? 'Chrome' : /Safari\//.test(t) ? 'Safari' : ''
  return [sistema, nav].filter(Boolean).join(' · ') || 'Un navegador'
}
