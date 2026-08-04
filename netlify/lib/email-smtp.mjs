// Envío por SMTP, para cuando el correo del proyecto es un BUZÓN normal
// (Hostinger, Zoho, Gmail...) y no un servicio de envío con API HTTP.
//
// Está en un fichero aparte de email.mjs a propósito: nodemailer es la
// única dependencia de todo el proyecto, y así ni las pruebas del pintado
// del correo ni el arranque en frío de los proveedores HTTP la cargan.
// send-emails.mjs lo importa con `await import()` solo si toca.
//
// VARIABLES DE ENTORNO
//   SMTP_HOST   p.ej. smtp.hostinger.com
//   SMTP_PORT   465 (SSL directo) o 587 (STARTTLS). Por defecto 465.
//   SMTP_USER   la dirección del buzón, p.ej. avisos@pokedoc.es
//   SMTP_PASS   su contraseña
//
// OJO con el remitente: casi todos los buzones exigen que el `From`
// coincida con la cuenta autenticada. Si EMAIL_FROM apunta a otra
// dirección, el servidor rechaza el envío con un 550 y cuesta de ver.
// Por eso se avisa explícitamente en vez de dejar que falle a secas.

import { buildSmtpMessage, parseFrom } from './email.mjs'

export function smtpConfigDesdeEntorno(env = process.env) {
  const host = env.SMTP_HOST
  const user = env.SMTP_USER
  const pass = env.SMTP_PASS
  if (!host || !user || !pass) return null
  const port = Number(env.SMTP_PORT || 465)
  return {
    host,
    port,
    // El 465 va cifrado desde el primer byte; el 587 empieza en claro y
    // sube a TLS con STARTTLS. Poner `secure` al revés es el fallo
    // clásico y da un error de conexión que no dice nada de esto.
    secure: port === 465,
    auth: { user, pass },
  }
}

// Comprueba que el remitente sea el buzón autenticado, y si no, lo dice
// claro. Devuelve el `from` que hay que usar.
export function remitenteValido(from, smtpUser) {
  const dir = parseFrom(from).email?.toLowerCase()
  if (!smtpUser) return from
  if (dir === String(smtpUser).toLowerCase()) return from
  throw new Error(
    `EMAIL_FROM usa "${dir}" pero el buzón autenticado es "${smtpUser}". ` +
      'La mayoría de servidores SMTP rechazan enviar en nombre de otra dirección. ' +
      `Pon EMAIL_FROM = "PokeDoc <${smtpUser}>" o crea ese buzón.`
  )
}

export async function sendViaSmtp(config, msg, crearTransporte = null) {
  const crear = crearTransporte || (await import('nodemailer')).default.createTransport
  const transporte = crear(config)
  const mensaje = buildSmtpMessage({ ...msg, from: remitenteValido(msg.from, config.auth?.user) })
  await transporte.sendMail(mensaje)
  // Los buzones limitan cuántos correos por hora aceptan, y en un envío
  // seguido conviene cerrar la conexión en vez de dejarla colgando hasta
  // que la función se congele.
  if (typeof transporte.close === 'function') transporte.close()
  return true
}
