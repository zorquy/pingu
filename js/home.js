import { supabase } from './supabase.js'
import { conVueltaAtrasDeTipo } from './articulos.js'
import { escapeHtml, getSession, getProfile, avatarStyle, getInitial } from './app.js'
import { icons } from './icons.js'
import { montarPrimerosPasos } from './primeros-pasos.js'
import { vistaVigilada, leerVista, claveDeVista } from './ultima-vista.js'
import { hojaInyectada } from './hoja.js'


async function loadHeroGuideCount() {
  const el = document.getElementById('heroStatGuides')
  if (!el) return
  // El contador dice «N guías», así que cuenta guías: una noticia no es
  // una guía por mucho que comparta tabla. Con vuelta atrás, porque si la
  // consulta falla el contador enseña un 0 —y un «0 guías» en la portada
  // es peor que un número un poco de más.
  const contar = (filtrar) => {
    let q = supabase.from('guides').select('*', { count: 'exact', head: true }).not('published_at', 'is', null)
    return filtrar ? q.eq('kind', 'guide') : q
  }
  const { count } = await conVueltaAtrasDeTipo(() => contar(true), () => contar(false))
  el.textContent = count || 0
}

// Los números del panel: cuánta gente hay y cuántas cartas tiene el
// catálogo. Si algo falla se quedan los guiones del HTML — mejor un guion
// que un cero mentiroso.
//
// El segundo era «mensajes esta semana» hasta la tanda 362. Un dato en
// vivo que puede salir bajo es prueba social EN CONTRA: con 105 mensajes
// en todo el foro, «3 esta semana» le dice a quien llega que aquí no hay
// nadie. El catálogo solo sube, y es lo único de este panel que ninguna
// otra web española tiene.
async function cargarNumerosComunidad() {
  const elMiembros = document.getElementById('heroStatMiembros')
  const elCartas = document.getElementById('heroStatCartas')
  if (!elMiembros && !elCartas) return
  try {
    const [{ count: miembros }, { count: cartas }] = await Promise.all([
      supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
      supabase.from('tcg_cards').select('id', { count: 'exact', head: true }).eq('market', 'WEST'),
    ])
    if (elMiembros && miembros != null) elMiembros.textContent = miembros
    // Con separador de miles: «21356» se lee como un número de serie y
    // «21.356» se lee como una cifra.
    if (elCartas && cartas != null) elCartas.textContent = cartas.toLocaleString('es-ES', { useGrouping: 'always' })
  } catch {}
}

// El sitio de las imágenes de carta. Es COPIA de `ASSETS` en
// `js/carta-ruta.js`, y la copia es a propósito: importar aquel módulo
// mete su peso en la portada, que va al límite de los 170 KB, por UNA
// cadena. Una copia sin vigilar se separa, así que la compara
// test-tanda-362.mjs — la misma norma que `IDIOMA_POR_MERCADO` (322).
// Lo que vale tu colección, tapado si lo tapaste en Mi colección (992): la
// misma marca en <html>, y hoy.css pone los asteriscos.
try { if (localStorage.getItem('pokedoc-valor-oculto') === '1') document.documentElement.classList.add('mc-valor-oculto') } catch {}

const ASSETS_CARTAS = 'https://assets.tcgdex.net'

// ── Las tres cartas del héroe, de verdad (tanda 362) ──
//
// El panel dibujaba tres rectángulos de color con CSS. Se hizo cuando no
// había catálogo; ahora hay 21.000 fichas con su escaneo, y tres cartas
// REALES del set más nuevo cambian la primera impresión de la portada
// por completo.
//
// Los rectángulos se quedan: son el hueco reservado y el respaldo. Si la
// consulta falla, si la CDN no contesta o si el set nuevo todavía no
// tiene imágenes, la portada se ve exactamente como antes — y no se
// mueve nada de sitio, porque la foto va DENTRO del rectángulo que ya
// estaba.
async function cartasDelHeroe() {
  const marcos = document.querySelectorAll('.card-stack .tcg-card')
  if (!marcos.length) return
  try {
    // En dos pasos y no con un `order` sobre la tabla embebida: PostgREST
    // se come el `nullslast` ahí y ordenaría por los sets sin fecha
    // (tanda 322).
    //
    // Y se pide CON código de TCG Live, que hace dos cosas de una: son
    // los sets con los que juega la gente, y de paso deja fuera los de
    // Pokémon TCG Pocket sin tener que arrastrar `esDelTCG` hasta la
    // portada — que son 26 páginas bajándose un módulo por un filtro.
    const { data: sets } = await supabase
      .from('tcg_sets')
      .select('id')
      .eq('market', 'WEST')
      .not('release_date', 'is', null)
      .not('tcg_online_code', 'is', null)
      .order('release_date', { ascending: false })
      .limit(1)
    const set = (sets || [])[0]
    if (!set) return

    const { data: cartas } = await supabase
      .from('tcg_cards')
      .select('image_path')
      .eq('market', 'WEST')
      .eq('set_id', set.id)
      .not('image_path', 'is', null)
      .order('local_id')
      .limit(marcos.length)
    const fotos = (cartas || []).map((c) => (c.image_path ? `${ASSETS_CARTAS}/en/${c.image_path}/low.webp` : null)).filter(Boolean)
    if (!fotos.length) return

    marcos.forEach((marco, i) => {
      const url = fotos[i % fotos.length]
      if (!url || marco.querySelector('img')) return
      const img = document.createElement('img')
      img.className = 'tcg-card-foto'
      img.loading = 'lazy'
      img.decoding = 'async'
      img.alt = ''
      // Si la imagen no llega, se quita y queda el rectángulo de siempre.
      img.addEventListener('error', () => img.remove())
      img.src = url
      marco.appendChild(img)
    })
  } catch {}
}

// Los bloques de la portada nacen VISIBLES con un esqueleto dentro
// (index.html) para que el hueco esté reservado desde el primer pintado:
// antes nacían con display:none y al llegar los datos empujaban todo lo
// de abajo — el «layout shift» que PageSpeed penalizaba. La contrapartida
// es que ahora el camino de «no hay datos» tiene que RECOGER la sección,
// que si no el esqueleto se queda ahí girando para siempre.
function recogerSeccion(id) {
  const s = document.getElementById(id)
  if (!s) return
  s.style.display = 'none'
  // La marca deja dicho POR QUÉ está escondida: no la ha escondido nadie
  // a mano, es que no había datos que pintar. La usaba una regla de CSS
  // que encogía la fila de «hoy» cuando le faltaba un hijo; esa fila ya
  // no existe (tanda 368), así que hoy no la mira nadie. Se conserva
  // porque cuesta nada y es lo que distingue «recogida» de «oculta», que
  // es justo lo que hará falta el día que alguien vuelva a colocar estas
  // secciones. Mirar el `display` en línea desde CSS sería posible, pero
  // se rompería en cuanto alguien la escondiera de otra forma.
  s.classList.add('seccion-recogida')
}

// ── El próximo torneo, en la portada (tanda 255) ──
//
// La sección «Jugar» se abrió a todo el mundo el 2026-09-02 y la portada
// no decía ni una palabra de ella: quien entraba en pokedoc.es solo se
// enteraba de que hay torneos si abría el menú. Es la novedad más grande
// de la web y estaba escondida detrás de un clic.
//
// Se enseña UNO: el que antes se juega de los que tienen las
// inscripciones abiertas. Dos torneos en la portada ya es una lista, y
// una lista pide una página — que es /torneos, y está a un clic.
//
// Si no hay ninguno abierto, la sección se recoge y la portada queda
// exactamente como estaba. Sin torneos que ofrecer, un hueco que diga
// «no hay torneos» solo ocupa sitio.

async function cargarTorneoPortada() {
  const seccion = document.getElementById('torneoPortadaSeccion')
  const hueco = document.getElementById('torneoPortada')
  if (!seccion || !hueco) return
  try {
    const { data } = await supabase
      .from('tournaments')
      .select('id, slug, name, start_at, max_players')
      .eq('status', 'registration_open')
      .gte('start_at', new Date().toISOString())
      .order('start_at', { ascending: true })
      .limit(1)
    const torneo = (data || [])[0]
    if (!torneo) return recogerSeccion('torneoPortadaSeccion')

    // Las plazas, solo si hay aforo. Es una consulta de CUENTA (head),
    // así que no se trae ninguna fila — y solo se hace cuando hay un
    // torneo que enseñar.
    let plazas = ''
    if (torneo.max_players != null) {
      const { count } = await supabase
        .from('tournament_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('tournament_id', torneo.id)
        .eq('status', 'active')
      const libres = Math.max(0, torneo.max_players - (count ?? 0))
      plazas = libres === 0 ? ' · sin plazas libres' : libres === 1 ? ' · queda 1 plaza' : ` · quedan ${libres} plazas`
    }

    // De fila fina gris a tarjeta con fecha (tanda 300): un torneo es
    // una CITA, y de una cita lo primero que se mira es el día. El
    // recuadro de la fecha es lo que la distingue del resto de enlaces
    // de la portada de un vistazo.
    const dia = new Date(torneo.start_at)
    const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
    hueco.innerHTML = `
      <a class="portada-torneo" href="/torneo?slug=${encodeURIComponent(torneo.slug)}">
        <span class="portada-torneo-fecha">
          <b>${dia.getDate()}</b>
          <span>${MESES[dia.getMonth()]}</span>
        </span>
        <span class="portada-torneo-cuerpo">
          <strong>${escapeHtml(torneo.name)}</strong>
          <small>${escapeHtml(cuandoSeJuega(torneo.start_at))}${escapeHtml(plazas)}</small>
        </span>
        <span class="portada-torneo-boton">Apuntarme</span>
      </a>`
    seccion.style.display = ''
  } catch {
    recogerSeccion('torneoPortadaSeccion')
  }
}

// «hoy a las 19:00», «mañana a las 19:00», «el viernes 4 de septiembre».
// Lo cercano se dice en relativo porque es lo que uno necesita saber
// —¿me da tiempo?—; a partir de una semana, la fecha a secas.
function cuandoSeJuega(iso) {
  const cuando = new Date(iso)
  if (Number.isNaN(cuando.getTime())) return 'Próximamente'
  const hora = cuando.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const dia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dias = Math.round((dia(cuando) - dia(new Date())) / 86400_000)
  if (dias <= 0) return `Hoy a las ${hora}`
  if (dias === 1) return `Mañana a las ${hora}`
  if (dias < 7) return `El ${cuando.toLocaleDateString('es-ES', { weekday: 'long' })} a las ${hora}`
  return cuando.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
}

// ── La bienvenida del miembro ──
//
// Con sesión, el hero de marketing sobra: quien entra cada día no
// necesita que le expliquen qué es PokeDoc. En su lugar, una barra
// compacta con su nombre, su racha y su nivel — y la portada útil
// (reto, top del mes, foro) queda una pantalla más arriba.
async function cargarBienvenida(session) {
  // El script del <head> pudo dejar la portada del miembro pintada por
  // un token guardado; si la sesión no vale (caducada, cerrada en otro
  // sitio), se retira la clase y vuelve el hero del visitante.
  if (!session) return document.documentElement.classList.remove('con-sesion')
  // Con sesión el héroe no se ve (la clase `con-sesion` del <head> lo
  // esconde desde el primer pintado): sus cinco consultas se piden solo si
  // la sesión no vale y el héroe vuelve (1017).
  const seccion = document.getElementById('bienvenidaSeccion')
  const hueco = document.getElementById('bienvenida')
  if (!seccion || !hueco) return
  // Lo de hoy se baja ya, mientras llega el perfil (983).
  const hoyMod = import('./hoy.js')
  hoyMod.catch(() => {})
  try {
    // sin rango: el «Hola, X» es TEXTO, no un enlace al perfil. Es el perfil
    // que ya pidió la barra (983), entero: con los escudos de la racha, que
    // antes iban en otra consulta detrás (sin la migración del protector la
    // columna no viene y son cero).
    const profile = await getProfile(session.user.id)
    if (!profile) {
      document.documentElement.classList.remove('con-sesion')
      return pintarHeroe()
    }

    const nombre = profile.display_name || profile.username || ''
    // En el PC la racha ya va en la barra de arriba (780, LO6): aquí, solo en el móvil.
    const racha = profile.current_streak || 0
    const escudos = profile.streak_shields || 0
    // Y el aviso de «te ha salvado»: lo deja checkDailyStreak en
    // sessionStorage al gastarse el escudo; se enseña una vez y fuera.
    let salvada = false
    try {
      salvada = sessionStorage.getItem('pokedoc-racha-protegida') === '1'
      if (salvada) sessionStorage.removeItem('pokedoc-racha-protegida')
    } catch {}

    // El saludo de su maqueta (748, J5): el día y «Buenos días» en grande,
    // la racha a la derecha. El avatar, el nivel y «Tu perfil» viven en la
    // hoja «Tú», a un toque.
    const h = new Date().getHours()
    hueco.innerHTML = `
      <div class="bienvenida-texto">
        <small>${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</small>
        <strong>${h >= 6 && h < 14 ? 'Buenos días' : h >= 14 && h < 21 ? 'Buenas tardes' : 'Buenas noches'}${nombre ? `, ${escapeHtml(nombre)}` : ''}</strong>
      </div>
      <div class="bienvenida-chips">
        ${racha > 0 && matchMedia('(max-width: 900px)').matches ? `<span class="bienvenida-chip" title="Días seguidos">${icons.flame(16)} ${racha}</span>` : ''}
        ${escudos > 0 ? `<span class="bienvenida-chip bienvenida-escudo" title="Protectores de racha: si un día no entras, uno se gasta solo y la racha sigue">${icons.shield(14)} ${escudos}</span>` : ''}
        ${salvada ? `<span class="bienvenida-chip bienvenida-salvada">${icons.shield(14)} Tu protector salvó la racha</span>` : ''}
      </div>`
    // El hero se esconde SOLO cuando la bienvenida está lista: si algo
    // de arriba fallara, la portada de siempre sigue entera. La clase
    // del body compacta el aire de arriba: los 76px de .page-content
    // están pensados para el hero de marketing, y con la bienvenida
    // como primer bloque sobraban (se notaba sobre todo en móvil).
    document.querySelector('.hero')?.style.setProperty('display', 'none')
    document.body.classList.add('portada-compacta')
    document.documentElement.classList.add('con-sesion')
    seccion.style.display = ''
    // Lo de hoy, debajo del saludo (SCHEMA 744).
    hoyMod.then((m) => m.montarHoy(session)).catch(() => {})
  } catch {}
}

function setupModals() {
  document.getElementById('btnWhatIsPokeDoc')?.addEventListener('click', () => {
    document.getElementById('whatIsModal').classList.remove('hidden')
  })
  document.getElementById('whatIsModalClose')?.addEventListener('click', () => {
    document.getElementById('whatIsModal').classList.add('hidden')
  })
  document.getElementById('whatIsModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'whatIsModal') e.target.classList.add('hidden')
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.getElementById('whatIsModal')?.classList.add('hidden')
  })
}

// Lo de la última vez (984): la portada del miembro sale ya con lo que
// tenía, bloque a bloque, y cada bloque se cambia al llegar lo suyo. «Hoy»
// no está en el HTML (lo pone hoy.js): su caja se crea aquí, para pintarla
// de lo guardado —con su hoja, o sale sin estilo— y para vigilarla.
function pintarPortadaGuardada(session) {
  const clave = claveDeVista('portada', session.user.id)
  const seccion = document.getElementById('bienvenidaSeccion')
  if (seccion && !document.getElementById('hoyPortada')) {
    const caja = document.createElement('div')
    caja.className = 'hoy'
    caja.id = 'hoyPortada'
    caja.dataset.uv = ''
    caja.setAttribute('aria-label', 'Hoy')
    if (leerVista(clave)?.partes?.hoyPortada) {
      caja.style.visibility = 'hidden'
      hojaInyectada('css/hoy.css').then(() => caja.style.removeProperty('visibility'))
    }
    seccion.appendChild(caja)
  }
  vistaVigilada(clave, ['bienvenida', 'hoyPortada', 'foroVivo', 'aprende', 'torneoPortada', 'lanzamientoPortada', 'noticiaPortada', 'retoTarjetas', 'clasificacion'])
}

// Lo que pinta el héroe del visitante: la cuenta de guías, los números de
// la comunidad y las tres cartas. Con sesión no se pide (1017).
const pintarHeroe = () => Promise.all([loadHeroGuideCount(), cargarNumerosComunidad(), cartasDelHeroe()])

async function init() {
  setupModals()
  const session = await getSession()
  if (session) pintarPortadaGuardada(session)

  if (!session) {
    document.getElementById('signupBanner').style.display = 'block'
    // Las tres que más suben, en el hero (785, PA3). Después de las del set
    // más nuevo, que ya están puestas: si estas no llegan, se quedan aquellas.
    import('./escaparate.js').then(({ pintarEscaparate }) => pintarEscaparate()).catch(() => {})
  }

  // El foro, «Aprende», las noticias, la clasificación y la comunidad los
  // pinta js/portada-bloques.js (844), que entra por import() al final.
  await Promise.all([
    session ? null : pintarHeroe(),
    cargarTorneoPortada(),
    cargarBienvenida(session),
    montarPrimerosPasos(document.getElementById('primerosPasos'), session),
  ])
}

init()

// ── El reto del día y el repaso ──
//
// Es lo que da motivo para volver mañana: cinco preguntas nuevas cada
// día, las mismas para todo el mundo, y las que fallaste esperándote
// unos días después.
//
// Se pinta sin bloquear el resto de la home y se calla si algo falla:
// mientras la migración de los cursos no esté aplicada, estas dos
// tarjetas simplemente no aparecen.
// El reto, de fila a HÉROE (tanda 299)
//
// Era una fila fina más entre otras cuatro iguales: mismo alto, mismo
// icono a la izquierda, misma flechita. Lo que más engancha de la web
// tenía exactamente el mismo peso visual que un atajo al editor de
// guías. Ahora abre la portada, en grande, con los cinco puntos del reto
// de hoy a la vista: cinco huecos vacíos se leen como una invitación, y
// tres de cinco encendidos, como algo que mejorar mañana.
//
// Los puntos se pintan con <span> y no con un icono: son un contador,
// no un dibujo, y así el que no ha jugado ve la forma del reto —cinco,
// ni tres ni diez— antes de pulsar.
function puntosHtml(aciertos, total) {
  let html = ''
  for (let i = 0; i < total; i++) html += `<span class="reto-punto${i < aciertos ? ' acertado' : ''}"></span>`
  return `<span class="reto-puntos" aria-hidden="true">${html}</span>`
}

// Las tres caras del héroe comparten molde. Va de <div> y con el botón
// dentro, nunca de <a> envolviéndolo todo: la línea del repaso es OTRO
// enlace, y un enlace dentro de otro ni es HTML válido ni se puede
// pulsar (el navegador cierra el de fuera y la caja se descoloca).
function heroeReto({ rotulo, titular, sub, puntos, boton, repaso, hecho }) {
  return `
  <div class="reto-hoy${hecho ? ' reto-hoy-hecha' : ''}">
    <span class="reto-hoy-rotulo">${icons.flame(16)} ${rotulo}</span>
    <strong class="reto-hoy-titular">${titular}</strong>
    ${puntos}
    <small class="reto-hoy-sub">${sub}</small>
    ${boton || ''}
    ${repaso || ''}
  </div>`
}

async function cargarReto() {
  const seccion = document.getElementById('retoSeccion')
  if (!seccion) return

  const session = await getSession()

  // Al visitante también se le enseña el reto: es la mecánica más
  // enganchosa de la web y estaba escondida detrás de la sesión. El clic
  // lleva al registro — el gancho de volver mañana empieza a trabajar
  // antes de que exista la cuenta.
  if (!session) {
    // Los seis retos (989: el cuestionario de cinco preguntas ya no está).
    document.getElementById('retoTarjetas').innerHTML = heroeReto({
      rotulo: 'Retos de hoy',
      titular: 'Seis retos al día',
      puntos: puntosHtml(0, 6),
      sub: 'Los mismos para todo el mundo. Se juegan en un minuto y suman XP.',
      boton: '<a class="btn-primary reto-hoy-boton" href="/retos">Jugar →</a>',
    })
    seccion.style.display = ''
    return
  }

  // Los seis retos de hoy (843): el bloque habla de todos, y lleva al
  // siguiente que te falta. El repaso de preguntas sigue de segunda línea.
  // Lo de hoy llega de una vez con `portada_hoy()` (1017, `datosDeHoy`, que
  // hoy.js ya ha pedido); sin la migración, las tres consultas de antes.
  const [retos, { cuantasParaRepasar }, hoyMod] = await Promise.all([import('./portada-retos.js'), import('./curso-datos.js'), import('./hoy.js').catch(() => null)])
  const datos = hoyMod ? await hoyMod.datosDeHoy(session.user.id) : null
  const [estado, porRepasar, comunidad] = await Promise.all([
    retos.estadoDeHoy(session.user.id, datos ? datos.retos ?? null : undefined),
    datos ? Number(datos.repaso) || 0 : cuantasParaRepasar(session.user.id).catch(() => 0),
    datos ? datos.comunidad || null : retos.comunidadDeHoy().catch(() => null),
  ])
  const repaso =
    porRepasar > 0
      ? `<a class="reto-hoy-repaso tr-repaso" href="/curso.html?reto=repaso">
           ${icons.refreshCw(15)} ${porRepasar} ${porRepasar === 1 ? 'pregunta' : 'preguntas'} por repasar
         </a>`
      : ''
  if (!estado) {
    document.getElementById('retoTarjetas').innerHTML = heroeReto({
      rotulo: 'Retos de hoy',
      titular: 'Seis retos al día',
      puntos: '',
      sub: 'Cartas, precios, siluetas y parejas. Cada uno suma XP.',
      boton: '<a class="btn-primary reto-hoy-boton" href="/retos">Ver los retos →</a>',
      repaso,
    })
  } else {
    await retos.hoja
    document.getElementById('retoTarjetas').innerHTML = retos.bloqueRetosHtml(estado, comunidad, repaso, (p) => {
      const nombre = p?.display_name || p?.username || '?'
      return `<span class="tr-cara" style="${avatarStyle(p)}" title="${escapeHtml(nombre)}">${p?.avatar_url ? '' : escapeHtml(getInitial(nombre))}</span>`
    })
  }
  seccion.style.display = ''
}
cargarReto().catch(() => recogerSeccion('retoSeccion'))


// ── El próximo lanzamiento ──
//
// La miniatura de /lanzamientos: el siguiente set y cuántos días
// faltan. La cuenta va EN LÍNEA a propósito: importar
// js/lanzamientos.js metería el módulo entero en el grafo de la
// portada, y el presupuesto de peso (test-carga) anda justo.
async function cargarLanzamiento() {
  const seccion = document.getElementById('lanzamientoSeccion')
  const hueco = document.getElementById('lanzamientoPortada')
  if (!seccion || !hueco) return
  // Con cuenta, el próximo lanzamiento ya sale en las fichas de «Hoy», y aquí
  // iba repetido; en su sitio, que se puede escribir una guía (1010: la gente
  // nueva solo veía guías y no sabía que podía escribirlas).
  if (await getSession().catch(() => null)) {
    hueco.href = '/editor-guia.html'
    hueco.innerHTML = `<span class="lanzamiento-portada-icono">${icons.edit(18)}</span>
      <span class="lanzamiento-portada-texto"><strong>Escribe una guía</strong><span class="subtext">Cualquiera puede: la revisamos y sale en Aprender</span></span>
      <span class="reto-flecha">→</span>`
    seccion.style.display = ''
    return
  }
  try {
    const hoy = new Date().toISOString().slice(0, 10)
    // Del CATÁLOGO (656): el primer set occidental con fecha de hoy en
    // adelante (sin Pocket, que no es el TCG), y la lista a mano por si hay
    // un anuncio que TCGGO aún no tiene. Gana el que salga antes.
    const [{ data: sets }, { data }] = await Promise.all([
      supabase.from('tcg_sets').select('name,name_en,release_date,logo_tcggo,logo_scrydex,oculto,tcggo_id').eq('market', 'WEST').neq('serie_id', 'tcgp').gte('release_date', hoy).order('release_date').limit(5),
      supabase.from('site_settings').select('value').eq('key', 'lanzamientos').maybeSingle(),
    ])
    const delCatalogo = (sets || []).filter((s) => (!s.oculto || s.tcggo_id) && s.release_date).map((s) => ({ nombre: s.name || s.name_en, fecha: String(s.release_date).slice(0, 10), imagen: s.logo_scrydex || s.logo_tcggo || '' }))
    const proximo = [...delCatalogo, ...(data?.value?.sets || [])]
      .filter((s) => s && s.nombre && /^\d{4}-\d{2}-\d{2}$/.test(s.fecha || '') && s.fecha >= hoy)
      .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))[0]
    if (!proximo) return recogerSeccion('lanzamientoSeccion')
    const dias = Math.round((Date.parse(`${proximo.fecha}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) / 86400_000)
    const cuenta = dias === 0 ? '¡Sale hoy!' : dias === 1 ? 'Sale mañana' : `Faltan ${dias} días`
    // Con logo, el logo va a la IZQUIERDA (donde el icono) y el texto al
    // lado; si no carga, el onerror deja el nombre (replaceWith con
    // string inserta texto plano, es seguro).
    hueco.innerHTML = `
      ${
        proximo.imagen
          ? `<img loading="lazy" class="lanzamiento-portada-logo" src="${escapeHtml(proximo.imagen)}" alt="${escapeHtml(proximo.nombre)}" decoding="async" referrerpolicy="no-referrer" onerror="this.replaceWith(this.alt)" />`
          : `<span class="lanzamiento-portada-icono">${icons.calendar(18)}</span>`
      }
      <span class="lanzamiento-portada-texto">
        ${proximo.imagen ? '' : `<strong>${escapeHtml(proximo.nombre)}</strong>`}
        <span class="subtext">${cuenta} · ver el calendario</span>
      </span>
      <span class="reto-flecha">→</span>`
    seccion.style.display = ''
  } catch {
    recogerSeccion('lanzamientoSeccion')
  }
}
cargarLanzamiento().catch(() => recogerSeccion('lanzamientoSeccion'))

// Si el módulo no llega, los huecos se recogen: un esqueleto girando para
// siempre no dice nada.
getSession()
  .then((s) => import('./portada-bloques.js').then((m) => m.montarPortada(s)))
  .catch(() => ['foroVivoSeccion', 'recientesSeccion', 'noticiaPortadaSeccion', 'clasificacionSeccion'].forEach(recogerSeccion))
