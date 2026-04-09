import { useEffect, useMemo, useState } from 'react'
import { findRhymes, lastWordOf, loadRhymes, RhymeResult } from '../lib/rhymes'
import './RhymePanel.css'

interface Props {
  /**
   * The lines currently in the input. Used to populate the line picker so the
   * user can quickly examine the end of any line they're working on.
   */
  lines: string[]
  onClose: () => void
}

export default function RhymePanel({ lines, onClose }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)
  const [query, setQuery]     = useState('')
  const [touched, setTouched] = useState(false)

  // Lines that contain at least one word, paired with their original index.
  const candidateLines = useMemo(
    () =>
      lines
        .map((raw, idx) => ({ raw, idx, word: lastWordOf(raw) }))
        .filter(l => l.word),
    [lines],
  )

  useEffect(() => {
    loadRhymes()
      .then(() => setLoading(false))
      .catch(() => {
        setLoading(false)
        setError(true)
      })
  }, [])

  // When the user hasn't typed anything, default the query to the last word
  // of the last input line so the panel is immediately useful.
  useEffect(() => {
    if (touched) return
    const last = candidateLines[candidateLines.length - 1]
    if (last && last.word !== query) setQuery(last.word)
  }, [candidateLines, touched, query])

  const results: RhymeResult[] = useMemo(() => {
    if (loading || error || !query.trim()) return []
    return findRhymes(query.trim())
  }, [query, loading, error])

  const perfectCount = results.filter(r => r.perfect).length

  return (
    <aside className="rhyme-panel" aria-label="Rhyme suggestions">
      <div className="rhyme-inner">
        <div className="rhyme-header">
          <h2 className="rhyme-heading">Rhyme helper</h2>
          <button className="rhyme-close" onClick={onClose} aria-label="Close rhyme panel">
            ×
          </button>
        </div>

        <div className="rhyme-controls">
          <label className="rhyme-field">
            <span className="rhyme-label">Word</span>
            <input
              type="text"
              className="rhyme-input"
              value={query}
              onChange={e => { setQuery(e.target.value); setTouched(true) }}
              placeholder="Type a word…"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
            />
          </label>

          {candidateLines.length > 0 && (
            <label className="rhyme-field">
              <span className="rhyme-label">…or pick a line ending</span>
              <select
                className="rhyme-select"
                value=""
                onChange={e => {
                  const idx = parseInt(e.target.value, 10)
                  const pick = candidateLines.find(c => c.idx === idx)
                  if (pick) { setQuery(pick.word); setTouched(true) }
                }}
              >
                <option value="" disabled>Choose a line…</option>
                {candidateLines.map(c => (
                  <option key={c.idx} value={c.idx}>
                    {`L${c.idx + 1}: …${c.word}`}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="rhyme-results">
          {loading && <p className="rhyme-status">Loading rhyme dictionary…</p>}
          {error && (
            <p className="rhyme-status rhyme-error">
              Could not load the rhyme dictionary.
            </p>
          )}
          {!loading && !error && !query.trim() && (
            <p className="rhyme-status">Type a word to see rhymes.</p>
          )}
          {!loading && !error && query.trim() && results.length === 0 && (
            <p className="rhyme-status">
              No rhymes found for <em>{query.trim()}</em>.
            </p>
          )}
          {!loading && !error && results.length > 0 && (
            <>
              <p className="rhyme-summary">
                {perfectCount > 0
                  ? `${results.length} rhyme${results.length === 1 ? '' : 's'} for `
                  : `${results.length} near-rhyme${results.length === 1 ? '' : 's'} for `}
                <strong>{query.trim().toLowerCase()}</strong>
                {perfectCount === 0 && ' (not in dictionary — letter-suffix matches)'}
              </p>
              <ul className="rhyme-list">
                {results.map(r => (
                  <li
                    key={r.word}
                    className={`rhyme-word${r.perfect ? '' : ' rhyme-word-near'}`}
                  >
                    {r.word}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}
