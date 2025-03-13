// IPC Channel names
export const IPC_CHANNELS = {
  GET_APP_INFO: 'get-app-info',
  GET_POKEMON_INFO: 'get-pokemon-info',
  STREAM_RESPONSE: 'stream-response',
} as const

// Types for IPC communication
export interface IpcResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface AppInfo {
  version: string
  platform: string
  arch: string
}

export interface PokemonInfo {
  id: number
  name: string
  // Add more fields as needed
}

export interface StreamChunk {
  type: 'chunk' | 'done'
  content?: string
  error?: string
}

// Type for our IPC handlers
export type IpcMainHandlers = {
  [IPC_CHANNELS.GET_APP_INFO]: () => Promise<IpcResponse<AppInfo>>
  [IPC_CHANNELS.GET_POKEMON_INFO]: (
    pokemonName: string
  ) => Promise<IpcResponse<PokemonInfo>>
  [IPC_CHANNELS.STREAM_RESPONSE]: (content: string) => void
}
