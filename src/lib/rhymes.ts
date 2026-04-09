/**
 * Client-side rhyme lookup.
 *
 * Uses the precomputed `rhymes.json` file produced by `scripts/build-dict.mjs`.
 * Each key in that file is a "rhyme tail": the CMU phonemes from the last
 * stressed vowel to the end of the word, joined with hyphens (stress digits
 * stripped). Example: "hello" (HH AH0 L OW1) → key "OW".
 *
 * Two words rhyme (perfect rhyme) when they share a rhyme tail.
 *
 * For words missing from CMU we fall back to a crude letter-suffix match —
 * good enough to keep suggestions flowing for proper nouns and rare words.
 */

export interface RhymeResult {
  word: string
  /** True when both the query and the candidate were resolved via the CMU dict. */
  perfect: boolean
}

let _rhymes: Record<string, string[]> | null = null
/** Reverse index: word → list of rhyme keys this word participates in. */
let _wordToKeys: Map<string, string[]> | null = null

export async function loadRhymes(): Promise<void> {
  if (_rhymes) return
  const res = await fetch('/rhymes.json')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  _rhymes = (await res.json()) as Record<string, string[]>

  _wordToKeys = new Map()
  for (const key of Object.keys(_rhymes)) {
    for (const w of _rhymes[key]) {
      const list = _wordToKeys.get(w)
      if (list) list.push(key)
      else _wordToKeys.set(w, [key])
    }
  }
}

/**
 * Pull the last alphabetic word from a line of text. Returns "" if the line
 * has no usable word.
 */
export function lastWordOf(line: string): string {
  const matches = line.match(/[A-Za-z][A-Za-z']*/g)
  if (!matches || !matches.length) return ''
  return matches[matches.length - 1].toLowerCase().replace(/'+$/, '')
}

/**
 * Find rhymes for a word. Results are de-duplicated, exclude the query word
 * itself, and are returned roughly in order of "tightness" — longer shared
 * rhyme tails first, then alphabetical.
 *
 * If `limit` is provided, the result is truncated to that many entries.
 */
export function findRhymes(word: string, limit = 60): RhymeResult[] {
  if (!_rhymes || !_wordToKeys) return []
  const clean = word.toLowerCase().replace(/[^a-z']/g, '').replace(/'+$/, '')
  if (!clean) return []

  const keys = _wordToKeys.get(clean)

  if (keys && keys.length) {
    // Sort the word's rhyme keys by length descending so the tightest rhyme
    // tail (most matching phonemes) is consulted first.
    const sortedKeys = [...keys].sort((a, b) => b.length - a.length)
    const seen = new Set<string>([clean])
    const out: RhymeResult[] = []

    for (const key of sortedKeys) {
      const bucket = _rhymes[key] ?? []
      for (const w of bucket) {
        if (seen.has(w)) continue
        seen.add(w)
        out.push({ word: w, perfect: true })
        if (out.length >= limit) return out
      }
    }
    return out
  }

  // ── Fallback: word not in CMU dict ──────────────────────────────────────
  // Find words sharing a long letter suffix. Walk down from a 4-letter suffix
  // to a 2-letter suffix, collecting words from any rhyme bucket whose
  // members end with that suffix. This is approximate but better than nothing.
  const out: RhymeResult[] = []
  const seen = new Set<string>([clean])

  for (const sufLen of [5, 4, 3, 2]) {
    if (clean.length < sufLen + 1) continue
    const suf = clean.slice(-sufLen)
    for (const w of _wordToKeys.keys()) {
      if (w.length <= sufLen) continue
      if (!w.endsWith(suf)) continue
      if (seen.has(w)) continue
      seen.add(w)
      out.push({ word: w, perfect: false })
      if (out.length >= limit) return out
    }
    if (out.length >= limit / 2) break
  }
  return out
}
