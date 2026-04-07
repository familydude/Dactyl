/**
 * Client-side poetry scansion engine.
 *
 * Pipeline:
 *   1. Tokenise a line into word tokens
 *   2. Look up each word in the CMU dict JSON
 *   3. Syllabify words not found in CMU dict (rule-based fallback)
 *   4. Assign stress pattern → SyllableToken[]
 *   5. Group syllables into metrical feet
 *   6. Detect the dominant meter for the line
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Stress = 0 | 1  // 0 = unstressed  1 = stressed

export interface SyllableToken {
  text: string        // display text for this syllable
  stress: Stress
  wordIndex: number   // which word token this belongs to
  uncertain: boolean  // true when stress was estimated, not from CMU dict
  overridden: boolean // true when the user manually changed the stress
}

export type FootType =
  | 'iamb'        // ˘ ˈ
  | 'trochee'     // ˈ ˘
  | 'spondee'     // ˈ ˈ
  | 'pyrrhic'     // ˘ ˘
  | 'dactyl'      // ˈ ˘ ˘
  | 'anapest'     // ˘ ˘ ˈ
  | 'amphibrach'  // ˘ ˈ ˘
  | 'amphimacer'  // ˈ ˘ ˈ
  | 'monosyllable'
  | 'unknown'

export interface MetricalFoot {
  syllables: SyllableToken[]
  type: FootType
}

export interface ScannedLine {
  raw: string
  syllables: SyllableToken[]
  feet: MetricalFoot[]
  meter: string
}

// ---------------------------------------------------------------------------
// CMU dict
// ---------------------------------------------------------------------------

let _dict: Record<string, number[][]> | null = null

export async function loadDict(): Promise<void> {
  if (_dict) return
  const res = await fetch('/cmudict.json')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  _dict = (await res.json()) as Record<string, number[][]>
}

function lookupWord(word: string): number[] | null {
  if (!_dict) return null
  const key = word.toLowerCase().replace(/[^a-z']/g, '')
  const entry = _dict[key] ?? _dict[key.replace(/'+$/, '')] ?? null
  return entry ? entry[0] : null
}

// ---------------------------------------------------------------------------
// Rule-based fallback syllabifier
// ---------------------------------------------------------------------------

function heuristicStresses(word: string): number[] {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!clean) return [0]

  const vowelGroups = clean.match(/[aeiouy]+/g) ?? ['a']
  let count = vowelGroups.length

  // Silent-e: "make", "time" → subtract one
  if (clean.length > 2 && /[^aeiouy]e$/.test(clean)) {
    count = Math.max(1, count - 1)
  }

  if (count === 1) return [1]
  if (count === 2) return [1, 0]  // trochaic default

  // Longer words: primary stress on penultimate syllable
  return Array.from({ length: count }, (_, i) => (i === count - 2 ? 1 : 0))
}

// ---------------------------------------------------------------------------
// Syllable text splitter (best-effort display)
// ---------------------------------------------------------------------------

function splitSyllableTexts(word: string, count: number): string[] {
  const clean = word.replace(/[^a-zA-Z']/g, '')
  if (count === 1 || !clean) return [clean || word]

  const len = clean.length
  const result: string[] = []
  let pos = 0
  for (let i = 0; i < count; i++) {
    const remaining = count - i
    const size = Math.round((len - pos) / remaining)
    result.push(clean.slice(pos, pos + Math.max(1, size)))
    pos += Math.max(1, size)
  }
  return result
}

// ---------------------------------------------------------------------------
// Foot pattern recognition
// ---------------------------------------------------------------------------

function patternToFoot(pattern: Stress[]): FootType {
  switch (pattern.join('')) {
    case '01':  return 'iamb'
    case '10':  return 'trochee'
    case '11':  return 'spondee'
    case '00':  return 'pyrrhic'
    case '100': return 'dactyl'
    case '001': return 'anapest'
    case '010': return 'amphibrach'
    case '101': return 'amphimacer'
    case '0':
    case '1':   return 'monosyllable'
    default:    return 'unknown'
  }
}

// ---------------------------------------------------------------------------
// Foot detection
// ---------------------------------------------------------------------------

export function buildFeet(syllables: SyllableToken[]): MetricalFoot[] {
  if (!syllables.length) return []

  const stressed = syllables.filter(s => s.stress === 1).length
  const total = syllables.length
  // If ratio of total:stressed > ~2.4 assume triple meter
  const isTriple = stressed > 0 && total / stressed > 2.4

  const feet: MetricalFoot[] = []
  let i = 0

  while (i < syllables.length) {
    const remaining = syllables.length - i

    if (isTriple && remaining >= 3) {
      const chunk = syllables.slice(i, i + 3)
      feet.push({ syllables: chunk, type: patternToFoot(chunk.map(s => s.stress)) })
      i += 3
    } else if (remaining >= 2) {
      const chunk = syllables.slice(i, i + 2)
      feet.push({ syllables: chunk, type: patternToFoot(chunk.map(s => s.stress)) })
      i += 2
    } else {
      const chunk = syllables.slice(i, i + 1)
      feet.push({ syllables: chunk, type: patternToFoot(chunk.map(s => s.stress)) })
      i += 1
    }
  }

  return feet
}

// ---------------------------------------------------------------------------
// Meter detection
// ---------------------------------------------------------------------------

const COUNT_NAMES: Record<number, string> = {
  1: 'monometer',
  2: 'dimeter',
  3: 'trimeter',
  4: 'tetrameter',
  5: 'pentameter',
  6: 'hexameter',
  7: 'heptameter',
  8: 'octameter',
}

export function detectMeter(feet: MetricalFoot[]): string {
  if (!feet.length) return '—'

  const counts: Partial<Record<FootType, number>> = {}
  for (const f of feet) counts[f.type] = (counts[f.type] ?? 0) + 1

  const meaningful = feet.filter(
    f => f.type !== 'monosyllable' && f.type !== 'unknown',
  )
  const total = meaningful.length || 1

  const iambic   = ((counts.iamb ?? 0) + (counts.pyrrhic ?? 0) + (counts.spondee ?? 0)) / total
  const trochaic = (counts.trochee ?? 0) / total
  const dactylic = (counts.dactyl ?? 0) / total
  const anapestic = (counts.anapest ?? 0) / total

  const T = 0.45
  let dominant = 'mixed'
  if (iambic   >= T) dominant = 'iambic'
  else if (trochaic  >= T) dominant = 'trochaic'
  else if (dactylic  >= T) dominant = 'dactylic'
  else if (anapestic >= T) dominant = 'anapestic'

  const countName = COUNT_NAMES[feet.length] ?? `${feet.length}-foot`

  return dominant === 'mixed'
    ? `mixed meter (${feet.length} feet)`
    : `${dominant} ${countName}`
}

// ---------------------------------------------------------------------------
// Recompute feet + meter after a manual stress override
// ---------------------------------------------------------------------------

export function recomputeLine(line: ScannedLine): ScannedLine {
  const feet = buildFeet(line.syllables)
  return { ...line, feet, meter: detectMeter(feet) }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function scanLine(raw: string): ScannedLine {
  const tokens = raw.trim().split(/\s+/).filter(Boolean)
  const syllables: SyllableToken[] = []

  tokens.forEach((token, wordIndex) => {
    const stripped = token.replace(/[^a-zA-Z']/g, '')
    if (!stripped) return

    const cmuStresses = lookupWord(stripped)
    const uncertain   = cmuStresses === null
    const stresses    = cmuStresses ?? heuristicStresses(stripped)
    const texts       = splitSyllableTexts(stripped, stresses.length)

    stresses.forEach((s, si) => {
      syllables.push({
        text: texts[si] ?? stripped,
        stress: s as Stress,
        wordIndex,
        uncertain,
        overridden: false,
      })
    })
  })

  const feet  = buildFeet(syllables)
  const meter = detectMeter(feet)
  return { raw, syllables, feet, meter }
}
