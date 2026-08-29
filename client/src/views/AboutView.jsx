import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Badge, Button, Divider } from '../ui/index.js'
import { BAND_THRESHOLDS, RISK_BANDS } from '../lib/riskBands.js'
import styles from './AboutView.module.css'

const CAPABILITIES = [
  {
    title: 'Grid based risk',
    body: 'The region is divided into geographic cells, each carrying a composite risk score and a factor breakdown.',
  },
  {
    title: 'Hazard layers',
    body: 'Flood extent, landslide exposure, road access and bridge condition are shown as separate toggleable layers.',
  },
  {
    title: 'Risk aware routing',
    body: 'Routes are compared on risk as well as distance, so the shortest path is not assumed to be the safest one.',
  },
  {
    title: 'Emergency SOS',
    body: 'A held action shares location and a prepared message with configured contacts and emergency services.',
  },
]

export default function AboutView() {
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.head}>
          <span className="label">About</span>
          <h1 className={styles.title}>Disaster risk, made visible before it is urgent.</h1>
          <p className={styles.lede}>
            Navigation tools optimise for distance and time. During a flood or a landslide those are the wrong
            objectives. resQ maps disaster risk at a granular geographic level so people and responders can see
            which areas are exposed, and choose routes accordingly.
          </p>
          <p className={styles.meta}>
            Initial focus area: Assam and Meghalaya, demonstrated on Guwahati.
          </p>
        </header>

        <Divider />

        <section className={styles.section}>
          <h2 className="label">What the platform does</h2>
          <div className={styles.grid}>
            {CAPABILITIES.map((item) => (
              <article key={item.title} className={styles.card}>
                <h3 className={styles.cardTitle}>{item.title}</h3>
                <p className={styles.cardBody}>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <Divider />

        <section className={styles.section}>
          <h2 className="label">Risk bands</h2>
          <p className={styles.sectionLede}>
            Every score resolves to one of four bands. Colour is used only to communicate risk, never for
            decoration.
          </p>
          <ul className={styles.bands}>
            {RISK_BANDS.map((band) => {
              const range = BAND_THRESHOLDS.find((t) => t.band === band)
              return (
                <li key={band} className={styles.bandRow} data-risk={band}>
                  <span className={styles.bandSwatch} />
                  <span className={styles.bandName}>{band}</span>
                  <span className={`${styles.bandRange} mono`}>
                    {range.min} to {range.max}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>

        <Divider />

        <section className={styles.section}>
          <div className={styles.statusRow}>
            <Badge tone="quiet">Prototype</Badge>
            <p className={styles.statusText}>
              This build demonstrates the interface. Risk values, hazard layers and route comparisons shown in
              the map are placeholder data supplied through a service layer, and are replaced by the live risk
              and routing services as they come online.
            </p>
          </div>
          <Button as={Link} to="/" variant="primary" iconRight={ArrowRight}>
            Open the map
          </Button>
        </section>
      </div>
    </div>
  )
}
