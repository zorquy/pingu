"""Rigor de la tanda 633 — la barra lateral desplegable, el estadio y la
banca en las repeticiones, la TG24 al importar, /escaneo y /sprite por la
ruta, y el Mew del 30 aniversario.

Cada mutación rompe el ORIGEN: lo que abre un cajón, lo que mide el alto,
lo que reserva el contenido plegado, cómo se quita un estadio, qué banca
sobra, cómo se lee una línea de Galería, qué ids se prueban, qué es una
colección reciente, cómo se lee la ruta y el respaldo en español."""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

BL = 'js/barra-lateral.js'
LC = 'css/lateral.css'
ST = 'css/style.css'
ES = 'js/repeticiones/estado.js'
RG = 'js/repeticiones/registro.js'
NU = 'js/constructor/nucleo.js'
DA = 'js/constructor/datos.js'
EC = 'netlify/functions/escaneo.mjs'
SP = 'netlify/functions/sprite.mjs'
DI = 'js/torneos/decklist-imagen.js'

MUTACIONES = [
    # ── La barra ──
    (BL, 'abrir un cajón no cierra los demás', "    const si = b === boton ? abrir : false\n", "    const si = b === boton ? abrir : b.getAttribute('aria-expanded') === 'true'\n"),
    (BL, 'un cajón cerrado sigue alcanzable', "    if (cajon) cajon.inert = !si\n", ""),
    (BL, 'la sección de la página no sale abierta', "      const abierto = conCajon && s.nombre === abierta\n", "      const abierto = false\n"),
    (BL, 'no se aprieta nunca', "  if (barra.scrollHeight > barra.clientHeight + 1) barra.classList.add('lat-prieta')\n", ""),
    (BL, 'plegarla no se recuerda', "      try { localStorage.setItem(CLAVE_PLEGADA, ahora ? '1' : '0') } catch {}\n", ""),
    (BL, 'plegar no se anima', "      doc.documentElement.classList.add('lat-animando')\n", ""),
    (LC, 'el cajón cerrado ocupa', "    grid-template-rows: 0fr;", "    grid-template-rows: 1fr;"),
    (LC, 'los renglones prietos no se aprietan', "  .lat.lat-prieta .mc-pestania {\n    min-height: 36px;", "  .lat.lat-prieta .mc-pestania {\n    min-height: 44px;"),
    (ST, 'el contenido no se arrima al plegar', "  html.lat-plegada body:has(> #navbar) { padding-left: 72px; }\n", ""),

    # ── Las repeticiones ──
    (ES, 'el estadio descartado se queda en la mesa', "      if (delEstadio) {\n        quitarEstadio(s)", "      if (false) {\n        quitarEstadio(s)"),
    (ES, 'la banca de seis no se recorta', "const sobraBanca = (s, p) => p.banca.length > 5 && (!s.estadio || s.estadioFuera === s.turno)", "const sobraBanca = (s, p) => false"),
    (ES, 'la banca de seis se recorta con el estadio puesto', "const sobraBanca = (s, p) => p.banca.length > 5 && (!s.estadio || s.estadioFuera === s.turno)", "const sobraBanca = (s, p) => p.banca.length > 5"),
    (ES, 'se descarta el activo en vez del de la banca', "      const slot = (sobraBanca(s, p) && !e.cartas?.length && deLaBancaQueSeLlama(p, e.pokemon)) || buscar(p, e.pokemon)", "      const slot = buscar(p, e.pokemon)"),
    (ES, 'la copia de la mano se toma por el estadio', " && !p.manoConocida.some((c) => igual(c, s.estadio.carta))\n", "\n"),
    (RG, '«Se ha descartado» no se lee', "    [/^Se ha descartado (.+)$/, (m) => ({ tipo: 'descartadoSuelto', carta: nombreDeCarta(m[1]) })],\n", ""),

    # ── Importar ──
    (NU, 'la línea de Galería se lee como las demás', "    if (galeria) {\n      lineas.push(", "    if (false) {\n      lineas.push("),
    (DA, 'la TG solo se prueba en el set principal del código', "          for (const otro of idsDeCodigo?.get(l.set) || []) {", "          for (const otro of []) {"),

    # ── El Mew ──
    (DA, 'las colecciones nuevas sin letra no cuentan', "  return new Set(sets.filter((s) => s.release_date && String(s.release_date) >= String(corte)).map((s) => s.id))", "  return new Set()"),
    (DA, 'el corte es la marca más nueva', "    const vieja = [...legales].sort()[0]\n", "    const vieja = [...legales].sort().at(-1)\n"),
    (DA, 'Estándar no deja pasar las sin letra', ",and(regulation_mark.is.null,set_id.in.(${nuevas.join(',')}))` : ''}", "` : ''}"),
    (DA, 'entre las legales no gana la más nueva', "      if (la && (!a.regulation_mark || !b.regulation_mark)) return", "      if (false) return"),

    # ── Escaneos ──
    (EC, '/escaneo no lee la ruta', "    set: url.searchParams.get('set') || (ruta ? leer(ruta[1]) : null),", "    set: url.searchParams.get('set'),"),
    (SP, '/sprite no lee la ruta', "  return url.searchParams.get('n') || deRuta", "  return url.searchParams.get('n')"),
    (DI, 'sin respaldo en español', "    if (/\\/en\\//.test(en)) fuentes.push(en.replace('/en/', '/es/'))\n", ""),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-633.mjs')
