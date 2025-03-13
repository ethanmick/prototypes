import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useAppInfo } from './hooks/useAppInfo'
import { usePokemonInfo } from './hooks/usePokemonInfo'

const App = () => {
  const { appInfo, loading: appLoading, error: appError } = useAppInfo()
  const {
    pokemonInfo,
    loading: pokemonLoading,
    error: pokemonError,
    fetchPokemonInfo,
  } = usePokemonInfo()
  const [pokemonName, setPokemonName] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pokemonName.trim()) {
      fetchPokemonInfo(pokemonName.trim())
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
    </div>
  )
}

const container = document.getElementById('root') || document.body
const root = createRoot(container)
root.render(<App />)
