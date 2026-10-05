"""Rigor de la tanda 628 — Mis partidas: filtros, gráficos y estadísticas.

Cada mutación rompe una cuenta, un dibujo o el paso de la página que los
usa — no una comprobación de repuesto."""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

E = 'js/estadisticas-partidas.js'
G = 'js/graficos-partidas.js'
MP = 'js/mis-partidas.js'

MUTACIONES = [
    # ── Las cuentas ──
    (E, '«últimos 7 días» son ocho', "{ desde: sumarDias(hoy, -(n - 1)), hasta: hoy }", "{ desde: sumarDias(hoy, -n), hasta: hoy }"),
    (E, 'el filtro de resultado no filtra', "      (!f.resultado || p.resultado === f.resultado) &&", "      true &&"),
    (E, 'la que no tiene fecha va la primera', "      if (!fa) return 1\n", "      if (!fa) return -1\n"),
    (E, 'a igual fecha no se respeta el orden pedido', "    return signo * String(a.creada || '').localeCompare(String(b.creada || ''))", "    return String(a.creada || '').localeCompare(String(b.creada || ''))"),
    (E, 'un empate no cuenta medio', "  c.pct = porcentaje(c)", "  c.pct = c.total ? c.ganadas / c.total : null"),
    (E, 'la peor racha cuenta los empates', "    if (actual.resultado === 'loss') peor = Math.max(peor, actual.n)", "    if (actual.resultado === 'draw') peor = Math.max(peor, actual.n)"),
    (E, 'el eje se come los periodos sin partidas', "  return { unidad: u, cubos: cubos.map((c) => ({", "  return { unidad: u, cubos: cubos.filter((c) => c.partidas.length).map((c) => ({"),
    (E, 'las semanas empiezan en domingo', "  const dow = (new Date(aMs(fecha)).getUTCDay() + 6) % 7 // lunes = 0", "  const dow = new Date(aMs(fecha)).getUTCDay()"),
    (E, 'por días solo una semana', "  return dias <= 31 ? 'dia'", "  return dias <= 7 ? 'dia'"),

    # ── Los dibujos ──
    (G, 'la línea no se corta donde no se jugó', "      if (tramo.length) tramos.push(tramo)\n      tramo = []\n      return\n", "      return\n"),
    (G, 'el acumulado no cuenta el empate medio', "    const acumulado = (g + e / 2) / t", "    const acumulado = g / t"),
    (G, 'las derrotas abajo', "[[c.ganadas, 'graf-v'], [c.empatadas, 'graf-e'], [c.perdidas, 'graf-d']]", "[[c.perdidas, 'graf-d'], [c.empatadas, 'graf-e'], [c.ganadas, 'graf-v']]"),
    (G, 'sin hueco entre trozos', "        const alto1 = Math.max(1, h - (trozos.length ? 2 : 0))", "        const alto1 = Math.max(1, h)"),
    (G, 'el techo del eje vuelve a 1-2-5', "  for (const k of [1, 2, 3, 4, 5, 6, 8, 10]) if (k * base >= max) return k * base", "  for (const k of [1, 2, 5, 10]) if (k * base >= max) return k * base"),

    # ── La página ──
    (MP, 'los filtros no mandan en las cifras', "  const partidas = filtrarPartidas(todas, filtros)", "  const partidas = todas"),
    (MP, 'se pintan con la pestaña escondida', "  if (!ancho) return // escondida: se pinta al abrir la pestaña", "  if (false) return"),
    (MP, 'al abrir la pestaña no se pintan', "      if (btn.dataset.vista === 'stats') pintarGraficos()", "      void 0"),
    (MP, 'al cambiar el ancho no se vuelven a medir', "        if (anchoPintado && caja.clientWidth && caja.clientWidth !== anchoPintado) pintarGraficos()", "        void 0"),
    (MP, 'el cartel no sale', "    cartel.classList.remove('hidden')\n", ""),
    (MP, 'la lista de sueltas no filtra', "  pintarLista(filtrarPartidas(todas.filter((p) => !p.deTorneo && !p.torneoId), filtrosDeLista()))", "  pintarLista(todas.filter((p) => !p.deTorneo && !p.torneoId))"),
    (MP, 'un filtro vacío dice «aún no hay partidas»', "    const hay = todas.some((p) => !p.deTorneo && !p.torneoId)", "    const hay = false"),
    (MP, 'los torneos no cambian de orden', "  const signo = $('torneoOrden')?.value === 'antiguas' ? 1 : -1", "  const signo = -1"),
    (MP, '«Quitar filtros» deja el periodo', "    $('filtroPeriodo').value = 'siempre'\n", ""),
    (MP, '«Entre dos fechas» no abre sus campos', "  $(`${prefijo}DesdeCampo`).classList.toggle('hidden', !rango)", "  void rango"),
    (MP, 'las últimas 10, con la más reciente a la izquierda', "  const diez = ultimas(jugadas, 10).reverse()", "  const diez = ultimas(jugadas, 10)"),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-628.mjs')
