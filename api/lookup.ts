import { productionDeps } from './_lib/deps.js'
import { lookupRegistration } from './_lib/handlers.js'

export function POST(request: Request): Promise<Response> {
  return lookupRegistration(request, productionDeps)
}
