// Los fixtures «de la app» (1023): una web con datos de verdad en todas las
// pantallas (colección, foro, torneos, guías, partidas, mensajes…), los
// mismos con los que se fotografió la propuesta «PokeDoc como app». Los
// usa la prueba de solapes y vale para cualquier prueba que quiera abrir una
// página cualquiera con algo dentro. `sembrar(quien)` corre como init script;
// `contexto(b, movil, quien, extra)` abre un contexto con el viewport del
// iPhone 13 o del PC, el tema oscuro y las imágenes de terceros tapadas.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
const FOTOS = new URL('../fotos/', import.meta.url).pathname
export const BASE = 'http://localhost:8892'
const cartas = [1, 2, 3, 4, 5].map((i) => readFileSync(`${FOTOS}carta${i}.svg`, 'utf8'))
const fotos = [1, 2, 3].map((i) => readFileSync(`${FOTOS}foto${i}.svg`, 'utf8'))

export const sembrar = (quien) => {
  window.__FAKE_SESSION__ = quien
  localStorage.setItem('pokedoc-theme', window.__TEMA__ || 'dark')
  localStorage.setItem('pokedoc-onboarding', '1')
  const ahora = Date.now()
  const hace = (h) => new Date(ahora - h * 3600e3).toISOString()
  const dia = (d) => new Date(ahora - d * 86400e3).toISOString().slice(0, 10)
  const NOMBRES = ['Charizard ex', 'Pikachu', 'Gardevoir ex', 'Iono', 'Rare Candy', 'Lugia V', 'Giratina VSTAR', 'Arceus VSTAR', 'Boss\'s Orders', 'Mew ex', 'Raging Bolt ex', 'Dragapult ex', 'Terapagos ex', 'Ogerpon ex', 'Fezandipiti ex', 'Munkidori', 'Noctowl', 'Lillie\'s Clefairy ex', 'Hydreigon ex', 'Night Stretcher', 'Buddy-Buddy Poffin', 'Ultra Ball', 'Nest Ball', 'Professor\'s Research', 'Jamming Tower', 'Area Zero Underdepths', 'Energy Switch', 'Earthen Vessel', 'Counter Catcher', 'Prime Catcher']
  const ES = ['Charizard ex', 'Pikachu', 'Gardevoir ex', 'e-Nigma', 'Caramelo Raro', 'Lugia V', 'Giratina VSTAR', 'Arceus VSTAR', 'Órdenes del Jefe', 'Mew ex', 'Electrofuria ex', 'Dragapult ex', 'Terapagos ex', 'Ogerpon ex', 'Fezandipiti ex', 'Munkidori', 'Noctowl', 'Clefairy de Lylia ex', 'Hydreigon ex', 'Camilla Nocturna', 'Poffin Amistoso', 'Ultra Ball', 'Nido Ball', 'Investigación de Profesores', 'Torre Interferencia', 'Profundidades del Área Cero', 'Cambio de Energía', 'Vasija Terrestre', 'Cazador Contraataque', 'Cazador Selecto']
  const RAR = ['Double Rare', 'Common', 'Double Rare', 'Uncommon', 'Uncommon', 'Ultra Rare', 'Rare Holo VSTAR', 'Rare Holo VSTAR', 'Uncommon', 'Double Rare', 'Double Rare', 'Double Rare', 'Double Rare', 'Double Rare', 'Double Rare', 'Rare', 'Uncommon', 'Double Rare', 'Double Rare', 'Uncommon', 'Uncommon', 'Uncommon', 'Uncommon', 'Uncommon', 'Uncommon', 'Uncommon', 'Uncommon', 'Uncommon', 'Uncommon', 'ACE SPEC Rare']
  const TIPOS = ['Fire', 'Lightning', 'Psychic', null, null, 'Colorless', 'Dragon', 'Colorless', null, 'Psychic', 'Dragon', 'Dragon', 'Colorless', 'Grass', 'Darkness', 'Darkness', 'Colorless', 'Psychic', 'Darkness', null, null, null, null, null, null, null, null, null, null, null]
  window.__FAKE_ERAS__ = [{ id: 'sv', nombre: 'Escarlata y Púrpura', orden: 1 }, { id: 'swsh', nombre: 'Espada y Escudo', orden: 2 }]
  window.__FAKE_SETS__ = [
    { id: 'sv08', name: 'Corona Astral', name_en: 'Surging Sparks', serie_id: 'sv', tcg_online_code: 'SSP', card_count_official: 191, card_count_total: 252, release_date: '2024-11-08', logo_tcggo: 'https://images.tcggo.com/sv08.png', symbol: 'https://images.tcggo.com/sv08-s.png' },
    { id: 'sv07', name: 'Chispas Fulgurantes', name_en: 'Stellar Crown', serie_id: 'sv', tcg_online_code: 'SCR', card_count_official: 142, card_count_total: 175, release_date: '2024-09-13', logo_tcggo: 'https://images.tcggo.com/sv07.png' },
    { id: 'sv06', name: 'Máscaras de Crepúsculo', name_en: 'Twilight Masquerade', serie_id: 'sv', tcg_online_code: 'TWM', card_count_official: 167, card_count_total: 226, release_date: '2024-05-24', logo_tcggo: 'https://images.tcggo.com/sv06.png' },
    { id: 'swsh12', name: 'Tempestad Plateada', name_en: 'Silver Tempest', serie_id: 'swsh', tcg_online_code: 'SIT', card_count_official: 195, card_count_total: 215, release_date: '2022-11-11', logo_tcggo: 'https://images.tcggo.com/swsh12.png' },
    { id: 'me03', name: 'Delta Reign', name_en: 'Delta Reign', serie_id: 'sv', tcg_online_code: 'DR', card_count_official: 200, card_count_total: 240, release_date: new Date(ahora + 12 * 86400e3).toISOString().slice(0, 10), logo_tcggo: 'https://images.tcggo.com/me03.png' },
  ]
  window.__FAKE_CARTAS__ = NOMBRES.map((n, i) => ({
    id: `sv08-${i + 1}`, set_id: 'sv08', market: 'WEST', local_id: String(i + 1), name: n, name_es: ES[i], image_path: `en/sv/sv08/${i + 1}`,
    rarity: RAR[i], rarity_en: RAR[i], category: i === 3 || i === 4 || i === 8 || i >= 19 ? 'Trainer' : 'Pokemon', types: TIPOS[i] ? [TIPOS[i]] : null,
    dex_ids: i < 19 ? [6 + i * 17] : null, hp: TIPOS[i] ? 230 : null, illustrator: ['5ban Graphics', 'Mitsuhiro Arita', 'Kouki Saitou'][i % 3], regulation_mark: 'H',
    variants: i % 5 === 0 ? { normal: false, holo: true, reverse: false } : { normal: true, holo: false, reverse: true },
    tcg_sets: { id: 'sv08', name: 'Corona Astral', serie_id: 'sv', tcg_online_code: 'SSP', release_date: '2024-11-08' },
  }))
  const PRECIO = [182.5, 0.12, 24.9, 1.6, 0.4, 12, 9.5, 11, 1.1, 38, 15.5, 22, 8.2, 6.4, 4.1, 0.3, 0.25, 19, 14, 0.5, 0.6, 0.3, 0.2, 0.3, 0.4, 0.5, 0.2, 0.9, 0.4, 7.9]
  window.__FAKE_PRECIOS__ = PRECIO.map((p, i) => ({ card_id: `sv08-${i + 1}`, cm_low: p, cm_trend: p * 1.05, cm_avg30: p * 1.02, cm_low_es: p * 0.95, cm_low_en: p, cm_low_de: p * 0.9, cm_url: 'https://www.cardmarket.com/', cm_updated: hace(2), tp_market_eur: p * 1.1, origen: 'tcggo', tcggo_updated: hace(2) }))
  window.__FAKE_HISTORIAL__ = [].concat(...[0, 1, 2, 9, 29].map((i) => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30].map((d) => ({ card_id: `sv08-${i + 1}`, dia: dia(30 - d), cm_low: PRECIO[i] * (0.8 + d / 150), cm_low_es: PRECIO[i] * (0.78 + d / 150), cm_low_en: PRECIO[i] * (0.8 + d / 150) }))))
  window.__FAKE_COLECCION__ = [0, 1, 2, 3, 4, 5, 6, 9, 10, 11, 17, 18, 20, 21].map((i, k) => ({ id: `col-${k}`, user_id: quien, card_id: `sv08-${i + 1}`, market: 'WEST', idioma: k % 4 === 1 ? 'en' : 'es', estado: 'NM', variante: i % 5 === 0 ? 'holo' : k % 3 === 2 ? 'reverse' : 'normal', cantidad: k % 3 === 0 ? 2 : 1, cambio: k === 1 || k === 4 ? 1 : 0, precio_compra: k === 0 ? 120 : null, created_at: hace(k * 30) }))
  window.__FAKE_VALOR__ = [...Array(45)].map((_, i) => ({ user_id: quien, dia: dia(44 - i), valor: 260 + i * 2.4 + Math.sin(i) * 9, copias: 14, distintas: 14, sin_precio: 0 }))
  window.__FAKE_DESEOS__ = [12, 13, 14].map((i) => ({ user_id: quien, card_id: `sv08-${i + 1}`, market: 'WEST', idioma: null, prioridad: 1, created_at: hace(5) }))
  window.__FAKE_ALBUMES__ = [{ id: 'alb-1', user_id: quien, nombre: 'Charizards de toda la vida', descripcion: 'Uno por era', cartas: [{ card_id: 'sv08-1', market: 'WEST' }], is_public: true, tipo: 'binder' }, { id: 'alb-2', user_id: quien, nombre: 'Para el torneo', cartas: [], is_public: false, tipo: 'carpeta' }]
  window.__FAKE_VITRINA__ = [0, 2, 9].map((i, k) => ({ user_id: quien, posicion: k + 1, card_id: `sv08-${i + 1}`, market: 'WEST' }))
  window.__FAKE_PERFIL__ = { display_name: 'Ash', bio: 'Coleccionista desde Base Set. Juego Charizard desde 2023.', total_xp: 4820, level: 11, current_streak: 12, last_active_date: dia(0), achievements: ['torneo_jugado', 'torneo_podio', 'torneo_campeon', 'primera_guia'], last_active_at: hace(1), created_at: '2026-03-10T10:00:00Z', ciudad: 'Madrid', is_admin: quien === 'admin-1' }
  window.__FAKE_PERFILES__ = ['Misty', 'Brock', 'jesus', 'Lance', 'Cynthia', 'Serena', 'Gary', 'Leaf', 'Red', 'enez.cards'].map((u, i) => ({ id: i < 3 ? ['user-2', 'mod-1', 'user-3'][i] : `extra-${i}`, username: u, display_name: u, total_xp: 3900 - i * 310, level: 9 - i / 2 | 0, current_streak: [7, 0, 3, 21, 1, 0, 5, 2, 0, 1][i], last_active_date: dia(i % 2), created_at: hace(600 - i * 40), achievements: i === 0 ? ['torneo_campeon'] : [] }))
  window.__FAKE_XP_MES__ = [{ user_id: quien, xp_inicio: 4100 }, { user_id: 'user-2', xp_inicio: 3200 }, { user_id: 'extra-3', xp_inicio: 2600 }]
  window.__FAKE_SEGUIDOS__ = [{ follower_id: quien, following_id: 'user-2' }, { follower_id: quien, following_id: 'extra-3' }, { follower_id: 'user-2', following_id: quien }]
  // Guías, cursos y noticias
  window.__FAKE_CATEGORIAS__ = [{ id: 'cat-1', slug: 'empezar', name: 'Empezar', description: 'Si acabas de llegar' }, { id: 'cat-2', slug: 'competitivo', name: 'Competitivo', description: 'Torneos y meta' }, { id: 'cat-3', slug: 'coleccion', name: 'Coleccionar', description: 'Cuidar y valorar' }]
  const bloques = (t) => [{ type: 'paragraph', text: `${t} Esta es la primera parte, donde explicamos lo esencial con calma y sin tecnicismos. Si ya sabes jugar, salta al siguiente bloque.` }, { type: 'heading', text: 'Lo primero' }, { type: 'paragraph', text: 'Un mazo tiene exactamente 60 cartas. Puedes llevar hasta cuatro copias de cada carta que no sea energía básica. Empiezas con siete en la mano y seis cartas de premio.' }, { type: 'tip', text: 'Baraja siempre después de buscar en el mazo.' }, { type: 'paragraph', text: 'Cada turno robas una carta, puedes bajar un Pokémon básico, evolucionar, jugar objetos y UN partidario, poner UNA energía y atacar.' }, { type: 'quiz', question: '¿Cuántas cartas de premio hay?', options: ['Cuatro', 'Seis', 'Ocho'], answer: 1 }]
  const GUIAS = [['como-empezar', 'Cómo empezar a jugar Pokémon TCG', 'Las reglas básicas explicadas con calma: turnos, energías, premios y qué hace cada tipo de carta.', 'cat-1', 8, 'course'], ['charizard-ex', 'Guía de Charizard ex para Estándar', 'Lista, plan de juego, emparejamientos y los cambios de la última rotación.', 'cat-2', 14, 'guide'], ['gradear', 'Gradear o no gradear: lo que cuesta y lo que vale', 'PSA, CGC y Beckett comparados con precios de 2026 y cuándo compensa.', 'cat-3', 11, 'guide'], ['mulligan', 'El mulligan y la mano de salida', 'Cuándo tienes que enseñar la mano y qué pasa con el premio extra.', 'cat-1', 4, 'guide'], ['rotacion-2026', 'La rotación de 2026: qué sale y qué se queda', 'Las letras de regulación explicadas y las cartas que pierdes.', 'cat-2', 6, 'guide'], ['guardar-cartas', 'Fundas, toploaders y cajas: cómo guardar tus cartas', 'Lo que estropea una carta y lo que la protege.', 'cat-3', 7, 'guide'], ['gardevoir', 'Gardevoir ex: el mazo que no muere', 'Por qué sigue en el meta y cómo jugarlo contra Dragapult.', 'cat-2', 12, 'guide']]
  window.__FAKE_GUIAS__ = GUIAS.map(([slug, title, description, cat, mins, kind], i) => ({ id: `guia-${i + 1}`, slug, title, description, kind: kind === 'course' ? 'guide' : kind, category_id: cat, estimated_mins: mins, author_id: i % 2 ? 'user-2' : quien, published_at: hace(24 * (i * 4 + 1)), created_at: hace(24 * (i * 4 + 2)), view_count: 1200 - i * 130, blocks: bloques(title), has_course: kind === 'course', level: ['beginner', 'intermediate', 'advanced'][i % 3] }))
  window.__FAKE_NOTICIAS__ = [['delta-reign-promos', 'Delta Reign tendrá cartas promo de Kyogre, Groudon y Giratina en tiendas de EE. UU.'], ['prerelease-madrid', 'Prerelease de Delta Reign en Madrid: fechas y tiendas'], ['rotacion-anuncio', 'Pokémon anuncia la rotación de abril: se van las cartas con la letra G'], ['liga-fdn', 'La Liga FDN de otoño arranca con 48 jugadores']].map(([slug, title], i) => ({ id: `noticia-${i + 1}`, slug, title, description: 'Lo que se sabe hasta ahora y lo que falta por confirmar.', kind: 'news', author_id: quien, published_at: hace(43 + i * 30), created_at: hace(44 + i * 30), blocks: bloques(title), cover_image: `https://images.tcggo.com/noticia${(i % 3) + 1}.png`, image_ratio: 1.78 }))
  window.__FAKE_PROGRESO__ = [{ user_id: quien, guide_id: 'guia-1', status: 'in_progress', current_block: 3, started_at: hace(30) }, { user_id: quien, guide_id: 'guia-3', status: 'in_progress', current_block: 1, started_at: hace(70) }]
  // Foro
  window.__FAKE_SECCIONES__ = [{ id: 'seccion-1', name: 'Comunidad', position: 0 }, { id: 'seccion-2', name: 'Juego', position: 1 }]
  window.__FAKE_FOROS__ = [{ id: 'foro-1', slug: 'presentaciones', name: 'Presentaciones', description: 'Cuéntanos quién eres', section_id: 'seccion-1', position: 0 }, { id: 'foro-2', slug: 'general', name: 'General', description: 'De todo un poco', section_id: 'seccion-1', position: 1 }, { id: 'foro-3', slug: 'competitivo', name: 'Competitivo', description: 'Mazos, torneos y meta', section_id: 'seccion-2', position: 0 }, { id: 'foro-4', slug: 'coleccion', name: 'Colección', description: 'Precios, gradeos y cambios', section_id: 'seccion-2', position: 1 }]
  const TEMAS = [['foro-1', 'enez.cards', 'extra-9', 'Off-topic'], ['foro-3', '¿Charizard sigue siendo top tras la rotación?', 'user-2', null], ['foro-4', 'Qué me ofrecéis por este Umbreon VMAX alt art', 'extra-3', 'Cambio'], ['foro-2', 'Tiendas en Valencia para jugar los sábados', 'extra-4', 'Pregunta'], ['foro-3', 'Lista Dragapult para Regional Lille', 'extra-6', 'Mazo'], ['foro-4', 'PSA vs CGC: mi experiencia con 40 cartas', 'user-3', null], ['foro-2', 'Encuesta: ¿cuál es tu carta favorita de Corona Astral?', quien, 'Encuesta'], ['foro-1', 'Hola a todos desde Sevilla', 'extra-5', null]]
  window.__FAKE_TEMAS__ = TEMAS.map(([board_id, title, author_id, prefix], i) => ({ id: `tema-${i + 1}`, board_id, title, author_id, prefix, post_count: [2, 14, 5, 3, 9, 7, 22, 4][i], view_count: 120 * (8 - i), last_post_at: hace(i * 5 + 1), last_post_author_id: i === 0 ? quien : 'user-2', created_at: hace(i * 9 + 3), is_pinned: i === 1 }))
  window.__FAKE_MENSAJES__ = [
    { id: 'msg-1', thread_id: 'tema-1', author_id: 'extra-9', body_html: '<p>¡Hola! Soy Enez, de enez.cards. Colecciono desde 2016 y ahora mismo busco completar la Corona Astral en español.</p>', created_at: hace(10) },
    { id: 'msg-2', thread_id: 'tema-1', author_id: quien, body_html: '<p>«Bienvenido a PokeDoc @enezcards ! Un verdadero placer tenerte por aquí, cualquier duda ya sabes que aquí estamos para ayudar :)»</p>', created_at: hace(9) },
    { id: 'msg-3', thread_id: 'tema-2', author_id: 'user-2', body_html: '<p>Con la rotación pierde Rare Candy antiguo pero gana Night Stretcher. Yo creo que sigue top 3. ¿Qué pensáis?</p>', created_at: hace(40) },
    { id: 'msg-4', thread_id: 'tema-2', author_id: 'extra-3', body_html: '<p>Top 3 seguro, el matchup contra Dragapult es lo único feo.</p>', created_at: hace(30) },
    { id: 'msg-5', thread_id: 'tema-2', author_id: quien, body_html: '<p>Yo lo jugué en la liga del sábado: 4-1, solo perdí contra Gardevoir.</p>', created_at: hace(6) },
  ]
  window.__FAKE_REACCIONES__ = [{ post_id: 'msg-2', user_id: 'extra-9', emoji: 'heart' }, { post_id: 'msg-5', user_id: 'user-2', emoji: 'fire' }]
  window.__FAKE_SUSCRIPCIONES__ = [{ thread_id: 'tema-2', user_id: quien }, { thread_id: 'tema-7', user_id: quien }]
  window.__FAKE_LECTURAS__ = [{ thread_id: 'tema-2', user_id: quien, last_read_at: hace(48) }]
  window.__FAKE_NOTIFICACIONES__ = [{ recipient_id: quien, type: 'forum_reply', title: 'Misty ha respondido en «¿Charizard sigue siendo top?»', link: '/tema/tema-2', created_at: hace(3) }, { recipient_id: quien, type: 'new_follower', title: 'Misty te sigue', link: '/usuario/Misty', created_at: hace(20), read_at: hace(10) }]
  // Torneos y partidas
  window.__FAKE_TORNEOS__ = [
    { id: 'torneo-1', slug: 'liga-fdn-otono', name: 'Liga FDN [Oct–Dic] · jornada 3', description: 'Liga de tres meses con una jornada cada dos semanas. Formato Estándar, lista abierta.', status: 'in_progress', format: 'league', start_at: hace(-5 * 24), max_players: 32, admin_id: 'admin-1', matchday_dates: [dia(14), dia(0), new Date(ahora + 5 * 86400e3).toISOString().slice(0, 10)], is_official: true },
    { id: 'torneo-2', slug: 'copa-delta', name: 'Copa Delta Reign', description: 'Torneo de lanzamiento, suizo a 4 rondas y top 4.', status: 'registration_open', format: 'swiss', start_at: hace(-13 * 24), max_players: 16, admin_id: 'user-2' },
    { id: 'torneo-3', slug: 'copa-verano', name: 'Copa de verano', status: 'finished', format: 'swiss', start_at: hace(60 * 24), max_players: 16, admin_id: 'admin-1', champion_id: 'user-2', podium: [quien, 'user-2', 'extra-3'] },
  ]
  window.__FAKE_INSCRIPCIONES__ = [].concat(...['torneo-1', 'torneo-2', 'torneo-3'].map((t) => [quien, 'user-2', 'extra-3', 'extra-4', 'extra-5', 'extra-6'].map((u, i) => ({ id: `ins-${t}-${i}`, tournament_id: t, user_id: u, status: 'active', created_at: hace(100 + i) }))))
  window.__FAKE_MAZOS__ = [{ id: 'mazo-1', user_id: quien, name: 'Charizard ex Pidgeot', format: 'standard', cover_card: 'sv08-1', cards: NOMBRES.slice(0, 15).map((n, i) => ({ id: `sv08-${i + 1}`, name: n, n: i < 2 ? 4 : i < 10 ? 3 : 2 })).concat([{ id: 'energia', name: 'Fire Energy', n: 20 }]), updated_at: hace(5) }, { id: 'mazo-2', user_id: quien, name: 'Dragapult (en pruebas)', format: 'standard', cards: NOMBRES.slice(10, 20).map((n, i) => ({ id: `sv08-${i + 11}`, name: n, n: 3 })), updated_at: hace(80) }]
  window.__FAKE_PARTIDAS__ = [...Array(14)].map((_, i) => ({ id: `mlog-${i}`, user_id: quien, mi_mazo: i % 3 ? 'charizard-ex' : 'dragapult-ex', mi_mazo_nombre: i % 3 ? 'Charizard ex' : 'Dragapult ex', rival_mazo: ['gardevoir-ex', 'raging-bolt-ex', 'dragapult-ex', 'lugia-v', 'miraidon-ex'][i % 5], rival_mazo_nombre: ['Gardevoir ex', 'Raging Bolt ex', 'Dragapult ex', 'Lugia V', 'Miraidon ex'][i % 5], resultado: ['win', 'win', 'loss', 'win', 'tie'][i % 5], jugada_el: dia(i * 3), user_deck_id: i % 3 ? 'mazo-1' : null, formato: 'bo1', torneo: i < 4 ? 'Liga FDN' : null, notas: i === 0 ? 'Robó mal, Iono en el turno 2 me dejó con 1 carta' : null }))
  window.__FAKE_META_ARQUETIPOS__ = [['Charizard ex', 18.2, 54], ['Dragapult ex', 15.1, 52], ['Gardevoir ex', 11.4, 50], ['Raging Bolt ex', 9.8, 49], ['Lugia V', 6.1, 47], ['Terapagos ex', 5.5, 48], ['Miraidon ex', 4.2, 45], ['Gholdengo ex', 3.9, 51]].map(([nombre, cuota, win], i) => ({ id: `arq-${i + 1}`, nombre, slug: nombre.toLowerCase().replace(/ /g, '-'), iconos: [nombre.split(' ')[0].toLowerCase()], cuota, winrate: win, mazos: Math.round(cuota * 12), tendencia: [2.1, -0.8, 0.4, 1.9, -1.2, 0.6, -0.3, 0.9][i], visto_at: hace(2) }))
  window.__FAKE_META_CARTAS__ = [0, 3, 8, 20, 21, 22, 23, 1, 4, 19].map((c, i) => ({ dia: dia(0), arquetipo: 'arq-1', seccion: c >= 19 || c === 3 || c === 4 || c === 8 ? 'entrenador' : 'pokemon', clave: `sv08-${c + 1}`, nombre: NOMBRES[c], set_codigo: 'SSP', numero: String(c + 1), mazos: 60 - i * 4, copias: 4 - (i % 3) }))
  window.__FAKE_RETOS__ = [{ user_id: quien, day: dia(0), correct: 4, total: 5, score: 40 }, { user_id: quien, day: dia(1), correct: 5, total: 5, score: 50 }]
  window.__FAKE_LOGROS__ = [['primera_guia', 'Primera guía', 'Publicaste tu primera guía', 'bookOpen', 'bronze'], ['torneo_jugado', 'Primer torneo', 'Jugaste un torneo entero', 'trophy', 'bronze'], ['torneo_podio', 'Podio', 'Quedaste entre los tres primeros', 'award', 'silver'], ['torneo_campeon', 'Campeón', 'Ganaste un torneo', 'crown', 'gold'], ['racha_30', 'Un mes seguido', 'Treinta días seguidos entrando', 'flame', 'silver'], ['coleccion_100', 'Cien cartas', 'Cien cartas en tu colección', 'layers', 'bronze']].map(([id, title, description, emoji, rarity]) => ({ id, title, description, emoji, rarity, xp_reward: 25 }))
  window.__FAKE_AJUSTES__ = [{ key: 'lanzamientos', value: { sets: [] } }]
  window.__FAKE_FILAS__ = {
    conversations: [{ id: 'conv-1', participants: [quien, 'user-2'], updated_at: hace(2), last_message: '¿Te sigue interesando el Umbreon?' }, { id: 'conv-2', participants: [quien, 'extra-3'], updated_at: hace(50), last_message: 'Perfecto, el sábado en la tienda' }],
    private_messages: [{ id: 'pm-1', conversation_id: 'conv-1', sender_id: 'user-2', body: 'Hola Ash, vi que das el Giratina VSTAR. ¿Lo cambias por mi Lugia V alt?', created_at: hace(3) }, { id: 'pm-2', conversation_id: 'conv-1', sender_id: quien, body: 'Lo miro esta tarde y te digo. Lo tengo en español NM.', created_at: hace(2.5) }, { id: 'pm-3', conversation_id: 'conv-1', sender_id: 'user-2', body: '¿Te sigue interesando el Umbreon?', created_at: hace(2) }, { id: 'pm-4', conversation_id: 'conv-2', sender_id: 'extra-3', body: 'Perfecto, el sábado en la tienda', created_at: hace(50) }],
    guide_helpful: [{ guide_id: 'guia-1', user_id: 'user-2' }, { guide_id: 'guia-1', user_id: 'extra-3' }, { guide_id: 'guia-2', user_id: 'user-2' }],
    user_follows: [{ follower_id: quien, following_id: 'user-2' }, { follower_id: 'user-2', following_id: quien }, { follower_id: 'extra-3', following_id: quien }],
  }
}


export const VP = { movil: { width: 390, height: 844 }, pc: { width: 1440, height: 900 } }
export async function contexto(b, movil, quien = 'user-1', extra = null) {
  const vp = movil ? VP.movil : VP.pc
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: movil, hasTouch: movil, locale: 'es-ES', colorScheme: 'dark', userAgent: movil ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' : undefined })
  await ctx.addInitScript(sembrar, quien)
  if (extra) await ctx.addInitScript(extra)
  let n = 0
    await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com\/.*\.(png|jpg|webp)|\/escaneo\/|\/.netlify\/functions\/escaneo/, (r) => {
      const u = r.request().url()
      if (/logo|images\.tcggo\.com\/(sv|swsh|me)\d+\.png/.test(u) && !/-s\.png/.test(u)) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="110"><rect width="300" height="110" rx="10" fill="#b58a2c"/><text x="150" y="70" font-size="34" text-anchor="middle" font-family="sans-serif" font-weight="900" fill="#fff">${u.match(/(sv\d+|swsh\d+|me\d+)/)?.[1]?.toUpperCase() || 'SET'}</text></svg>` })
      if (/-s\.png/.test(u)) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="16" fill="#9ab"/></svg>' })
      if (/noticia/.test(u)) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: fotos[n++ % 3] })
      return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: cartas[n++ % 5] })
    })
    await ctx.route(/r2\.limitlesstcg\.net|raw\.githubusercontent\.com|cdn\.jsdelivr\.net|\/sprite\//, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="68" height="56"><circle cx="34" cy="30" r="20" fill="#e8763a"/><circle cx="26" cy="26" r="3" fill="#222"/><circle cx="42" cy="26" r="3" fill="#222"/></svg>' }))
    await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  return ctx
}
export { chromium }
