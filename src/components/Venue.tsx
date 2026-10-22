import { MapPin } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { event, openStreetMapUrl } from '../config/event'
import { ErrorBoundary } from './ErrorBoundary'
import { sectionNumber } from '../config/features'

const VenueMap = lazy(() => import('./VenueMap'))

export function Venue() {
  const { t, i18n } = useTranslation()
  const language = i18n.language === 'en' ? 'en' : 'cs'
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [showMap, setShowMap] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setShowMap(true)
        observer.disconnect()
      }
    })
    if (mapContainerRef.current) observer.observe(mapContainerRef.current)
    return () => observer.disconnect()
  }, [])
  return (
    <section
      id="venue"
      tabIndex={-1}
      className="content-section venue-section"
      aria-labelledby="venue-title"
    >
      <div className="section-label">
        <span>{sectionNumber('venue')} /</span>
        <h2 id="venue-title" className="section-title">
          {t('venue.title')}
        </h2>
      </div>
      <div className="venue-layout">
        <div className="venue-copy">
          <div className="venue-address">
            <MapPin size={22} aria-hidden="true" />
            <div>
              <p>{event.venue[language]}</p>
              <p className="muted-copy">{t('venue.university')}</p>
              <p className="muted-copy">{event.address}</p>
            </div>
          </div>
          <p className="venue-location">
            {event.city} · {t('venue.country')}
          </p>
        </div>
        <div className="venue-map-container" ref={mapContainerRef}>
          <ErrorBoundary
            fallback={
              <div className="map-placeholder">
                <p>{t('venue.mapError')}</p>
                <a href={openStreetMapUrl} target="_blank" rel="noopener noreferrer">
                  {t('venue.openMap')} ↗
                </a>
              </div>
            }
          >
            <Suspense fallback={<p className="map-placeholder">{t('venue.mapLoading')}</p>}>
              {showMap ? <VenueMap /> : <p className="map-placeholder">{t('venue.mapLoading')}</p>}
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </section>
  )
}
