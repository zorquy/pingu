// UN correo a una dirección que no es de ninguna cuenta (tanda 1067).
//
// La cola (`email_outbox` + send-emails) escribe a CUENTAS: resuelve la
// dirección desde auth.users. La invitación de una tienda va a un email que
// todavía no tiene cuenta, así que sale directo desde la función que la
// crea, con la misma configuración (EMAIL_PROVIDER, EMAIL_FROM, SMTP_*…) y
// la misma plantilla que todo lo demás.

import { sendEmail, PROVEEDORES } from './email.mjs'

// Qué hay configurado y, si falta algo, qué: el panel lo enseña tal cual.
export function configDeCorreo(env = process.env, smtpDesdeEntorno = null) {
  const provider = String(env.EMAIL_PROVIDER || 'smtp').toLowerCase()
  const from = env.EMAIL_FROM || 'PokeDoc <avisos@pokedoc.es>'
  if (!PROVEEDORES.includes(provider)) return { provider, from, falta: `EMAIL_PROVIDER="${provider}" no vale` }
  if (provider === 'smtp') {
    const smtp = smtpDesdeEntorno ? smtpDesdeEntorno(env) : null
    return { provider, from, smtp, falta: smtp ? null : 'SMTP_HOST, SMTP_USER y SMTP_PASS' }
  }
  return { provider, from, apiKey: env.EMAIL_API_KEY, falta: env.EMAIL_API_KEY ? null : 'EMAIL_API_KEY' }
}

// Devuelve { enviado, motivo }: un correo que no sale no tumba lo que lo
// pidió (la solicitud ya está aceptada), y quien lo pidió sabe por qué.
export async function enviarCorreoSuelto({ to, subject, html, text }, env = process.env, deps = {}) {
  const smtpDe = deps.smtpDesdeEntorno || (async (e) => (await import('./email-smtp.mjs')).smtpConfigDesdeEntorno(e))
  const smtpCfg = String(env.EMAIL_PROVIDER || 'smtp').toLowerCase() === 'smtp' ? await smtpDe(env) : null
  const cfg = configDeCorreo(env, () => smtpCfg)
  if (cfg.falta) return { enviado: false, motivo: `Falta configurar ${cfg.falta} en Netlify.` }
  const msg = { apiKey: cfg.apiKey, from: cfg.from, to, subject, html, text, mailgunDomain: env.EMAIL_MAILGUN_DOMAIN }
  try {
    if (cfg.provider === 'smtp') {
      const mandarSmtp = deps.sendViaSmtp || (await import('./email-smtp.mjs')).sendViaSmtp
      await mandarSmtp(cfg.smtp, msg)
    } else {
      await (deps.sendEmail || sendEmail)(cfg.provider, msg, deps.fetchImpl)
    }
    return { enviado: true, motivo: null }
  } catch (e) {
    return { enviado: false, motivo: String(e?.message || e).slice(0, 300) }
  }
}
