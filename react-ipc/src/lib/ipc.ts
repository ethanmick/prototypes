// IPC Channel names
export const IPC_CHANNELS = {
  GET_APP_INFO: 'get-app-info',
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

// Type for our IPC handlers
export type IpcMainHandlers = {
  [IPC_CHANNELS.GET_APP_INFO]: () => Promise<IpcResponse<AppInfo>>
}
