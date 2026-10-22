import type { Deps } from './handlers.js'
import { createResendMailer } from './mailer.js'
import { createSupabaseStore } from './store.js'

let deps: Deps | undefined

/** Created on first request, so a missing variable fails with a clear 500, not at import. */
export function productionDeps(): Deps {
  deps ??= {
    store: createSupabaseStore(),
    mailer: createResendMailer(),
    now: () => new Date(),
  }
  return deps
}
