"""Rigor de la tanda 421 — el meta que junta variantes, y la imagen
exportada que se puede volver a importar.

Nada de esto da error al romperse: un meta con veinticuatro filas para
treinta y dos jugadores se ve bien, una imagen con fondo azul en vez de
transparente también, y una imagen que se importa con la mitad de las
copias mal leídas solo se nota cuando alguien cuenta. Cada mutación rompe
el ORIGEN de una de esas cosas.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

MT = 'js/torneos/meta-torneo.js'
DI = 'js/torneos/decklist-imagen.js'
LP = 'js/lista-en-png.js'
IM = 'js/constructor/imagen.js'
C = 'js/constructor.js'

MUTACIONES = [
    # ── 1. El meta ──
    (MT, 'el meta vuelve a separar por arquetipo entero',
     '  return dex ? `p:${dex}` : claveDeArquetipo(arq)', '  return claveDeArquetipo(arq)'),
    (MT, 'las variantes se separan por idioma',
     "  return partes.length ? partes.sort().join('|') : claveDeArquetipo(arq)", '  return claveDeArquetipo(arq)'),
    (MT, 'un grupo con variantes se enseña como el primero de ellas',
     '  if (porVariante.size === 1) return { arq: jugadores[0].arq, variantes: [] }',
     '  return { arq: jugadores[0].arq, variantes: [] }'),
    (MT, 'el grupo se llama como el primero, no como los más',
     '[...nombres].sort((a, b) => b[1].cuantos - a[1].cuantos)[0]', '[...nombres][0]'),
    (MT, 'no se dice qué jugó cada uno',
     "${g.variantes.length ? `<span class=\"torneo-meta-variante\">${escapeHtml(j.arq.nombre)}</span>` : ''}", ''),

    # ── 2. La imagen ──
    (DI, 'la rejilla deja una carta sola en la última fila',
     '  const columnas = Math.max(1, Math.ceil(n / filas))', '  const columnas = tope'),
    (DI, 'vuelve el fondo azul',
     '  // Sin fondo: transparente, para ponerla encima de lo que se quiera.\n',
     "  ctx.fillStyle = '#163d59'\n  ctx.fillRect(0, 0, ancho, alto)\n"),
    (DI, 'el hexágono de las copias no se pinta',
     '  dibujarInsignia(ctx, linea.quantity, x, y, CARTA_W, CARTA_H)\n', ''),
    (DI, 'la lista no va dentro del PNG',
     'const bytes = meterLista(new Uint8Array(await blob.arrayBuffer()), textoDeLista(porSeccion))',
     'const bytes = new Uint8Array(await blob.arrayBuffer())'),
    (DI, 'la lista de dentro sin las cabeceras de sección',
     '    return [`${s.cabecera}: ${n}`, ...lineas.map(', '    return [...lineas.map('),
    (LP, 'el trozo de la lista con la suma de control mal',
     '  v.setUint32(8 + datos.length, crc32(new Uint8Array([...tipo, ...datos])))', '  v.setUint32(8 + datos.length, 0)'),
    (LP, 'la lista de dentro no se encuentra',
     '    if (fin < 0 || dec.decode(d.subarray(0, fin)) !== CLAVE_LISTA) continue', '    if (fin < 0 || dec.decode(d.subarray(0, fin)) === CLAVE_LISTA) continue'),

    # ── 3. Importarla ──
    (C, 'el constructor no mira la lista de dentro',
     '    if (incrustada) {', '    if (false) {'),
    (IM, 'sobre fondo blanco no se encuentran las cartas',
     '  const esCarta = claro ? (v) => Math.abs(v - fondo) > 45 : (v) => v > T', '  const esCarta = (v) => v > T'),
    (IM, 'el tamaño de carta lo decide el número y no la superficie',
     '      const area = celdas.filter((o) => Math.abs(o.h - c.h) / c.h < 0.2).reduce((s, o) => s + o.w * o.h, 0)',
     '      const area = celdas.filter((o) => Math.abs(o.h - c.h) / c.h < 0.2).length'),
    (IM, 'el rojo de una carta le gana al hexágono azul',
     '      let cnt = azul.n && azul.nota > rojo.nota ? azul : rojo', '      let cnt = rojo.n ? rojo : azul'),
    (IM, 'el hexágono azul no se reconoce como tal',
     'const MINIMO_AZUL = 0.18', 'const MINIMO_AZUL = 0.9'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-421.mjs')
