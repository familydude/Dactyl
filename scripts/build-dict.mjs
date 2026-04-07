/**
 * Fetches the CMU Pronouncing Dictionary and converts it to a compact JSON
 * lookup used by the client-side scansion engine.
 *
 * Output format:
 *   {
 *     "hello": [[1, 0]],           // stressed, unstressed
 *     "record": [[1, 0], [0, 1]], // two pronunciations
 *   }
 *
 * Each pronunciation is an array of stress values (0 or 1) for each VOWEL
 * phoneme only. Secondary stress (2) is mapped to 1 (stressed).
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT = join(__dirname, '..', 'public', 'cmudict.json')
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

const dict = Object.create(null)  // avoid prototype property collisions

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
}

mkdirSync(dirname(OUTPUT), { recursive: true })
writeFileSync(OUTPUT, JSON.stringify(dict))
console.log(`Written ${Object.keys(dict).length.toLocaleString()} entries → ${OUTPUT}`)
