"""Rigor de la tanda 384 — el laboratorio de pruebas del constructor.

Casi nada de lo que se puede romper aqui da error. Una probabilidad mal
condicionada sigue siendo un porcentaje con buena pinta; una carta cuyo
efecto no se encuentra se juega «a mano» y la partida sigue; un deshacer
que no devuelve el azar deja repetir un robo sin que nadie lo note.
Por eso cada mutacion rompe el ORIGEN del dato, no una guarda.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

P = 'js/constructor/partida.js'
E = 'js/constructor/efectos.js'
L = 'js/constructor/laboratorio.js'

MUTACIONES = [
    # ── 1. Las probabilidades ──
    # La tabla del mazo sin condicionar a una mano CON basico: da la
    # hipergeometrica a secas, que es lo que hacen casi todas las webs.
    (P, 'la mano inicial no se condiciona a tener basico',
     'return Math.max(0, Math.min(1, 1 - (sinX - sinXni * sinXDespues) / pValida))',
     'return Math.max(0, Math.min(1, 1 - sinX))'),
    # Olvidarse de que las cartas que no has visto pueden estar en los
    # PREMIOS: todas las que faltan irian al mazo.
    (P, 'los premios boca abajo no cuentan como sitio donde puede estar',
     '    Uu: sinConf.length + premiosOcultos.length,',
     '    Uu: sinConf.length,'),
    # Barajar ya no convierte lo conocido en «esta en el mazo, no se
    # donde»: tras un Pokegear se olvidaria que esas siete no estan en
    # los premios.
    (P, 'barajar olvida lo que habias visto',
     'if (i < k.arriba || i >= L - k.abajo) k.confirmados[s.mazo[i]] = true',
     'if (false) k.confirmados[s.mazo[i]] = true'),
    # La columna de la pantalla enseña otro numero que el del motor.
    (L, 'la pantalla enseña «en N robos» como «proximo robo»',
     '<td><span class="lab-num">${pct(r.siguiente)}</span>${barra(r.siguiente)}</td>',
     '<td><span class="lab-num">${pct(r.enN)}</span>${barra(r.enN)}</td>'),

    # ── 2. Deshacer ──
    # El azar fuera del estado: deshacer y volver a barajar da otro
    # orden, y el laboratorio deja «repetir hasta que salga».
    (P, 'el azar vive fuera del estado',
     '  azar() {\n    return siguienteAzar(this.s)\n  }',
     '  azar() {\n    return Math.random()\n  }'),

    # ── 3. Los nombres ──
    # Sin la tabla de nombres, las 176 cartas con el español en `name`
    # se quedan sin efecto — sin dar error.
    (P, 'no se traduce el nombre en español',
     '  if (INGLES_DE[n]) return INGLES_DE[n]\n',
     ''),
    # Las claves de la tabla sin normalizar: «poké pad» con tilde no
    # casa con «poke pad».
    (E, 'las claves de los entrenadores no se normalizan',
     '  entrenadores: enPlano(entrenadores),',
     '  entrenadores,'),
    # Una Mega ex vuelve a dar 2 premios.
    (P, 'una Mega ex da 2 premios',
     '  if (esMegaEx(c)) return 3\n',
     ''),

    # ── 4. La firma y la era ──
    (P, 'un ataque con otro daño impreso hereda el efecto',
     '      if (c.attacks.some((a, j) => impreso(a?.damage) !== firma[j])) return null\n',
     ''),
    (P, 'una carta sin habilidades hereda la de otra que se llama igual',
     '    if (Array.isArray(c.abilities) && !c.abilities.length) return null\n',
     ''),

    # ── 5. Las reglas del turno ──
    (E, 'Caramelo Raro en el primer turno',
     "      if (p.s.estricta && p.esMiPrimerTurno) return 'No se puede usar en tu primer turno.'\n",
     ''),
    (P, 'quien va primero ataca en su primer turno',
     "    if (this.primerTurnoDelPrimero) return 'Quien va primero no puede atacar en su primer turno.'\n",
     ''),

    # ── 6. La hoja ──
    # Sin la hoja en el HTML, lo que pinta el `import()` sale sin CSS.
    ('constructor.html', 'la hoja del laboratorio no se carga',
     '  <link rel="stylesheet" href="/css/laboratorio.css" />\n',
     ''),
    # La paleta es copia de la de la ficha: si se separa, se nota.
    ('css/laboratorio.css', 'un color de energia se separa del de la ficha',
     ".lab-energia[data-tipo='R'] { --tipo-energia: ",
     ".lab-energia[data-tipo='R'] { --tipo-energia: #000000; --rigor: "),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-384.mjs')
