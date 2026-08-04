// Iconos SVG en línea, estilo trazo fino (misma familia visual que
// Feather/Lucide) — sin depender de ningún paquete ni CDN externo. Se
// heredan el color de texto (`stroke="currentColor"`) para que combinen
// con cualquier fondo claro u oscuro sin CSS aparte.
function icon(inner, size = 18) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`
}

export const icons = {
  search: (size) => icon('<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>', size),
  bell: (size) => icon('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path>', size),
  mail: (size) => icon('<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline>', size),
  user: (size) => icon('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>', size),
  logOut: (size) => icon('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16,17 21,12 16,7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line>', size),
  star: (size) => icon('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>', size),
  edit: (size) => icon('<path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>', size),
  sun: (size) =>
    icon(
      '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>',
      size
    ),
  moon: (size) => icon('<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>', size),
  messageSquare: (size) => icon('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>', size),
  // A diferencia de los demás iconos, admite un segundo argumento para
  // pintarse relleno (guardado) o solo el contorno (sin guardar) — evita
  // tener dos SVGs distintos para el mismo icono en sus dos estados.
  bookmark: (size, filled = false) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`,
  flag: (size) => icon('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line>', size),
  bookOpen: (size) => icon('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>', size),
  graduationCap: (size) => icon('<path d="M22 10 12 5 2 10l10 5 10-5Z"></path><path d="M6 12v5c0 1 3 3 6 3s6-2 6-3v-5"></path>', size),
  clock: (size) => icon('<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>', size),
  folder: (size) => icon('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>', size),
  layers: (size) => icon('<polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline>', size),
  compass: (size) => icon('<circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>', size),
  trophy: (size) => icon('<path d="M7 4h10v4a5 5 0 0 1-10 0z"></path><path d="M5 4h2v3a3 3 0 0 1-3-3z"></path><path d="M19 4h-2v3a3 3 0 0 0 3-3z"></path><path d="M12 13v4"></path><path d="M8 21h8"></path><path d="M12 17v4"></path>', size),
  users: (size) => icon('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>', size),
  bug: (size) => icon('<rect x="8" y="6" width="8" height="14" rx="4"></rect><path d="M19 7l-3 2"></path><path d="M5 7l3 2"></path><path d="M19 19l-3-2"></path><path d="M5 19l3-2"></path><path d="M12 6V2"></path><path d="M9 2h6"></path>', size),
  barChart: (size) => icon('<line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="16"></line>', size),
  trash: (size) => icon('<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>', size),
  image: (size) => icon('<rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline>', size),
  refreshCw: (size) => icon('<polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>', size),
  flame: (size) => icon('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>', size),
  lock: (size) => icon('<rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>', size),
  sparkles: (size) => icon('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"></path>', size),
  eye: (size) => icon('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>', size),
  upload: (size) => icon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line>', size),
  settings: (size) =>
    icon(
      '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>',
      size
    ),
  link: (size) => icon('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>', size),
  listOrdered: (size) => icon('<line x1="10" y1="6" x2="21" y2="6"></line><line x1="10" y1="12" x2="21" y2="12"></line><line x1="10" y1="18" x2="21" y2="18"></line><path d="M4 6h1v4"></path><path d="M4 10h2"></path><path d="M6 18H4c0-1 2-1.5 2-2.5S5 14 4 14"></path>', size),
  checkSquare: (size) => icon('<polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>', size),
  helpCircle: (size) => icon('<circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line>', size),
  checkCircle: (size) => icon('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>', size),
  xCircle: (size) => icon('<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>', size),
  package: (size) => icon('<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line>', size),
  send: (size) => icon('<line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>', size),
  volumeX: (size) => icon('<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>', size),
  ban: (size) => icon('<circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>', size),
  crown: (size) => icon('<path d="M2 18h20l-2-8-5 4-3-7-3 7-5-4-2 8z"></path>', size),
  sprout: (size) => icon('<path d="M7 20h10"></path><path d="M10 20c0-4 2-6 2-6"></path><path d="M14 20c0-4-2-6-2-6"></path><path d="M12 14c-3 0-5-2-5-5 3 0 5 1 5 3"></path><path d="M12 14c3 0 5-2 5-5-3 0-5 1-5 3"></path>', size),
  trendingUp: (size) => icon('<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline>', size),
  shield: (size) => icon('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>', size),
  zap: (size) => icon('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>', size),
  lightbulb: (size) => icon('<path d="M9 18h6"></path><path d="M10 22h4"></path><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"></path>', size),
  triangleAlert: (size) => icon('<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>', size),
  pin: (size) => icon('<path d="M12 2a7 7 0 0 0-7 7c0 6 7 13 7 13s7-7 7-13a7 7 0 0 0-7-7z"></path><circle cx="12" cy="9" r="2.5"></circle>', size),

  // ── Añadidos para sustituir a los emojis del contenido ──
  //
  // El vocabulario no es inventado: sale de los emojis que se usan de
  // verdad en las portadas de las guías, en las categorías y en el
  // selector del editor. Mismo trazo de 2 y mismo lienzo de 24 que los de
  // arriba, para que no se note cuáles vinieron después.
  cards: (size) => icon('<rect x="3" y="6" width="11" height="15" rx="2"></rect><path d="M8 3h9a2 2 0 0 1 2 2v11"></path>', size),
  coins: (size) => icon('<ellipse cx="12" cy="6" rx="8" ry="3"></ellipse><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6"></path><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"></path>', size),
  gem: (size) => icon('<path d="M6 3h12l4 6-10 12L2 9z"></path><path d="M2 9h20"></path><path d="M12 21 8 9l2-6"></path><path d="m12 21 4-12-2-6"></path>', size),
  target: (size) => icon('<circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="5"></circle><circle cx="12" cy="12" r="1.5"></circle>', size),
  snowflake: (size) => icon('<line x1="12" y1="2" x2="12" y2="22"></line><line x1="3.3" y1="7" x2="20.7" y2="17"></line><line x1="3.3" y1="17" x2="20.7" y2="7"></line><path d="m9 5 3-3 3 3"></path><path d="m9 19 3 3 3-3"></path>', size),
  gamepad: (size) => icon('<line x1="7" y1="12" x2="11" y2="12"></line><line x1="9" y1="10" x2="9" y2="14"></line><line x1="15" y1="13" x2="15.01" y2="13"></line><line x1="17.5" y1="11" x2="17.51" y2="11"></line><rect x="2" y="6" width="20" height="12" rx="5"></rect>', size),
  droplet: (size) => icon('<path d="M12 2.7 6.7 8a7.5 7.5 0 1 0 10.6 0z"></path>', size),
  palette: (size) => icon('<circle cx="13.5" cy="6.5" r="1"></circle><circle cx="17.5" cy="10.5" r="1"></circle><circle cx="8.5" cy="7.5" r="1"></circle><circle cx="6.5" cy="12.5" r="1"></circle><path d="M12 2a10 10 0 0 0 0 20 2.5 2.5 0 0 0 2-4 2.5 2.5 0 0 1 2-4h2a4 4 0 0 0 4-4 10 10 0 0 0-10-8z"></path>', size),
  ruler: (size) => icon('<path d="M21.3 8.7 8.7 21.3a1 1 0 0 1-1.4 0l-4.6-4.6a1 1 0 0 1 0-1.4L15.3 2.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4z"></path><path d="m7.5 10.5 2 2"></path><path d="m10.5 7.5 2 2"></path><path d="m13.5 4.5 2 2"></path>', size),
  receipt: (size) => icon('<path d="M4 2v20l2.5-1.5L9 22l2.5-1.5L14 22l2.5-1.5L19 22V2l-2.5 1.5L14 2l-2.5 1.5L9 2 6.5 3.5z"></path><line x1="8" y1="8" x2="15" y2="8"></line><line x1="8" y1="12" x2="15" y2="12"></line>', size),
  hash: (size) => icon('<line x1="4" y1="9" x2="20" y2="9"></line><line x1="4" y1="15" x2="20" y2="15"></line><line x1="10" y1="3" x2="8" y2="21"></line><line x1="16" y1="3" x2="14" y2="21"></line>', size),
  scan: (size) => icon('<path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path><circle cx="12" cy="12" r="3.5"></circle>', size),
  leaf: (size) => icon('<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z"></path><path d="M2 21c0-3 1.9-5.7 4.5-7.5"></path>', size),
}

// Los nombres válidos, sacados del propio objeto: si se añade un icono
// arriba, esta lista se entera sola. Una lista escrita a mano al lado se
// desincroniza el día que alguien añada uno y no baje hasta aquí.
export const ICON_NAMES = Object.keys(icons)
