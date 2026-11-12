// «Voy a…» (1295): la imagen para contar que vas a un evento, con el marco de
// las redes (`js/redes-marco.js`, la 1156) y la hoja de compartir de siempre.
// Es la invitación: lleva tu número («Soy el nº 14 de PokeDoc que va»), el
// logo del evento y unas cuantas caras de los que van, y el enlace a la ficha.
// Entra por `import()` desde la ficha al pulsar «Compártelo».
//
// Las caras van con su INICIAL sobre su color (`avatarColorForKey`), no con la
// foto: las fotos de perfil vienen de sitios que no dejan exportar un lienzo
// que las lleve (Google, Discord…), y un lienzo «manchado» no se descarga.
// El logo sí se intenta (es del cubo público de PokeDoc, con CORS); si no
// llega en tres segundos o no deja, van las siglas en su color.
import { avatarColorForKey, getInitial } from './app.js'
import { fechaLarga, siglasDe, textoDeVoy, webSegura } from './eventos-puro.js'

const ENLACE = 'pokedoc.es'
const nombreDe = (p) => p?.display_name || p?.username || 'Alguien'

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

function redondo(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// El logo, inclinado como en la ficha; sin logo (o sin permiso), las siglas.
function pintarLogo(ctx, e, img, { cx, cy, lado }) {
  const color = /^#[0-9a-f]{6}$/i.test(e.color || '') ? e.color : '#1e5175'
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((-4 * Math.PI) / 180)
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = lado * 0.18
  ctx.shadowOffsetY = lado * 0.08
  if (img && e.logo_sin_fondo) {
    const k = Math.min(lado / img.width, lado / img.height)
    ctx.drawImage(img, -img.width * k / 2, -img.height * k / 2, img.width * k, img.height * k)
  } else {
    redondo(ctx, -lado / 2, -lado / 2, lado, lado, lado * 0.16)
    ctx.fillStyle = color
    ctx.fill()
    ctx.shadowColor = 'transparent'
    if (img) {
      ctx.save()
      ctx.clip()
      const k = Math.max(lado / img.width, lado / img.height)
      ctx.drawImage(img, -img.width * k / 2, -img.height * k / 2, img.width * k, img.height * k)
      ctx.restore()
    } else {
      ctx.fillStyle = '#ffffff'
      ctx.font = `800 ${Math.round(lado * 0.26)}px Outfit, Inter, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(siglasDe(e), 0, 0)
    }
  }
  ctx.restore()
}

// Una fila de caras: la tuya la primera, con su aro verde.
function pintarCaras(ctx, personas, { cx, y, lado, yo }) {
  const n = personas.length
  if (!n) return
  const paso = lado * 0.78
  let x = cx - ((n - 1) * paso) / 2
  for (const p of personas) {
    ctx.beginPath()
    ctx.arc(x, y, lado / 2 + lado * 0.06, 0, Math.PI * 2)
    ctx.fillStyle = p.id === yo ? '#34d399' : '#0b1219'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(x, y, lado / 2, 0, Math.PI * 2)
    ctx.fillStyle = avatarColorForKey(p.id || p.username || '')
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.font = `700 ${Math.round(lado * 0.42)}px Inter, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(getInitial(nombreDe(p)), x, y + 1)
    x += paso
  }
}

export async function pintarVoy(lienzo, { evento: e, numero = null, yo = null, formato = 'historia' }) {
  const { pintarMarco, prepararMarco } = await import('./redes-marco.js')
  await prepararMarco()
  const lugar = [e.sitio, e.ciudad].filter(Boolean).join(', ')
  const van = Number(e.van) || 0
  const { ctx, caja } = pintarMarco(lienzo, {
    formato,
    seccion: 'comunidad',
    chapa: 'Voy a ir',
    titulo: `Voy a *${e.nombre}*`,
    entradilla: [fechaLarga(e), lugar].filter(Boolean).join(' · '),
    linea: numero ? `Soy el nº ${numero} de PokeDoc que va` : van > 1 ? `Vamos ${van} de PokeDoc` : '¿Te vienes?',
    enlace: `${ENLACE}/eventos/${e.slug}`,
  })
  const img = await cargarImagen(webSegura(e.logo_url))
  const apaisada = formato === 'apaisada'
  const lado = Math.min(caja.w, caja.h) * (apaisada ? 0.62 : 0.56)
  const caras = Array.isArray(e.caras) ? e.caras : []
  const yoPrimero = [...caras.filter((p) => p.id === yo), ...caras.filter((p) => p.id !== yo)].slice(0, 7)
  const cx = caja.x + caja.w / 2
  const cyLogo = caja.y + (yoPrimero.length ? caja.h * 0.4 : caja.h / 2)
  pintarLogo(ctx, e, img, { cx, cy: cyLogo, lado })
  if (yoPrimero.length) pintarCaras(ctx, yoPrimero, { cx, y: caja.y + caja.h * 0.86, lado: Math.min(caja.h * 0.18, apaisada ? 64 : 96), yo })
  return lienzo
}

export async function compartirVoy({ evento: e, numero = null, yo = null, url = '' }) {
  const { abrirHojaCompartir } = await import('./compartir-hoja.js')
  const lugar = [e.sitio, e.ciudad].filter(Boolean).join(', ')
  const texto = textoDeVoy({ nombre: e.nombre, fecha: fechaLarga(e), lugar, numero, van: Number(e.van) || 0, url })
  return abrirHojaCompartir({
    titulo: 'Cuenta que vas',
    texto,
    x: { texto: texto.split('\n').slice(0, 2).join('\n'), url },
    nombre: `voy-${e.slug || 'evento'}`,
    imagen: (formato) => pintarVoy(document.createElement('canvas'), { evento: e, numero, yo, formato }),
  })
}
