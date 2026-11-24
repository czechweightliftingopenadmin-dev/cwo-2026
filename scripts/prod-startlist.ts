import pg from 'pg'
import type { Plugin } from 'vite'

/**
 * `npm run dev:prod`: the local site shows the start list built from live production
 * registrations, from the same view the evening snapshot publishes, without the birth year.
 * Nothing is written: the query runs in a read-only transaction and every other API call
 * is refused, so the forms cannot reach production.
 */
export function prodStartlist(password: string | undefined): Plugin {
  if (!password) throw new Error('npm run dev:prod needs SUPABASE_DB_PASSWORD_PROD in .env.local')
  return {
    name: 'cwo-prod-startlist',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api', (req, res) => {
        const send = (status: number, body: unknown) => {
          res.statusCode = status
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.setHeader('cache-control', 'no-store')
          res.end(JSON.stringify(body))
        }
        if (req.method !== 'GET' || req.url?.split('?')[0] !== '/startlist')
          return send(503, { error: 'server' })
        readStartlist(password).then(
          (entries) =>
            send(200, { publishedAt: new Date().toISOString(), isFinal: false, entries }),
          (error: unknown) => {
            server.config.logger.error(`prod start list: ${String(error)}`)
            send(500, { error: 'server' })
          },
        )
      })
    },
  }
}

async function readStartlist(password: string): Promise<unknown[]> {
  const client = new pg.Client({
    host: 'aws-0-eu-west-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.sjexsymadngqgffddvqd',
    password,
    // The Supabase pooler presents a certificate from Supabase's own CA.
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10_000,
  })
  await client.connect()
  try {
    await client.query('begin read only')
    const { rows } = await client.query<{ entries: unknown[] }>(`
      select coalesce(jsonb_agg(jsonb_build_object(
        'kind', kind,
        'teamName', team_name,
        'firstName', first_name,
        'lastName', last_name,
        'sex', sex,
        'nationality', nationality,
        'weightClass', weight_class,
        'total', total,
        'cwo', cwo,
        'amcr', amcr,
        'university', university
      ) order by last_name, first_name), '[]'::jsonb) as entries
      from public.public_startlist`)
    return rows[0]?.entries ?? []
  } finally {
    await client.query('rollback').catch(() => undefined)
    await client.end()
  }
}
