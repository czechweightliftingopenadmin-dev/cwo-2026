import { productionDeps } from './_lib/deps.js'
import { getStartlist } from './_lib/handlers.js'

export function GET(request: Request): Promise<Response> {
  return getStartlist(request, productionDeps)
}
