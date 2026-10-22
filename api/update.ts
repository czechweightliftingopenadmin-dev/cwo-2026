import { productionDeps } from './_lib/deps.js'
import { updateRegistration } from './_lib/handlers.js'

export function POST(request: Request): Promise<Response> {
  return updateRegistration(request, productionDeps)
}
