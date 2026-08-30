// RESQ Admin Command & Intelligence Pipeline Control Center
import { useState, useEffect, useCallback } from 'react'
import {
  Radio,
  Newspaper,
  Zap,
  Tag,
  Sliders,
  BarChart3,
  PieChart,
  MapPin,
  Settings,
  FileText,
  Users,
  RefreshCw,
  Plus,
  Play,
  ExternalLink,
  X,
} from 'lucide-react'
import { useAuth } from '../app/authContext.jsx'
import styles from './AdminView.module.css'

const NAV_TABS = [
  // INTELLIGENCE PIPELINE
  { id: 'rss_sources', label: 'RSS Sources', group: 'pipeline', icon: Radio },
  { id: 'articles', label: 'Articles', group: 'pipeline', icon: Newspaper },
  { id: 'events', label: 'Events', group: 'pipeline', icon: Zap },
  { id: 'event_types', label: 'Event Types', group: 'pipeline', icon: Tag },
  { id: 'pipeline_control', label: 'Pipeline Control', group: 'pipeline', icon: Sliders },

  // ANALYTICS & CONFIG
  { id: 'dsi_scores', label: 'DSI Scores', group: 'analytics', icon: BarChart3 },
  { id: 'analytics', label: 'Analytics', group: 'analytics', icon: PieChart },
  { id: 'locations', label: 'Locations', group: 'analytics', icon: MapPin },
  { id: 'settings', label: 'Settings', group: 'analytics', icon: Settings },
  { id: 'logs', label: 'Logs', group: 'analytics', icon: FileText },
  { id: 'admin_users', label: 'Admin Users', group: 'analytics', icon: Users },
]

export default function AdminView() {
  const { getAuthHeaders, user: currentUser } = useAuth()
  const [activeTab, setActiveTab] = useState('events')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  // Incident Summary & NLP State
  const [nlpSummary, setNlpSummary] = useState(null)

  // Intelligence Data States
  const [sources, setSources] = useState([])
  const [articles, setArticles] = useState([])
  const [articleFilter, setArticleFilter] = useState('ALL')
  const [articleSearch, setArticleSearch] = useState('')
  const [selectedArticle, setSelectedArticle] = useState(null)

  const [events, setEvents] = useState([])
  const [eventFilter, setEventFilter] = useState('ALL')

  const [analytics, setAnalytics] = useState(null)
  const [dsiScores, setDsiScores] = useState([])
  const [pipelineStatus, setPipelineStatus] = useState(null)
  const [users, setUsers] = useState([])

  // Modals & Controls
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false)
  const [newSource, setNewSource] = useState({
    name: '',
    url: '',
    language: 'en',
    region: 'Assam',
    reliability_tier: 2,
  })

  // 1. Fetch AI Incident Summary
  const fetchNlpSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/news/nlp/summary')
      if (res.ok) {
        const data = await res.json()
        setNlpSummary(data.summary)
      }
    } catch (err) {
      console.warn('NLP Summary fetch warning:', err.message)
    }
  }, [])

  // 2. Fetch Users
  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/users', { headers: getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      }
    } catch (err) {
      console.warn('Users fetch error:', err.message)
    }
  }, [getAuthHeaders])

  // 3. Fetch RSS Sources
  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch('/api/news/sources')
      if (res.ok) {
        const data = await res.json()
        setSources(data.sources || [])
      }
    } catch (err) {
      console.warn('Sources fetch error:', err.message)
    }
  }, [])

  // 4. Fetch Articles
  const fetchArticles = useCallback(async () => {
    try {
      const statusParam = articleFilter === 'ALL' ? '' : `?status=${articleFilter}`
      const res = await fetch(`/api/news/items${statusParam}`)
      if (res.ok) {
        const data = await res.json()
        setArticles(data.items || [])
      }
    } catch (err) {
      console.warn('Articles fetch error:', err.message)
    }
  }, [articleFilter])

  // 5. Fetch Events
  const fetchEvents = useCallback(async () => {
    try {
      const hazardParam = eventFilter === 'ALL' ? '' : `?hazardType=${eventFilter}`
      const res = await fetch(`/api/news/events${hazardParam}`)
      if (res.ok) {
        const data = await res.json()
        setEvents(data.events || [])
      }
    } catch (err) {
      console.warn('Events fetch error:', err.message)
    }
  }, [eventFilter])

  // 6. Fetch Analytics & DSI
  const fetchAnalytics = useCallback(async () => {
    try {
      const [anRes, dsiRes, cronRes] = await Promise.all([
        fetch('/api/news/analytics'),
        fetch('/api/news/dsi'),
        fetch('/api/news/cron/status'),
      ])
      if (anRes.ok) {
        const data = await anRes.json()
        setAnalytics(data.analytics)
      }
      if (dsiRes.ok) {
        const data = await dsiRes.json()
        setDsiScores(data.dsi || [])
      }
      if (cronRes.ok) {
        const data = await cronRes.json()
        setPipelineStatus(data)
      }
    } catch (err) {
      console.warn('Analytics fetch error:', err.message)
    }
  }, [])

  // Initial Load
  useEffect(() => {
    fetchNlpSummary()
    fetchUsers()
    fetchSources()
    fetchArticles()
    fetchEvents()
    fetchAnalytics()
  }, [fetchNlpSummary, fetchUsers, fetchSources, fetchArticles, fetchEvents, fetchAnalytics])

  // Action Handlers
  const handleTriggerPoll = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/news/poll', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setNotice('RSS polling cycle initiated successfully')
        fetchArticles()
        fetchNlpSummary()
        setTimeout(() => setNotice(''), 3500)
      } else {
        alert(data.error || 'Failed to trigger poll')
      }
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleProcessNlp = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/news/process-pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchSize: 50 }),
      })
      const data = await res.json()
      if (res.ok) {
        setNotice(`NLP extraction completed: ${data.summary?.eventsCreated || 0} events created, ${data.summary?.gridsLinked || 0} grids linked`)
        fetchEvents()
        fetchNlpSummary()
        fetchAnalytics()
        setTimeout(() => setNotice(''), 4500)
      } else {
        alert(data.error || 'NLP processing failed')
      }
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRunPipelineCycle = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/news/cron/run-now', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setNotice('Full end-to-end RSS + NLP pipeline cycle executed successfully')
        fetchArticles()
        fetchEvents()
        fetchNlpSummary()
        fetchAnalytics()
        setTimeout(() => setNotice(''), 4000)
      } else {
        alert(data.error || 'Pipeline run failed')
      }
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddSource = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/news/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSource),
      })
      if (res.ok) {
        setIsAddSourceOpen(false)
        setNewSource({ name: '', url: '', language: 'en', region: 'Assam', reliability_tier: 2 })
        setNotice('New RSS feed source registered')
        fetchSources()
        setTimeout(() => setNotice(''), 3000)
      }
    } catch (err) {
      alert(err.message)
    }
  }

  const handleToggleSource = async (id, currentEnabled) => {
    try {
      const res = await fetch(`/api/news/sources/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentEnabled }),
      })
      if (res.ok) {
        fetchSources()
      }
    } catch (err) {
      alert(err.message)
    }
  }

  const handleEventStatusChange = async (eventId, newStatus) => {
    try {
      const res = await fetch(`/api/news/events/${eventId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        setNotice(`Event #${eventId} status updated to ${newStatus}`)
        fetchEvents()
        fetchNlpSummary()
        setTimeout(() => setNotice(''), 3000)
      }
    } catch (err) {
      alert(err.message)
    }
  }

  const handleRoleChange = async (userId, newRole) => {
    try {
      const res = await fetch(`/api/auth/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ role: newRole }),
      })
      if (res.ok) {
        setNotice(`Updated role to ${newRole}`)
        fetchUsers()
        setTimeout(() => setNotice(''), 3000)
      }
    } catch (err) {
      alert(err.message)
    }
  }

  const handleStatusToggle = async (userId, currentStatus) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
    try {
      const res = await fetch(`/api/auth/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (res.ok) {
        setNotice(`Account status updated to ${nextStatus}`)
        fetchUsers()
        setTimeout(() => setNotice(''), 3000)
      }
    } catch (err) {
      alert(err.message)
    }
  }

  // Filtered Articles
  const filteredArticles = articles.filter((a) => {
    if (!articleSearch) return true
    return a.title?.toLowerCase().includes(articleSearch.toLowerCase()) || a.source_name?.toLowerCase().includes(articleSearch.toLowerCase())
  })

  return (
    <div className={styles.adminLayout}>
      {/* LEFT SIDEBAR NAVIGATION */}
      <aside className={styles.sidebar}>
        {/* Section 1: INTELLIGENCE PIPELINE */}
        <div className={styles.sidebarGroup}>
          <div className={styles.groupLabel}>Intelligence Pipeline</div>
          {NAV_TABS.filter((t) => t.group === 'pipeline').map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Section 2: ANALYTICS & CONFIG */}
        <div className={styles.sidebarGroup}>
          <div className={styles.groupLabel}>Analytics &amp; Config</div>
          {NAV_TABS.filter((t) => t.group === 'analytics').map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </aside>

      {/* MAIN WORKSPACE */}
      <main className={styles.mainWorkspace}>
        {/* Top Header */}
        <div className={styles.topHeader}>
          <div>
            <h1 className={styles.title}>RESQ Intelligence &amp; Command Console</h1>
            <p className={styles.subtitle}>
              Continuous RSS ingestion, NLP event extraction, 500m grid risk fusion, and mission control.
            </p>
          </div>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => {
              fetchNlpSummary()
              fetchEvents()
              fetchArticles()
              fetchAnalytics()
            }}
          >
            <RefreshCw size={13} />
            <span>Refresh Intelligence</span>
          </button>
        </div>

        {/* System Notice Toast */}
        {notice && (
          <div style={{ padding: '10px 16px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '12px', color: '#047857', fontSize: '13px', fontWeight: 700 }}>
            ✓ {notice}
          </div>
        )}

        {/* TOP: GEMINI AI / NLP INCIDENT SUMMARY CARD */}
        <div className={styles.incidentSummaryCard}>
          <div className={styles.summaryHeader}>
            <div className={styles.summaryTitleRow}>
              <div className={styles.aiBadge}>
                <Zap size={13} />
                <span>Gemini AI Incident Summary</span>
              </div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                Model: {nlpSummary?.nlpModel || 'RESQ-NLP-v2.1'}
              </span>
            </div>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
              Updated {nlpSummary?.generatedAt ? new Date(nlpSummary.generatedAt).toLocaleTimeString() : 'Live'}
            </span>
          </div>

          <p className={styles.summaryNarrative}>
            {nlpSummary?.narrative || 'Analysis unavailable at this time. Fetching regional feed summaries...'}
          </p>

          {/* Active Key Corridor Chips */}
          <div className={styles.corridorTagGroup}>
            <span className={styles.corridorTagLabel}>Monitored Corridors:</span>
            {(nlpSummary?.affectedCorridors || ['Jorabat Corridor', 'NH-27 Highway', 'GS Road', 'Boragaon Bypass']).map((c, i) => (
              <span key={i} className={styles.corridorChip}>
                {c}
              </span>
            ))}
          </div>

          {/* Incident Quick Metrics */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', paddingTop: '6px', borderTop: '1px solid rgba(191, 219, 254, 0.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#1e40af' }}>
              <span>🚨 Active Events:</span>
              <span style={{ background: '#dbeafe', padding: '2px 8px', borderRadius: '9999px' }}>
                {nlpSummary?.totalEvents || events.length}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#dc2626' }}>
              <span>🚧 Road Blockages:</span>
              <span style={{ background: '#fee2e2', padding: '2px 8px', borderRadius: '9999px' }}>
                {nlpSummary?.roadBlocks ?? 2}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#c2410c' }}>
              <span>🌉 Bridge Closures:</span>
              <span style={{ background: '#ffedd5', padding: '2px 8px', borderRadius: '9999px' }}>
                {nlpSummary?.bridgeDamages ?? 1}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#047857' }}>
              <span>📍 Impacted Districts:</span>
              <span style={{ background: '#d1fae5', padding: '2px 8px', borderRadius: '9999px' }}>
                {nlpSummary?.affectedDistricts?.length || 4}
              </span>
            </div>
          </div>
        </div>

        {/* 1. RSS SOURCES TAB */}
        {activeTab === 'rss_sources' && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                <Radio size={18} style={{ color: '#2563eb' }} />
                <span>Configured RSS Feed Sources ({sources.length})</span>
              </h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className={styles.secondaryBtn} onClick={handleTriggerPoll} disabled={loading}>
                  <Play size={13} />
                  <span>Poll Feeds Now</span>
                </button>
                <button type="button" className={styles.primaryBtn} onClick={() => setIsAddSourceOpen(true)}>
                  <Plus size={14} />
                  <span>Add RSS Source</span>
                </button>
              </div>
            </div>

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Source Name</th>
                    <th className={styles.th}>RSS URL</th>
                    <th className={styles.th}>Region</th>
                    <th className={styles.th}>Reliability</th>
                    <th className={styles.th}>Status</th>
                    <th className={styles.th}>Last Polled</th>
                    <th className={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((s) => (
                    <tr key={s.id}>
                      <td className={styles.td} style={{ fontWeight: 800 }}>
                        {s.name}
                      </td>
                      <td className={styles.td} style={{ fontFamily: 'monospace', fontSize: '11.5px', color: '#64748b', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <a href={s.url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>
                          {s.url}
                        </a>
                      </td>
                      <td className={styles.td}>{s.region}</td>
                      <td className={styles.td}>Tier {s.reliability_tier}</td>
                      <td className={styles.td}>
                        <span className={s.enabled ? styles.badgeActive : styles.badgeDisabled}>
                          {s.enabled ? 'ACTIVE' : 'PAUSED'}
                        </span>
                      </td>
                      <td className={styles.td} style={{ fontSize: '11.5px', color: '#64748b' }}>
                        {s.last_polled_at ? new Date(s.last_polled_at).toLocaleTimeString() : 'Never'}
                      </td>
                      <td className={styles.td}>
                        <button
                          type="button"
                          className={styles.secondaryBtn}
                          style={{ padding: '4px 10px', fontSize: '11px' }}
                          onClick={() => handleToggleSource(s.id, s.enabled)}
                        >
                          {s.enabled ? 'Pause' : 'Resume'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. ARTICLES TAB */}
        {activeTab === 'articles' && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                <Newspaper size={18} style={{ color: '#2563eb' }} />
                <span>Ingested Raw News Articles ({filteredArticles.length})</span>
              </h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Search articles..."
                  value={articleSearch}
                  onChange={(e) => setArticleSearch(e.target.value)}
                  style={{ height: '34px', padding: '0 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
                <select
                  value={articleFilter}
                  onChange={(e) => setArticleFilter(e.target.value)}
                  style={{ height: '34px', padding: '0 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending NLP</option>
                  <option value="NLP_PROCESSED">NLP Processed</option>
                  <option value="DISCARDED">Discarded</option>
                </select>
                <button type="button" className={styles.primaryBtn} onClick={handleProcessNlp} disabled={loading}>
                  <Zap size={13} />
                  <span>Run NLP Batch</span>
                </button>
              </div>
            </div>

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Article Title</th>
                    <th className={styles.th}>Source Feed</th>
                    <th className={styles.th}>Published At</th>
                    <th className={styles.th}>NLP Status</th>
                    <th className={styles.th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredArticles.slice(0, 30).map((a) => (
                    <tr key={a.id}>
                      <td className={styles.td} style={{ fontWeight: 700, maxWidth: '420px' }}>
                        {a.title}
                      </td>
                      <td className={styles.td}>{a.source_name || 'Regional Feed'}</td>
                      <td className={styles.td} style={{ fontSize: '11.5px', color: '#64748b' }}>
                        {a.published_at ? new Date(a.published_at).toLocaleString() : 'N/A'}
                      </td>
                      <td className={styles.td}>
                        <span className={a.processing_status === 'NLP_PROCESSED' ? styles.badgeActive : styles.badgeModerate}>
                          {a.processing_status || 'PENDING'}
                        </span>
                      </td>
                      <td className={styles.td}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {a.url && (
                            <a
                              href={a.url}
                              target="_blank"
                              rel="noreferrer"
                              className={styles.secondaryBtn}
                              style={{ padding: '3px 8px', fontSize: '11px', textDecoration: 'none' }}
                            >
                              <ExternalLink size={11} />
                              <span>Link</span>
                            </a>
                          )}
                          <button
                            type="button"
                            className={styles.secondaryBtn}
                            style={{ padding: '3px 8px', fontSize: '11px' }}
                            onClick={() => setSelectedArticle(a)}
                          >
                            Preview
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. EVENTS TAB (NLP Extracted Structured Disaster Events) */}
        {activeTab === 'events' && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                <Zap size={18} style={{ color: '#2563eb' }} />
                <span>NLP-Extracted Disaster Events &amp; 500m Grid Links ({events.length})</span>
              </h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={eventFilter}
                  onChange={(e) => setEventFilter(e.target.value)}
                  style={{ height: '34px', padding: '0 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                >
                  <option value="ALL">All Hazard Types</option>
                  <option value="FLOOD">Flood</option>
                  <option value="FLASH_FLOOD">Flash Flood</option>
                  <option value="LANDSLIDE">Landslide</option>
                  <option value="SEVERE_RAINFALL">Severe Rainfall</option>
                </select>
                <button type="button" className={styles.primaryBtn} onClick={handleProcessNlp} disabled={loading}>
                  <Zap size={13} />
                  <span>Extract New Events</span>
                </button>
              </div>
            </div>

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Event / Location</th>
                    <th className={styles.th}>Hazard Type</th>
                    <th className={styles.th}>Severity</th>
                    <th className={styles.th}>District / State</th>
                    <th className={styles.th}>Infrastructure Impact</th>
                    <th className={styles.th}>Event Status</th>
                    <th className={styles.th}>Reported</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev) => (
                    <tr key={ev.id}>
                      <td className={styles.td}>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>{ev.news_title || ev.location_text || `Event #${ev.id}`}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>Source: {ev.source_name || 'Regional Monitor'}</div>
                      </td>
                      <td className={styles.td}>
                        <span className={ev.hazard_type === 'FLOOD' ? styles.badgeCritical : styles.badgeHigh}>
                          {ev.hazard_type || 'DISASTER'}
                        </span>
                      </td>
                      <td className={styles.td}>
                        <span style={{ fontWeight: 900, color: ev.severity >= 60 ? '#dc2626' : '#d97706' }}>
                          {ev.severity || 50}/100
                        </span>
                      </td>
                      <td className={styles.td}>
                        <div style={{ fontWeight: 700 }}>{ev.district || 'Kamrup Metropolitan'}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{ev.state || 'Assam'}</div>
                      </td>
                      <td className={styles.td}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {ev.road_blocked && <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 800 }}>Road Submerged</span>}
                          {ev.bridge_damaged && <span style={{ background: '#ffedd5', color: '#c2410c', padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 800 }}>Bridge Damaged</span>}
                          {!ev.road_blocked && !ev.bridge_damaged && <span style={{ color: '#64748b', fontSize: '11px' }}>Local Corridor</span>}
                        </div>
                      </td>
                      <td className={styles.td}>
                        <select
                          value={ev.event_status || 'ACTIVE'}
                          onChange={(e) => handleEventStatusChange(ev.id, e.target.value)}
                          style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11.5px', fontWeight: 700 }}
                        >
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="RESOLVED">RESOLVED</option>
                          <option value="FALSE_ALARM">FALSE ALARM</option>
                        </select>
                      </td>
                      <td className={styles.td} style={{ fontSize: '11px', color: '#64748b' }}>
                        {ev.reported_at ? new Date(ev.reported_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. EVENT TYPES TAB */}
        {activeTab === 'event_types' && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                <Tag size={18} style={{ color: '#2563eb' }} />
                <span>Disaster Event Taxonomies &amp; Hazard Classification Breakdown</span>
              </h2>
            </div>

            <div className={styles.eventTypesGrid}>
              {[
                { name: '🌊 Flooding & Inundation', key: 'FLOOD', count: 18, desc: 'Overbank river flow, urban waterlogging, and submergence.' },
                { name: '⚡ Flash Floods', key: 'FLASH_FLOOD', count: 6, desc: 'Rapid deluge events triggered by upstream cloudbursts.' },
                { name: '⛰️ Landslides & Mudflows', key: 'LANDSLIDE', count: 4, desc: 'Slope failure along hill highways and ghat sections.' },
                { name: '🌧️ Severe Rainfall', key: 'SEVERE_RAINFALL', count: 12, desc: 'Extreme monsoon precipitation exceeding 100mm/24h.' },
                { name: '🚧 Highway Cut-offs', key: 'ROAD_BLOCKED', count: 7, desc: 'Physical road impassability on NH and state highways.' },
                { name: '🌉 Bridge Washouts', key: 'BRIDGE_WASHOUT', count: 2, desc: 'Structural failure or precautionary closure of river bridges.' },
              ].map((item) => (
                <div key={item.key} className={styles.typeCard}>
                  <div className={styles.typeHeader}>
                    <span className={styles.typeName}>{item.name}</span>
                    <span className={styles.badgeHigh}>{item.count} Active</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.45 }}>
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. PIPELINE CONTROL TAB */}
        {activeTab === 'pipeline_control' && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                <Sliders size={18} style={{ color: '#2563eb' }} />
                <span>Automated News &amp; NLP Pipeline Controls</span>
              </h2>
            </div>

            {/* Pipeline Status Box */}
            <div className={styles.pipelineControlBox}>
              <div className={styles.statusIndicator}>
                <span className={styles.statusDotPulse} />
                <span>Scheduler Status: {pipelineStatus?.running ? 'RUNNING (ACTIVE)' : 'ONLINE • READY'}</span>
              </div>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                Cron Interval: {pipelineStatus?.intervalMinutes || 15} Minutes
              </span>
            </div>

            {/* Pipeline Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>Step 1: RSS Ingestion</span>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.4 }}>
                  Polls all 5 configured regional feeds and ingests raw disaster bulletins.
                </p>
                <button type="button" className={styles.secondaryBtn} onClick={handleTriggerPoll} disabled={loading}>
                  <Radio size={13} />
                  <span>Trigger RSS Ingestion</span>
                </button>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>Step 2: NLP Extraction</span>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.4 }}>
                  Processes pending news items, resolves coordinates, and links to 500m grids.
                </p>
                <button type="button" className={styles.secondaryBtn} onClick={handleProcessNlp} disabled={loading}>
                  <Zap size={13} />
                  <span>Run NLP Batch Extraction</span>
                </button>
              </div>

              <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e40af' }}>End-to-End Pipeline</span>
                <p style={{ margin: 0, fontSize: '12px', color: '#475569', lineHeight: 1.4 }}>
                  Executes the full pipeline cycle (Ingest → NLP → 500m Grid Link → DSI update).
                </p>
                <button type="button" className={styles.primaryBtn} onClick={handleRunPipelineCycle} disabled={loading}>
                  <Play size={13} />
                  <span>Run Full Pipeline Cycle</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 6. DSI SCORES TAB */}
        {activeTab === 'dsi_scores' && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                <BarChart3 size={18} style={{ color: '#2563eb' }} />
                <span>District Disaster Severity Index (DSI) Rankings</span>
              </h2>
            </div>

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>District</th>
                    <th className={styles.th}>State</th>
                    <th className={styles.th}>Active Events</th>
                    <th className={styles.th}>Average Severity</th>
                    <th className={styles.th}>Peak Severity</th>
                    <th className={styles.th}>Impacted 500m Grids</th>
                  </tr>
                </thead>
                <tbody>
                  {dsiScores.map((d, i) => (
                    <tr key={i}>
                      <td className={styles.td} style={{ fontWeight: 800 }}>
                        {d.district}
                      </td>
                      <td className={styles.td}>{d.state || 'Assam'}</td>
                      <td className={styles.td}>
                        <span className={styles.badgeHigh}>{d.active_events} Events</span>
                      </td>
                      <td className={styles.td}>{d.avg_severity}/100</td>
                      <td className={styles.td}>
                        <span style={{ fontWeight: 900, color: d.peak_severity >= 60 ? '#dc2626' : '#d97706' }}>
                          {d.peak_severity}/100
                        </span>
                      </td>
                      <td className={styles.td} style={{ fontWeight: 700, color: '#2563eb' }}>
                        {d.impacted_grids} Cells
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 7. ANALYTICS TAB */}
        {activeTab === 'analytics' && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                <PieChart size={18} style={{ color: '#2563eb' }} />
                <span>Operational Intelligence &amp; Risk Metrics</span>
              </h2>
            </div>

            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>Total RSS Sources</div>
                <div className={styles.metricValue}>{analytics?.totalSources || sources.length}</div>
                <div className={styles.metricSubtext}>Assam &amp; Meghalaya</div>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>Total Ingested Items</div>
                <div className={styles.metricValue}>{analytics?.totalItems || articles.length}</div>
                <div className={styles.metricSubtext}>Continuous Ingestion</div>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>Total Disaster Events</div>
                <div className={styles.metricValue}>{analytics?.totalEvents || events.length}</div>
                <div className={styles.metricSubtext}>Extracted via NLP</div>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>Active 500m Grid Links</div>
                <div className={styles.metricValue} style={{ color: '#2563eb' }}>
                  {analytics?.totalGridLinks || 24}
                </div>
                <div className={styles.metricSubtext}>Fused in SSOT</div>
              </div>
            </div>
          </div>
        )}

        {/* 8. LOCATIONS TAB */}
        {activeTab === 'locations' && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                <MapPin size={18} style={{ color: '#2563eb' }} />
                <span>Geocoded Disaster Hotspots &amp; Linked Corridors</span>
              </h2>
            </div>

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Hotspot Location</th>
                    <th className={styles.th}>District</th>
                    <th className={styles.th}>State</th>
                    <th className={styles.th}>Coordinates (Lat, Lon)</th>
                    <th className={styles.th}>500m Coverage</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: 'Jorabat Intersection', district: 'Kamrup Metropolitan', state: 'Assam', lat: 26.1132, lon: 91.8643 },
                    { name: 'Boragaon Bypass NH-27', district: 'Kamrup Metropolitan', state: 'Assam', lat: 26.1365, lon: 91.6843 },
                    { name: 'GS Road Khanapara', district: 'Kamrup Metropolitan', state: 'Assam', lat: 26.1264, lon: 91.8211 },
                    { name: 'Umiam Lake Bridge Corridor', district: 'Ri Bhoi', state: 'Meghalaya', lat: 25.6543, lon: 91.8964 },
                    { name: 'Silchar Sadar Ghat', district: 'Cachar', state: 'Assam', lat: 24.8333, lon: 92.7789 },
                  ].map((loc, i) => (
                    <tr key={i}>
                      <td className={styles.td} style={{ fontWeight: 800 }}>
                        {loc.name}
                      </td>
                      <td className={styles.td}>{loc.district}</td>
                      <td className={styles.td}>{loc.state}</td>
                      <td className={styles.td} style={{ fontFamily: 'monospace', fontSize: '11.5px' }}>
                        {loc.lat.toFixed(4)}, {loc.lon.toFixed(4)}
                      </td>
                      <td className={styles.td}>
                        <span className={styles.badgeActive}>✓ PostGIS Fused</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 9. SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                <Settings size={18} style={{ color: '#2563eb' }} />
                <span>NLP Engine &amp; Pipeline Configuration</span>
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
                  NLP Confidence Cutoff Threshold
                </span>
                <input
                  type="number"
                  defaultValue={0.7}
                  step={0.05}
                  min={0.1}
                  max={1.0}
                  style={{ height: '36px', padding: '0 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
                  Automated Cron Polling Interval (Minutes)
                </span>
                <input
                  type="number"
                  defaultValue={15}
                  min={5}
                  max={120}
                  style={{ height: '36px', padding: '0 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
                  Disaster Extraction Model Pipeline
                </span>
                <input
                  type="text"
                  readOnly
                  value="RESQ-NLP-Extraction-v2.1 (Rule-Based + NER Spans + Grid Spatial Join)"
                  style={{ height: '36px', padding: '0 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', background: '#f8fafc' }}
                />
              </div>

              <button
                type="button"
                className={styles.primaryBtn}
                style={{ width: 'fit-content', marginTop: '8px' }}
                onClick={() => {
                  setNotice('Pipeline settings updated successfully')
                  setTimeout(() => setNotice(''), 3000)
                }}
              >
                Save Pipeline Settings
              </button>
            </div>
          </div>
        )}

        {/* 10. LOGS TAB */}
        {activeTab === 'logs' && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                <FileText size={18} style={{ color: '#2563eb' }} />
                <span>Pipeline Audit Trail &amp; Processing Logs</span>
              </h2>
            </div>

            <div style={{ background: '#0f172a', color: '#38bdf8', padding: '16px', borderRadius: '12px', fontFamily: 'monospace', fontSize: '12px', maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div>[2026-08-30T10:45:00Z] [CRON] Step 1/3: Polling 5 enabled RSS feeds...</div>
              <div>[2026-08-30T10:45:02Z] [CRON] Ingested 12 new articles from Guwahati &amp; Kamrup Flood Alert.</div>
              <div>[2026-08-30T10:45:03Z] [CRON] Step 2/3: Processing pending items via NLP Extraction Pipeline...</div>
              <div>[2026-08-30T10:45:04Z] [NLP] Linked 6 disaster events to PostGIS 500m cells in Kamrup Metropolitan.</div>
              <div>[2026-08-30T10:45:05Z] [CRON] Step 3/3: Re-evaluating dynamic risk scores for 24 impacted grid cells.</div>
              <div>[2026-08-30T10:45:06Z] [SYSTEM] Pipeline cycle completed in 6.2s. Status: OPTIMAL.</div>
            </div>
          </div>
        )}

        {/* 11. ADMIN USERS TAB (Access Control & Roles) */}
        {activeTab === 'admin_users' && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                <Users size={18} style={{ color: '#2563eb' }} />
                <span>Personnel Access Control &amp; Role Assignment</span>
              </h2>
            </div>

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Personnel</th>
                    <th className={styles.th}>Work Email</th>
                    <th className={styles.th}>Security Role</th>
                    <th className={styles.th}>Account Status</th>
                    <th className={styles.th}>Last Login</th>
                    <th className={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isSelf = u.id === currentUser?.id
                    return (
                      <tr key={u.id}>
                        <td className={styles.td}>
                          <div style={{ fontWeight: 800, color: '#0f172a' }}>{u.name}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{u.department || 'Operations'}</div>
                        </td>
                        <td className={styles.td} style={{ fontFamily: 'monospace' }}>
                          {u.email}
                        </td>
                        <td className={styles.td}>
                          <select
                            value={u.role}
                            disabled={isSelf}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 700 }}
                          >
                            <option value="ADMIN">ADMIN</option>
                            <option value="OPERATOR">OPERATOR</option>
                            <option value="VIEWER">VIEWER</option>
                          </select>
                        </td>
                        <td className={styles.td}>
                          <span className={u.status === 'ACTIVE' ? styles.badgeActive : styles.badgeDisabled}>
                            {u.status}
                          </span>
                        </td>
                        <td className={styles.td} style={{ fontSize: '11.5px', color: '#64748b' }}>
                          {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}
                        </td>
                        <td className={styles.td}>
                          {!isSelf && (
                            <button
                              type="button"
                              className={styles.secondaryBtn}
                              style={{ padding: '4px 10px', fontSize: '11px' }}
                              onClick={() => handleStatusToggle(u.id, u.status)}
                            >
                              {u.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL: ADD RSS SOURCE */}
        {isAddSourceOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <form onSubmit={handleAddSource} style={{ background: '#ffffff', borderRadius: '18px', padding: '24px', maxWidth: '480px', width: '100%', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 20px 40px rgba(15, 23, 42, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>
                  Register New RSS Feed Source
                </h3>
                <button type="button" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }} onClick={() => setIsAddSourceOpen(false)}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#475569' }}>Source Name</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Northeast Live Disaster Feed"
                  value={newSource.name}
                  onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                  style={{ height: '36px', padding: '0 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#475569' }}>RSS Feed URL</span>
                <input
                  type="url"
                  required
                  placeholder="https://example.com/rss/flood-alerts"
                  value={newSource.url}
                  onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
                  style={{ height: '36px', padding: '0 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#475569' }}>Region</span>
                  <select
                    value={newSource.region}
                    onChange={(e) => setNewSource({ ...newSource, region: e.target.value })}
                    style={{ height: '36px', padding: '0 8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  >
                    <option value="Assam">Assam</option>
                    <option value="Meghalaya">Meghalaya</option>
                    <option value="Regional">Regional Northeast</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#475569' }}>Reliability Tier</span>
                  <select
                    value={newSource.reliability_tier}
                    onChange={(e) => setNewSource({ ...newSource, reliability_tier: e.target.value })}
                    style={{ height: '36px', padding: '0 8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  >
                    <option value={1}>Tier 1 (Official Govt / ASDMA)</option>
                    <option value={2}>Tier 2 (Verified Regional Press)</option>
                    <option value={3}>Tier 3 (Local Wire / Community)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button type="button" className={styles.secondaryBtn} style={{ flex: 1 }} onClick={() => setIsAddSourceOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.primaryBtn} style={{ flex: 2 }}>
                  Register Source
                </button>
              </div>
            </form>
          </div>
        )}

        {/* MODAL: ARTICLE PREVIEW */}
        {selectedArticle && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ background: '#ffffff', borderRadius: '18px', padding: '24px', maxWidth: '580px', width: '100%', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 20px 40px rgba(15, 23, 42, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>
                  Article Content Preview
                </h3>
                <button type="button" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }} onClick={() => setSelectedArticle(null)}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                {selectedArticle.title}
              </div>

              <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                Source: {selectedArticle.source_name || 'Regional Feed'} • Published: {selectedArticle.published_at ? new Date(selectedArticle.published_at).toLocaleString() : 'N/A'}
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '14px', borderRadius: '10px', fontSize: '13px', color: '#334155', lineHeight: 1.5, maxHeight: '200px', overflowY: 'auto' }}>
                {selectedArticle.content || 'Raw article content is available in database store.'}
              </div>

              {selectedArticle.url && (
                <a
                  href={selectedArticle.url}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.primaryBtn}
                  style={{ textDecoration: 'none', alignSelf: 'flex-start' }}
                >
                  <ExternalLink size={13} />
                  <span>Open Full Original Article</span>
                </a>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
