// Propuesta «Menos cosas antes del contenido» (PINGU, 2026-10-26): lo que se
// inyecta sobre la página real para dibujar el «después». Solo el móvil salvo
// las que llevan `pc: true`. Cada una: id, ruta, css y, si hace falta, js.

// G — lo común: chips, segmentos y pestañas de 36 px a la vista (el dedo sigue
// teniendo 44: un ::after invisible que sobresale), y lo que se esconde del
// todo se esconde con `display:none` solo en el prototipo.
export const COMUN = `
@media (max-width: 599px) {
  .seg { padding: 2px !important; min-height: 0 !important; }
  .seg .seg-btn, .chip-filtro, .aprender-chip, .com-chip, .mc-chip-mando, .mc-seg-sueltas > button, .tab-btn, .cm-pestania, .cm-vista {
    min-height: 36px !important; height: 36px; padding-block: 0 !important; font-size: var(--t-sm) !important; position: relative;
  }
  .seg .pildora { display: none !important; }
  .seg .seg-btn[aria-pressed='true'], .seg .seg-btn.activa { background: var(--navy-solid) !important; color: var(--blanco-fijo) !important; border-radius: 999px; }
  .seg .seg-btn::after, .chip-filtro::after, .com-chip::after, .mc-chip-mando::after, .tab-btn::after { content: ''; position: absolute; inset: -4px 0; }
  .oc { display: none !important; }
}`

// Para recolocar la píldora de un .seg después de encoger sus botones.
const PILDORAS = `() => { window.dispatchEvent(new Event('resize')); document.querySelectorAll('.seg.con-pildora').forEach((s) => { const a = s.querySelector('.seg-btn[aria-pressed="true"], .seg-btn.activa, .seg-btn.active') ; const p = s.querySelector('.pildora'); if (a && p) { p.style.left = a.offsetLeft + 'px'; p.style.width = a.offsetWidth + 'px'; p.style.top = a.offsetTop + 'px'; p.style.height = a.offsetHeight + 'px' } }) }`

// Lo de arriba de Deseos y cambios: las cuatro pestañas enteras y Evento como icono.
const TRADE_CSS = `
.mc-deseos-cabeza { gap: 8px !important; }
.mc-deseos-seg { flex: 1 1 auto !important; min-width: 0; }
.mc-deseos-seg .seg-btn { flex: 1 1 0; padding-inline: 6px !important; justify-content: center; }
.mc-deseos-n { font-size: var(--t-2xs) !important; }
.mc-evento-boton { width: 40px !important; min-width: 40px !important; height: 40px !important; min-height: 40px !important; padding: 0 !important; justify-content: center; border-radius: 50% !important; flex: 0 0 auto; }
.mc-evento-texto { display: none !important; }
`
const TRADE_JS = `() => {
  for (const b of document.querySelectorAll('.mc-deseos-seg .seg-btn')) {
    const s = b.querySelector('span:not(.mc-deseos-n)')
    if (s && s.textContent === 'La quiero') s.textContent = 'Quiero'
    if (s && s.textContent === 'Las que doy') s.textContent = 'Doy'
  }
}`

export const PROPUESTAS = [
  // ── Colección ──
  { id: 'quiero', contenido: 'article.mc-deseo-baldosa', grupo: 'coleccion', ruta: '/mi-coleccion?ver=quiero',
    css: TRADE_CSS + `
      .mc-quiero-cabeza { min-height: 40px !important; }
      .mc-quiero-compartir { width: 40px !important; min-width: 40px !important; height: 40px !important; min-height: 40px !important; }
      #mcDeseoBuscar { min-height: 40px !important; height: 40px; }
      .mc-quiero-filtro .seg { width: 100%; } .mc-quiero-filtro .seg-btn { flex: 1 1 0; }`,
    js: TRADE_JS },
  { id: 'mercado', contenido: '.mc-bloque-mercado .empty-state, .mc-bloque-mercado article', grupo: 'coleccion', ruta: '/mi-coleccion?ver=mercado',
    css: TRADE_CSS + `
      .mc-mercado-catalogo { display: none !important; }
      #mcMercadoBuscar { min-height: 40px !important; height: 40px; }
      .mc-mercado-mandos { overflow: visible !important; gap: 8px; }
      .mc-mercado-opcion select { min-height: 36px !important; height: 36px; font-size: var(--t-sm) !important; }`,
    js: TRADE_JS },
  { id: 'productos', contenido: '#mcProdSets', grupo: 'coleccion', ruta: '/mi-coleccion?ver=productos',
    css: `#mcProdTuyos, #mcProdNormal > h2.mc-subtitulo { display: none !important; }
      .mc-prod-buscador { flex-basis: 100% !important; }
      .mc-prod-catalogo { margin-inline: auto !important; }` },
  { id: 'pokedex', contenido: '.pdx-rejilla', grupo: 'coleccion', ruta: '/mi-coleccion?ver=pokedex',
    css: `#mcPdxEncabezado { display: none !important; }
      #mcPdxBuscar { min-height: 40px !important; height: 40px; }
      .pdx-mandos { gap: 8px !important; }
      #mcPdxSoloMios { font-size: 0 !important; } #mcPdxSoloMios::before { content: 'Tengo'; font-size: var(--t-sm); }
      #mcPdxOrden { display: none !important; }
      .pdx-region { min-height: 44px !important; height: 44px; padding: 4px 10px !important; }
      .pdx-region-nombre { font-size: var(--t-xs) !important; } .pdx-region-cuenta { font-size: var(--t-2xs) !important; }` },
  { id: 'expansiones', contenido: '#mcEstanteriaRejilla', grupo: 'coleccion', ruta: '/mi-coleccion?ver=album',
    css: `.mc-seg-sueltas { display: none !important; }
      .mc-estanteria-orden { width: 40px !important; min-width: 40px !important; padding: 0 !important; font-size: 0 !important; justify-content: center; }
      .mc-estanteria-lupa { width: 40px !important; min-width: 40px !important; }
      .mc-estanteria-cabeza { gap: 8px !important; }` },
  { id: 'catalogo', contenido: '#mcEstanteriaRejilla', grupo: 'coleccion', ruta: '/cartas',
    css: `#mcTitulo { position: absolute !important; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
      .mc-seg-sueltas { display: none !important; }
      .mc-estanteria-orden { width: 40px !important; min-width: 40px !important; padding: 0 !important; font-size: 0 !important; justify-content: center; }
      #mcEstanteriaBusca { flex: 1 1 100% !important; width: 100% !important; }
      #mcEstanteriaBuscar { min-height: 40px !important; height: 40px; }
      .proto-fila { display: flex; gap: 8px; align-items: center; justify-content: space-between; margin-bottom: 8px; }`,
    js: `() => { const seg = document.querySelector('#mcHero .seg'); const orden = document.getElementById('mcEstanteriaOrdenAbrir'); const hero = document.getElementById('mcHero'); const barra = document.querySelector('.mc-estanteria-barra'); if (seg && orden && barra) { const fila = document.createElement('div'); fila.className = 'proto-fila'; fila.append(seg, orden); barra.prepend(fila); hero.style.display = 'none'; } }` },
  // ── Aprender ──
  { id: 'aprender', contenido: '#apLista', grupo: 'aprender', ruta: '/aprender', pc: true,
    css: `.ap-cab h1 { position: absolute !important; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
      #medallero, #apChips { display: none !important; }
      .ap-cab { display: none !important; }
      .aprender-seguir { min-height: 0 !important; padding: 8px 12px !important; }
      .aprender-seguir .aprender-aro { width: 36px !important; height: 36px !important; }
      .aprender-seguir-sub { display: none !important; }
      .ap-baldosas { gap: 8px !important; }
      .ap-baldosa { min-height: 36px !important; height: 36px; padding: 0 12px !important; border-radius: 999px !important; width: auto !important; flex: 0 0 auto !important; }
      .ap-baldosa-icono, .ap-baldosa-sub, .ap-baldosa-barra { display: none !important; }
      .ap-herramientas { display: flex !important; gap: 8px; align-items: center; }
      .ap-buscar { flex: 1; } #apBuscar { min-height: 40px !important; height: 40px; }
      .proto-escribir { width: 40px; height: 40px; min-height: 40px; padding: 0; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; }
      @media (min-width: 600px) { .ap-baldosas { display: flex !important; flex-wrap: wrap; } .ap-cab { display: flex !important; } .ap-cab h1 { position: static !important; width: auto; height: auto; clip-path: none; } .proto-escribir { display: none !important; } .ap-buscar { flex: 0 1 360px; } }`,
    js: `() => { const e = document.querySelector('.ap-escribir'); const h = document.querySelector('.ap-herramientas'); if (e && h) { const c = e.cloneNode(true); c.classList.add('proto-escribir'); h.append(c); } const b = document.getElementById('apBuscar'); if (b) b.placeholder = 'Busca una guía'; }` },
  { id: 'glosario', contenido: '#glosarioLista', grupo: 'aprender', ruta: '/glosario',
    css: `.cabecera-pagina.cab-lista { display: none !important; }
      #glosarioBuscar { min-height: 40px !important; height: 40px; }
      .glosario-letras { display: flex !important; flex-wrap: nowrap !important; overflow-x: auto; gap: 0 !important; margin-inline: -24px; padding-inline: 24px; scrollbar-width: none; }
      .glosario-letras a { flex: 0 0 auto; width: 36px !important; min-width: 36px !important; height: 36px !important; min-height: 36px !important; }
      .glosario-mandos { gap: 8px !important; }` },
  { id: 'novedades', contenido: '#nvDestacadas', grupo: 'inicio', ruta: '/novedades',
    css: `.cabecera-pagina > p.subtext { display: none !important; }
      .cabecera-pagina h1 { position: absolute !important; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
      #nvDestacadasTitulo { font-size: var(--t-md) !important; margin: 0 0 8px !important; }
      .nv-dest-dibujo { height: 88px !important; overflow: hidden; }
      .nv-dest-texto p { display: none !important; }
      .nv-dest-texto { padding: 12px 16px !important; }
      .nv-ir { min-height: 36px !important; }`,
    scroll: { movil: 0 } },
  { id: 'lanzamientos', contenido: '#proximoDestacado', grupo: 'inicio', ruta: '/lanzamientos',
    css: `.page-header.cab-lista { display: none !important; }
      .lanz-mandos .seg-btn { min-height: 36px !important; }
      .lanzamiento-destacado { display: grid !important; grid-template-columns: 72px 1fr; gap: 4px 12px; padding: 12px !important; align-items: center; }
      .lanzamiento-logo-grande { width: 72px !important; height: 56px !important; grid-row: span 2; object-fit: contain; }
      .lanzamiento-destacado .eyebrow { font-size: var(--t-2xs) !important; }
      .lanzamiento-destacado h2 { font-size: var(--t-lg) !important; }
      .lanzamiento-destacado { grid-template-columns: 72px 1fr auto !important; }
      .lanzamiento-destacado > div { grid-column: 2 / 4; grid-row: 1; }
      .lanzamiento-logo-grande { grid-row: 1 / 3 !important; }
      .lanzamiento-destacado .lanz-reloj { grid-column: 2; grid-row: 2; justify-self: start; }
      .lanzamiento-destacado .lanz-avisar { grid-column: 3; grid-row: 2; }` },
  // ── Comunidad ──
  { id: 'foro', contenido: '.foro-seccion', grupo: 'comunidad', ruta: '/foro',
    css: `#foroTitulo { position: absolute !important; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
      .foro-cabecera { min-height: 0 !important; margin-bottom: 8px !important; }
      .foro-calientes h2 { font-size: var(--t-md) !important; }
      .foro-chips-secciones { display: none !important; }
      .foro-seccion > div:not(.foro-fila), .foro-seccion { display: block !important; }
      .foro-fila { display: grid !important; grid-template-columns: 32px 1fr; gap: 0 12px; width: 100% !important; min-height: 0 !important; padding: 12px !important; margin-bottom: 8px; align-items: center; }
      .foro-fila-icono { width: 32px !important; height: 32px !important; }
      .foro-fila-cuerpo h3 { display: flex !important; gap: 8px; align-items: center; }
      .foro-fila-cuerpo .subtext { display: none !important; }` },
  { id: 'comunidad', contenido: '.com-persona', grupo: 'comunidad', ruta: '/usuarios',
    css: `.page-header.cab-lista { display: none !important; }
      .com-podio { padding: 12px !important; }
      .com-podio h2 { display: none !important; }
      .com-podio-tres { display: grid !important; grid-template-columns: repeat(3, 1fr); gap: 8px !important; margin-top: 8px; }
      .com-puesto { flex-direction: column !important; align-items: center !important; text-align: center; padding: 8px 4px !important; min-height: 0 !important; gap: 4px !important; display: flex !important; }
      .com-puesto-cara { width: 32px !important; height: 32px !important; }
      .com-puesto-xp { font-size: var(--t-2xs) !important; } .com-puesto-medalla { position: static !important; }
      .com-dos .seccion-cabecera { display: none !important; }` },
  // ── Jugar ──
  { id: 'torneos', contenido: '.torneos-rejilla', grupo: 'jugar', ruta: '/torneos', pc: true,
    css: `@media (max-width: 599px) {
        .torneos-heroe { display: none !important; }
        .torneos-mandos { display: none !important; }
        .torneo-pestanas-chips { display: flex !important; flex-wrap: nowrap !important; overflow-x: auto; gap: 8px !important; margin-inline: -24px; padding-inline: 24px; scrollbar-width: none; align-items: center; }
        .torneo-pestanas-chips > * { flex: 0 0 auto; }
        .proto-acc { display: inline-flex; gap: 8px; flex: 0 0 auto; }
        .proto-acc .btn-primary, .proto-acc .btn-secondary { width: 36px; min-width: 36px; height: 36px; min-height: 36px; padding: 0; border-radius: 50%; font-size: 0; justify-content: center; }
        .proto-acc .btn-primary::before { content: '+'; font-size: var(--t-lg); font-weight: 700; }
      }
      @media (min-width: 600px) { .torneo-pestanas-chips { flex-wrap: nowrap !important; } }`,
    js: `(movil) => { if (!movil) return; const n = document.querySelector('.torneo-pestanas-chips'); const a = document.querySelector('.torneos-heroe-acciones'); if (n && a) { const c = a.cloneNode(true); c.className = 'proto-acc'; n.prepend(c); } }` },
  { id: 'partidas', contenido: '#partidasLista', grupo: 'jugar', ruta: '/mis-partidas',
    css: `.cabecera-pagina h1 { position: absolute !important; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
      .cabecera-pagina.cab-lista { justify-content: flex-end !important; min-height: 0 !important; margin-bottom: 8px !important; }
      #btnApuntarPartida { min-height: 40px !important; }
      .partidas-hero { display: grid !important; grid-template-columns: 64px 1fr; gap: 12px; padding: 12px !important; align-items: center; }
      .partidas-hero-anillo { width: 64px !important; height: 64px !important; }
      .partidas-hero-anillo { font-size: var(--t-xs) !important; } .partidas-hero-anillo small, .partidas-hero-anillo span:not(:first-child) { display: none !important; }
      .partidas-forma, .partidas-hero-datos > .subtext { display: none !important; }
      .partidas-hero-mazo { grid-column: 1 / -1; padding: 8px 12px !important; min-height: 0 !important; }
      .partidas-hero-mazo .partidas-sprite { width: 32px !important; height: 32px !important; }
      #btnDesdeRepeticion, .partidas-barra { display: none !important; }` },
  { id: 'laboratorio', contenido: 'section.lp-bloque', grupo: 'jugar', ruta: '/laboratorio',
    css: `.lp-cabecera p.subtext, .lp-cabecera .lp-que { display: none !important; }
      .lp-cabecera h1 { position: absolute !important; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
      .lp-mazo { display: grid !important; grid-template-columns: 1fr auto auto; gap: 8px; align-items: center; padding: 12px !important; }
      .lp-mazo-editar, .lp-mazo-probar { min-height: 36px !important; height: 36px; padding-block: 0 !important; }` },
  { id: 'repeticiones', contenido: '#repTexto', grupo: 'jugar', ruta: '/repeticiones',
    css: `.rep-lema, .rep-pegar-ayuda { display: none !important; }
      .rep-cabecera h1 { position: absolute !important; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
      #repTexto { height: 140px !important; min-height: 140px !important; }
      .proto-ayuda { font-size: var(--t-sm); color: var(--text-mid); margin: 0 0 8px; }`,
    js: `() => { const t = document.getElementById('repPegarTitulo'); if (t) { const p = document.createElement('p'); p.className = 'proto-ayuda'; p.innerHTML = 'Pega el registro de JCC Pokémon Live. <a href="#">¿Cómo se copia?</a>'; t.after(p); } }` },
  { id: 'constructor', contenido: '.cm-resumen', grupo: 'jugar', ruta: '/constructor?mazo=mazo-1',
    css: `.breadcrumb { display: none !important; }
      .cm-pestanias { margin-bottom: 8px !important; }
      .cm-hero { min-height: 0 !important; height: 88px; padding: 8px 12px !important; }
      .cm-hero-arte { opacity: .35; }
      .cm-total { width: 48px !important; height: 48px !important; }
      #cmCoste, #cmEstadoGuardado { display: none !important; }
      .cm-acciones { padding-block: 4px !important; }
      .cm-acciones .cm-btn { min-height: 40px !important; height: 40px; }
      .cm-resumen { padding-block: 4px !important; }` },
  // ── Perfil ──
  { id: 'perfil', contenido: '.vitrina-rejilla', grupo: 'perfil', ruta: '/perfil',
    css: `.profile-hero-banner { height: 88px !important; min-height: 88px !important; }
      .profile-hero-edit-btn#btnEditBanner { min-height: 36px !important; }
      .profile-hero-avatar-wrap { width: 72px !important; height: 72px !important; margin-top: -40px !important; }
      .proto-ico { width: 40px !important; min-width: 40px !important; height: 40px !important; min-height: 40px !important; padding: 0 !important; font-size: 0 !important; justify-content: center; border-radius: 50% !important; }
      .proto-ico svg { width: 18px; height: 18px; }
      .profile-hero-avatar { width: 72px !important; height: 72px !important; font-size: var(--t-xl) !important; }
      .profile-hero-info h1 { font-size: var(--t-xl) !important; }
      .profile-bio { -webkit-line-clamp: 1; display: -webkit-box !important; -webkit-box-orient: vertical; overflow: hidden; }
      .perfil-cifras { min-height: 0 !important; }
      .perfil-cifra { min-height: 48px !important; height: 52px; padding-block: 4px !important; }
      .perfil-cifra .valor { font-size: var(--t-lg) !important; line-height: 1.1; }
      .perfil-cifra .rotulo { font-size: var(--t-2xs) !important; }`,
    js: `() => { const v = document.getElementById('perfilVitrina'); if (!v) return; for (const b of v.querySelectorAll('button, a')) { const t = b.textContent.trim(); if (t === 'Compartir' || t === 'Cambiar') { b.classList.add('proto-ico'); b.setAttribute('aria-label', t) } } for (const e of v.querySelectorAll('h2, h3, strong')) { if (e.textContent.trim() === 'Vitrina') e.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)' } }` },
]
