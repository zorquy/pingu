// El motor puro de torneos: pareos suizos, clasificación con desempates,
// top cut y parser de decklists de TCG Live.
//
// Traducido 1:1 a JavaScript desde `libs/engine` de TrainerArena
// (github.com/ibaimanso/TrainerArena, de Ibai Manso), que lo trae
// resuelto y probado contra su SPEC. Los nombres de funciones se
// conservan en inglés A PROPÓSITO: así cualquier cambio se puede cotejar
// contra el original línea a línea. Datos planos dentro, resultados
// deterministas fuera — nada de Supabase ni de DOM aquí.
//
// Vocabulario de resultados (outcome): 'a_wins' | 'b_wins' | 'draw' |
// 'bye' | 'forfeit_a' | 'forfeit_b' | 'forfeit_both'.

// ── Jugadores activos ──
// Activo para la ronda N: no retirado, o retirado pero con
// droppedAfterRoundNumber >= N (aún juega esa ronda).
export function activePlayersForRound(players, roundNumber) {
  return players.filter(
    (p) => !p.dropped || (p.droppedAfterRoundNumber !== null && p.droppedAfterRoundNumber >= roundNumber)
  )
}

// Cuando un grupo no se puede parear sin repetir cruces: se lanza con los
// pareos parciales válidos para que la interfaz ofrezca el pareo manual.
export class ManualPairingRequired extends Error {
  constructor(partialPairings, unpairedPlayerIds, byePlayerId) {
    super('No se pudo completar el pareo automático sin repetir cruces.')
    this.name = 'ManualPairingRequired'
    this.partialPairings = partialPairings
    this.unpairedPlayerIds = unpairedPlayerIds
    this.byePlayerId = byePlayerId
  }
}

// ── Azar reproducible (xmur3 → mulberry32) ──
// La misma semilla de texto da la misma secuencia en cualquier navegador:
// es lo que hace auditable un sorteo de ronda 1.
function xmur3(str) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return h >>> 0
  }
}

function mulberry32(seed) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seededRandom(seed) {
  return mulberry32(xmur3(seed)())
}

// Fisher–Yates reproducible; no muta la entrada.
export function seededShuffle(items, seed) {
  const random = seededRandom(seed)
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// ── Tabla oficial de estructura (SPEC §5.1 de TrainerArena) ──
export function officialStructure(playerCount) {
  if (playerCount <= 8) return { swissRounds: 3, topCutSize: 0 }
  if (playerCount <= 16) return { swissRounds: 4, topCutSize: 4 }
  if (playerCount <= 32) return { swissRounds: 6, topCutSize: 8 }
  if (playerCount <= 64) return { swissRounds: 7, topCutSize: 8 }
  if (playerCount <= 128) return { swissRounds: 6, topCutSize: 16 }
  if (playerCount <= 256) return { swissRounds: 7, topCutSize: 16 }
  if (playerCount <= 512) return { swissRounds: 8, topCutSize: 16 }
  if (playerCount <= 1024) return { swissRounds: 9, topCutSize: 32 }
  if (playerCount <= 2048) return { swissRounds: 10, topCutSize: 32 }
  return { swissRounds: 10, topCutSize: 64 }
}

// ── SHA-256 puro (hex) ──
// Para la moneda al aire reproducible del último desempate, sin depender
// de crypto.subtle (que es asíncrono y aquí todo es síncrono).
const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]

function rotr(x, n) {
  return (x >>> n) | (x << (32 - n))
}

export function sha256Hex(input) {
  const bytes = []
  for (let i = 0; i < input.length; i++) {
    let code = input.charCodeAt(i)
    if (code < 0x80) bytes.push(code)
    else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < input.length) {
      const next = input.charCodeAt(i + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00)
        bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
        i++
      } else {
        bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
      }
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    }
  }

  const bitLength = bytes.length * 8
  bytes.push(0x80)
  while (bytes.length % 64 !== 56) bytes.push(0)
  for (let i = 7; i >= 0; i--) bytes.push((bitLength / 2 ** (i * 8)) & 0xff)

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19

  const w = new Array(64)
  for (let block = 0; block < bytes.length; block += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] =
        (bytes[block + t * 4] << 24) |
        (bytes[block + t * 4 + 1] << 16) |
        (bytes[block + t * 4 + 2] << 8) |
        bytes[block + t * 4 + 3]
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3)
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10)
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7

    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const temp1 = (h + S1 + ch + K[t] + w[t]) | 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (S0 + maj) | 0
      h = g
      g = f
      f = e
      e = (d + temp1) | 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) | 0
    }

    h0 = (h0 + a) | 0
    h1 = (h1 + b) | 0
    h2 = (h2 + c) | 0
    h3 = (h3 + d) | 0
    h4 = (h4 + e) | 0
    h5 = (h5 + f) | 0
    h6 = (h6 + g) | 0
    h7 = (h7 + h) | 0
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7].map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('')
}

// ── Puntuación y desempates (SPEC §5.4–§5.5) ──
// Victoria 3 · empate 1 · derrota 0. El bye es victoria, cuenta como
// jugado y en byesReceived pero no añade rival real. Los forfeits cuentan
// como jugados para ambos y como rivales reales mutuos; forfeit_both es
// derrota para los dos.

function resultFor(match, playerId) {
  const isA = match.playerAId === playerId
  const isB = match.playerBId === playerId
  if (!isA && !isB) return null
  switch (match.outcome) {
    case 'a_wins':
      return isA ? 'win' : 'loss'
    case 'b_wins':
      return isB ? 'win' : 'loss'
    case 'draw':
      return 'draw'
    case 'bye':
      return 'win'
    case 'forfeit_a':
      return isA ? 'loss' : 'win'
    case 'forfeit_b':
      return isB ? 'loss' : 'win'
    case 'forfeit_both':
      return 'loss'
  }
  return null
}

const POINTS = { win: 3, draw: 1, loss: 0 }

// Estadísticas por jugador a partir de las partidas cerradas del snapshot.
export function computeStats(snapshot) {
  const stats = new Map()
  const ensure = (playerId) => {
    let s = stats.get(playerId)
    if (!s) {
      s = {
        playerId,
        matchPoints: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        gamesPlayed: 0,
        byesReceived: 0,
        realOpponentIds: [],
        mwp: 0,
        lastFinishedAt: null,
      }
      stats.set(playerId, s)
    }
    return s
  }

  for (const player of snapshot.players) ensure(player.id)

  for (const match of snapshot.matches) {
    const participants = [match.playerAId, match.playerBId].filter((id) => id !== null)
    for (const playerId of participants) {
      const result = resultFor(match, playerId)
      if (result === null) continue
      const s = ensure(playerId)
      s.matchPoints += POINTS[result]
      if (result === 'win') s.wins++
      else if (result === 'draw') s.draws++
      else s.losses++
      s.gamesPlayed++
      if (match.outcome === 'bye') {
        s.byesReceived++
      } else {
        const opponentId = match.playerAId === playerId ? match.playerBId : match.playerAId
        if (opponentId !== null) s.realOpponentIds.push(opponentId)
      }
      if (match.finishedAt !== null) {
        const ts = Date.parse(match.finishedAt)
        if (!Number.isNaN(ts)) {
          s.lastFinishedAt = s.lastFinishedAt === null ? ts : Math.max(s.lastFinishedAt, ts)
        }
      }
    }
  }

  for (const s of stats.values()) {
    s.mwp = s.gamesPlayed > 0 ? (s.wins + 0.5 * s.draws) / s.gamesPlayed : 0
  }
  return stats
}

// OWP: media del MWP de los rivales reales (los byes no son rivales).
export function computeOwp(stats, playerId) {
  const s = stats.get(playerId)
  if (!s || s.realOpponentIds.length === 0) return 0
  let sum = 0
  for (const oppId of s.realOpponentIds) {
    sum += stats.get(oppId)?.mwp ?? 0
  }
  return sum / s.realOpponentIds.length
}

// OOWP: (Σ OWP de rivales reales + 1.0 por bye recibido) / (reales + byes).
export function computeOowp(stats, playerId) {
  const s = stats.get(playerId)
  if (!s) return 0
  const denominator = s.realOpponentIds.length + s.byesReceived
  if (denominator === 0) return 0
  let sum = s.byesReceived * 1.0
  for (const oppId of s.realOpponentIds) {
    sum += computeOwp(stats, oppId)
  }
  return sum / denominator
}

// Orden total estricto: puntos → OWP → OOWP → finishedAt más temprano
// (sin partidas = el peor) → moneda sha256("{semilla}:{id}") lexicográfica.
export function standingsComparator(pairingSeed) {
  return (a, b) => {
    if (a.matchPoints !== b.matchPoints) return b.matchPoints - a.matchPoints
    if (a.owp !== b.owp) return b.owp - a.owp
    if (a.oowp !== b.oowp) return b.oowp - a.oowp
    const aTs = a.lastFinishedAt ?? Number.POSITIVE_INFINITY
    const bTs = b.lastFinishedAt ?? Number.POSITIVE_INFINITY
    if (aTs !== bTs) return aTs - bTs
    const aHash = sha256Hex(`${pairingSeed}:${a.playerId}`)
    const bHash = sha256Hex(`${pairingSeed}:${b.playerId}`)
    return aHash < bHash ? -1 : aHash > bHash ? 1 : 0
  }
}

// Clasificación completa, ordenada por el orden estricto de la SPEC.
export function computeStandings(snapshot, players) {
  const stats = computeStats(snapshot)
  const pool = players ?? snapshot.players
  const entries = pool.map((p) => {
    const s = stats.get(p.id) ?? {
      playerId: p.id,
      matchPoints: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      gamesPlayed: 0,
      byesReceived: 0,
      realOpponentIds: [],
      mwp: 0,
      lastFinishedAt: null,
    }
    return { ...s, owp: computeOwp(stats, p.id), oowp: computeOowp(stats, p.id) }
  })
  entries.sort(standingsComparator(snapshot.pairingSeed))
  return entries
}

// ── Pareo suizo (SPEC §5.2 ronda 1, §5.3 Monrad para las siguientes) ──

// Ronda 1: barajado reproducible con "{semilla}:round:1"; con impares, el
// último tras barajar recibe el bye.
export function pairRound1(snapshot) {
  const active = activePlayersForRound(snapshot.players, 1)
    .map((p) => p.id)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const shuffled = seededShuffle(active, `${snapshot.pairingSeed}:round:1`)

  let byePlayerId = null
  if (shuffled.length % 2 === 1) {
    byePlayerId = shuffled.pop() ?? null
  }

  const pairings = []
  for (let i = 0; i < shuffled.length; i += 2) {
    pairings.push({
      tableNumber: pairings.length + 1,
      playerAId: shuffled[i],
      playerBId: shuffled[i + 1],
    })
  }
  return { pairings, byePlayerId }
}

// Clave normalizada de cruce (menor:mayor) para el histórico de pareos.
export function pairKey(playerA, playerB) {
  return playerA < playerB ? `${playerA}:${playerB}` : `${playerB}:${playerA}`
}

const BACKTRACK_LIMIT = 40320 // 8!

// Parea un grupo UH[i] vs LH[i]; ante recruces prueba permutaciones de LH
// en orden de generación con tope global de 8! intentos. Null = imposible.
function pairGroup(group, history) {
  const half = group.length / 2
  const upper = group.slice(0, half)
  const lower = group.slice(half)

  let attempts = 0
  const used = new Array(lower.length).fill(false)
  const assignment = new Array(upper.length).fill(-1)

  const backtrack = (position) => {
    if (attempts >= BACKTRACK_LIMIT) return false
    if (position === upper.length) {
      attempts++
      return true
    }
    for (let j = 0; j < lower.length; j++) {
      if (used[j]) continue
      if (history.has(pairKey(upper[position], lower[j]))) {
        continue
      }
      used[j] = true
      assignment[position] = j
      if (backtrack(position + 1)) return true
      used[j] = false
      assignment[position] = -1
      if (attempts >= BACKTRACK_LIMIT) return false
    }
    return false
  }

  if (!backtrack(0)) return null
  return upper.map((playerA, i) => [playerA, lower[assignment[i]]])
}

// Pareo Monrad para rondas 2+. Lanza ManualPairingRequired con los pareos
// parciales válidos cuando un grupo no sale sin repetir cruces.
export function pairSwissRound({ snapshot, roundNumber, history }) {
  const activePlayers = activePlayersForRound(snapshot.players, roundNumber)
  const ranking = computeStandings(snapshot, activePlayers)

  // Bye: el peor clasificado que nunca lo recibió; si todos, el peor absoluto.
  let byePlayerId = null
  const pool = [...ranking]
  if (pool.length % 2 === 1) {
    let byeIndex = -1
    for (let i = pool.length - 1; i >= 0; i--) {
      if (pool[i].byesReceived === 0) {
        byeIndex = i
        break
      }
    }
    if (byeIndex === -1) byeIndex = pool.length - 1
    byePlayerId = pool[byeIndex].playerId
    pool.splice(byeIndex, 1)
  }

  // Grupos por puntos (el orden del ranking se conserva dentro de cada uno).
  const groups = []
  let currentPoints = null
  for (const entry of pool) {
    if (entry.matchPoints !== currentPoints) {
      groups.push([])
      currentPoints = entry.matchPoints
    }
    groups[groups.length - 1].push(entry.playerId)
  }

  // Float-down: un grupo impar (que no sea el último) baja a su peor
  // jugador a encabezar el siguiente.
  for (let g = 0; g < groups.length; g++) {
    if (groups[g].length % 2 === 1) {
      if (g === groups.length - 1) {
        throw new ManualPairingRequired([], groups.flat(), byePlayerId)
      }
      const floated = groups[g].pop()
      if (floated !== undefined) groups[g + 1].unshift(floated)
    }
  }

  // Parear cada grupo; mesas numeradas seguidas en orden de grupo.
  const pairings = []
  for (let g = 0; g < groups.length; g++) {
    const group = groups[g]
    if (group.length === 0) continue
    const pairs = pairGroup(group, history)
    if (pairs === null) {
      const unpaired = groups.slice(g).flat()
      throw new ManualPairingRequired([...pairings], unpaired, byePlayerId)
    }
    for (const [playerAId, playerBId] of pairs) {
      pairings.push({ tableNumber: pairings.length + 1, playerAId, playerBId })
    }
  }

  return { pairings, byePlayerId }
}

// ── Top cut: siembra y avance «fold» (SPEC §7) ──

export function largestPowerOfTwoAtMost(n) {
  if (n < 2) return 0
  let p = 2
  while (p * 2 <= n) p *= 2
  return p
}

export function smallestPowerOfTwoAtLeast(n) {
  let p = 1
  while (p < n) p *= 2
  return p
}

// Siembra el corte desde el ranking final (los retirados ya fuera).
// Tamaño efectivo S = mayor potencia de 2 ≤ min(configurado, ranking);
// cruza semilla i vs (S+1−i) en la posición i. Null si S < 2.
export function seedTopCut(finalRankingPlayerIds, configuredTopCutSize) {
  const size = largestPowerOfTwoAtMost(Math.min(configuredTopCutSize, finalRankingPlayerIds.length))
  if (size < 2) return null
  const pairings = []
  for (let i = 1; i <= size / 2; i++) {
    pairings.push({
      bracketPosition: i,
      playerAId: finalRankingPlayerIds[i - 1],
      playerBId: finalRankingPlayerIds[size - i],
      isBye: false,
    })
  }
  return pairings
}

// Ganador de una partida cerrada; null si forfeit_both/draw (nadie gana).
export function matchWinner(match) {
  switch (match.outcome) {
    case 'a_wins':
      return match.playerAId
    case 'b_wins':
      return match.playerBId
    case 'bye':
      return match.playerAId
    case 'forfeit_a':
      return match.playerBId
    case 'forfeit_b':
      return match.playerAId
    case 'forfeit_both':
    case 'draw':
      return null
  }
  return null
}

// Avanza el bracket tras cerrar una ronda del corte: con K posiciones, el
// ganador de la posición j cruza con el de K+1−j («fold»). Un lado vacío
// = bye; los dos vacíos = el hueco se propaga; sin ganadores = acaba sin
// campeón. K = 1 = acaba de cerrarse la final.
export function advanceTopCut(closedMatches) {
  const maxPosition = Math.max(0, ...closedMatches.map((m) => m.bracketPosition))
  const k = smallestPowerOfTwoAtLeast(Math.max(closedMatches.length, maxPosition))

  const winners = new Map()
  for (const match of closedMatches) {
    const winner = matchWinner(match)
    if (winner !== null) winners.set(match.bracketPosition, winner)
  }

  if (k <= 1) {
    return { pairings: [], finished: true, championId: winners.get(1) ?? null }
  }

  if (winners.size === 0) {
    return { pairings: [], finished: true, championId: null }
  }

  const pairings = []
  for (let j = 1; j <= k / 2; j++) {
    const high = winners.get(j) ?? null
    const low = winners.get(k + 1 - j) ?? null
    if (high === null && low === null) continue
    if (high !== null && low !== null) {
      pairings.push({ bracketPosition: j, playerAId: high, playerBId: low, isBye: false })
    } else {
      const survivor = high ?? low
      pairings.push({ bracketPosition: j, playerAId: survivor, playerBId: null, isBye: true })
    }
  }

  if (pairings.length === 0) {
    return { pairings: [], finished: true, championId: null }
  }
  return { pairings, finished: false, championId: null }
}

// ── Decklists de Pokémon TCG Live (SPEC §9) ──

const SECTION_HEADERS = [
  { pattern: /^pok[eé]mon\s*:/i, section: 'pokemon' },
  { pattern: /^trainer\s*:/i, section: 'trainer' },
  { pattern: /^energy\s*:/i, section: 'energy' },
]

const CARD_LINE = /^(\d+)\s+(.+?)\s+([A-Z]{2,6})\s+(\S+)$/

// Parsea un export de TCG Live: líneas vacías y comentarios (#, //) se
// ignoran; las cabeceras de sección (con o sin tilde) cambian la sección
// actual; lo anterior a la primera cabecera se ignora.
export function parseDecklist(rawText) {
  const result = { pokemon: [], trainer: [], energy: [], total: 0 }
  let currentSection = null

  for (const rawLine of String(rawText).split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#') || line.startsWith('//')) continue

    const header = SECTION_HEADERS.find((h) => h.pattern.test(line))
    if (header) {
      currentSection = header.section
      continue
    }
    if (currentSection === null) continue

    const match = CARD_LINE.exec(line)
    if (!match) continue
    const quantity = Number(match[1])
    if (quantity <= 0) continue

    result[currentSection].push({
      quantity,
      name: match[2],
      set: match[3],
      number: match[4],
    })
    result.total += quantity
  }

  return result
}

// Exactamente 60 cartas y al menos un Pokémon.
export function validateDecklist(decklist) {
  const errors = []
  if (decklist.total !== 60) {
    errors.push(`La lista debe tener exactamente 60 cartas (tiene ${decklist.total}).`)
  }
  if (decklist.pokemon.length === 0) {
    errors.push('La lista debe incluir al menos una carta de Pokémon.')
  }
  return errors
}

// ── Conciliación de reportes (apps/api, rounds.service — SPEC §6.5) ──
// Cada reporte es relativo a quien lo firma: win+loss casan (gana quien
// dijo win), draw+draw también; cualquier otra combinación es disputa
// y se devuelve null.
export function reconcileReports(aResult, bResult) {
  if (aResult === 'win' && bResult === 'loss') return { result: 'a_wins', winnerSide: 'a' }
  if (aResult === 'loss' && bResult === 'win') return { result: 'b_wins', winnerSide: 'b' }
  if (aResult === 'draw' && bResult === 'draw') return { result: 'draw', winnerSide: null }
  return null
}

// De qué lado cae el ganador al resolver a mano (SPEC §6.7): a_wins y la
// incomparecencia de B dan a A; el espejo da a B; empate y doble
// incomparecencia no tienen ganador.
export function resolutionWinnerSide(result) {
  if (result === 'a_wins' || result === 'forfeit_b') return 'a'
  if (result === 'b_wins' || result === 'forfeit_a') return 'b'
  return null
}

// ── Política de edición de la decklist (libs/shared, policies.ts) ──
// Solo el dueño y con inscripción activa; una lista sellada no se toca.
// Se edita libremente con las inscripciones abiertas o cerradas, y hay
// UNA excepción: la PRIMERA entrega con el torneo ya en juego se admite
// (el jugador pierde las rondas que empiecen sin lista) y quien la guarda
// debe sellarla en ese mismo momento.
export function canEditDecklist(userId, { tournament, registration, decklist }) {
  if (decklist && decklist.userId !== userId) return false
  if (decklist && decklist.lockedAt !== null) return false
  if (!registration || registration.userId !== userId || registration.status !== 'active') {
    return false
  }
  if (tournament.status === 'registration_open' || tournament.status === 'registration_closed') {
    return true
  }
  return tournament.status === 'in_progress' && !decklist
}
