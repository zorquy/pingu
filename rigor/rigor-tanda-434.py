"""Rigor de la tanda 434 — la ruta del asset de TCGdex, montada a mano.

Una dirección mal montada no da error: pide un fichero que no está, el
respaldo la quita y la carta se queda como estaba. O sea que romper esto
se ve EXACTAMENTE igual que el fallo que viene a arreglar.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

E = 'js/escaneo-carta.js'
R = 'js/carta-ruta.js'
J = 'js/mi-coleccion.js'
D = 'js/mi-coleccion/datos.js'

MUTACIONES = [
    (E, 'la ruta se monta al reves',
     "  return `${limpio(serie)}/${limpio(set)}/${limpio(numero)}`",
     "  return `${limpio(set)}/${limpio(serie)}/${limpio(numero)}`"),
    (E, 'sin serie se inventa una direccion',
     "  if (!serie || !set || !numero) return null", "  if (!set || !numero) return null"),
    (E, 'una barra dentro se cuela y cambia de carpeta',
     "  if ([serie, set, numero].some((v) => /[/?#\\s]/.test(limpio(v)))) return null\n", "  \n"),
    (E, 'la serie no se busca en el set embebido',
     "  const serie = serieDeSet || carta?.tcg_sets?.serie_id || carta?.serie_id || null",
     "  const serie = serieDeSet || carta?.serie_id || null"),
    (E, 'se monta a mano aunque YA haya image_path',
     "  const aMano = carta?.image_path ? null : rutaDeAssetDeTCGdex(carta)",
     "  const aMano = rutaDeAssetDeTCGdex(carta)"),
    (E, 'no se monta nunca a mano',
     "  if (aMano) cadena.push(comoEspejo(aMano))\n", "  \n"),
    (E, 'el asset a mano pierde el idioma del mercado',
     "  if (aMano) cadena.push(comoEspejo(aMano))", "  if (aMano) cadena.push(urlDeImagen(aMano, calidad))"),
    (R, 'la ruta del logo se monta mal',
     "  return `${ASSETS}/en/${String(serieId).trim()}/${String(setId).trim()}/logo.webp`",
     "  return `${ASSETS}/en/${String(setId).trim()}/${String(serieId).trim()}/logo.webp`"),
    (R, 'el logo sin serie se inventa',
     "  if (!serieId || !setId) return null", "  if (!setId) return null"),
    (R, 'una barra en el logo se cuela',
     "  if ([serieId, setId].some((v) => /[/?#\\s]/.test(String(v)))) return null\n", "  \n"),
    (J, 'la tarjeta no monta el logo a mano',
     "  const logoAMano = set.logo_path ? null : urlDeLogoPorPartes(set.serie_id, set.id)",
     "  const logoAMano = null"),
    (J, 'la tarjeta monta el logo a mano aunque ya tenga uno',
     "  const logoAMano = set.logo_path ? null : urlDeLogoPorPartes(set.serie_id, set.id)",
     "  const logoAMano = urlDeLogoPorPartes(set.serie_id, set.id)"),
    (J, 'el logo a mano no entra en la cadena de la tarjeta',
     "  const dibujos = [logo, logoAMano, simbolo].filter(Boolean)",
     "  const dibujos = [logo, simbolo].filter(Boolean)"),
    (D, 'la expansion deja de traer la serie',
     "tcg_sets(tcg_online_code,serie_id)", "tcg_sets(tcg_online_code)"),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-434.mjs')
