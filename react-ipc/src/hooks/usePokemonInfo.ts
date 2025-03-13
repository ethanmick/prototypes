import { useState } from 'react'
import { PokemonInfo } from '../lib/ipc'

export const usePokemonInfo = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pokemonInfo, setPokemonInfo] = useState<PokemonInfo | null>(null)

  const fetchPokemonInfo = async (pokemonName: string) => {
    setLoading(true)
    setError(null)

    try {
      const response = await window.electron.getPokemonInfo(
        pokemonName.toLowerCase()
      )
      if (response.success && response.data) {
        setPokemonInfo(response.data)
      } else {
        setError(response.error || 'Failed to fetch Pokemon info')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  return { pokemonInfo, loading, error, fetchPokemonInfo }
}
