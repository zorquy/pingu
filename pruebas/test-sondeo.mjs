import { sondeoAdaptable } from '/home/user/pingu/js/sondeo.js'

// El engranaje del sondeo de respaldo, probado en Node contra el código
// DE VERDAD (no contra el doble). Es la pieza de la que depende que la
// web siga funcionando cuando el websocket no conecta, así que no puede
// estar solo cubierta por una prueba de navegador que la sustituye.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Sin tiempo real, sondea a su ritmo ──')
{
  let veces = 0
  const s = sondeoAdaptable(() => veces++, 50)
  await esperar(260)
  s.parar()
  check('llama varias veces', veces >= 4, `${veces} en 260 ms a 50 ms`)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Con el vivo conectado, baja a la marcha larga ──')
{
  let veces = 0
  const s = sondeoAdaptable(() => veces++, 50, 6)  // marcha larga: 300 ms
  s.conVivo(true)
  await esperar(260)
  s.parar()
  // A 300 ms, en 260 ms no debería dar tiempo ni a una.
  check('deja de sondear tan a menudo', veces <= 1, `${veces} en 260 ms`)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. LA RED DE SEGURIDAD: si el vivo se cae, vuelve ──')
{
  // Esta es LA prueba de la tanda. Si esto no funciona, un websocket
  // que se muere en silencio deja la página muda para siempre.
  let veces = 0
  const s = sondeoAdaptable(() => veces++, 50, 6)
  s.conVivo(true)
  await esperar(150)
  const conVivo = veces
  s.conVivo(false)
  await esperar(260)
  s.parar()
  check('mientras había vivo, casi no sondea', conVivo <= 1, `${conVivo}`)
  check('al caerse, vuelve a sondear', veces - conVivo >= 4, `${veces - conVivo} tras la caída`)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Cambiar al mismo estado no reinicia el reloj ──')
{
  // Si cada aviso de «sigo vivo» reiniciara el intervalo, un canal que
  // confirma su estado a menudo dejaría el sondeo sin disparar NUNCA.
  let veces = 0
  const s = sondeoAdaptable(() => veces++, 50)
  for (let i = 0; i < 10; i++) {
    s.conVivo(false)
    await esperar(26)
  }
  s.parar()
  check('el sondeo sigue disparando', veces >= 3, `${veces} en 260 ms`)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Parar es parar ──')
{
  let veces = 0
  const s = sondeoAdaptable(() => veces++, 40)
  await esperar(100)
  const alParar = veces
  s.parar()
  await esperar(150)
  check('no llama más después de parar', veces === alParar, `${alParar} → ${veces}`)
}

console.log(fails ? `\n✘ ${fails} fallos` : '\n✔ todo verde')
process.exit(fails ? 1 : 0)
