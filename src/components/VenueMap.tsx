import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Map from 'ol/Map'
import View from 'ol/View'
import Overlay from 'ol/Overlay'
import TileLayer from 'ol/layer/Tile'
import OSM from 'ol/source/OSM'
import { fromLonLat } from 'ol/proj'
import { defaults as defaultInteractions } from 'ol/interaction/defaults'
import 'ol/ol.css'
import { event } from '../config/event'

export default function VenueMap() {
  const { t } = useTranslation()
  const targetRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [longitude, latitude] = event.coordinates
  const mapUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`

  useEffect(() => {
    if (!targetRef.current || !markerRef.current) return
    const source = new OSM({ crossOrigin: 'anonymous' })
    source.on('tileloadend', () => setStatus('ready'))
    source.on('tileloaderror', () => setStatus('error'))
    const map = new Map({
      target: targetRef.current,
      layers: [new TileLayer({ source, className: 'venue-map-tiles' })],
      view: new View({ center: fromLonLat(event.coordinates), zoom: 16, minZoom: 10, maxZoom: 19 }),
      controls: [],
      interactions: defaultInteractions({ mouseWheelZoom: false }),
      overlays: [
        new Overlay({
          element: markerRef.current,
          position: fromLonLat(event.coordinates),
          positioning: 'bottom-center',
          offset: [0, -8],
          stopEvent: false,
        }),
      ],
    })
    mapRef.current = map
    return () => {
      mapRef.current = null
      map.dispose()
    }
  }, [])

  function zoom(delta: number) {
    const view = mapRef.current?.getView()
    const current = view?.getZoom()
    if (current !== undefined) view?.setZoom(current + delta)
  }

  return (
    <div className="venue-map" data-map-status={status}>
      <div
        ref={targetRef}
        className="venue-map-canvas"
        role="region"
        aria-label={t('venue.mapLabel')}
        tabIndex={0}
      />
      <div ref={markerRef} className="venue-map-marker" aria-hidden="true">
        <span>FSpS MU</span>
        <i />
      </div>
      <div className="map-zoom" role="group" aria-label={t('venue.zoomLabel')}>
        <button type="button" onClick={() => zoom(1)} aria-label={t('venue.zoomIn')}>
          +
        </button>
        <button type="button" onClick={() => zoom(-1)} aria-label={t('venue.zoomOut')}>
          −
        </button>
      </div>
      {status !== 'ready' && (
        <p className="map-status" role="status">
          {t(status === 'loading' ? 'venue.mapLoading' : 'venue.mapError')}
        </p>
      )}
      <a className="map-external" href={mapUrl} target="_blank" rel="noopener noreferrer">
        {t('venue.openMap')} ↗
      </a>
      <span className="map-attribution">
        ©{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
          OpenStreetMap
        </a>{' '}
        contributors
      </span>
    </div>
  )
}
