"""Rigor de la tanda 428 — lo que te costó contra lo que vale.

Una cuenta de dinero mal hecha no da error NUNCA: sale un número bonito y
equivocado. Por eso cada mutación rompe el origen de la cuenta —qué
líneas entran, por cuánto se multiplica, qué se hace con lo que no se
sabe— y no una de sus guardas.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

B = 'js/mi-coleccion/balance.js'
J = 'js/mi-coleccion.js'
C = 'css/mi-coleccion.css'

MUTACIONES = [
    # ── Qué entra en la cuenta ──
    (B, 'entran tambien las que no tienen precio de compra',
     "  const conPrecio = (lineas || []).filter((l) => Number(l?.precio_compra) > 0)",
     "  const conPrecio = lineas || []"),
    (B, 'un precio de compra de 0 cuenta como compra',
     "Number(l?.precio_compra) > 0)", "Number(l?.precio_compra) >= 0)"),
    (B, 'las que no tienen precio de mercado cuentan como cero',
     "    if (!Number.isFinite(v) || v <= 0) {\n      sinValorar += cuantas\n      continue\n    }",
     "    if (!Number.isFinite(v) || v <= 0) {\n      pagado += Number(l.precio_compra) * cuantas\n      copias += cuantas\n      continue\n    }"),
    (B, 'no se dice cuantas se quedan fuera',
     "      sinValorar += cuantas\n      continue", "      continue"),

    # ── Las cuentas ──
    (B, 'las copias no multiplican lo pagado',
     "    pagado += Number(l.precio_compra) * cuantas", "    pagado += Number(l.precio_compra)"),
    (B, 'la diferencia va al reves',
     "    diferencia: valor - pagado,", "    diferencia: pagado - valor,"),
    (B, 'sin nada comparable se enseña un balance a cero',
     "    hayBalance: copias > 0,", "    hayBalance: true,"),
    (B, 'sin `valorDe` se cuenta como si valiera lo pagado',
     "    const v = Number(valorDe ? valorDe(l) : NaN)", "    const v = Number(valorDe ? valorDe(l) : l.precio_compra)"),

    # ── La tarjeta ──
    (J, 'la tarjeta no distingue ganar de perder',
     "  const clase = dif === 0 ? '' : dif > 0 ? ' mc-gana' : ' mc-pierde'", "  const clase = ''"),
    (J, 'el signo se cae y queda solo el color',
     "  const signo = dif === 0 ? '' : dif > 0 ? '+' : '−'", "  const signo = ''"),
    (J, 'un cero sale con signo de ganancia',
     "  const dif = Math.round(b.diferencia * 100) / 100", "  const dif = b.diferencia + 0.0001"),
    (J, 'sin nada apuntado se enseña un balance vacio',
     "  if (!b.hayBalance) {", "  if (false) {"),
    (J, 'la tarjeta no dice sobre cuantas cartas es',
     "    <p class=\"mc-diapo-pie\">${dif === 0 ? 'ni ganas ni pierdes, ' : ''}en ${escapeHtml(cuantas)}</p>",
     "    <p class=\"mc-diapo-pie\">tu balance</p>"),
    (J, 'no se avisa de las que no se pueden valorar',
     "      b.sinValorar\n        ? `<p class=\"subtext\">", "      false\n        ? `<p class=\"subtext\">"),
    (J, 'la tarjeta compara con el valor de la coleccion ENTERA',
     "  const b = balanceDeCompra(lineas, (l) => valorDeLinea(l, precioDe(l)))",
     "  const b = { ...balanceDeCompra(lineas, (l) => valorDeLinea(l, precioDe(l))), valor: valorDeAhora(), diferencia: valorDeAhora() - balanceDeCompra(lineas, (l) => valorDeLinea(l, precioDe(l))).pagado }"),

    # ── La cifra de la cabecera ──
    (J, 'la cabecera vuelve a decir «Pagado» a secas',
     "<dt>Pagado en ${conCompra.toLocaleString('es-ES')} ${conCompra === 1 ? 'carta' : 'cartas'}</dt>",
     "<dt>Pagado</dt>"),
    (J, 'la cabecera cuenta mal cuantas tienen precio de compra',
     "      pagado += Number(l.precio_compra) * l.cantidad\n      conCompra += l.cantidad",
     "      pagado += Number(l.precio_compra) * l.cantidad\n      conCompra += 1"),

    # ── El CSS ──
    (C, 'ganar y perder se pintan igual',
     ".mc-diapo-cifra.mc-gana {\n  color: var(--success);\n}", ".mc-diapo-cifra.mc-gana {\n  color: var(--danger);\n}"),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-428.mjs')
