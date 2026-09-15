"""Las dos mutaciones que la tanda 305 NO detectaba, tras reforzar la prueba."""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

rigor_comun.correr([
    ('css/style.css', 'un paso de la escala desaparece',
     '  --t-lg: 16px;', '  /* --t-lg: 16px; */'),
    ('curso.html', 'el curso se queda sin renglones de párrafo',
     '            <div class="esq-linea"></div><div class="esq-linea"></div><div class="esq-linea"></div>\n          </div>\n          <div class="esq-bloque"></div>',
     '          </div>\n          <div class="esq-bloque"></div>'),
    # Y una tercera contra el mismo listón flojo, por el otro lado: que
    # un párrafo se quede con menos renglones de los que debe.
    ('guia.html', 'un párrafo pierde un renglón',
     '            <div class="esq-linea"></div><div class="esq-linea"></div><div class="esq-linea"></div>\n          </div>\n          <div class="esq-bloque"></div>',
     '            <div class="esq-linea"></div><div class="esq-linea"></div>\n          </div>\n          <div class="esq-bloque"></div>'),
], 'test-tanda-305.mjs')
