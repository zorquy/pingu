import { supabase } from './supabase.js'
import { escapeHtml, getSession, burstConfetti, guideHasReference } from './app.js'
import { markCourseStarted, markCourseCompleted, addXP, incrementQuizCorrect } from './gamification.js'
import { parseBBCode } from './bbcode.js'
import { showToast } from './toast.js'
import { icons } from './icons.js'
import { contentIconHtml } from './content-icon.js'
import { cardsByIds, cardImageUrl } from './tcgdex.js'
import { MOSTRAR_PLANES } from './planes.js'
import {
  esPractica,
  claveDePregunta,
  nuevaPartida,
  anotarRespuesta,
  cerrarPartida,
  multiplicadorDe,
  xpPorMejoraDeMedalla,
  MEDALLAS,
  BONUS_PERFECTO,
} from './curso-juego.js'
import {
  preguntasDelDia,
  preguntasDeRepaso,
  yaJugadoHoy,
  guardarReto,
  XP_RETO_DIARIO,
  XP_POR_RECUPERADA,
} from './reto-diario.js'
import { sonar, vibrar, estallido, comboGrande, silenciado, alternarSilencio } from './curso-estimulos.js'
import {
  registrarRespuesta,
  estadisticasDelCurso,
  guardarPartida,
  mejorPartida,
  clasificacionDeCurso,
  haJugadoAntes,
  apuntarParaRepasar,
  quitarDelRepaso,
} from './curso-datos.js'

// La lista que se juega. Empieza siendo una copia de `guide.blocks`, y
// crece: cada pregunta fallada se vuelve a meter justo antes de la
// pantalla final, para que la repases antes de terminar. Ese reencolado
// es lo que convierte el curso en práctica en vez de en un examen que
// pasas de largo.
let secuencia = []
let currentIndex = 0
let guide = null
let session = null
let categorySlug = null
let partida = null
let estadisticas = {}
let empezadoEn = 0
let esPrimeraPartida = true
let mejorAnterior = null
// El resumen que se calcula al pintar la pantalla final. Se guarda
// porque `cerrarPartida()` suma el bonus de partida perfecta, y llamarla
// dos veces lo sumaría dos veces.
let ultimoResumen = null
// 'curso' | 'diario' | 'repaso'. El reto diario y el repaso son la misma
// partida que un curso —marcador, racha, medalla— pero con las preguntas
// sacadas de otro sitio y guardadas en otra tabla. Todo lo demás del
// motor es igual, así que no hay una segunda página que mantener.
let modo = 'curso'

const stage = document.getElementById('cursoStage')
const progressFill = document.getElementById('progressFill')
const btnContinue = document.getElementById('btnContinue')
const btnBack = document.getElementById('btnBack')
const btnPrevious = document.getElementById('btnPrevious')
const hud = document.getElementById('cursoHud')
const hudPuntos = document.getElementById('hudPuntos')
const hudRacha = document.getElementById('hudRacha')

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function updateProgress() {
  const pct = secuencia.length > 1 ? (currentIndex / (secuencia.length - 1)) * 100 : 100
  progressFill.style.width = `${pct}%`
}

// ── El marcador ──

function pintarHud() {
  if (!partida) return
  hud.classList.remove('hidden')
  hudPuntos.textContent = partida.puntos

  const mult = multiplicadorDe(partida.racha)
  if (partida.racha >= 2) {
    hudRacha.classList.remove('hidden')
    hudRacha.innerHTML = `${icons.flame(15)} ${partida.racha}${mult > 1 ? ` <b>×${mult}</b>` : ''}`
    hudRacha.classList.toggle('hud-racha-fuerte', mult > 1)
  } else {
    hudRacha.classList.add('hidden')
  }
}

function celebrarPuntos(ganados) {
  if (!ganados) return
  const globo = document.createElement('span')
  globo.className = 'hud-suma'
  globo.textContent = `+${ganados}`
  hud.appendChild(globo)
  globo.addEventListener('animationend', () => globo.remove())
  hudPuntos.classList.remove('hud-late')
  // Reiniciar la animación: sin este reflow, dos aciertos seguidos solo
  // la lanzan la primera vez (la clase nunca llega a quitarse del todo).
  void hudPuntos.offsetWidth
  hudPuntos.classList.add('hud-late')
}

async function persistIndex(index) {
  // `guide` es null en el reto diario y en el repaso: ahí no hay un
  // curso cuya posición guardar. Sin esta salida, cada "Continuar"
  // lanzaba un error (leer `id` de null) que no se veía en pantalla pero
  // llenaba la consola y abortaba la promesa a medias.
  if (!session || !guide) return
  await supabase
    .from('user_progress')
    .update({ current_block: index })
    .eq('user_id', session.user.id)
    .eq('guide_id', guide.id)
}

function renderHook(b) {
  return `
    <div class="block block-hook">
      <span class="block-emoji">${contentIconHtml(b.emoji, 34, 'sparkles')}</span>
      <h1 class="block-headline">${escapeHtml(b.headline || '')}</h1>
      <p class="block-subtext">${parseBBCode(b.subtext || '')}</p>
    </div>`
}

function renderConceptLike(b, extraClass, label) {
  return `
    <div class="block ${extraClass}">
      <div class="block-header">
        <span>${b.emoji ? contentIconHtml(b.emoji, 20, 'lightbulb') : ''}</span>
        <span class="block-label">${label}</span>
      </div>
      ${b.image_url ? `<img src="${escapeHtml(b.image_url)}" class="block-image" onerror="this.style.display='none'">` : ''}
      <h2 class="block-title">${escapeHtml(b.title || '')}</h2>
      <p class="block-body">${parseBBCode(b.body || '')}</p>
      ${b.highlight ? `<div class="block-highlight">${parseBBCode(b.highlight)}</div>` : ''}
    </div>`
}

// La cabecera de una pregunta dice lo que vale AHORA MISMO, no un "+5 XP"
// fijo. Ver "+20 ×2" antes de responder es media gracia del asunto: la
// racha solo tira si la ves antes de jugártela.
function cabeceraPractica(texto, b) {
  if (b.__repesca) {
    return `
      <div class="block-header quiz-header">
        <span class="block-label">${texto}</span>
        <span class="block-vale block-vale-repesca">REPESCA</span>
      </div>`
  }
  const mult = multiplicadorDe(partida ? partida.racha : 0)
  return `
    <div class="block-header quiz-header">
      <span class="block-label">${texto}</span>
      <span class="block-vale${mult > 1 ? ' block-vale-fuerte' : ''}">+${10 * mult}${mult > 1 ? ` ×${mult}` : ''}</span>
    </div>`
}

function renderQuiz(b) {
  const options = (b.options || [])
    .map((opt, i) => `<button class="quiz-option" data-index="${i}">${escapeHtml(opt)}</button>`)
    .join('')
  return `
    <div class="block block-quiz">
      ${cabeceraPractica('PREGUNTA', b)}
      <h2 class="block-question">${escapeHtml(b.question || '')}</h2>
      <div class="quiz-options">${options}</div>
      <div class="quiz-explanation hidden">${escapeHtml(b.explanation || '')}</div>
    </div>`
}

function renderTrueFalse(b) {
  return `
    <div class="block block-quiz block-truefalse">
      ${cabeceraPractica('¿VERDADERO O FALSO?', b)}
      <h2 class="block-question">${escapeHtml(b.statement || '')}</h2>
      <div class="tf-options">
        <button class="tf-option" data-value="true">${icons.checkCircle(16)} Verdadero</button>
        <button class="tf-option" data-value="false">${icons.xCircle(16)} Falso</button>
      </div>
      <div class="quiz-explanation hidden">${escapeHtml(b.explanation || '')}</div>
    </div>`
}

function renderFillBlank(b) {
  const options = (b.options || [])
    .map((opt) => `<button class="fillblank-option" data-value="${escapeHtml(opt)}">${escapeHtml(opt)}</button>`)
    .join('')
  return `
    <div class="block block-quiz block-fillblank">
      ${cabeceraPractica('RELLENA EL HUECO', b)}
      <p class="fillblank-sentence">
        ${escapeHtml(b.before || '')} <span class="fillblank-slot" id="fillblankSlot">＿＿＿＿</span> ${escapeHtml(b.after || '')}
      </p>
      <div class="fillblank-options">${options}</div>
      <div class="quiz-explanation hidden">${escapeHtml(b.explanation || '')}</div>
    </div>`
}

function renderMatch(b) {
  const pairs = b.pairs || []
  const lefts = pairs.map((p, i) => ({ text: p.left, i }))
  const rights = shuffle(pairs.map((p, i) => ({ text: p.right, i })))
  const leftHtml = lefts.map((l) => `<button class="match-item" data-side="left" data-pair="${l.i}">${escapeHtml(l.text)}</button>`).join('')
  const rightHtml = rights.map((r) => `<button class="match-item" data-side="right" data-pair="${r.i}">${escapeHtml(r.text)}</button>`).join('')
  return `
    <div class="block block-quiz block-match">
      ${cabeceraPractica('RELACIONA LAS PAREJAS', b)}
      <h2 class="block-question">${escapeHtml(b.title || 'Une cada término con su pareja')}</h2>
      <div class="match-columns">
        <div class="match-col">${leftHtml}</div>
        <div class="match-col">${rightHtml}</div>
      </div>
    </div>`
}

function renderOrder(b) {
  const items = b.items || []
  const bank = shuffle(items.map((text, i) => ({ text, i })))
  const bankHtml = bank.map((item) => `<button class="order-chip" data-index="${item.i}">${escapeHtml(item.text)}</button>`).join('')
  return `
    <div class="block block-quiz block-order">
      ${cabeceraPractica('ORDENA LOS PASOS', b)}
      <h2 class="block-question">${escapeHtml(b.title || 'Toca los pasos en el orden correcto')}</h2>
      <div class="order-answer" id="orderAnswer"></div>
      <div class="order-bank" id="orderBank">${bankHtml}</div>
      <p class="order-feedback hidden" id="orderFeedback">Ese orden no es correcto — quita algún paso y prueba otra vez.</p>
    </div>`
}

// ── Los bloques con cartas de verdad ──
//
// Un test de texto es un examen; una carta en pantalla es un juego. Estos
// tres tipos guardan SOLO identificadores de TCGdex ('swsh3-136'), igual
// que las listas de cartas de las guías: ni imágenes ni nombres. El
// dibujo lo monta esta web leyendo `tcg_cards`, así que si mañana cambia
// el diseño de una carta o se corrige su nombre, cambia en todos los
// cursos ya escritos sin tocar ninguno.
//
// Las cartas se piden al pintar el bloque, no al cargar el curso: no
// tiene sentido bajarse veinte imágenes que a lo mejor no se ven.
const cartasPorId = {}

function cartaJugableHtml(id, extraClass = '', extraAttrs = '') {
  const carta = cartasPorId[id]
  if (!carta) {
    return `<button class="carta-opcion ${extraClass}" data-id="${escapeHtml(id)}" ${extraAttrs}>
      <span class="carta-opcion-noimg">${escapeHtml(id)}</span>
    </button>`
  }
  const src = cardImageUrl(carta.image_path, 'high', carta.market)
  return `<button class="carta-opcion ${extraClass}" data-id="${escapeHtml(id)}" ${extraAttrs} aria-label="${escapeHtml(carta.name)}">
    ${
      src
        ? // Sin reintento en otro idioma: el catálogo es inglés y tiene
          // escaneo de todas las cartas.
          `<img src="${escapeHtml(src)}" alt="${escapeHtml(carta.name)}" loading="lazy"
             onerror="this.onerror=null;this.style.display='none'">`
        : `<span class="carta-opcion-noimg">${escapeHtml(carta.name)}</span>`
    }
  </button>`
}

// Carga las cartas que necesita un bloque y repinta lo que ya está en
// pantalla. Se llama después de meter el HTML: así el bloque aparece al
// instante (con el hueco de la carta) y las imágenes entran cuando
// llegan, en vez de dejar la pantalla en blanco esperando a Supabase.
async function cargarCartasDe(ids, alTerminar) {
  const faltan = [...new Set(ids)].filter((id) => id && !cartasPorId[id])
  if (faltan.length) {
    try {
      const cartas = await cardsByIds(faltan)
      cartas.forEach((c) => {
        cartasPorId[c.id] = c
      })
    } catch {
      // Sin cartas se sigue jugando: el bloque enseña el identificador en
      // vez de la imagen, que es feo pero jugable.
    }
  }
  alTerminar()
}

function renderCartaQuiz(b) {
  const ids = b.card_ids || []
  return `
    <div class="block block-quiz block-cartaquiz">
      ${cabeceraPractica('ELIGE LA CARTA', b)}
      <h2 class="block-question">${escapeHtml(b.question || '¿Cuál es?')}</h2>
      <div class="cartas-opciones" id="cartasOpciones">${ids.map((id) => cartaJugableHtml(id)).join('')}</div>
      <div class="quiz-explanation hidden">${escapeHtml(b.explanation || '')}</div>
    </div>`
}

// "Encuentra el fallo": una imagen grande y tocas la zona. Las zonas se
// guardan en tanto por ciento del ancho y del alto, no en píxeles, para
// que valgan igual en el móvil y en una pantalla de 27 pulgadas.
function renderZonas(b) {
  return `
    <div class="block block-quiz block-zonas">
      ${cabeceraPractica('ENCUENTRA EL FALLO', b)}
      <h2 class="block-question">${escapeHtml(b.question || 'Toca dónde está el fallo')}</h2>
      <div class="zonas-lienzo" id="zonasLienzo">
        ${b.image_url ? `<img src="${escapeHtml(b.image_url)}" alt="" draggable="false">` : '<p class="deck-empty">Falta la imagen de este ejercicio.</p>'}
      </div>
      <div class="quiz-explanation hidden">${escapeHtml(b.explanation || '')}</div>
    </div>`
}

function renderClasifica(b) {
  const cartas = b.cards || []
  const cubos = b.buckets || []
  return `
    <div class="block block-quiz block-clasifica">
      ${cabeceraPractica('CLASIFICA', b)}
      <h2 class="block-question">${escapeHtml(b.title || 'Pon cada carta en su sitio')}</h2>
      <div class="clasifica-mano" id="clasificaMano">
        ${shuffle(cartas).map((c) => cartaJugableHtml(c.id, 'carta-mano')).join('')}
      </div>
      <div class="clasifica-cubos">
        ${cubos
          .map(
            (cubo) => `
          <div class="clasifica-cubo" data-cubo="${escapeHtml(cubo)}">
            <span class="clasifica-cubo-nombre">${escapeHtml(cubo)}</span>
            <div class="clasifica-cubo-contenido"></div>
          </div>`
          )
          .join('')}
      </div>
      <div class="quiz-explanation hidden">${escapeHtml(b.explanation || '')}</div>
    </div>`
}

function renderChecklist(b) {
  const items = (b.items || [])
    .map((item, i) => `
      <li class="checklist-item" data-index="${i}">
        <div class="checkbox"></div>
        <span>${escapeHtml(item)}</span>
      </li>`)
    .join('')
  return `
    <div class="block block-checklist">
      <h2>${escapeHtml(b.title || '')}</h2>
      <ul class="checklist">${items}</ul>
    </div>`
}

const NOMBRE_MEDALLA = { oro: 'Oro', plata: 'Plata', bronce: 'Bronce' }

function medallaHtml(medalla) {
  if (!medalla) {
    return `
      <div class="reward-medalla reward-medalla-ninguna">
        <span class="reward-medalla-icono">${icons.target(40)}</span>
        <strong>Sin medalla todavía</strong>
        <small>Acierta la mitad para el bronce</small>
      </div>`
  }
  return `
    <div class="reward-medalla reward-medalla-${medalla}">
      <span class="reward-medalla-icono">${icons.trophy(40)}</span>
      <strong>Medalla de ${NOMBRE_MEDALLA[medalla]}</strong>
      <small>${medalla === 'oro' ? 'Pleno: no has fallado ni una' : `Llega al ${Math.round(MEDALLAS[medalla === 'bronce' ? 'plata' : 'oro'].minimo * 100)} % para subir`}</small>
    </div>`
}

function renderReward(b) {
  const resumen = cerrarPartida(partida)
  ultimoResumen = resumen

  return `
    <div class="block block-reward">
      <div class="card-stack on-navy" aria-hidden="true">
        <span class="tcg-card c1"></span>
        <span class="tcg-card c2"></span>
        <span class="tcg-card c3"></span>
      </div>
      ${medallaHtml(resumen.medal)}
      <div class="xp-display"><span id="xpCounter">0</span> pts</div>
      <ul class="reward-desglose">
        <li><span>Aciertos</span><strong>${resumen.correct} de ${resumen.total}</strong></li>
        <li><span>Mejor racha</span><strong>${resumen.mejorRacha}</strong></li>
        ${resumen.perfecto ? `<li class="reward-bonus"><span>Partida perfecta</span><strong>+${BONUS_PERFECTO}</strong></li>` : ''}
      </ul>
      <p class="reward-record" id="rewardRecord"></p>
      <p class="reward-xp hidden" id="rewardXp"></p>
      ${!session ? '<p style="color: var(--ice); font-size: 13px;">Crea una cuenta para guardar tu marca y tu XP.</p>' : ''}
      <p class="reward-save-warning hidden" id="rewardSaveWarning"></p>
      <div class="reward-tabla" id="rewardTabla"></div>
      <div class="reward-actions">
        ${
          // Presumir del reto del día: el bucle de Wordle. Un texto listo
          // para pegar en WhatsApp o donde sea, con el enlace al reto —
          // quien lo reciba puede intentar superarte hoy mismo.
          modo === 'diario'
            ? '<button class="btn-primary" id="btnPresumir">🎴 Presumir de resultado</button>'
            : ''
        }
        ${
          // El reto del día se juega una vez y ya: ofrecer "repetir"
          // sería ofrecer algo que la base va a rechazar.
          modo === 'curso' && resumen.medal !== 'oro'
            ? '<button class="btn-primary" id="btnRepetir">Repetir y mejorar la medalla</button>'
            : ''
        }
        ${
          // La vuelta a la teoría. Solo en el curso de una guía —el reto
          // y el repaso mezclan preguntas de varias— y solo si esa guía
          // tiene documentación que leer.
          //
          // Es lo que se pide justo después de fallar algo: "vale, ¿y
          // esto dónde lo explican?". Sin este botón había que volver a
          // buscar la guía por el catálogo.
          modo === 'curso' && guideHasReference(guide)
            ? `<a href="guia.html?slug=${encodeURIComponent(guide.slug)}" class="btn-secondary">${icons.bookOpen(15)} Repasar la teoría</a>`
            : ''
        }
        <a href="aprender.html" class="${modo === 'curso' && resumen.medal !== 'oro' ? 'btn-secondary' : 'btn-primary'}">Seguir explorando →</a>
      </div>
    </div>`
}

// La clasificación del curso: los diez primeros y, si no estás entre
// ellos, tu fila aparte. Un top 10 en el que no sales no dice nada;
// saber que vas el 14º y que el 13º está a 20 puntos, sí.
function tablaHtml(filas, miId) {
  if (!filas.length) return ''
  const top = filas.slice(0, 10)
  const yo = filas.find((f) => f.user_id === miId)
  const salgoArriba = top.some((f) => f.user_id === miId)

  const fila = (f) => `
    <li class="${f.user_id === miId ? 'reward-tabla-yo' : ''}">
      <span class="reward-tabla-pos">${f.posicion}</span>
      <span class="reward-tabla-nombre">${escapeHtml(f.display_name || f.username || 'Alguien')}</span>
      <span class="reward-tabla-pts">${f.score}</span>
    </li>`

  return `
    <h3>Mejores marcas</h3>
    <ol class="reward-tabla-lista">
      ${top.map(fila).join('')}
      ${!salgoArriba && yo ? `<li class="reward-tabla-corte">···</li>${fila(yo)}` : ''}
    </ol>`
}

function getBlockHTML(block) {
  switch (block.type) {
    case 'hook':
      return renderHook(block)
    case 'concept':
      return renderConceptLike(block, 'block-concept', 'CONCEPTO')
    case 'warning':
      return renderConceptLike(block, 'block-warning', 'CUIDADO')
    case 'tip':
      return renderConceptLike(block, 'block-tip', 'CONSEJO')
    case 'example':
      return renderConceptLike(block, 'block-example', 'EJEMPLO')
    case 'quiz':
      return renderQuiz(block)
    case 'truefalse':
      return renderTrueFalse(block)
    case 'fillblank':
      return renderFillBlank(block)
    case 'match':
      return renderMatch(block)
    case 'order':
      return renderOrder(block)
    case 'cartaquiz':
      return renderCartaQuiz(block)
    case 'zonas':
      return renderZonas(block)
    case 'clasifica':
      return renderClasifica(block)
    case 'checklist':
      return renderChecklist(block)
    case 'reward':
      return renderReward(block)
    default:
      return `<div class="block"><p>Bloque desconocido.</p></div>`
  }
}

// El contador de la pantalla final.
//
// Subía de dos en dos cada 30 ms, que con el XP de antes (20-25) duraba
// un suspiro. Ahora la puntuación de una partida buena pasa de 150 y a
// ese ritmo tardaba dos segundos y medio en parar de contar. El paso se
// calcula del total para que siempre dure lo mismo.
const DURACION_CONTADOR_MS = 900

function animateXP(target) {
  const el = document.getElementById('xpCounter')
  if (!el) return
  if (target <= 0) {
    el.textContent = '0'
    return
  }
  const pasos = Math.max(1, Math.round(DURACION_CONTADOR_MS / 30))
  const salto = Math.max(1, Math.ceil(target / pasos))
  let current = 0
  const interval = setInterval(() => {
    current += salto
    if (current >= target) {
      el.textContent = target
      clearInterval(interval)
    } else {
      el.textContent = current
    }
  }, 30)
}

function desbloquearContinuar() {
  btnContinue.disabled = false
  btnContinue.classList.remove('disabled')
}

// Una pregunta fallada vuelve al final del curso, justo antes de la
// pantalla de recompensa. Esto es lo que separa "practicar" de "hacer un
// examen": la que no te sabes te la vuelves a encontrar antes de salir.
function encolarRepesca(block, clave) {
  const yaEncolada = secuencia.some((b) => b.__repesca && claveDePregunta(b) === clave)
  if (yaEncolada) return

  const iRecompensa = secuencia.findIndex((b) => b.type === 'reward')
  // Sin bloque de recompensa la repesca va al final; con él, justo
  // antes. En los dos casos queda por delante de donde estamos, que es
  // lo único que no puede fallar aquí.
  const destino = iRecompensa === -1 ? secuencia.length : iRecompensa
  secuencia.splice(destino, 0, { ...block, __repesca: true })
  updateProgress()
}

// XP por bloque acertado, SOLO la primera vez que se juega el curso.
//
// Antes esto se daba en cada partida, así que repetir el curso más corto
// en bucle era la forma más rápida de subir de nivel del sitio entero.
const XP_POR_ACIERTO = 5

// El corazón del juego: todo lo que pasa al responder, en un solo sitio.
function resolver(block, acierto) {
  const clave = claveDePregunta(block)
  const repesca = !!block.__repesca
  // Hay que mirarlo ANTES de anotar: `anotarRespuesta` apunta la clave.
  const yaRespondida = !repesca && !!clave && partida.respondidas.has(clave)

  const ganados = anotarRespuesta(partida, { clave, acierto, esRepesca: repesca })
  pintarHud()
  celebrarPuntos(ganados)

  const caja = stage.querySelector('.block')
  if (caja) caja.classList.add(acierto ? 'block-acertado' : 'block-fallado')

  // Los estímulos (curso-estimulos.js): sonido, vibración, partículas
  // sobre la respuesta buena y el «×N» en grande cuando el multiplicador
  // acaba de subir — no en cada acierto, que lo gastaría. Todo decorado:
  // nada de esto toca el guardado.
  sonar(acierto ? 'acierto' : 'fallo')
  vibrar(acierto ? 'acierto' : 'fallo')
  if (acierto) {
    estallido(caja?.querySelector('.correct, .zona-clic-bien') || caja)
    const mult = multiplicadorDe(partida.racha)
    if (mult > 1 && mult !== multiplicadorDe(partida.racha - 1)) {
      sonar('combo')
      comboGrande(stage, mult, partida.racha)
    }
  }
  // La barra de progreso se tiñe de dorado mientras hay multiplicador.
  progressFill?.classList.toggle('progress-racha', multiplicadorDe(partida.racha) > 1)

  // Ojo con `incrementQuizCorrect`: alimenta el logro de "aciertos", así
  // que también se queda fuera al repetir. Si no, el logro se saca
  // rejugando el curso más corto veinte veces.
  if (acierto && !repesca && !yaRespondida && session && esPrimeraPartida) {
    addXP(session.user.id, XP_POR_ACIERTO)
    incrementQuizCorrect(session.user.id)
  }

  if (!acierto && !repesca && !yaRespondida) encolarRepesca(block, clave)

  // Estadística de la comunidad y cola de repaso. Las dos cosas van sin
  // `await` a propósito: son un extra, y esperarlas dejaría la pantalla
  // congelada entre pregunta y pregunta.
  // En el reto diario y en el repaso, cada pregunta viene de un curso
  // distinto: la estadística tiene que ir a SU curso, no al de la
  // partida (que ahí ni existe).
  const idCurso = block.__guideId || guide?.id
  if (!yaRespondida) registrarRespuesta(idCurso, clave, acierto)
  if (session && clave && idCurso) {
    if (acierto) quitarDelRepaso(session.user.id, idCurso, clave)
    else apuntarParaRepasar(session.user.id, idCurso, clave, block)
  }

  desbloquearContinuar()
}

function setupQuiz(block) {
  stage.querySelectorAll('.quiz-option').forEach((btn) => {
    btn.addEventListener('click', function onClick() {
      const selected = parseInt(this.dataset.index, 10)
      const isCorrect = selected === block.correct_index

      stage.querySelectorAll('.quiz-option').forEach((b, i) => {
        b.disabled = true
        if (i === block.correct_index) b.classList.add('correct')
        if (i === selected && !isCorrect) b.classList.add('incorrect')
      })

      showExplanation(isCorrect, block)
      resolver(block, isCorrect)
    })
  })
}

function setupTrueFalse(block) {
  stage.querySelectorAll('.tf-option').forEach((btn) => {
    btn.addEventListener('click', function onClick() {
      const selected = this.dataset.value === 'true'
      const isCorrect = selected === !!block.is_true

      stage.querySelectorAll('.tf-option').forEach((b) => {
        b.disabled = true
        const isTrueBtn = b.dataset.value === 'true'
        if (isTrueBtn === !!block.is_true) b.classList.add('correct')
        else if (b === this && !isCorrect) b.classList.add('incorrect')
      })

      showExplanation(isCorrect, block)
      resolver(block, isCorrect)
    })
  })
}

function setupFillBlank(block) {
  const slot = document.getElementById('fillblankSlot')
  stage.querySelectorAll('.fillblank-option').forEach((btn) => {
    btn.addEventListener('click', function onClick() {
      const selected = this.dataset.value
      const isCorrect = selected === block.correct_option

      stage.querySelectorAll('.fillblank-option').forEach((b) => {
        b.disabled = true
        if (b.dataset.value === block.correct_option) b.classList.add('correct')
        if (b === this && !isCorrect) b.classList.add('incorrect')
      })

      if (slot) slot.textContent = selected

      showExplanation(isCorrect, block)
      resolver(block, isCorrect)
    })
  })
}

function setupMatch(block) {
  const total = (block.pairs || []).length
  let matchedCount = 0
  let selectedLeft = null
  // Emparejar mal no impide terminar (se sigue probando hasta juntarlas
  // todas), pero sí cuenta como fallo: si no, este bloque sería el único
  // en el que la racha no se puede perder y bastaría con ir a fuerza
  // bruta.
  let huboFallo = false

  stage.querySelectorAll('.match-item').forEach((item) => {
    item.addEventListener('click', function onClick() {
      if (this.classList.contains('matched')) return

      if (this.dataset.side === 'left') {
        stage.querySelectorAll('.match-item[data-side="left"]').forEach((el) => el.classList.remove('selected'))
        this.classList.add('selected')
        selectedLeft = this
        return
      }

      if (!selectedLeft) return

      const isCorrect = selectedLeft.dataset.pair === this.dataset.pair
      if (isCorrect) {
        selectedLeft.classList.remove('selected')
        selectedLeft.classList.add('matched')
        this.classList.add('matched')
        selectedLeft = null
        matchedCount++
        if (matchedCount === total) {
          resolver(block, !huboFallo)
        }
      } else {
        huboFallo = true
        const wrongLeft = selectedLeft
        const wrongRight = this
        wrongRight.classList.add('wrong')
        wrongLeft.classList.add('wrong')
        setTimeout(() => {
          wrongRight.classList.remove('wrong')
          wrongLeft.classList.remove('wrong', 'selected')
        }, 400)
        selectedLeft = null
      }
    })
  })
}

function setupOrder(block) {
  const correctOrder = (block.items || []).map((_, i) => i)
  const answerEl = document.getElementById('orderAnswer')
  const bankEl = document.getElementById('orderBank')
  const feedbackEl = document.getElementById('orderFeedback')
  const current = []
  let huboFallo = false

  function renderAnswer() {
    answerEl.innerHTML = current
      .map((idx) => `<button class="order-chip placed" data-index="${idx}">${escapeHtml(block.items[idx])}</button>`)
      .join('')
    answerEl.querySelectorAll('.order-chip').forEach((chip) => {
      chip.addEventListener('click', function onClick() {
        const idx = parseInt(this.dataset.index, 10)
        current.splice(current.indexOf(idx), 1)
        feedbackEl.classList.add('hidden')
        renderAnswer()
        renderBank()
        btnContinue.disabled = true
        btnContinue.classList.add('disabled')
      })
    })
  }

  function renderBank() {
    bankEl.querySelectorAll('.order-chip').forEach((chip) => {
      const idx = parseInt(chip.dataset.index, 10)
      chip.classList.toggle('hidden', current.includes(idx))
    })
  }

  bankEl.querySelectorAll('.order-chip').forEach((chip) => {
    chip.addEventListener('click', function onClick() {
      const idx = parseInt(this.dataset.index, 10)
      if (current.includes(idx)) return
      current.push(idx)
      renderAnswer()
      renderBank()

      if (current.length === correctOrder.length) {
        const isCorrect = current.every((v, i) => v === correctOrder[i])
        if (isCorrect) {
          resolver(block, !huboFallo)
        } else {
          // Se puede seguir intentando, pero el intento fallido ya
          // cuenta: quitar fichas hasta dar con el orden bueno no puede
          // valer lo mismo que acertarlo a la primera.
          huboFallo = true
          feedbackEl.classList.remove('hidden')
        }
      }
    })
  })
}

function setupCartaQuiz(block) {
  const pintar = () => {
    const cont = document.getElementById('cartasOpciones')
    if (!cont) return
    cont.innerHTML = (block.card_ids || []).map((id) => cartaJugableHtml(id)).join('')
    cont.querySelectorAll('.carta-opcion').forEach((btn) => {
      btn.addEventListener('click', function onClick() {
        const acierto = this.dataset.id === block.correct_id
        cont.querySelectorAll('.carta-opcion').forEach((b) => {
          b.disabled = true
          if (b.dataset.id === block.correct_id) b.classList.add('correct')
          if (b === this && !acierto) b.classList.add('incorrect')
        })
        showExplanation(acierto, block)
        resolver(block, acierto)
      })
    })
  }
  pintar()
  cargarCartasDe(block.card_ids || [], pintar)
}

function setupZonas(block) {
  const lienzo = document.getElementById('zonasLienzo')
  const img = lienzo?.querySelector('img')
  if (!lienzo || !img) {
    // Sin imagen no hay ejercicio: se deja pasar en vez de dejar a la
    // persona encerrada en un bloque que no se puede responder.
    desbloquearContinuar()
    return
  }

  let respondido = false
  img.addEventListener('click', (e) => {
    if (respondido) return
    respondido = true

    // El clic se mide contra la IMAGEN, no contra el contenedor: la
    // imagen va centrada y con `max-height`, así que casi nunca ocupa
    // toda la caja y las coordenadas saldrían corridas.
    const caja = img.getBoundingClientRect()
    const x = ((e.clientX - caja.left) / caja.width) * 100
    const y = ((e.clientY - caja.top) / caja.height) * 100

    const zonas = block.zones || []
    const acierto = zonas.some((z) => Math.hypot(x - z.x, y - z.y) <= (z.r || 10))

    // Se enseñan todas las zonas buenas, se acierte o no: si no, quien
    // falla se queda sin saber dónde estaba.
    zonas.forEach((z) => {
      const marca = document.createElement('span')
      marca.className = 'zona-marca'
      marca.style.left = `${z.x}%`
      marca.style.top = `${z.y}%`
      marca.style.width = marca.style.height = `${(z.r || 10) * 2}%`
      lienzo.appendChild(marca)
    })
    const donde = document.createElement('span')
    donde.className = `zona-clic ${acierto ? 'zona-clic-bien' : 'zona-clic-mal'}`
    donde.style.left = `${x}%`
    donde.style.top = `${y}%`
    lienzo.appendChild(donde)

    showExplanation(acierto, block)
    resolver(block, acierto)
  })
}

function setupClasifica(block) {
  const cartas = block.cards || []
  const mano = document.getElementById('clasificaMano')
  if (!mano) return

  let elegida = null
  let colocadas = 0
  let huboFallo = false

  const pintarMano = () => {
    mano.innerHTML = shuffle(cartas).map((c) => cartaJugableHtml(c.id, 'carta-mano')).join('')
    mano.querySelectorAll('.carta-opcion').forEach((btn) => {
      btn.addEventListener('click', function onClick() {
        if (this.classList.contains('colocada')) return
        mano.querySelectorAll('.carta-opcion').forEach((b) => b.classList.remove('elegida'))
        this.classList.add('elegida')
        elegida = this
      })
    })
  }

  pintarMano()
  cargarCartasDe(cartas.map((c) => c.id), pintarMano)

  stage.querySelectorAll('.clasifica-cubo').forEach((cubo) => {
    cubo.addEventListener('click', () => {
      if (!elegida) return
      const carta = cartas.find((c) => c.id === elegida.dataset.id)
      const acierto = carta && carta.bucket === cubo.dataset.cubo

      if (acierto) {
        elegida.classList.remove('elegida')
        elegida.classList.add('colocada')
        cubo.querySelector('.clasifica-cubo-contenido').appendChild(elegida)
        elegida = null
        colocadas++
        if (colocadas === cartas.length) {
          showExplanation(!huboFallo, block)
          resolver(block, !huboFallo)
        }
      } else {
        // Igual que en las parejas: se puede seguir probando, pero el
        // fallo ya cuenta. Si no, bastaría con ir a fuerza bruta.
        huboFallo = true
        cubo.classList.add('wrong')
        elegida.classList.add('wrong')
        const fallada = elegida
        setTimeout(() => {
          cubo.classList.remove('wrong')
          fallada.classList.remove('wrong', 'elegida')
        }, 400)
        elegida = null
      }
    })
  })
}

// Qué porcentaje de la comunidad acertó esta pregunta.
//
// Solo se enseña con unas cuantas respuestas encima: un "el 100 % la
// acertó" salido de dos personas no es un dato, es ruido.
const MINIMO_PARA_ENSEÑAR_PORCENTAJE = 5

function porcentajeComunidad(block) {
  const dato = estadisticas[claveDePregunta(block)]
  if (!dato || dato.respondida < MINIMO_PARA_ENSEÑAR_PORCENTAJE) return ''
  const pct = Math.round((dato.acertada / dato.respondida) * 100)
  return pct >= 50
    ? ` · La acierta el ${pct} % de la comunidad.`
    : ` · Solo la acierta el ${pct} % de la comunidad.`
}

function showExplanation(isCorrect, block) {
  const explanationEl = stage.querySelector('.quiz-explanation')
  if (!explanationEl) return
  const abre = block.__repesca
    ? isCorrect ? '¡Esta vez sí! ' : 'Otra vez no… '
    : isCorrect ? '¡Correcto! ' : '¡Casi! '
  explanationEl.textContent = `${abre}${block.explanation || ''}${porcentajeComunidad(block)}`
  explanationEl.classList.remove('hidden')
}

// Guardar la partida, repartir el XP que toque y contar cómo ha ido
// respecto a las veces anteriores.
async function cerrarYGuardar(resumen) {
  const xpCurso = guide.xp_reward || 20
  const avisar = (texto) => {
    const warning = document.getElementById('rewardSaveWarning')
    if (warning) {
      warning.textContent = texto
      warning.classList.remove('hidden')
    }
    showToast(texto)
  }

  try {
    // El XP del curso entero sigue dándose una sola vez: `user_progress`
    // ya lo tenía en `completed` desde la primera partida.
    await markCourseCompleted(session.user.id, guide.id, esPrimeraPartida ? xpCurso : 0)
  } catch {
    // El curso se ha terminado en pantalla, pero la base lo ha
    // rechazado. Callarlo haría que el usuario creyera que su progreso
    // está guardado cuando no lo está.
    avisar('No hemos podido guardar tu progreso. Vuelve a entrar al curso más tarde para que cuente.')
  }

  const guardada = await guardarPartida(session.user.id, guide.id, resumen, Date.now() - empezadoEn)

  // La medalla que manda es la que ha calculado la base, no la que hemos
  // pintado nosotros: si alguna vez dejaran de coincidir, la buena es la
  // suya.
  const medallaFinal = guardada ? guardada.medal : resumen.medal
  const ganadoPorMedalla = xpPorMejoraDeMedalla(mejorAnterior?.medal, medallaFinal)
  if (ganadoPorMedalla > 0) {
    try {
      await addXP(session.user.id, ganadoPorMedalla)
    } catch {
      // Ya queda registrado en client_errors.
    }
  }

  const elXp = document.getElementById('rewardXp')
  if (elXp) {
    const trozos = []
    if (esPrimeraPartida) trozos.push(`+${xpCurso} XP por terminar el curso`)
    if (ganadoPorMedalla > 0) trozos.push(`+${ganadoPorMedalla} XP por subir a ${NOMBRE_MEDALLA[medallaFinal].toLowerCase()}`)
    if (trozos.length) {
      elXp.textContent = trozos.join(' · ')
      elXp.classList.remove('hidden')
    }
  }

  const elRecord = document.getElementById('rewardRecord')
  if (elRecord) {
    if (!mejorAnterior) {
      elRecord.textContent = esPrimeraPartida ? 'Tu primera marca en este curso.' : ''
    } else if (resumen.score > mejorAnterior.score) {
      elRecord.textContent = `¡Nueva mejor marca! Antes tenías ${mejorAnterior.score}.`
      elRecord.classList.add('reward-record-nuevo')
    } else {
      elRecord.textContent = `Tu mejor marca sigue siendo ${mejorAnterior.score}.`
    }
  }

  const tabla = document.getElementById('rewardTabla')
  if (tabla) {
    const filas = await clasificacionDeCurso(guide.id)
    tabla.innerHTML = tablaHtml(filas, session.user.id)
  }
}

// Cerrar una partida del reto diario o del repaso.
async function cerrarYGuardarReto(resumen) {
  const elXp = document.getElementById('rewardXp')
  const decir = (texto) => {
    if (!elXp) return
    elXp.textContent = texto
    elXp.classList.remove('hidden')
  }

  if (modo === 'diario') {
    const guardado = await guardarReto(session.user.id, resumen)
    if (guardado) {
      try {
        await addXP(session.user.id, XP_RETO_DIARIO)
        decir(`+${XP_RETO_DIARIO} XP por el reto de hoy`)
      } catch {
        // Ya queda registrado en client_errors.
      }
    } else {
      // Si no se ha guardado es porque ya estaba jugado hoy (la clave
      // primaria lo impide) o porque falta la migración. En los dos
      // casos, no hay XP.
      decir('El reto de hoy ya estaba jugado.')
    }
  } else {
    // Repaso: el XP va por pregunta recuperada, no por partida, porque
    // el número de preguntas depende de lo que hubieras fallado.
    const ganado = resumen.correct * XP_POR_RECUPERADA
    if (ganado > 0) {
      try {
        await addXP(session.user.id, ganado)
        decir(`+${ganado} XP por recuperar ${resumen.correct} ${resumen.correct === 1 ? 'pregunta' : 'preguntas'}`)
      } catch {
        // Ya queda registrado en client_errors.
      }
    }
  }

  const elRecord = document.getElementById('rewardRecord')
  if (elRecord) {
    elRecord.textContent =
      modo === 'diario'
        ? 'Mañana hay cinco preguntas nuevas.'
        : resumen.correct === resumen.total
          ? 'Todas recuperadas. Fuera de la cola de repaso.'
          : 'Las que has vuelto a fallar seguirán esperándote.'
  }
}

async function setupBlockLogic(block) {
  if (esPractica(block)) {
    btnContinue.disabled = true
    btnContinue.classList.add('disabled')
  }

  if (block.type === 'quiz') {
    setupQuiz(block)
  } else if (block.type === 'truefalse') {
    setupTrueFalse(block)
  } else if (block.type === 'fillblank') {
    setupFillBlank(block)
  } else if (block.type === 'match') {
    setupMatch(block)
  } else if (block.type === 'order') {
    setupOrder(block)
  } else if (block.type === 'cartaquiz') {
    setupCartaQuiz(block)
  } else if (block.type === 'zonas') {
    setupZonas(block)
  } else if (block.type === 'clasifica') {
    setupClasifica(block)
  } else if (block.type === 'checklist') {
    btnContinue.disabled = true
    btnContinue.classList.add('disabled')

    const items = stage.querySelectorAll('.checklist-item')
    items.forEach((item) => {
      item.addEventListener('click', () => {
        item.classList.toggle('checked')
        const allChecked = Array.from(items).every((i) => i.classList.contains('checked'))
        btnContinue.disabled = !allChecked
        btnContinue.classList.toggle('disabled', !allChecked)
      })
    })
  } else if (block.type === 'reward') {
    btnContinue.style.display = 'none'
    const resumen = ultimoResumen
    animateXP(resumen.score)
    // El confeti solo si hay algo que celebrar. Lanzarlo también cuando
    // has fallado media docena de preguntas es lo que hace que deje de
    // significar nada.
    if (resumen.medal) {
      burstConfetti()
      sonar('final')
    }

    const btnRepetir = document.getElementById('btnRepetir')
    if (btnRepetir) btnRepetir.addEventListener('click', () => window.location.reload())

    // El texto de presumir: resultado + enlace al reto. En móvil abre la
    // hoja de compartir del sistema; sin ella, va al portapapeles.
    const btnPresumir = document.getElementById('btnPresumir')
    if (btnPresumir && ultimoResumen) {
      const MEDALLA_EMOJI = { oro: '🥇', plata: '🥈', bronce: '🥉' }
      const emoji = MEDALLA_EMOJI[ultimoResumen.medal] || '🎯'
      const texto = `🎴 Reto Pokémon TCG de hoy en PokeDoc: ${ultimoResumen.correct}/${ultimoResumen.total} ${emoji}\n¿Puedes superarlo? ${window.location.origin}/curso.html?reto=hoy`
      btnPresumir.addEventListener('click', async () => {
        try {
          if (navigator.share) {
            await navigator.share({ text: texto })
            return
          }
        } catch {
          // Compartir cancelado: no es un error.
          return
        }
        try {
          await navigator.clipboard.writeText(texto)
          showToast('Resultado copiado. ¡Pégalo donde quieras presumir!', 'success')
        } catch {
          showToast('No se ha podido copiar el resultado.')
        }
      })
    }

    // Aquí NO se valora nada.
    //
    // Antes se pintaban las estrellas con el título "¿Qué te ha parecido
    // el curso?", pero escribían en `guide_reviews`: la nota era de la
    // GUÍA, no del curso. Quien acababa el curso puntuaba una
    // documentación que a lo mejor ni había abierto, y esa nota es la que
    // sale luego en las tarjetas y en el ranking de autores.
    //
    // La valoración vive en la guía, al terminar de leerla, que es donde
    // se tiene opinión sobre lo que se está puntuando.

    if (session) {
      if (modo === 'curso') await cerrarYGuardar(resumen)
      else await cerrarYGuardarReto(resumen)
    }
  } else {
    btnContinue.disabled = false
    btnContinue.classList.remove('disabled')
  }
}

function renderBlock(index, direction = 'forward') {
  const block = secuencia[index]
  btnContinue.style.display = ''
  btnContinue.textContent = index === secuencia.length - 1 ? 'Finalizar' : 'Continuar →'
  btnPrevious.classList.toggle('hidden', index === 0 || block.type === 'reward')

  const outClass = direction === 'forward' ? 'slide-out-left' : 'slide-out-right'
  const inClass = direction === 'forward' ? 'slide-in-right' : 'slide-in-left'

  stage.classList.add(outClass)

  setTimeout(() => {
    stage.innerHTML = getBlockHTML(block)
    stage.classList.remove(outClass)
    stage.classList.add(inClass)
    setTimeout(() => stage.classList.remove(inClass), 300)

    updateProgress()
    setupBlockLogic(block)
  }, 300)
}

function renderLocked(message) {
  stage.innerHTML = `
    <div class="block" style="text-align: center;">
      <span style="display:flex; justify-content:center;">${icons.lock(40)}</span>
      <h2>Contenido Pro</h2>
      <p class="block-body">${escapeHtml(message)}</p>
    </div>`
  btnContinue.style.display = 'none'
  btnPrevious.classList.add('hidden')
}

// Arrancar una partida ya montada (reto diario o repaso), que no sale de
// un curso concreto sino de preguntas sueltas de varios.
function empezarPartidaSuelta(preguntas, { titular, subtexto }) {
  secuencia = [
    { type: 'hook', emoji: modo === 'diario' ? 'flame' : 'refreshCw', headline: titular, subtext: subtexto },
    ...preguntas,
    { type: 'reward' },
  ]
  partida = nuevaPartida(preguntas.length)
  empezadoEn = Date.now()
  currentIndex = 0
  pintarHud()
  renderBlock(0)
}

function pantallaVacia(titulo, texto) {
  stage.innerHTML = `
    <div class="block" style="text-align:center;">
      <h2 class="block-title">${escapeHtml(titulo)}</h2>
      <p class="block-body">${escapeHtml(texto)}</p>
      <div class="reward-actions" style="justify-content:center;">
        <a href="aprender.html" class="btn-primary">Ir a los cursos →</a>
      </div>
    </div>`
  btnContinue.style.display = 'none'
  btnPrevious.classList.add('hidden')
}

async function cargarReto() {
  session = await getSession()
  esPrimeraPartida = false // no hay XP por bloque en el reto ni en el repaso

  if (modo === 'diario') {
    if (session) {
      const jugado = await yaJugadoHoy(session.user.id)
      if (jugado) {
        pantallaVacia(
          'El reto de hoy ya está jugado',
          `Hiciste ${jugado.correct} de ${jugado.total}. Vuelve mañana: hay cinco preguntas nuevas.`
        )
        return
      }
    }
    const preguntas = await preguntasDelDia()
    if (!preguntas.length) {
      pantallaVacia('Todavía no hay reto', 'Hacen falta cursos publicados con preguntas para poder montarlo.')
      return
    }
    // Las preguntas del reto vienen de cursos distintos: se cargan sus
    // estadísticas de golpe para poder enseñar el "% de la comunidad".
    estadisticas = {}
    empezarPartidaSuelta(preguntas, {
      titular: 'El reto de hoy',
      subtexto: `${preguntas.length} preguntas sacadas de los cursos. Las mismas para todo el mundo.`,
    })
    return
  }

  // Repaso
  if (!session) {
    pantallaVacia('El repaso es tuyo', 'Entra con tu cuenta para repasar lo que has fallado.')
    return
  }
  const preguntas = await preguntasDeRepaso(session.user.id)
  if (!preguntas.length) {
    pantallaVacia('No tienes nada que repasar', 'Aquí van apareciendo las preguntas que falles, unos días después.')
    return
  }
  estadisticas = {}
  empezarPartidaSuelta(preguntas, {
    titular: 'Repaso',
    subtexto: `${preguntas.length} ${preguntas.length === 1 ? 'pregunta que fallaste' : 'preguntas que fallaste'}. A ver si ahora sí.`,
  })
}

async function loadCourse() {
  const params = new URLSearchParams(window.location.search)
  const reto = params.get('reto')
  if (reto === 'hoy' || reto === 'repaso') {
    modo = reto === 'hoy' ? 'diario' : 'repaso'
    await cargarReto()
    return
  }

  const slug = params.get('slug')
  if (!slug) {
    stage.innerHTML = `<p class="empty-state">Curso no encontrado.</p>`
    btnContinue.style.display = 'none'
    return
  }

  const { data, error } = await supabase
    .from('guides')
    .select('*, categories(slug)')
    .eq('slug', slug)
    .single()

  if (error || !data || !Array.isArray(data.blocks) || data.blocks.length === 0) {
    stage.innerHTML = `<p class="empty-state">Este curso todavía no está disponible.</p>`
    btnContinue.style.display = 'none'
    return
  }

  guide = data
  // Copia: la lista de la partida crece con las repescas y no queremos
  // andar tocando el array que vino de la base.
  secuencia = data.blocks.map((b) => ({ ...b }))
  categorySlug = data.categories?.slug || null
  session = await getSession()

  partida = nuevaPartida(secuencia.filter(esPractica).length)
  empezadoEn = Date.now()
  pintarHud()

  supabase.from('guides').update({ view_count: (guide.view_count || 0) + 1 }).eq('id', guide.id)

  if (MOSTRAR_PLANES && guide.is_pro) {
    let isPro = false
    if (session) {
      const { data: profile } = await supabase.from('user_profiles').select('is_pro').eq('id', session.user.id).single()
      isPro = !!profile?.is_pro
    }
    if (!isPro) {
      renderLocked(session ? 'Este curso es exclusivo para usuarios Pro.' : 'Inicia sesión con una cuenta Pro para acceder a este curso.')
      return
    }
  }

  // Siempre desde el principio.
  //
  // Antes se reanudaba por `current_block`, y con puntuación eso no se
  // sostiene: quien entrara directo al último bloque haría un 1 de 1,
  // se llevaría el oro y su XP en diez segundos. Una partida es una
  // partida: las mismas preguntas para todos. Los cursos son de cinco
  // minutos, así que tampoco se pierde gran cosa. `current_block` se
  // sigue guardando porque es la posición por la que vas, y no cuesta
  // nada mantenerla al día.
  currentIndex = 0

  if (session) {
    // Estas tres cosas no dependen unas de otras: en serie eran tres
    // idas y venidas a Supabase antes de pintar la primera pantalla.
    const [yaJugado, mejor, stats] = await Promise.all([
      haJugadoAntes(session.user.id, guide.id),
      mejorPartida(session.user.id, guide.id),
      estadisticasDelCurso(guide.id),
    ])
    esPrimeraPartida = !yaJugado
    mejorAnterior = mejor
    estadisticas = stats

    try {
      await markCourseStarted(session.user.id, guide.id)
    } catch {
      // Ya queda registrado en client_errors. El curso se puede hacer
      // igualmente, así que no se bloquea la carga por esto.
      showToast('No hemos podido guardar que has empezado este curso.')
    }
  } else {
    estadisticas = await estadisticasDelCurso(guide.id)
  }

  renderBlock(currentIndex)
}

btnContinue.addEventListener('click', () => {
  if (btnContinue.disabled) return
  if (currentIndex < secuencia.length - 1) {
    currentIndex++
    persistIndex(currentIndex)
    renderBlock(currentIndex, 'forward')
  }
})

btnPrevious.addEventListener('click', () => {
  if (currentIndex === 0) return
  currentIndex--
  persistIndex(currentIndex)
  renderBlock(currentIndex, 'backward')
})

btnBack.addEventListener('click', () => {
  if (window.history.length > 1) {
    window.history.back()
  } else {
    window.location.href = categorySlug ? `categoria.html?slug=${encodeURIComponent(categorySlug)}` : 'aprender.html'
  }
})

// El botón del sonido en el marcador: pinta el estado guardado y lo
// alterna. Al reactivarlo suena la nota de acierto — es la manera más
// corta de confirmar «ya se oye» sin escribir nada.
const btnSilencio = document.getElementById('btnSilencio')
function pintarSilencio() {
  if (btnSilencio) btnSilencio.innerHTML = silenciado() ? icons.volumeX(15) : icons.volume2(15)
}
btnSilencio?.addEventListener('click', () => {
  alternarSilencio()
  pintarSilencio()
  if (!silenciado()) sonar('acierto')
})
pintarSilencio()

loadCourse()
