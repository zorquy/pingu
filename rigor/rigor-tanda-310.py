"""Rigor de la tanda 310 — espaciado, desplegables, estados vacíos,
sombras, la barra de una pestaña y la carga diferida."""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

MUTACIONES = [
    # ── La escala de espaciado ──
    ('css/components.css', 'vuelve un espaciado impar',
     '.mini-avatar {\n  width: 26px;', '.mini-avatar {\n  margin-right: 5px;\n  width: 26px;'),
    ('css/style.css', 'desaparece un paso de la escala',
     '  --e-lg: 16px;', '  /* --e-lg: 16px; */'),
    ('css/style.css', 'la escala deja de ir de menor a mayor',
     '  --e-xl: 24px;', '  --e-xl: 10px;'),

    # ── Los desplegables ──
    ('css/style.css', 'el desplegable vuelve a ser el del sistema',
     'select {\n  appearance: none;\n  -webkit-appearance: none;', 'select {\n  /* sin appearance */'),
    ('css/style.css', 'en modo oscuro la flecha se queda invisible',
     ":root[data-theme='dark'] select {", ":root[data-theme='dark'] select.no-existe {"),

    # ── Los estados vacíos ──
    ('css/style.css', 'el estado vacío vuelve a ser una frase suelta',
     '  border: 1px dashed var(--border-strong);\n  border-radius: var(--radius-lg);',
     '  border-radius: var(--radius-lg);'),

    # ── Sombras y transiciones ──
    ('css/foro.css', 'un panel flotante recupera su sombra a pelo',
     '.foro-mod-menu {\n', '.foro-mod-menu {\n  box-shadow: 0 10px 28px rgb(0 0 0 / 14%);\n'),
    ('css/components.css', 'vuelve una duración de transición suelta',
     '.tab-btn {\n', '.tab-btn {\n  transition: color 0.22s var(--ease);\n'),

    # ── La barra de una pestaña ──
    ('js/torneos/torneo.js', 'la barra de una sola pestaña se vuelve a enseñar',
     "  nav.classList.toggle('hidden', visibles.length < 2)", '  void 0'),
    ('js/torneos/torneo.js', 'la barra se esconde SIEMPRE, hasta con varias pestañas',
     "  nav.classList.toggle('hidden', visibles.length < 2)", "  nav.classList.add('hidden')"),

    # ── La carga diferida ──
    ('js/torneos/selector-mazo.js', 'una imagen de lista se pide de golpe',
     '<img loading="lazy" ', '<img '),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-310.mjs')
