// El aviso de torneo EN JUEGO en la barra de navegación: si estás
// inscrito en un torneo que se está jugando, un botón ámbar con pulso
// te lleva directo a tu mesa (la ficha abre sola en «Jugar» cuando
// tienes partida viva).
//
// Lo importa app.js en diferido y SOLO para admins mientras los torneos
// estén en pruebas: ni la portada ni el resto de visitantes pagan este
// fichero. Por lo mismo, sus estilos van inyectados aquí y no en
// components.css (que lo baja todo el mundo).
import { supabase } from '../supabase.js'
import { escapeHtml } from '../app.js'
import { icons } from '../icons.js'

const ESTILOS = `
.nav-torneo-vivo {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;
  border-radius: 999px;
  background: #f2b23e;
  color: #4a3305;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  animation: nav-torneo-pulso 2s infinite;
}
.nav-torneo-vivo:hover { background: #f6c159; }
.nav-torneo-vivo svg { flex-shrink: 0; }
@keyframes nav-torneo-pulso {
  0% { box-shadow: 0 0 0 0 rgba(242, 178, 62, 0.55); }
  70% { box-shadow: 0 0 0 9px rgba(242, 178, 62, 0); }
  100% { box-shadow: 0 0 0 0 rgba(242, 178, 62, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .nav-torneo-vivo { animation: none; }
}
.nav-right .nav-torneo-vivo { max-width: 190px; margin-right: 2px; }
@media (max-width: 860px) {
  /* En pantallas estrechas no cabe: queda la copia del menú móvil. */
  .nav-right .nav-torneo-vivo { display: none; }
}
.nav-menu-mobile .nav-torneo-vivo { margin: 6px 0; max-width: none; }
`

export async function montarAvisoTorneo(session) {
  // ¿Estoy inscrito (activo) en algún torneo que se esté jugando?
  const { data: inscripciones } = await supabase
    .from('tournament_registrations')
    .select('tournament_id')
    .eq('user_id', session.user.id)
    .eq('status', 'active')
  const ids = (inscripciones || []).map((i) => i.tournament_id)
  if (!ids.length) return

  const { data: torneos } = await supabase
    .from('tournaments')
    .select('slug, name, start_at')
    .in('id', ids)
    .eq('status', 'in_progress')
    .order('start_at', { ascending: false })
    .limit(1)
  const torneo = torneos?.[0]
  if (!torneo) return

  const estilo = document.createElement('style')
  estilo.textContent = ESTILOS
  document.head.appendChild(estilo)

  const enlace = `<a class="nav-torneo-vivo" href="/torneo?slug=${encodeURIComponent(torneo.slug)}"
    title="Torneo en juego — ir a tu mesa">${icons.zap(14)} ${escapeHtml(torneo.name)}</a>`
  // A la derecha de la barra, pegado a la llamita de la racha (que
  // también se antepone a .nav-right: llegue quien llegue primero,
  // quedan juntos). En el menú móvil, al final.
  const derecha = document.querySelector('.nav-right')
  if (derecha) {
    const racha = derecha.querySelector('.nav-racha')
    if (racha) racha.insertAdjacentHTML('beforebegin', enlace)
    else derecha.insertAdjacentHTML('afterbegin', enlace)
  }
  document.querySelector('.nav-menu-mobile')?.insertAdjacentHTML('beforeend', enlace)
}
