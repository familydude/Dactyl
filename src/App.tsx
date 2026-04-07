import { useState, useEffect, useCallback } from 'react'
import { loadDict, scanLine, recomputeLine, ScannedLine, Stress } from './lib/scansion'
import ScansionDisplay from './components/ScansionDisplay'
import ReferencePanel from './components/ReferencePanel'
import './App.css'

const PLACEHOLDER = `Shall I compare thee to a summer's day?
Thou art more lovely and more temperate.
To be or not to be, that is the question.`

export default function App() {
  const [input, setInput] = useState('')
  const [lines, setLines] = useState<ScannedLine[]>([])
  const [loading, setLoading] = useState(true)
  const [dictError, setDictError] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [refOpen, setRefOpen] = useState(false)

  useEffect(() => {
    loadDict()
      .then(() => setLoading(false))
      .catch(() => {
        setLoading(false)
        setDictError(true)
      })
  }, [])

  const handleScan = useCallback(() => {
    if (!input.trim()) return
    setScanning(true)
    setTimeout(() => {
      const scanned = input
        .split('\n')
        .filter(l => l.trim())
        .map(l => scanLine(l))
      setLines(scanned)
      setScanning(false)
    }, 0)
  }, [input])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleScan()
  }

  const handleToggleStress = useCallback((lineIdx: number, sylIdx: number) => {
    setLines(prev =>
      prev.map((line, li) => {
        if (li !== lineIdx) return line
        const newSyllables = line.syllables.map((syl, si) =>
          si !== sylIdx
            ? syl
            : { ...syl, stress: (syl.stress === 1 ? 0 : 1) as Stress, overridden: true },
        )
        return recomputeLine({ ...line, syllables: newSyllables })
      }),
    )
  }, [])

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-mark">ˈ˘˘</span>
            <span className="logo-text">Dactyl</span>
          </div>
          <p className="tagline">Poetry scansion in your browser</p>
          <button
            className="ref-toggle"
            onClick={() => setRefOpen(o => !o)}
            aria-expanded={refOpen}
          >
            {refOpen ? 'Hide' : 'Show'} reference
          </button>
        </div>
      </header>

      {refOpen && <ReferencePanel />}

      <main className="main">
        {dictError && (
          <div className="alert">
            Could not load the CMU Pronouncing Dictionary — stress marks are estimated only.
          </div>
        )}

        <section className="input-section">
          <textarea
            id="poetry-input"
            className="poetry-input"
            rows={6}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={PLACEHOLDER}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            aria-label="Enter lines of poetry"
          />
          <div className="input-footer">
            <span className="hint">
              {loading ? 'Loading CMU dictionary…' : 'Ctrl+Enter to scan · click any marker to override stress'}
            </span>
            <button
              className="btn-scan"
              onClick={handleScan}
              disabled={loading || scanning || !input.trim()}
            >
              {scanning ? 'Scanning…' : 'Scan'}
            </button>
          </div>
        </section>

        {lines.length > 0 && (
          <section className="results">
            {lines.map((line, li) => (
              <ScansionDisplay
                key={`${li}-${line.raw}`}
                line={line}
                lineIndex={li}
                onToggleStress={si => handleToggleStress(li, si)}
              />
            ))}
          </section>
        )}
      </main>

      <footer className="app-footer">
        Stress data from the{' '}
        <a
          href="https://github.com/cmusphinx/cmudict"
          target="_blank"
          rel="noopener noreferrer"
        >
          CMU Pronouncing Dictionary
        </a>
        . Click any syllable to override its stress.
      </footer>
    </div>
  )
}
