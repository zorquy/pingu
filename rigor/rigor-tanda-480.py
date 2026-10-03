"""Rigor de la tanda 480 — compartir, guardar y descargar en vídeo una
repetición.

Casi nada de esto da error al romperse: un enlace que se comprime de una
forma y se lee de otra no abre nada; un MP4 con el índice mal apuntado se
descarga igual y no se ve; una política que deja leer las compartidas deja
LISTAR las de todo el mundo sin que nadie lo note; una lista que no se
repinta dice «no compartida» de una que sí lo está. Cada mutación rompe el
ORIGEN de una de esas cosas, no una de sus guardas (tanda 314).
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

EN = 'js/repeticiones/enlace.js'
MP4 = 'js/repeticiones/mp4.js'
VID = 'js/repeticiones/video.js'
DAT = 'js/repeticiones/datos.js'
REP = 'js/repeticiones.js'
SQL = 'supabase-migration-repeticiones.sql'
BORDE = 'netlify/edge-functions/meta-social.js'

MUTACIONES = [
    # ── 1. El enlace largo ──
    (EN, 'se comprime de una forma y se lee de otra',
     "return PREFIJO + aBase64Url(await pasarPor(bytes, new CompressionStream('deflate-raw')))",
     "return PREFIJO + aBase64Url(await pasarPor(bytes, new CompressionStream('deflate')))"),
    (EN, 'el enlace lleva + y / (un chat lo parte)',
     "return btoa(bin).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '')",
     "return btoa(bin).replace(/=+$/, '')"),
    (EN, 'un enlace roto revienta en vez de decir que está roto',
     '  } catch {\n    return null\n  }\n}', '  } catch (e) {\n    throw e\n  }\n}'),

    # ── 2. El MP4 ──
    (MP4, 'el índice apunta 8 bytes más allá de los datos',
     "const stco = cajaCompleta('stco', 0, 0, u32(1), u32(desplazamiento))",
     "const stco = cajaCompleta('stco', 0, 0, u32(1), u32(desplazamiento + 8))"),
    (MP4, 'todas las muestras duran lo mismo (un fotograma largo dura uno)',
     '    else runs.push([1, m.duracion])\n  }\n  return cajaCompleta(\'stts\'',
     '    else runs.push([1, 3750])\n  }\n  return cajaCompleta(\'stts\''),
    (MP4, 'sin la caja de desfases aunque el codificador reordene',
     '  if (!muestras.some((m) => m.desfase)) return null', '  return null'),
    (MP4, 'el avcC, cortado',
     "if (pista.codec === 'avc1') return caja('avc1', ...comun, caja('avcC', pista.descripcion))",
     "if (pista.codec === 'avc1') return caja('avc1', ...comun, caja('avcC', pista.descripcion.subarray(0, 6)))"),

    # ── 3. La base ──
    (SQL, 'las compartidas se pueden LISTAR',
     'for select using (auth.uid() = user_id);', 'for select using (auth.uid() = user_id or compartida);'),
    (SQL, 'el enlace abre también las NO compartidas de otros',
     '  where r.id = p_id\n    and (r.compartida or r.user_id = auth.uid())', '  where r.id = p_id'),
    (SQL, 'la vista previa enseña las no compartidas',
     '  where r.id = p_id and r.compartida\n', '  where r.id = p_id\n'),
    (SQL, 'sin tope por hora',
     "r.created_at > now() - interval '1 hour') >= 30 then", "r.created_at > now() - interval '1 hour') >= 3000 then"),

    # ── 4. El borde ──
    (BORDE, 'la vista previa de una repetición, indexable',
     "    imagen: IMAGEN_POR_DEFECTO,\n    robots: 'noindex,follow',\n  }\n}\n\nasync function calcularMeta",
     "    imagen: IMAGEN_POR_DEFECTO,\n  }\n}\n\nasync function calcularMeta"),
    (BORDE, 'la vista previa pide el registro entero',
     'rpc/repeticiones_resumen?p_id=', 'rpc/repeticiones_leer?p_id='),

    # ── 5. La página ──
    (DAT, 'tus repeticiones se piden SIN filtrar por ti',
     ".select(COLUMNAS_LISTA)\n    .eq('user_id', userId)", '.select(COLUMNAS_LISTA)'),
    (DAT, 'un cambio que la política rechaza pasa por bueno',
     ".update(cambios).eq('id', id).select('id,titulo,compartida')", ".update(cambios).eq('id', id)"),
    (REP, 'con cuenta, compartir da el enlace largo',
     '    } else if (R.sesion) {\n      if (o?.mia) {', '    } else if (false) {\n      if (o?.mia) {'),
    (REP, 'compartir una guardada no repinta la lista',
     "          R.origen = { ...o, compartida: (await datos.compartir(o.id, true)).compartida }\n          cargarGuardadas()\n",
     "          R.origen = { ...o, compartida: (await datos.compartir(o.id, true)).compartida }\n"),
    (REP, 'al volver de entrar no sale la ventana de guardar',
     '    if (cargar(pendiente) && R.sesion) dialogoGuardar()', '    cargar(pendiente)'),
    (REP, 'borrar a la primera',
     "      if (b.dataset.confirmar !== 'si') {", '      if (false) {'),
    (REP, 'un enlace largo roto se abre como «pega primero»',
     '    if (texto) return cargar(texto, { conservarDireccion: true })', '    return cargar(texto, { conservarDireccion: true })'),
    (REP, 'abrir un enlace largo le borra la dirección',
     '    if (texto) return cargar(texto, { conservarDireccion: true })', '    if (texto) return cargar(texto)'),
    (REP, 'el vídeo pinta las cartas sin pasar por /escaneo',
     'M: { abajo: R.abajo, psDe, letraDe: (n) => letraDeEnergia(n) || \'C\', colorDe, fuentesDe, esperaDe },',
     'M: { abajo: R.abajo, psDe, letraDe: (n) => letraDeEnergia(n) || \'C\', colorDe, fuentesDe: () => [], esperaDe },'),

    # ── 6. El vídeo ──
    (VID, 'el vídeo no dura lo que dice la ventana',
     '  const linea = lineaDeTiempo(fotos, M.esperaDe, ritmo)\n', '  const linea = lineaDeTiempo(fotos, M.esperaDe, ritmo * 2)\n'),
    (VID, 'el vídeo acaba sin el cartel de quién gana',
     ": f?.tipo === 'fin' ? `Gana ${s.fin?.ganador}` : null", ': null'),
    (VID, 'cancelar no para nada',
     '      if (senal.cancelado) throw cancelar()\n      if (fallo) throw fallo', '      if (fallo) throw fallo'),
    (VID, 'una imagen sin permiso mancha el lienzo (y el vídeo no sale)',
     "    img.crossOrigin = 'anonymous'\n", ''),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-480.mjs')
