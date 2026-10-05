"""Rigor de la tanda 626 — las energías, con su símbolo.

Cada mutación rompe lo que DIBUJA el símbolo (la regla de la hoja), no una
comprobación de repuesto."""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

LAB = 'css/laboratorio.css'
CARTA = 'css/carta.css'
TIPOS = "[data-tipo='G'], [data-tipo='R'], [data-tipo='W'], [data-tipo='L'], [data-tipo='P'], [data-tipo='F'], [data-tipo='D'], [data-tipo='M']"

MUTACIONES = [
    (LAB, 'el laboratorio no pinta el símbolo',
     f".lab-energia:is({TIPOS}) {{\n  background-image: var(--icono-energia);\n", f".lab-energia:is({TIPOS}) {{\n"),
    (LAB, 'la píldora vuelve a tener relleno y asoma el color',
     "  padding: 0;\n  color: transparent;", "  padding: 0 var(--e-xs);\n  color: transparent;"),
    (LAB, 'la letra se pinta encima del símbolo',
     "  padding: 0;\n  color: transparent;\n}", "  padding: 0;\n}"),
    (LAB, 'el número de una energía doble se esconde con la letra',
     "[data-tipo='P'], [data-tipo='F'], [data-tipo='D']) sub {\n  color: var(--blanco-fijo);\n}", "[data-tipo='P'], [data-tipo='F'], [data-tipo='D']) sub {\n}"),
    (LAB, 'el número va encima del símbolo',
     ":has(sub) {\n  padding: 0 var(--e-xs) 0 var(--e-xl);\n}", ":has(sub) {\n}"),
    (LAB, 'Planta enseña el de Fuego',
     ".lab-energia[data-tipo='G'] { --icono-energia: url('/assets/iconos-energia/G.png'); }", ".lab-energia[data-tipo='G'] { --icono-energia: url('/assets/iconos-energia/R.png'); }"),
    (CARTA, 'la ficha no pinta el símbolo',
     "  background-image: var(--icono-energia);\n  background-size: cover;\n", "  background-size: cover;\n"),
    (CARTA, 'Psíquico enseña el de Agua en la ficha',
     ".carta-energia[data-tipo='Psychic'] { --icono-energia: url('/assets/iconos-energia/P.png'); }", ".carta-energia[data-tipo='Psychic'] { --icono-energia: url('/assets/iconos-energia/W.png'); }"),
    (CARTA, 'Incolora se pinta con un símbolo que no es el suyo',
     ".carta-energia[data-tipo='Colorless'] { --tipo-energia: #e6eaed; }", ".carta-energia[data-tipo='Colorless'] { --tipo-energia: #e6eaed; background-image: url('/assets/iconos-energia/M.png'); }"),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-626.mjs')
