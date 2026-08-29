import { useState } from 'react'
import { ChevronLeft, ChevronRight, MapPin, Navigation, SquareDashed } from 'lucide-react'
import {
  Badge,
  Button,
  EmptyState,
  Panel,
  PanelBody,
  PanelHeader,
  TabPanel,
  Tabs,
  TextField,
} from '../ui/index.js'
import { REGION_LABEL } from '../map/constants.js'
import styles from './ContextPanel.module.css'

const TAB_ITEMS = [
  { value: 'analysis', label: 'Analysis' },
  { value: 'route', label: 'Route' },
]

export function ContextPanel({ selection = null }) {
  const [tab, setTab] = useState('analysis')
  const [collapsed, setCollapsed] = useState(false)

  if (collapsed) {
    return (
      <button
        type="button"
        className={styles.reopen}
        onClick={() => setCollapsed(false)}
        aria-label="Show analysis panel"
      >
        <ChevronLeft size={16} strokeWidth={1.75} />
      </button>
    )
  }

  return (
    <aside className={styles.dock} aria-label="Area analysis">
      <Panel className={styles.panel}>
        <PanelHeader
          eyebrow={selection ? 'Selected area' : 'Region'}
          title={selection ? selection.id : REGION_LABEL}
          meta={selection ? selection.place : 'Assam and Meghalaya demonstration area'}
          actions={
            <>
              <Badge tone="quiet">Mock data</Badge>
              <button
                type="button"
                className={styles.collapse}
                onClick={() => setCollapsed(true)}
                aria-label="Hide analysis panel"
              >
                <ChevronRight size={15} strokeWidth={1.75} />
              </button>
            </>
          }
        />

        <div className={styles.tabsRow}>
          <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} />
        </div>

        <PanelBody scroll>
          <TabPanel value="analysis" active={tab === 'analysis'}>
            <EmptyState
              icon={SquareDashed}
              title="No area selected"
              description="Select a grid cell on the map to see its risk score and breakdown."
            />
          </TabPanel>

          <TabPanel value="route" active={tab === 'route'}>
            <div className={styles.routeForm}>
              <TextField
                label="Origin"
                icon={MapPin}
                accentDot="var(--accent)"
                placeholder="Set a start point"
              />
              <TextField
                label="Destination"
                icon={MapPin}
                accentDot="var(--text-muted)"
                placeholder="Set a destination"
              />
              <Button variant="primary" icon={Navigation} block disabled>
                Analyze route
              </Button>
              <p className={styles.routeHint}>
                Route comparison is wired to the routing service in a later phase.
              </p>
            </div>
          </TabPanel>
        </PanelBody>
      </Panel>
    </aside>
  )
}
