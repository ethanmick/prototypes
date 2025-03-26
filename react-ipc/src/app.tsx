import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useAppInfo } from './hooks/useAppInfo'
import { usePokemonInfo } from './hooks/usePokemonInfo'
import { useStreamResponse } from './hooks/useStreamResponse'

const App = () => {
  const { appInfo, loading: appLoading, error: appError } = useAppInfo()
  const {
    pokemonInfo,
    loading: pokemonLoading,
    error: pokemonError,
    fetchPokemonInfo,
  } = usePokemonInfo()
  const {
    response,
    loading: streamLoading,
    error: streamError,
    streamResponse,
  } = useStreamResponse()
  const [pokemonName, setPokemonName] = useState('')
  const [streamContent, setStreamContent] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pokemonName.trim()) {
      fetchPokemonInfo(pokemonName.trim())
    }
  }

  const handleStreamSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (streamContent.trim()) {
      streamResponse(streamContent.trim())
    }
  }

  return (
    <div style={{ padding: '20px' }}>
      <section>
        <h2>Electron App Info</h2>
        {appLoading && <div>Loading app info...</div>}
        {appError && <div>Error: {appError}</div>}
        {appInfo && (
          <ul>
            <li>Version: {appInfo.version}</li>
            <li>Platform: {appInfo.platform}</li>
            <li>Architecture: {appInfo.arch}</li>
            <li>Current Working Directory: {appInfo.cwd}</li>
          </ul>
        )}
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Pokemon Info</h2>
        <form onSubmit={handleSubmit} style={{ marginBottom: '1rem' }}>
          <input
            type="text"
            value={pokemonName}
            onChange={(e) => setPokemonName(e.target.value)}
            placeholder="Enter Pokemon name"
            style={{ marginRight: '0.5rem', padding: '0.5rem' }}
          />
          <button
            type="submit"
            disabled={pokemonLoading || !pokemonName.trim()}
            style={{ padding: '0.5rem 1rem' }}
          >
            {pokemonLoading ? 'Loading...' : 'Search'}
          </button>
        </form>

        {pokemonError && (
          <div style={{ color: 'red' }}>Error: {pokemonError}</div>
        )}

        {pokemonInfo && (
          <div>
            <h3>
              {pokemonInfo.name} (#{pokemonInfo.id})
            </h3>
          </div>
        )}
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Streaming Response</h2>
        <form onSubmit={handleStreamSubmit} style={{ marginBottom: '1rem' }}>
          <textarea
            value={streamContent}
            onChange={(e) => setStreamContent(e.target.value)}
            placeholder="Enter content to stream..."
            style={{
              width: '100%',
              minHeight: '100px',
              marginBottom: '0.5rem',
              padding: '0.5rem',
            }}
          />
          <button
            type="submit"
            disabled={streamLoading || !streamContent.trim()}
            style={{ padding: '0.5rem 1rem' }}
          >
            {streamLoading ? 'Streaming...' : 'Start Stream'}
          </button>
        </form>

        {streamError && (
          <div style={{ color: 'red' }}>Error: {streamError}</div>
        )}

        {response && (
          <div
            style={{
              whiteSpace: 'pre-wrap',
              border: '1px solid #ccc',
              borderRadius: '4px',
              padding: '1rem',
              backgroundColor: '#f5f5f5',
              minHeight: '100px',
            }}
          >
            {response}
          </div>
        )}
      </section>
    </div>
  )
}

const container = document.getElementById('root') || document.body
const root = createRoot(container)
root.render(<App />)
