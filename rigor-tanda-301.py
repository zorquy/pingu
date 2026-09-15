"""Rigor de la tanda 301 (la comunidad). En segundo plano SIEMPRE."""
import sys

sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
from rigor_comun import correr

SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
REPO = '/home/user/pingu'
US = 'js/usuarios.js'
HTML = 'usuarios.html'
CSS = 'css/comunidad.css'

MUTACIONES = [
    # ── Abre por gente, y a ancho completo ──
    (HTML, 'la comunidad vuelve a abrir por la lista de documentos',
     '''      <button class="com-chip active" data-ctab="users">Gente''',
     '''      <button class="com-chip" data-ctab="users">Gente'''),

    (HTML, 'y el panel de entrada vuelve a ser el de guías',
     '        <div class="tab-panel active" id="ctab-users">',
     '        <div class="tab-panel" id="ctab-users">'),

    (HTML, 'la comunidad vuelve a la columna estrecha',
     '  <main class="page-content container">', '  <main class="page-content container-narrow">'),

    # ── Los números ──
    (US, 'los números desaparecen',
     "    cuenta(() => supabase.from('user_profiles').select('id', { count: 'exact', head: true })),",
     '    Promise.resolve(null),'),

    (US, 'la cuenta de guías incluye las que nadie ha publicado',
     "supabase.from('guides').select('id', { count: 'exact', head: true }).not('author_id', 'is', null).not('published_at', 'is', null)",
     "supabase.from('guides').select('id', { count: 'exact', head: true }).not('author_id', 'is', null)"),

    (US, 'se cuentan rachas de gente que no aparece desde hace meses',
     ".gt('current_streak', 0).gte('last_active_date', ayer)", ".gt('current_streak', 0)"),

    (US, 'una cifra que falla enseña un cero en vez de un guion',
     '      return error ? null : count', '      return error ? 0 : count'),

    (US, 'una tabla que falta tumba la lista de gente entera',
     '    (Array.isArray(filas) ? filas : []).reduce((acc, f) => {',
     '    (filas || []).reduce((acc, f) => {'),

    # ── El podio ──
    (US, 'el podio premia a quien lleva más tiempo aquí, no a quien aporta ahora',
     '      .map((p) => ({ p, ganado: Math.max(0, (p.total_xp || 0) - (inicio[p.id] ?? 0)) }))',
     '      .map((p) => ({ p, ganado: p.total_xp || 0 }))'),

    (US, 'el podio enseña la XP total en vez de la del mes',
     '<span class="com-puesto-xp">+${new Intl.NumberFormat(\'es-ES\').format(ganado)} XP este mes</span>',
     '<span class="com-puesto-xp">+${new Intl.NumberFormat(\'es-ES\').format(p.total_xp || 0)} XP este mes</span>'),

    (US, 'el podio saca más de tres',
     '      .slice(0, 3)', '      .slice(0, 6)'),

    (US, 'sale un podio vacío cuando nadie ha ganado XP este mes',
     '    if (!tres.length) return', '    if (!tres.length) tres.push({ p: perfiles[0], ganado: 0 })'),

    (US, 'el podio no lleva a ningún perfil',
     '            <a class="com-puesto com-puesto-${i + 1}" href="${profileUrl(p)}">',
     '            <a class="com-puesto com-puesto-${i + 1}">'),

    (US, 'las medallas vuelven a ser emojis',
     '<span class="com-puesto-medalla">${icons.medal(14)} ${MEDALLAS[i]}</span>',
     '<span class="com-puesto-medalla">${MEDALLAS[i]}</span>'),

    # ── La tarjeta de persona ──
    (US, 'la tarjeta deja de decir qué ha hecho cada uno',
     "  if (p.approvedGuidesCount > 0) hizo.push(`${p.approvedGuidesCount} ${p.approvedGuidesCount === 1 ? 'guía' : 'guías'}`)",
     '  if (false) hizo.push()'),

    (US, 'la tarjeta deja de decir cuántos mensajes ha escrito',
     "  if (p.mensajes > 0) hizo.push(`${p.mensajes} ${p.mensajes === 1 ? 'mensaje' : 'mensajes'}`)",
     '  if (false) hizo.push()'),

    (US, 'quien no ha hecho nada dice «0 guías · 0 mensajes»',
     "${hizo.length ? escapeHtml(hizo.join(' · ')) : 'Acaba de llegar'}",
     "${escapeHtml(hizo.join(' · '))}"),

    (US, 'la racha desaparece de la tarjeta',
     '        p.racha > 0\n          ? `<span class="com-persona-racha"', '        false\n          ? `<span class="com-persona-racha"'),

    (US, 'los mensajes no se cuentan: todo el mundo acaba de llegar',
     '    mensajes: mensajesPorAutor[p.id] || 0,', '    mensajes: 0,'),

    (US, 'vuelve el marco dorado de los tres primeros',
     '    <div class="com-persona">', '    <div class="com-persona user-card-top">'),

    # ── Quién anda por aquí hoy ──
    (US, 'sale «por aquí hoy» aunque no haya nadie',
     '  if (caja && activos.length) {', '  if (caja) {'),

    (US, '«por aquí hoy» cuenta también a los de hace meses',
     '  const activos = (perfiles || []).filter((p) => p.last_active_date === hoy)',
     '  const activos = perfiles || []'),

    # ── Lo que ya funcionaba ──
    (US, 'cambiar de pestaña deja de guardarse en la dirección',
     "  if (recordar) history.replaceState(null, '', `#${nombre}`)", '  if (false) history.replaceState()'),

    (US, 'la búsqueda de gente deja de filtrar',
     '    render(allUsers.filter((p) => contienePlegado(p.display_name, q) || contienePlegado(p.username, q)))',
     '    render(allUsers)'),

    (US, 'el chip de Gente se queda sin su cuenta',
     "  if (chip && miembros != null) chip.textContent = new Intl.NumberFormat('es-ES').format(miembros)",
     '  if (false) chip.textContent = 0'),

    # ── La hoja de estilo ──
    (HTML, 'la comunidad se queda sin su hoja',
     '  <link rel="stylesheet" href="css/comunidad.css" />', '  <!-- sin hoja -->'),

    (CSS, 'la lateral se pega a la principal y la página se sale',
     '''@media (min-width: 960px) {
  .com-dos {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;''',
     '''@media (min-width: 320px) {
  .com-dos {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;'''),
]

correr(MUTACIONES, 'test-tanda-301.mjs')
