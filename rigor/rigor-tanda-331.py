"""Rigor de la tanda 331 — la ficha que se completa sola.

Ninguna da error. La pagina se pinta, la carta sale y nadie ve una
excepcion. Lo que cambia es CUANTO se pide a un catalogo comunitario y
gratuito, y QUE gana cuando lo de fuera y lo nuestro no coinciden.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

C = 'js/carta.js'
D = 'js/carta-detalle.js'

MUTACIONES = [
    # ── 1. El fallo original ──
    # Sin esto, una carta sin engordar vuelve a salir con el nombre, la
    # foto y nada mas — que es lo que vio PINGU con el Mew ex.
    (C, 'una carta sin engordar vuelve a salir a medias',
     '  const completa = carta.detalle_at ? carta : await conDetalleDeTCGdex(carta)',
     '  const completa = carta'),

    # ── 2. El coste ──
    # Pedirla SIEMPRE, tambien las 20.000 que ya estan guardadas. No se
    # ve, no falla, y es portarse como un abuson con quien nos regala los
    # datos.
    (C, 'se le pide a TCGdex hasta lo que ya tenemos guardado',
     '  const completa = carta.detalle_at ? carta : await conDetalleDeTCGdex(carta)',
     '  const completa = await conDetalleDeTCGdex(carta)'),

    # ── 3. Quien manda ──
    # Lo de fuera pisando lo nuestro: la marca de regulacion la curamos
    # nosotros, y si la pisa una respuesta rara cambia la legalidad de una
    # carta en la lista de un mazo.
    (C, 'lo que llega de fuera pisa lo que tenemos curado',
     '    const mezcla = { ...encontrado.fila, ...carta }',
     '    const mezcla = { ...carta, ...encontrado.fila }'),
    # Y el relleno al reves: no se rellena nada y la ficha sigue a medias
    # aunque la peticion haya ido bien.
    (C, 'no se rellena ningun hueco',
     '      if (carta[k] === null || carta[k] === undefined) mezcla[k] = v',
     '      if (false) mezcla[k] = v'),

    # ── 4. Que no tumbe la pagina ──
    # Sin el catch, una red caida deja la ficha en el esqueleto: la regla
    # de la casa es peor ficha, nunca pagina en blanco.
    (C, 'un fallo de red se lleva la ficha por delante',
     '  } catch {\n    return carta\n  }\n}\n\nfunction pintar',
     '  } finally {\n    /* nada */\n  }\n}\n\nfunction pintar'),

    # ── 5. El repintado, que es donde se me escapo ──
    # Sin esto, el borde pinta la ficha corta, deja la caja marcada, y el
    # detalle que acabamos de pedir NO LLEGA A LA PANTALLA. Es lo que vio
    # PINGU: «ya ves que no». La pagina no falla, simplemente no cambia.
    (C, 'lo que se ha traido no llega a la pantalla si el borde ya pinto',
     "  if (caja.dataset.servidor !== '1' || repintarIgual) {",
     "  if (caja.dataset.servidor !== '1') {"),
    # Y el contrario: repintar SIEMPRE lo que el borde ya tenia bien.
    # Vuelve el relevo y con el el salto de los articulos.
    (C, 'se repinta siempre, tambien lo que el borde ya tenia bien',
     "  if (caja.dataset.servidor !== '1' || repintarIgual) {", '  if (true) {'),
    # La senal de «traigo mas» siempre encendida: mismo efecto.
    (C, 'se da por hecho que siempre traemos mas',
     '  const mejorQueLoPintado = completa !== carta', '  const mejorQueLoPintado = true'),

    # ── 6. El modulo mudado ──
    # Que deje de ser puro: en cuanto toca el DOM ya no puede vivir en los
    # dos sitios, y la funcion de Netlify deja de arrancar.
    (D, 'el modulo compartido empieza a tocar el navegador',
     'export function detalleDeCarta(card) {',
     'export function detalleDeCarta(card) {\n  if (typeof document !== "undefined") document.title = String(card?.name || "")'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-331.mjs')
