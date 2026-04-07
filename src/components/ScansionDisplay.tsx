import { ScannedLine, FootType } from '../lib/scansion'
import './ScansionDisplay.css'

interface Props {
  line: ScannedLine
  lineIndex: number
  onToggleStress: (sylIdx: number) => void
}

const FOOT_COLOR: Record<FootType, string> = {
  iamb:        'var(--foot-iamb)',
  trochee:     'var(--foot-trochee)',
  dactyl:      'var(--foot-dactyl)',
  anapest:     'var(--foot-anapest)',
  spondee:     'var(--foot-spondee)',
  pyrrhic:     'var(--foot-pyrrhic)',
  amphibrach:  'var(--foot-amphibrach)',
  amphimacer:  'var(--foot-amphimacer)',
  monosyllable:'var(--foot-mixed)',
  unknown:     'var(--foot-mixed)',
}

const STRESS_MARK: Record<0 | 1, string> = {
  0: '˘',  // breve — unstressed
  1: 'ˈ',  // ictus — stressed
}

export default function ScansionDisplay({ line, onToggleStress }: Props) {
  // Build a flat list of (foot index, position-in-foot) for each syllable
  // so we can draw dividers between feet.
  const sylToFoot: { footIdx: number; posInFoot: number; footSize: number }[] = []
  line.feet.forEach((foot, fi) => {
    foot.syllables.forEach((_, pi) => {
      sylToFoot.push({ footIdx: fi, posInFoot: pi, footSize: foot.syllables.length })
    })
  })

  return (
    <div className="scansion-block">
      {/* ── Meter label ── */}
      <div className="meter-label">{line.meter}</div>

      {/* ── Scansion row (markers + syllable texts) ── */}
      <div className="scansion-row" role="group" aria-label={`Scansion of: ${line.raw}`}>
        {line.syllables.map((syl, si) => {
          const { footIdx, posInFoot, footSize } = sylToFoot[si] ?? { footIdx: 0, posInFoot: 0, footSize: 1 }
          const foot = line.feet[footIdx]
          const isLastInFoot = posInFoot === footSize - 1
          const isLastFoot = footIdx === line.feet.length - 1
          const color = foot ? FOOT_COLOR[foot.type] : 'var(--text-muted)'

          return (
            <span
              key={si}
              className={[
                'syllable-cell',
                isLastInFoot && !isLastFoot ? 'foot-divider' : '',
                syl.uncertain && !syl.overridden ? 'uncertain' : '',
              ].filter(Boolean).join(' ')}
              style={{ '--foot-color': color } as React.CSSProperties}
              onClick={() => onToggleStress(si)}
              role="button"
              tabIndex={0}
              aria-label={`${syl.text}: ${syl.stress ? 'stressed' : 'unstressed'}${syl.uncertain ? ' (estimated)' : ''}${syl.overridden ? ' (overridden)' : ''}`}
              onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onToggleStress(si)}
              title={`Click to toggle stress${syl.uncertain ? '\n⚠ Not in CMU dict — stress estimated' : ''}${syl.overridden ? '\n✎ Manually overridden' : ''}`}
            >
              <span className={`stress-mark ${syl.stress ? 'stressed' : 'unstressed'}${syl.overridden ? ' overridden' : ''}`}>
                {STRESS_MARK[syl.stress]}
              </span>
              <span className={`syl-text${syl.uncertain && !syl.overridden ? ' syl-uncertain' : ''}`}>
                {syl.text}
              </span>
            </span>
          )
        })}
      </div>

      {/* ── Foot labels row ── */}
      <div className="feet-row">
        {line.feet.map((foot, fi) => (
          <span
            key={fi}
            className="foot-label"
            style={{ '--foot-color': FOOT_COLOR[foot.type] } as React.CSSProperties}
          >
            {foot.type}
            <span className="foot-pattern">
              {foot.syllables.map(s => STRESS_MARK[s.stress]).join('')}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
