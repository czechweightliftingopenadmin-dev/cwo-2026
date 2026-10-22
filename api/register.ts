import { productionDeps } from './_lib/deps.js'
import { createRegistration } from './_lib/handlers.js'

export function POST(request: Request): Promise<Response> {
  return createRegistration(request, productionDeps)
}
