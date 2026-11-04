// Las cifras de una banda SE CALCULAN al aparecer (1214; desde la 1217, PINGU:
// «que vayan como calculándose y al final aparezca el número final»): los
// dígitos de un número grande de `.banda-s-cifra b` dan vueltas y se fijan,
// con `calcularCifra` de js/contar.js (la misma del Panel y la portada). Vigila la página con un
// MutationObserver, así que vale para las bandas del HTML (cuyas cifras pone
// el JS de cada página, que nacen con guion) y para las que se pintan después
// (Cruces). Con «menos movimiento», nada: la cifra sale ya puesta.
const reducir = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

// «1.234», «12+», «3»: el número y lo que lleva detrás. Lo demás («—»,
// «12,5 €») no cuenta.
export function partesDeCifra(texto) {
  const m = /^(\d{1,3}(?:\.\d{3})*|\d+)(\+?)$/.exec(String(texto || '').trim())
  if (!m) return null
  return { n: Number(m[1].replace(/\./g, '')), miles: m[1].includes('.'), resto: m[2] }
}

// Lo que escribe la propia cuenta también lo ve el observador (y DESPUÉS,
// cuando ya no se puede saber quién fue): mientras cuenta, la cifra lleva
// `data-contando`, y si alguien escribe otro valor en medio, la cuenta lo
// nota (no es lo último que puso ella) y vuelve a empezar hacia el nuevo.
let calcularCifra = null
const listo = import('./contar.js').then((m) => { calcularCifra = m.calcularCifra })
function contar(b) {
  const p = partesDeCifra(b.textContent)
  if (!p || p.n < 2 || b.dataset.contada === b.textContent) return
  const final = b.textContent
  b.dataset.contada = final
  if (reducir) return
  b.dataset.contando = '1'
  const ir = () => {
    calcularCifra(b, final)
    // Lo que escribe la propia vuelta lo ve el observador: mientras dura,
    // `data-contando` le dice que no empiece otra.
    setTimeout(() => { delete b.dataset.contando }, 1150)
  }
  if (calcularCifra) ir()
  else void listo.then(ir, () => { delete b.dataset.contando })
}

function repasar(raiz) {
  for (const b of raiz.querySelectorAll?.('.banda-s-cifra b') || []) contar(b)
}

if (typeof document !== 'undefined' && typeof MutationObserver === 'function') {
  repasar(document)
  new MutationObserver((cambios) => {
    for (const c of cambios) {
      const b = c.target.nodeType === 3 ? c.target.parentElement : c.target
      if (b?.matches?.('.banda-s-cifra b')) {
        if (!b.dataset.contando) contar(b)
      } else if (c.addedNodes.length) {
        for (const n of c.addedNodes) if (n.nodeType === 1) repasar(n)
      }
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true })
}
