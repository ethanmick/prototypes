// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron'
import {
  AppInfo,
  IPC_CHANNELS,
  IpcResponse,
  PokemonInfo,
  StreamChunk,
} from './lib/ipc'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  getAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.GET_APP_INFO),
  getPokemonInfo: (pokemonName: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_POKEMON_INFO, pokemonName),
  streamResponse: (content: string, callback: (chunk: StreamChunk) => void) => {
    const channel = `${IPC_CHANNELS.STREAM_RESPONSE}-${Date.now()}`

    // Set up listener for this specific stream
    ipcRenderer.on(channel, (_, chunk: StreamChunk) => {
      callback(chunk)
    })

    // Initiate the stream
    ipcRenderer.invoke(IPC_CHANNELS.STREAM_RESPONSE, content, channel)

    // Return cleanup function
    return () => {
      ipcRenderer.removeAllListeners(channel)
    }
  },
})

// Add type definitions for the exposed API
declare global {
  interface Window {
    electron: {
      getAppInfo: () => Promise<IpcResponse<AppInfo>>
      getPokemonInfo: (pokemonName: string) => Promise<IpcResponse<PokemonInfo>>
      streamResponse: (
        content: string,
        callback: (chunk: StreamChunk) => void
      ) => () => void
    }
  }
}
