/**
 * Fetches the CMU Pronouncing Dictionary and converts it to two compact JSON
 * lookups used by the client-side engine.
 *
 * Output files:
 *
 *   public/cmudict.json  — stress patterns for scansion
 *     {
 *       "hello":  [[1, 0]],           // stressed, unstressed
 *       "record": [[1, 0], [0, 1]],   // two pronunciations
 *     }
 *   Each pronunciation is an array of stress values (0 or 1) for each VOWEL
 *   phoneme only. Secondary stress (2) is mapped to 1 (stressed).
 *
 *   public/rhymes.json  — rhyme index keyed by the "rhyme tail": the phonemes
 *   from the last stressed vowel to the end of the word (stress digits
 *   stripped). Example: "hello" (HH AH0 L OW1) → key "OW", value ["hello",…].
 *     {
 *       "OW":     ["hello", "mellow", ...],
 *       "AY-T":   ["night", "light", ...],
 *     }
 *   Words in each bucket are deduplicated and sorted alphabetically.
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DICT_OUT   = join(__dirname, '..', 'public', 'cmudict.json')
const RHYMES_OUT = join(__dirname, '..', 'public', 'rhymes.json')
const DICT_URL =
  'https://raw.githubusercontent.com/cmusphinx/cmudict/master/cmudict.dict'

console.log('Fetching CMU Pronouncing Dictionary…')

let text
try {
  // Try Node fetch first (respects NODE_EXTRA_CA_CERTS + HTTPS_PROXY env)
  const res = await fetch(DICT_URL)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  text = await res.text()
} catch {
  // Fall back to curl which picks up the system proxy automatically
  console.log('  fetch failed, trying curl…')
  try {
    text = execSync(
      `curl -sS --max-time 60 ${process.env.HTTPS_PROXY ? `--proxy "${process.env.HTTPS_PROXY}"` : ''} "${DICT_URL}"`,
      { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 },
    )
  } catch (e) {
    throw new Error(`curl also failed: ${e}`)
  }
}

const dict    = Object.create(null)  // avoid prototype property collisions
const rhymes  = Object.create(null)

// Skip rhyme entries for words that look like abbreviations, proper nouns,
// punctuation, or contractions. This keeps suggestions clean and the file
// small without being too aggressive.
function isRhymeCandidate(word) {
  if (word.length < 2) return false
  if (!/^[a-z]+$/.test(word)) return false   // drop things like "a.", "'bout"
  return true
}

function rhymeKey(phonemes) {
  // Strip stress digits and find the index of the last stressed vowel.
  let lastStressIdx = -1
  for (let i = 0; i < phonemes.length; i++) {
    const p = phonemes[i]
    // Primary (1) and secondary (2) both count for rhyme purposes. If the
    // word has no stressed vowel at all, fall back to the last vowel.
    if (/[12]$/.test(p)) lastStressIdx = i
  }
  if (lastStressIdx === -1) {
    for (let i = phonemes.length - 1; i >= 0; i--) {
      if (/[012]$/.test(phonemes[i])) { lastStressIdx = i; break }
    }
  }
  if (lastStressIdx === -1) return null

  return phonemes
    .slice(lastStressIdx)
    .map(p => p.replace(/[012]$/, ''))
    .join('-')
}

for (const rawLine of text.split('\n')) {
  const line = rawLine.trim()
  if (!line || line.startsWith(';;;')) continue

  const parts = line.split(/\s+/)
  const wordRaw = parts[0].replace(/\(\d+\)$/, '')  // strip "(2)" variant suffix
  const word = wordRaw.toLowerCase()
  const phonemes = parts.slice(1)

  // Vowel phonemes end in 0 / 1 / 2
  const stresses = phonemes
    .filter(p => /[012]$/.test(p))
    .map(p => (parseInt(p.slice(-1), 10) === 0 ? 0 : 1))  // 2 → 1

  if (!stresses.length) continue

  if (!dict[word]) dict[word] = []
  dict[word].push(stresses)

  if (isRhymeCandidate(word)) {
    const key = rhymeKey(phonemes)
    if (key) {
      if (!rhymes[key]) rhymes[key] = new Set()
      rhymes[key].add(word)
    }
  }
}

// Convert rhyme Sets to sorted arrays for JSON serialisation.
const rhymesOut = Object.create(null)
for (const key of Object.keys(rhymes)) {
  rhymesOut[key] = [...rhymes[key]].sort()
}

mkdirSync(dirname(DICT_OUT), { recursive: true })
writeFileSync(DICT_OUT, JSON.stringify(dict))
console.log(`Written ${Object.keys(dict).length.toLocaleString()} entries → ${DICT_OUT}`)

writeFileSync(RHYMES_OUT, JSON.stringify(rhymesOut))
const wordCount = Object.values(rhymesOut).reduce((n, arr) => n + arr.length, 0)
console.log(
  `Written ${Object.keys(rhymesOut).length.toLocaleString()} rhyme buckets ` +
  `(${wordCount.toLocaleString()} words) → ${RHYMES_OUT}`,
)
