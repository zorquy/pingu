"""Rigor de la tanda 592 — «tú contra ti», escrita como TCG Live.

Lo que se rompe aquí no da error: el registro se lee entero, la repetición
se reproduce… y tiene una carta de más en la mano, una energía en el Dreepy
que no era, o un daño que no se ha curado. Cada mutación rompe el ORIGEN de
una de esas cuentas.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

DIA = 'js/constructor/diario.js'
PAR = 'js/constructor/partida.js'
REG = 'js/repeticiones/registro.js'
EST = 'js/repeticiones/estado.js'
LAB = 'js/constructor/laboratorio.js'

MUTACIONES = [
    # El que escribe
    (DIA, 'se roba ANTES de devolver la mano a la baraja', '    subs.unshift(...delante)', '    subs.unshift(...delante.reverse())'),
    (DIA, 'del descarte a la mano como «ha movido»', '    for (const u of recuperadas) subs.push(`Se ha añadido ${nom(u)} a la mano de ${J}.`)', '    for (const u of recuperadas) subs.push(`${J} ha movido ${nom(u)} de ${J} a su mano.`)'),
    (DIA, 'sin decir cuál de los gemelos', 'const conLugar = (linea, n) => (n > 0 ? [linea, `   ◦ lugar ${n}`] : [linea])', 'const conLugar = (linea, n) => [linea]'),
    (DIA, 'sin decir de dónde sale la energía', "          if (a.z === 'mazo') subs.push('   ◦ de la baraja')\n", ''),
    (DIA, 'sin curarse', "      else if (delta < 0) subs.push(", "      else if (false) subs.push("),
    (DIA, 'el daño del ataque contado dos veces', '      const delta = sl.danio - a.danio - (delAtaque.get(id) || 0)', '      const delta = sl.danio - a.danio'),
    (DIA, 'mirar arriba y poner debajo es «barajar»', '    if (resto.every((u, i) => u === ahora[i])) return false\n', ''),
    (DIA, 'la mano inicial sin lo que ya se puso en juego', '    out.push(`${J} ha robado 7 cartas de la mano inicial.`, \'- 7 cartas robadas.\', lista([...colocadas, ...p.s.mano]))', '    out.push(`${J} ha robado 7 cartas de la mano inicial.`, \'- 7 cartas robadas.\', lista(p.s.mano))'),
    # La mesa
    (PAR, 'en la preparación también se escribe', "    if (this.m.fase === 'mulligan' || this.m.fase === 'preparacion') {\n      this.tramo", "    if (false) {\n      this.tramo"),
    (PAR, 'lo de la preparación se vuelve a contar', '    if (this.tramo) this.tramo = { base: fotoDeMesa(this), cabs: [], golpes: [] }\n    p.s.fase = \'turno\'', "    p.s.fase = 'turno'"),
    (PAR, 'el daño de un ataque no se apunta', '    if (this.oponente) this.mesa?.golpe(this.oponente, objetivo, cantidad, { de: this, contadores })\n', ''),
    (PAR, 'deshacer no deshace el registro', '    this.jugadores[1].s = f.b\n    this.m = f.m\n', '    this.jugadores[1].s = f.b\n    this.m = { ...f.m, diario: this.m.diario }\n'),
    (PAR, 'sin «ha terminado su turno»', "    this.cortar([`${this.nombresDiario[this.indice(j)]} ha terminado su turno.`, '', `Turno de ${this.nombresDiario[this.indice(op)]}`])", '    this.cortar()'),
    # El que lee
    (REG, 'las pistas no se leen', "      if (ultimo && pista[1]) ultimo.lugar = Number(pista[1])\n", ''),
    (REG, 'las cartas de más por dos mulligans se cuentan dos veces', '(ev.cartas?.length || ev.n === ultimo.n)', '(ev.cartas?.length)'),
    (EST, 'curarse no baja el daño', '      if (obj) obj.danio = Math.max(0, obj.danio - e.danio)\n', ''),
    (EST, 'la energía del efecto sale del descarte aunque diga «de la baraja»', "      if (e.desde === 'mazo') deOtro = null\n      const enDescarte = e.desde === 'mazo' ? -1 :", "      const enDescarte ="),
    # La pantalla
    (LAB, '«Copiar» copia otra cosa', '    await navigator.clipboard.writeText(texto)\n    showToast(\'Registro copiado', '    await navigator.clipboard.writeText(texto.split(\'\\n\').slice(1).join(\'\\n\'))\n    showToast(\'Registro copiado'),
    (LAB, '«Verla» no deja la partida esperando', "    sessionStorage.setItem('pokedoc-repeticion-pendiente', texto)", "    sessionStorage.setItem('pokedoc-repeticion-pendientes', texto)"),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-592.mjs')
