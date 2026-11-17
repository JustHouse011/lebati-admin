import { createAssistantHandler } from '../server/assistant/handler'

const handle = createAssistantHandler()

export default {
  fetch: handle,
}
