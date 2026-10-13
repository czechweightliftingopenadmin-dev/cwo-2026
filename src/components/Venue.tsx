import { MapPin } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { event } from '../config/event'

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
        <span>02 /</span>
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
          <Suspense fallback={<p className="map-placeholder">{t('venue.mapLoading')}</p>}>
            {showMap ? <VenueMap /> : <p className="map-placeholder">{t('venue.mapLoading')}</p>}
          </Suspense>
        </div>
      </div>
    </section>
  )
}
