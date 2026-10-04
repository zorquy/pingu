"""Rigor de la tanda 596 — el repaso de fallos.

Cada mutación devuelve UNO de los fallos encontrados, tal como estaba: la
ventana que pisa a otra, el puzle que enseña la solución en la dirección,
el KO que no se cuenta, las fichas en el idioma equivocado, el «ya está
seleccionado» sin nada seleccionado, el título que se cambia al publicar,
los guardados repetidos…
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

REP = 'js/repeticiones.js'
IMP = 'js/repeticiones/impresion.js'
RCSS = 'css/repeticiones.css'
CON = 'js/constructor.js'
CCSS = 'css/constructor.css'
LAB = 'js/constructor/laboratorio.js'

MUTACIONES = [
    (REP, 'la ventana de compartir escribe aunque ya no sea la suya', "  if (!sigueLaVentana(vez)) return\n  nota.textContent = texto", "  nota.textContent = texto"),
    (REP, 'cualquier ventana «sigue»', "const sigueLaVentana = (vez) => vez === vezDialogo && $('repDialogo').open", "const sigueLaVentana = (vez) => true"),
    (REP, 'el puzle reescribe la dirección', "  await abrirGuardada(puzle.replay_id, { conservarDireccion: true })", "  await abrirGuardada(puzle.replay_id)"),
    (REP, 'abrir una guardada no pasa lo de la dirección', "      conservarDireccion,\n    })", "    })"),
    (REP, 'tu respuesta sin decirla', "k === solucion.elegida ? 'la tuya' : ''", "''"),
    (RCSS, '«la tuya» sin estilo', ".rep-puzle-recuento .rep-puzle-tuya {\n  text-decoration: underline;", ".rep-puzle-recuento .rep-puzle-tuya {\n  text-decoration: none;"),
    (REP, 'los números no se recuentan con los PS', "  R.numeros = numerosDe(R.lectura, R.fotos)\n", ''),
    (REP, 'los números se recuentan pero no se pintan', "  pintarMomentos()\n  pintarNumeros()\n  pintar()", "  pintarMomentos()\n  pintar()"),
    (REP, 'el idioma del registro no se mira', "  const idioma = /^\\s*Setup\\s*$/m.test(R.texto) ? 'en' : 'es'", "  const idioma = 'es'"),
    (IMP, 'TCGdex siempre en español', "const API = (idioma) => `https://api.tcgdex.net/v2/${idioma === 'en' ? 'en' : 'es'}`", "const API = (idioma) => 'https://api.tcgdex.net/v2/es'"),
    (REP, '«ya está seleccionado» sin nada seleccionado', "    } else showToast(`No se ha podido copiar solo. El enlace: ${url}`, 'info')", "    } else showToast('Cópialo a mano: ya está seleccionado.', 'info')"),
    (REP, 'publicar la tuya la vuelve a guardar (y le cambia el título)', "    const propia = !anonima && R.origen?.mia && R.origen.id", "    const propia = false"),
    (REP, 'las notas se publican con los nombres de verdad', "x.replace(palabra(real), alias)", "x"),
    (CON, 'la frase cuenta solo esta impresión', "  const delNombre = copiasDelNombre(cartaAbierta)", "  const delNombre = n"),
    (CON, 'se guarda mientras se está guardando', "  if (guardando) return\n", ''),
    (CON, 'la tecla mantenida guarda otra vez', "      if (!e.repeat) guardar()", "      guardar()"),
    (CCSS, 'el desplegable de formato no encoge', ".cm-ajustes .cm-campo select {\n  min-width: 0;", ".cm-ajustes .cm-campo select {\n  min-width: auto;"),
    (CON, 'el sello vacío se queda', "  sello.classList.toggle('hidden', !entradas.length)\n", ''),
    ('auth.html', '/auth sin <h1>', '      <h1 class="sr-only">Entrar o crear tu cuenta de PokeDoc</h1>\n', ''),
    (LAB, 'el nombre se escapa dos veces', "  const n = await ui.numero({ titulo: `Daño en ${nombreVisible(L.partida.cartaDe(slot))}`,", "  const n = await ui.numero({ titulo: `Daño en ${escapeHtml(nombreVisible(L.partida.cartaDe(slot)))}`,"),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-596.mjs')
