// La hoja de compartir de una invitación (1298): el marco de las redes con tu
// cara y un QR a tu enlace /r/<usuario>. Aparte de la tarjeta del perfil
// (invitar.js) porque la abre también el menú del avatar, en todas las páginas,
// y no debe arrastrar las clases de la tarjeta (que viven en perfil.css).
import { avatarColorForKey, getInitial } from './app.js'
import { showToast } from './toast.js'
import { matrizQR } from './qr.js'
import { enlaceDeInvitacion, enlaceCorto, textoDeInvitacion } from './invitar-puro.js'

const nombreDe = (p) => p?.display_name || p?.username || ''

function pintarQr(ctx, texto, { x, y, lado }) {
  const m = matrizQR(texto)
  const n = m.length + 4
  const mod = lado / n
  ctx.fillStyle = '#ffffff'
  const r = lado * 0.06
  ctx.beginPath()
  ctx.roundRect ? ctx.roundRect(x, y, lado, lado, r) : ctx.rect(x, y, lado, lado)
  ctx.fill()
  ctx.fillStyle = '#0d1b2a'
  m.forEach((fila, j) => fila.forEach((v, i) => { if (v) ctx.fillRect(x + (i + 2) * mod, y + (j + 2) * mod, Math.ceil(mod), Math.ceil(mod)) }))
}

function cargarImagen(url) {
  return new Promise((ok) => {
    if (!url) return ok(null)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const fin = setTimeout(() => ok(null), 3000)
    img.onload = () => { clearTimeout(fin); ok(img) }
    img.onerror = () => { clearTimeout(fin); ok(null) }
    img.src = url
  })
}

export async function pintarInvitacion(lienzo, { perfil, enlace, formato = 'historia' }) {
  const { pintarMarco, prepararMarco } = await import('./redes-marco.js')
  await prepararMarco()
  const nombre = nombreDe(perfil) || 'Alguien'
  const { ctx, caja } = pintarMarco(lienzo, {
    formato,
    seccion: 'comunidad',
    chapa: 'Invitación',
    titulo: 'Únete a *PokeDoc*',
    entradilla: `${nombre} te invita a la comunidad española de Pokémon TCG`,
    linea: 'Colección · Cambios · Guías · Retos · Torneos',
    enlace: enlaceCorto(enlace),
  })
  const apaisada = formato === 'apaisada'
  // La cara y el QR, uno al lado del otro en la apaisada y uno encima del otro
  // en las demás. La foto solo si deja pintarse (si no, la inicial).
  const foto = /^https:\/\//.test(perfil?.avatar_url || '') ? await cargarImagen(perfil.avatar_url) : null
  const lado = Math.min(apaisada ? caja.h * 0.8 : caja.w * 0.42, apaisada ? caja.w * 0.34 : caja.h * 0.4)
  const cara = lado * 0.62
  const cx = apaisada ? caja.x + caja.w * 0.27 : caja.x + caja.w / 2
  const cy = apaisada ? caja.y + caja.h / 2 : caja.y + caja.h * 0.24
  ctx.save()
  ctx.beginPath(); ctx.arc(cx, cy, cara / 2 + cara * 0.06, 0, Math.PI * 2); ctx.fillStyle = '#f06c9b'; ctx.fill()
  ctx.beginPath(); ctx.arc(cx, cy, cara / 2, 0, Math.PI * 2); ctx.closePath()
  ctx.fillStyle = avatarColorForKey(perfil?.id || perfil?.username || ''); ctx.fill()
  if (foto) {
    ctx.clip()
    const k = Math.max(cara / foto.width, cara / foto.height)
    ctx.drawImage(foto, cx - (foto.width * k) / 2, cy - (foto.height * k) / 2, foto.width * k, foto.height * k)
  } else {
    ctx.fillStyle = '#ffffff'
    ctx.font = `700 ${Math.round(cara * 0.44)}px Outfit, Inter, sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(getInitial(nombre), cx, cy + 2)
  }
  ctx.restore()
  const qx = apaisada ? caja.x + caja.w * 0.58 : caja.x + (caja.w - lado) / 2
  const qy = apaisada ? caja.y + (caja.h - lado) / 2 : caja.y + caja.h * 0.5
  pintarQr(ctx, enlace, { x: qx, y: qy, lado })
  return lienzo
}

export async function abrirInvitar(perfil) {
  const enlace = enlaceDeInvitacion(perfil?.username, location.origin)
  if (!enlace) { showToast('Ponte un nombre de usuario en tu perfil y tendrás tu enlace.'); return }
  const { abrirHojaCompartir } = await import('./compartir-hoja.js')
  const texto = textoDeInvitacion({ nombre: nombreDe(perfil), enlace })
  return abrirHojaCompartir({
    titulo: 'Invita a tus amigos',
    texto,
    x: { texto: texto.split('\n')[0], url: enlace },
    nombre: `invita-${perfil.username}`,
    imagen: (formato) => pintarInvitacion(document.createElement('canvas'), { perfil, enlace, formato }),
  })
}

