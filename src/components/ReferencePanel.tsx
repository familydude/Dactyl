import './ReferencePanel.css'

const FEET = [
  { name: 'Iamb',        pattern: '˘ ˈ',     example: 'a-LONE',      color: 'var(--foot-iamb)' },
  { name: 'Trochee',     pattern: 'ˈ ˘',     example: 'HA-ppy',      color: 'var(--foot-trochee)' },
  { name: 'Spondee',     pattern: 'ˈ ˈ',     example: 'DEAD SET',    color: 'var(--foot-spondee)' },
  { name: 'Pyrrhic',     pattern: '˘ ˘',     example: 'on the',      color: 'var(--foot-pyrrhic)' },
  { name: 'Dactyl',      pattern: 'ˈ ˘ ˘',   example: 'MER-ri-ly',   color: 'var(--foot-dactyl)' },
  { name: 'Anapest',     pattern: '˘ ˘ ˈ',   example: 'un-der-STAND',color: 'var(--foot-anapest)' },
  { name: 'Amphibrach',  pattern: '˘ ˈ ˘',   example: 'a-LONE-ly',   color: 'var(--foot-amphibrach)' },
  { name: 'Amphimacer',  pattern: 'ˈ ˘ ˈ',   example: 'ONCE a-GAIN', color: 'var(--foot-amphimacer)' },
]

const METERS = [
  { count: 'Monometer',   feet: 1 },
  { count: 'Dimeter',     feet: 2 },
  { count: 'Trimeter',    feet: 3 },
  { count: 'Tetrameter',  feet: 4 },
  { count: 'Pentameter',  feet: 5 },
  { count: 'Hexameter',   feet: 6 },
  { count: 'Heptameter',  feet: 7 },
  { count: 'Octameter',   feet: 8 },
]

export default function ReferencePanel() {
  return (
    <aside className="reference-panel">
      <div className="reference-inner">
        <section className="ref-section">
          <h2 className="ref-heading">Metrical Feet</h2>
          <div className="feet-grid">
            {FEET.map(f => (
              <div key={f.name} className="foot-card" style={{ '--c': f.color } as React.CSSProperties}>
                <span className="foot-card-name">{f.name}</span>
                <span className="foot-card-pattern">{f.pattern}</span>
                <span className="foot-card-example">{f.example}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="ref-section">
          <h2 className="ref-heading">Line Lengths</h2>
          <div className="meters-list">
            {METERS.map(m => (
              <div key={m.count} className="meter-row">
                <span className="meter-name">{m.count}</span>
                <span className="meter-feet">{m.feet} {m.feet === 1 ? 'foot' : 'feet'}</span>
              </div>
            ))}
          </div>
          <p className="ref-note">
            Combined: "iambic pentameter" = 5 iambs per line.
            Pyrrhics and spondees substitute freely in iambic verse.
          </p>
        </section>

        <section className="ref-section">
          <h2 className="ref-heading">Markers</h2>
          <div className="marker-list">
            <div className="marker-row">
              <span className="mk stressed-mk">ˈ</span>
              <span>Primary / secondary stress (from CMU dict)</span>
            </div>
            <div className="marker-row">
              <span className="mk unstressed-mk">˘</span>
              <span>Unstressed syllable</span>
            </div>
            <div className="marker-row">
              <span className="mk uncertain-mk">abc</span>
              <span>Amber underline — word not in CMU dict, stress estimated</span>
            </div>
            <div className="marker-row">
              <span className="mk override-mk">ˈ</span>
              <span>Underlined marker — manually overridden by you</span>
            </div>
          </div>
        </section>
      </div>
    </aside>
  )
}
