import { handleAssistant } from '../server/assistant/runtime.js'
import { endpoint } from '../server/assistant/endpoints.js'

export default {
  fetch: endpoint(handleAssistant, 'legacy'),
}
