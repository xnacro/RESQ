// Origin Selection Modal for RESQ Directions Flow
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  X,
  Navigation,
  Search,
  MapPin,
  Compass,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { searchGeocode } from '../services/api.js'
import styles from './SourceAddressModal.module.css'

export function SourceAddressModal({
  isOpen,
  onClose,
  destination,
  onSelectOrigin,
  isRouting = false,
}) {
  const [activeTab, setActiveTab] = useState('gps') // 'gps' | 'manual'
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError] = useState(null)
  const searchInputRef = useRef(null)

  // Auto-focus search field when switching to manual tab
  useEffect(() => {
    if (activeTab === 'manual' && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [activeTab])

  // Debounced geocoding search
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      return
    }

    let active = true
    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await searchGeocode(searchQuery.trim())
        if (active) {
          setSearchResults(results || [])
        }
      } catch (err) {
        console.error('Search failed:', err)
        if (active) setSearchResults([])
      } finally {
        if (active) setIsSearching(false)
      }
    }, 280)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [searchQuery])

  // Handle GPS location acquisition
  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.')
      return
    }

    setGpsLoading(true)
    setGpsError(null)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false)
        const origin = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          name: 'Current Location',
          displayName: 'Your Current Location (GPS)',
          district: 'Live GPS',
          state: 'Assam',
          isLiveGps: true,
        }
        if (onSelectOrigin) {
          onSelectOrigin(origin)
        }
      },
      (err) => {
        setGpsLoading(false)
        let msg = 'Failed to retrieve your current location.'
        if (err.code === 1) msg = 'Location access denied. Please enter your starting address manually.'
        if (err.code === 2) msg = 'Position unavailable. Please search your starting location.'
        if (err.code === 3) msg = 'Location request timed out. Please try again or search manually.'
        setGpsError(msg)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 2000,
      }
    )
  }, [onSelectOrigin])

  // Handle candidate selection from manual search
  const handleSelectCandidate = (candidate) => {
    if (!candidate) return
    const origin = {
      lat: Number(candidate.lat ?? candidate.latitude),
      lon: Number(candidate.lon ?? candidate.longitude),
      latitude: Number(candidate.lat ?? candidate.latitude),
      longitude: Number(candidate.lon ?? candidate.longitude),
      name: candidate.name,
      displayName: candidate.displayName || candidate.name,
      district: candidate.district || 'Regional',
      state: candidate.state || 'Assam',
    }
    if (onSelectOrigin) {
      onSelectOrigin(origin)
    }
  }

  if (!isOpen) return null

  const destName = destination?.displayName || destination?.name || 'Selected Destination'

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="source-modal-title">
      <div className={styles.modal}>
        {/* Modal Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.iconCircle}>
              <Navigation size={18} className={styles.navIcon} />
            </div>
            <div>
              <h2 id="source-modal-title" className={styles.title}>
                Where are you starting from?
              </h2>
              <p className={styles.subtitle}>
                Calculating route to <span className={styles.destHighlight}>{destName}</span>
              </p>
            </div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className={styles.tabToggle}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'gps' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('gps')}
          >
            <Compass size={15} />
            <span>Use Current Location</span>
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'manual' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('manual')}
          >
            <Search size={15} />
            <span>Enter Address Manually</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className={styles.body}>
          {/* TAB 1: GPS Selection */}
          {activeTab === 'gps' && (
            <div className={styles.gpsContainer}>
              <div className={styles.gpsGraphic}>
                <div className={styles.gpsPulseRing} />
                <Navigation size={28} className={styles.gpsGraphicIcon} />
              </div>
              <h3 className={styles.gpsHeading}>Detect Device Location</h3>
              <p className={styles.gpsDescription}>
                Use your device's high-accuracy GPS coordinates to calculate the optimal route from your current real-time position.
              </p>

              {gpsError && (
                <div className={styles.errorMessage}>
                  <AlertCircle size={15} className={styles.errorIcon} />
                  <span>{gpsError}</span>
                </div>
              )}

              <button
                type="button"
                className={styles.primaryGpsBtn}
                onClick={handleUseCurrentLocation}
                disabled={gpsLoading || isRouting}
              >
                {gpsLoading || isRouting ? (
                  <>
                    <Loader2 size={16} className={styles.spinner} />
                    <span>{isRouting ? 'Calculating Route...' : 'Locating Device...'}</span>
                  </>
                ) : (
                  <>
                    <Compass size={16} />
                    <span>Use My Current Location</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* TAB 2: Manual Search */}
          {activeTab === 'manual' && (
            <div className={styles.manualContainer}>
              <div className={styles.searchBar}>
                <Search size={16} className={styles.searchBarIcon} />
                <input
                  ref={searchInputRef}
                  type="text"
                  className={styles.searchInput}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search starting depot, bridge, town, or grid ID..."
                />
                {searchQuery && (
                  <button
                    type="button"
                    className={styles.clearBtn}
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Search Suggestions */}
              <div className={styles.resultsList}>
                {isSearching && (
                  <div className={styles.searchingState}>
                    <Loader2 size={18} className={styles.spinner} />
                    <span>Searching places in Assam & Meghalaya...</span>
                  </div>
                )}

                {!isSearching && searchResults.length > 0 && (
                  searchResults.map((item, idx) => (
                    <button
                      key={`${item.name}_${idx}`}
                      type="button"
                      className={styles.resultItem}
                      onClick={() => handleSelectCandidate(item)}
                      disabled={isRouting}
                    >
                      <div className={styles.resultPin}>
                        <MapPin size={15} />
                      </div>
                      <div className={styles.resultDetails}>
                        <span className={styles.resultTitle}>{item.name}</span>
                        <span className={styles.resultSubtitle}>
                          {item.displayName || `${item.district || 'Assam'}, ${item.state || 'India'}`}
                        </span>
                      </div>
                    </button>
                  ))
                )}

                {!isSearching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                  <div className={styles.emptyResults}>
                    <p>No matching locations found for "{searchQuery}".</p>
                    <p className={styles.emptyHint}>Try searching Guwahati, Shillong, Boko, or Dispur.</p>
                  </div>
                )}

                {!isSearching && !searchQuery && (
                  <div className={styles.quickSuggestions}>
                    <span className={styles.quickLabel}>Popular Starting Points:</span>
                    <div className={styles.quickList}>
                      {[
                        { name: 'Guwahati Emergency Depot', lat: 26.1445, lon: 91.7362, district: 'Kamrup Metro', state: 'Assam' },
                        { name: 'Shillong Transport Hub', lat: 25.5788, lon: 91.8933, district: 'East Khasi Hills', state: 'Meghalaya' },
                        { name: 'Dispur Secretariat', lat: 26.1445, lon: 91.7898, district: 'Kamrup Metro', state: 'Assam' },
                        { name: 'Nongpoh Station', lat: 25.9038, lon: 91.8805, district: 'Ri-Bhoi', state: 'Meghalaya' },
                      ].map((item) => (
                        <button
                          key={item.name}
                          type="button"
                          className={styles.quickChip}
                          onClick={() => handleSelectCandidate(item)}
                        >
                          <MapPin size={13} />
                          <span>{item.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SourceAddressModal
