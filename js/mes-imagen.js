// LA IMAGEN DE «TU MES» (tanda 1173): las cuatro cifras del mes con el
// marco de redes de la casa (1156), en publicación, historia y apaisada,
// por la hoja de compartir de siempre. Entra por import() desde el Panel.
import { pintarMarco, prepararMarco, TITULAR, TEXTO } from './redes-marco.js'
import { redondeado } from './imagen-compartir.js'
import { euros } from './cardmarket.js'

const signo = (v) => (v > 0 ? '+' : v < 0 ? '−' : '')

// Las fichas: cifra grande y lo que es. Las que no se saben no van.
export function fichasDelMes(r) {
  const fichas = []
  fichas.push({ cifra: `+${Number(r.cartas || 0).toLocaleString('es-ES')}`, texto: r.cartas === 1 ? 'carta' : 'cartas' })
  if (r.expansiones) fichas.push({ cifra: String(r.expansiones), texto: r.expansiones === 1 ? 'expansión nueva' : 'expansiones nuevas' })
  if (typeof r.cambios === 'number') fichas.push({ cifra: String(r.cambios), texto: r.cambios === 1 ? 'cambio hecho' : 'cambios hechos' })
  if (typeof r.valor === 'number') fichas.push({ cifra: `${signo(r.valor)}${euros(Math.abs(r.valor))}`, texto: 'de valor', color: r.valor > 0 ? '#2fb47c' : r.valor < 0 ? '#f49a9a' : null })
  return fichas
}

export function textoDelMes(r) {
  return [`Mi ${r.mes} en PokeDoc: ${fichasDelMes(r).map((f) => `${f.cifra} ${f.texto}`).join(' · ')}.`, r.mejor ? `Mi mejor compra: ${r.mejor.nombre}, pagué ${euros(r.mejor.pagado)} y vale ${euros(r.mejor.vale)}.` : '', 'pokedoc.es/mi-coleccion'].filter(Boolean).join('\n')
}

export function pintarMes(lienzo, r, { formato = 'historia' } = {}) {
  const apaisada = formato === 'apaisada'
  const { ctx, caja, acento } = pintarMarco(lienzo, {
    formato,
    seccion: 'coleccion',
    chapa: 'Mi colección',
    titulo: `Mi *${r.mes}* en PokeDoc`,
    entradilla: r.mejor ? `Mi mejor compra: ${r.mejor.nombre}, pagué ${euros(r.mejor.pagado)} y vale ${euros(r.mejor.vale)}.` : 'Lo que ha cambiado mi colección este mes.',
    enlace: 'pokedoc.es/mi-coleccion',
    linea: apaisada ? '' : formato === 'larga' ? 'Enlace en la bio' : 'Apunta la tuya gratis',
    maxLineas: 2,
  })
  const fichas = fichasDelMes(r)
  if (caja.h < 80 || !fichas.length) return lienzo
  // Dos columnas de fichas (o una fila en la apaisada), centradas en la caja.
  const cols = apaisada ? Math.min(2, fichas.length) : fichas.length > 1 ? 2 : 1
  const filas = Math.ceil(fichas.length / cols)
  const hueco = Math.round(caja.w * 0.03)
  const w = Math.min((caja.w - hueco * (cols - 1)) / cols, 460)
  const h = Math.min((caja.h - hueco * (filas - 1)) / filas, apaisada ? 150 : 230)
  const x0 = caja.x + (caja.w - (w * cols + hueco * (cols - 1))) / 2
  const y0 = caja.y + (caja.h - (h * filas + hueco * (filas - 1))) / 2
  fichas.forEach((f, i) => {
    const x = x0 + (i % cols) * (w + hueco)
    const y = y0 + Math.floor(i / cols) * (h + hueco)
    ctx.save()
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    redondeado(ctx, x, y, w, h, Math.round(h * 0.14))
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'
    ctx.lineWidth = 2
    redondeado(ctx, x, y, w, h, Math.round(h * 0.14))
    ctx.stroke()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = f.color || '#ffffff'
    ctx.font = `800 ${Math.round(h * 0.36)}px ${TITULAR}`
    ctx.fillText(f.cifra, x + w / 2, y + h * 0.42)
    ctx.fillStyle = '#cfe3f1'
    ctx.font = `600 ${Math.round(h * 0.15)}px ${TEXTO}`
    ctx.fillText(f.texto, x + w / 2, y + h * 0.74)
    ctx.restore()
  })
  void acento
  return lienzo
}

export async function compartirMes(r) {
  const { abrirHojaCompartir } = await import('./compartir-hoja.js')
  return abrirHojaCompartir({
    titulo: `Tu ${r.mes}`,
    texto: textoDelMes(r),
    nombre: `mi-${r.mes}-pokedoc`,
    historiaPropia: true,
    imagen: async (formato) => {
      await prepararMarco()
      return pintarMes(document.createElement('canvas'), r, { formato })
    },
  })
}
