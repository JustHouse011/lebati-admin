import { createContext } from 'react'

export const AssistantContext = createContext<(question?: string) => void>(() => {})
