// Un MP4 a mano, para el vídeo de una repetición (tanda 480).
//
// El navegador codifica (WebCodecs, `VideoEncoder`) pero no EMPAQUETA:
// devuelve trozos de vídeo sueltos, y un fichero que se pueda mandar por
// WhatsApp o subir a Instagram necesita su caja alrededor. La librería que
// lo hace sería una dependencia nueva de npm, que aquí no entra (CLAUDE.md),
// y lo que hace falta es poco: UNA pista de vídeo, sin sonido, con todo el
// índice delante («faststart»: el vídeo empieza a verse antes de bajarse
// entero).
//
// Sin DOM: se prueba en Node, y el resultado se mira con ffprobe.
//
// Lo que entra:
//   muestras: [{ datos: Uint8Array, duracion, clave, desfase? }] en el
//     orden en que salen del codificador (el de decodificar). `duracion`
//     y `desfase` (presentación − decodificación) en unidades de
//     `escala`.
//   pista: { codec: 'avc1' | 'vp09' | 'av01', ancho, alto, escala,
//            descripcion: Uint8Array (el avcC / av1C que da el
//            codificador; para vp09 se monta aquí) }

const texto = (s) => [...s].map((c) => c.charCodeAt(0))

// Una caja: tamaño (4 bytes) + tipo (4 letras) + lo de dentro.
function caja(tipo, ...partes) {
  const cuerpo = unir(partes)
  const out = new Uint8Array(8 + cuerpo.length)
  const v = new DataView(out.buffer)
  v.setUint32(0, out.length)
  out.set(texto(tipo), 4)
  out.set(cuerpo, 8)
  return out
}
// Una caja «completa»: además, versión (1 byte) y banderas (3).
const cajaCompleta = (tipo, version, banderas, ...partes) => caja(tipo, new Uint8Array([version, (banderas >> 16) & 255, (banderas >> 8) & 255, banderas & 255]), ...partes)

function unir(partes) {
  const planas = partes.flat(Infinity).filter((p) => p != null)
  const total = planas.reduce((t, p) => t + p.length, 0)
  const out = new Uint8Array(total)
  let i = 0
  for (const p of planas) {
    out.set(p, i)
    i += p.length
  }
  return out
}

const u8 = (n) => new Uint8Array([n & 255])
const u16 = (n) => new Uint8Array([(n >> 8) & 255, n & 255])
const u32 = (n) => {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setUint32(0, n >>> 0)
  return b
}
const i32 = (n) => {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setInt32(0, n)
  return b
}
const ceros = (n) => new Uint8Array(n)
// La matriz identidad de las cabeceras de película y de pista.
const MATRIZ = unir([u32(0x00010000), u32(0), u32(0), u32(0), u32(0x00010000), u32(0), u32(0), u32(0), u32(0x40000000)])

// El vpcC de VP9 (perfil 0, 8 bits, 4:2:0): lo que el codificador no da.
function vpcC(codec) {
  // vp09.PP.LL.DD: perfil, nivel y profundidad salen del propio nombre.
  const [, perfil = '00', nivel = '10', bits = '08'] = String(codec).split('.')
  return cajaCompleta(
    'vpcC',
    1,
    0,
    u8(Number(perfil)),
    u8(Number(nivel)),
    // bitDepth (4) | chromaSubsampling (3) = 1 (4:2:0 colocated) | fullRange (1) = 0
    u8((Number(bits) << 4) | (1 << 1)),
    u8(1), // colour_primaries: BT.709
    u8(1), // transfer_characteristics
    u8(1), // matrix_coefficients
    u16(0) // codecIntializationDataSize
  )
}

function entradaDeMuestra(pista) {
  const comun = [
    ceros(6),
    u16(1), // data_reference_index
    u16(0),
    u16(0),
    ceros(12),
    u16(pista.ancho),
    u16(pista.alto),
    u32(0x00480000), // 72 ppp
    u32(0x00480000),
    u32(0),
    u16(1), // frame_count
    ceros(32), // compressorname
    u16(0x0018),
    i16(-1),
  ]
  if (pista.codec === 'avc1') return caja('avc1', ...comun, caja('avcC', pista.descripcion))
  if (pista.codec === 'av01') return caja('av01', ...comun, caja('av1C', pista.descripcion))
  return caja('vp09', ...comun, vpcC(pista.codecCompleto || 'vp09.00.10.08'))
}
function i16(n) {
  const b = new Uint8Array(2)
  new DataView(b.buffer).setInt16(0, n)
  return b
}

// Las tablas del índice: duraciones agrupadas (stts), cuáles son clave
// (stss), tamaños (stsz) y, si las hay, los desfases de presentación
// (ctts). Todas las muestras van en UN trozo (stsc + stco).
function stts(muestras) {
  const runs = []
  for (const m of muestras) {
    const ultimo = runs.at(-1)
    if (ultimo && ultimo[1] === m.duracion) ultimo[0]++
    else runs.push([1, m.duracion])
  }
  return cajaCompleta('stts', 0, 0, u32(runs.length), runs.map(([n, d]) => [u32(n), u32(d)]))
}
function stss(muestras) {
  const claves = muestras.map((m, i) => (m.clave ? i + 1 : 0)).filter(Boolean)
  return cajaCompleta('stss', 0, 0, u32(claves.length), claves.map(u32))
}
function ctts(muestras) {
  if (!muestras.some((m) => m.desfase)) return null
  const runs = []
  for (const m of muestras) {
    const d = m.desfase || 0
    const ultimo = runs.at(-1)
    if (ultimo && ultimo[1] === d) ultimo[0]++
    else runs.push([1, d])
  }
  // Versión 1: desfases con signo.
  return cajaCompleta('ctts', 1, 0, u32(runs.length), runs.map(([n, d]) => [u32(n), i32(d)]))
}

function moov(pista, muestras, desplazamiento) {
  const duracion = muestras.reduce((t, m) => t + m.duracion, 0)
  // La película va en milésimas; la pista, en su propia escala.
  const duracionMs = Math.round((duracion / pista.escala) * 1000)
  const mvhd = cajaCompleta('mvhd', 0, 0, u32(0), u32(0), u32(1000), u32(duracionMs), u32(0x00010000), u16(0x0100), ceros(10), MATRIZ, ceros(24), u32(2))
  const tkhd = cajaCompleta('tkhd', 0, 3, u32(0), u32(0), u32(1), u32(0), u32(duracionMs), ceros(8), u16(0), u16(0), u16(0), u16(0), MATRIZ, u32(pista.ancho << 16), u32(pista.alto << 16))
  const mdhd = cajaCompleta('mdhd', 0, 0, u32(0), u32(0), u32(pista.escala), u32(duracion), u16(0x55c4), u16(0)) // idioma «und»
  const hdlr = cajaCompleta('hdlr', 0, 0, u32(0), new Uint8Array(texto('vide')), ceros(12), new Uint8Array([...texto('PokeDoc'), 0]))
  const vmhd = cajaCompleta('vmhd', 0, 1, u16(0), ceros(6))
  const dinf = caja('dinf', cajaCompleta('dref', 0, 0, u32(1), cajaCompleta('url ', 0, 1)))
  const stsd = cajaCompleta('stsd', 0, 0, u32(1), entradaDeMuestra(pista))
  const stsc = cajaCompleta('stsc', 0, 0, u32(1), u32(1), u32(muestras.length), u32(1))
  const stsz = cajaCompleta('stsz', 0, 0, u32(0), u32(muestras.length), muestras.map((m) => u32(m.datos.length)))
  const stco = cajaCompleta('stco', 0, 0, u32(1), u32(desplazamiento))
  const stbl = caja('stbl', stsd, stts(muestras), ctts(muestras), stss(muestras), stsc, stsz, stco)
  const minf = caja('minf', vmhd, dinf, stbl)
  const mdia = caja('mdia', mdhd, hdlr, minf)
  const trak = caja('trak', tkhd, mdia)
  return caja('moov', mvhd, trak)
}

// El fichero entero. Devuelve un Uint8Array.
export function empaquetarMp4(pista, muestras) {
  if (!muestras.length) throw new Error('Un vídeo sin fotogramas no es un vídeo.')
  const marcas = pista.codec === 'avc1' ? ['isom', 'iso2', 'avc1', 'mp41'] : pista.codec === 'av01' ? ['isom', 'iso2', 'av01', 'mp41'] : ['isom', 'iso2', 'vp09', 'mp41']
  const ftyp = caja('ftyp', new Uint8Array(texto('isom')), u32(512), marcas.map((m) => new Uint8Array(texto(m))))
  // El índice va DELANTE, así que dónde empiezan los datos depende de lo
  // que mide el índice: se mide con un desplazamiento cualquiera (el
  // tamaño no cambia con el número) y se monta otra vez con el bueno.
  const tamMoov = moov(pista, muestras, 0).length
  const datos = unir(muestras.map((m) => m.datos))
  const cabMdat = unir([u32(8 + datos.length), new Uint8Array(texto('mdat'))])
  const inicio = ftyp.length + tamMoov + cabMdat.length
  return unir([ftyp, moov(pista, muestras, inicio), cabMdat, datos])
}
