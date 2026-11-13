// «Soy una persona» de Cloudflare Turnstile (tanda 1312, S5 del plan), en
// entrar, crear cuenta, recuperar la contraseña y el alta de tiendas.
//
// DORMIDO hasta que haya clave: la clave PÚBLICA del sitio va en
// `site_settings` (`turnstile_site_key`), no en el repo. Sin ella esto no
// carga nada, no pinta nada y `token()` devuelve undefined, que Supabase
// ignora mientras su captcha esté apagado.
//
// El orden para encenderlo importa (SCHEMA 1312): PRIMERO la clave en
// `site_settings` y DESPUÉS el captcha en Supabase (Authentication → Attack
// Protection, con la clave secreta). Al revés, nadie podría entrar.

let clavePedida = null
function claveDelSitio(supabase) {
  clavePedida ??= supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'turnstile_site_key')
    .maybeSingle()
    .then(({ data }) => {
      const v = data?.value
      const clave = typeof v === 'string' ? v : v?.clave
      return typeof clave === 'string' && /^[0-9A-Za-z_-]{10,}$/.test(clave) ? clave : null
    })
    .catch(() => null)
  return clavePedida
}

let script = null
function cargarScript() {
  script ??= new Promise((ok, mal) => {
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.onload = () => ok(window.turnstile)
    s.onerror = mal
    document.head.append(s)
  })
  return script
}

const DORMIDO = { activo: false, token: async () => undefined, reiniciar() {} }

// Monta la caja en `caja` (un elemento con `hidden`). Devuelve { activo,
// token(), reiniciar() }: `token()` espera a que Cloudflare dé el suyo (casi
// siempre sin pedir nada) y cada token vale UNA vez, así que tras usarlo se
// llama a `reiniciar()`.
export async function prepararTurnstile(supabase, caja) {
  if (!caja) return DORMIDO
  const clave = await claveDelSitio(supabase)
  if (!clave) return DORMIDO
  let ts
  try {
    ts = await cargarScript()
  } catch {
    // Si Cloudflare no carga, se sigue sin él: Supabase dirá que falta el
    // token y la frase de friendlyAuthError lo explica.
    return DORMIDO
  }
  let actual = null
  let esperando = []
  caja.hidden = false
  const id = ts.render(caja, {
    sitekey: clave,
    language: 'es',
    theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'auto',
    appearance: 'interaction-only',
    callback: (t) => {
      actual = t
      esperando.forEach((f) => f(t))
      esperando = []
    },
    'expired-callback': () => { actual = null },
    'error-callback': () => { actual = null },
  })
  return {
    activo: true,
    token: () => (actual ? Promise.resolve(actual) : new Promise((ok) => {
      esperando.push(ok)
      setTimeout(() => ok(undefined), 10000)
    })),
    reiniciar() {
      actual = null
      try { ts.reset(id) } catch { /* una caja ya quitada */ }
    },
  }
}

// Las opciones de Supabase con el token, si lo hay.
export const conToken = (opciones, token) => (token ? { ...opciones, captchaToken: token } : opciones)
