import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { bodyweightCategories } from '../../config/competition'
import { sectionNumber } from '../../config/features'
import { fetchStartlist } from '../../lib/registration/api'
import { formatDateTime, kg } from '../../lib/registration/format'
import type { Startlist as StartlistData, StartlistEntry } from '../../lib/registration/types'

type Filter = 'women' | 'men' | 'teams' | 'amcr'
type Status = 'loading' | 'error' | 'ready'

const categoryOrder = (entry: StartlistEntry) => {
  const list: readonly string[] =
    entry.sex === 'F' ? bodyweightCategories.women : bodyweightCategories.men
  return list.indexOf(entry.weightClass)
}

const byCategoryThenTotal = (a: StartlistEntry, b: StartlistEntry) =>
  a.sex.localeCompare(b.sex) || categoryOrder(a) - categoryOrder(b) || b.total - a.total

interface Group {
  title: string
  entries: StartlistEntry[]
}

function groupBy(entries: StartlistEntry[], title: (entry: StartlistEntry) => string): Group[] {
  const groups = new Map<string, StartlistEntry[]>()
  for (const entry of entries) {
    const key = title(entry)
    groups.set(key, [...(groups.get(key) ?? []), entry])
  }
  return [...groups].map(([key, items]) => ({ title: key, entries: items }))
}

export function Startlist() {
  const { t, i18n } = useTranslation()
  const [status, setStatus] = useState<Status>('loading')
  const [data, setData] = useState<StartlistData | null>(null)
  const [filter, setFilter] = useState<Filter>('women')

  const load = useCallback(async () => {
    setStatus('loading')
    const response = await fetchStartlist()
    if (response.ok) {
      setData(response.data)
      setStatus('ready')
    } else {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const sexLabel = (entry: StartlistEntry) =>
    t(entry.sex === 'F' ? 'startlist.women' : 'startlist.men')
  const entries = data?.entries ?? []
  const groups: Group[] =
    filter === 'teams'
      ? groupBy(
          entries
            .filter((entry) => entry.kind === 'team')
            .sort((a, b) => (a.teamName ?? '').localeCompare(b.teamName ?? '', 'cs')),
          (entry) => entry.teamName ?? '',
        )
      : groupBy(
          entries
            .filter((entry) =>
              filter === 'amcr'
                ? entry.amcr
                : entry.kind === 'individual' &&
                  entry.cwo &&
                  entry.sex === (filter === 'women' ? 'F' : 'M'),
            )
            .sort(byCategoryThenTotal),
          (entry) =>
            filter === 'amcr'
              ? `${sexLabel(entry)} ${kg(entry.weightClass)}`
              : kg(entry.weightClass),
        )
  const showCategory = filter === 'teams'
  const showUniversity = filter === 'amcr'

  return (
    <section
      id="startlist"
      tabIndex={-1}
      className="content-section startlist-section"
      aria-labelledby="startlist-title"
    >
      <div className="about-content">
        <div className="section-label">
          <span>{sectionNumber('startlist')} /</span>
          <h2 id="startlist-title" className="section-title">
            {t('startlist.title')}
          </h2>
        </div>
        {status === 'loading' ? (
          <p className="notice" role="status">
            {t('startlist.loading')}
          </p>
        ) : status === 'error' ? (
          <div className="notice notice-error" role="alert">
            <p>{t('startlist.error')}</p>
            <button type="button" className="button button-secondary" onClick={() => void load()}>
              {t('startlist.retry')}
            </button>
          </div>
        ) : (
          <>
            <div className="startlist-meta">
              {data?.publishedAt && (
                <p className="muted-copy">
                  {t('startlist.updated', {
                    date: formatDateTime(data.publishedAt, i18n.language),
                  })}
                </p>
              )}
              {data?.isFinal && <span className="badge">{t('startlist.final')}</span>}
            </div>
            <div className="tabs" role="group" aria-label={t('startlist.filterLabel')}>
              {(['women', 'men', 'teams', 'amcr'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {t(`startlist.${value}`)}
                </button>
              ))}
            </div>
            {groups.length === 0 ? (
              <p className="notice">{t('startlist.empty')}</p>
            ) : (
              groups.map((group) => (
                <div key={group.title} className="startlist-group">
                  <h3>
                    {group.title}
                    <span className="muted-copy">
                      {t('startlist.count', { count: group.entries.length })}
                    </span>
                  </h3>
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th scope="col">{t('startlist.name')}</th>
                          <th scope="col">{t('startlist.birthYear')}</th>
                          {showCategory && <th scope="col">{t('startlist.weightClass')}</th>}
                          {showUniversity && <th scope="col">{t('startlist.university')}</th>}
                          <th scope="col" className="numeric">
                            {t('startlist.total')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.entries.map((entry, index) => (
                          <tr key={index}>
                            <th scope="row">
                              {entry.lastName} {entry.firstName}
                            </th>
                            <td>{entry.birthYear}</td>
                            {showCategory && (
                              <td>
                                {sexLabel(entry)} {kg(entry.weightClass)}
                              </td>
                            )}
                            {showUniversity && <td>{entry.university}</td>}
                            <td className="numeric">{kg(entry.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </section>
  )
}
