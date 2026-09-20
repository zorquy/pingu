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
  font-size: var(--t-sm);
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
  max-width: 220px;
  overflow: hidden;
  animation: nav-torneo-pulso 2s infinite;
}
.nav-torneo-vivo:hover { background: #f6c159; }
.nav-torneo-vivo svg { flex-shrink: 0; }
/* El nombre necesita SU caja para que salgan los puntos suspensivos:
   text-overflow no hace nada sobre un contenedor flex, así que el nombre
   se cortaba a hachazo («Pachanga de inauguraci») y parecía un fallo en
   vez de un recorte. Y min-width:0 es lo que le permite encogerse por
   debajo de su contenido, que es la otra mitad.
   (Sin comillas invertidas en este comentario: vive DENTRO de una
   plantilla de JavaScript y una sola cerraría la cadena — lo acabo de
   hacer y el módulo entero dejó de cargar, sin dar error en la página
   porque el import va en diferido y su fallo se traga.) */
.nav-torneo-nombre {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@keyframes nav-torneo-pulso {
  0% { box-shadow: 0 0 0 0 rgba(242, 178, 62, 0.55); }
  70% { box-shadow: 0 0 0 9px rgba(242, 178, 62, 0); }
  100% { box-shadow: 0 0 0 0 rgba(242, 178, 62, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .nav-torneo-vivo { animation: none; }
}
/* order -1: el chip va SIEMPRE el primero del bloque derecho (pegado al
   logo), gane quien gane la carrera de montarse con la llamita de la
   racha, que también se antepone. */
.nav-right .nav-torneo-vivo { max-width: 190px; margin-right: 2px; order: -1; }
/* La versión corta (pedida por PINGU): donde el chip con el nombre no
   cabe, esconderlo en el menú era perderlo — un torneo EN JUEGO se tiene
   que ver siempre. Se queda en la propia barra, primero del bloque de la
   derecha (entre el logo y la lupa), pequeño y con la ACCIÓN en vez del
   nombre: «Jugar».

   Y manda ÉL por defecto (tanda 320). Antes el del nombre salía desde
   860 px y ahí no cabe ni de lejos. MEDIDO: con el nombre, la barra pide
   1.282 px (logo 126 + enlaces 496 + los seis iconos y el chip 548 +
   relleno y huecos 112), y con los redondeos del navegador no queda limpio hasta los 1.340, que
   es donde se pone el corte: medido, no elegido.
   Se invierte la regla —corto por defecto, largo solo cuando sobra
   sitio— porque así el caso que se sale es el que hay que declarar, no
   el que hay que recordar. */
.nav-torneo-mini { padding: 4px 10px; font-size: var(--t-xs); gap: 4px; max-width: none; }
.nav-right .nav-torneo-vivo:not(.nav-torneo-mini) { display: none; }
@media (min-width: 1340px) {
  .nav-right .nav-torneo-vivo:not(.nav-torneo-mini) { display: inline-flex; }
  .nav-right .nav-torneo-mini { display: none; }
}
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

  const destino = `href="/torneo?slug=${encodeURIComponent(torneo.slug)}" title="Torneo en juego — ir a tu mesa"`
  // Dos chips, uno visible por tamaño de pantalla: en escritorio el
  // nombre del torneo; en móvil la versión mini con «Jugar» (el CSS de
  // arriba decide cuál se ve). Van a la derecha de la barra, pegados a
  // la llamita de la racha (que también se antepone a .nav-right: llegue
  // quien llegue primero, quedan juntos).
  const enlace =
    `<a class="nav-torneo-vivo" ${destino}>${icons.zap(14)}<span class="nav-torneo-nombre">${escapeHtml(torneo.name)}</span></a>` +
    `<a class="nav-torneo-vivo nav-torneo-mini" ${destino}>${icons.zap(12)} Jugar</a>`
  const derecha = document.querySelector('.nav-right')
  if (derecha) {
    const racha = derecha.querySelector('.nav-racha')
    if (racha) racha.insertAdjacentHTML('beforebegin', enlace)
    else derecha.insertAdjacentHTML('afterbegin', enlace)
  }
}
