// La franja de «Así lo ve alguien sin cuenta» (1306). La página entera va sin
// tu sesión (js/supabase.js); aquí solo se dice, y se ofrece volver.
// Su CSS va aquí: solo lo baja quien abre esta vista (la portada no paga).
const CSS = `.como-desconocido{position:sticky;top:0;z-index:60;display:flex;gap:var(--e-sm);align-items:center;justify-content:center;flex-wrap:wrap;padding:var(--e-sm) var(--e-md);background:var(--warning-bg);color:var(--text);border-bottom:1px solid var(--warning);font-size:var(--t-sm);text-align:center}
.como-desconocido a{font-weight:700;color:var(--text);min-height:44px;display:inline-flex;align-items:center}`

function poner() {
  if (document.getElementById('comoDesconocido')) return
  const estilo = document.createElement('style')
  estilo.textContent = CSS
  document.head.append(estilo)
  const sin = new URL(location.href)
  sin.searchParams.delete('como')
  const franja = document.createElement('div')
  franja.id = 'comoDesconocido'
  franja.className = 'como-desconocido'
  franja.setAttribute('role', 'status')
  franja.innerHTML = '<span>Así lo ve alguien <b>sin cuenta</b>. Nada de lo que hagas aquí cuenta como tú.</span>'
  const volver = document.createElement('a')
  volver.href = sin.pathname + sin.search + sin.hash
  volver.textContent = 'Volver'
  franja.append(volver)
  document.body.prepend(franja)
  document.documentElement.classList.add('con-como-desconocido')
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poner, { once: true })
else poner()
