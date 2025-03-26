import { openai } from '@ai-sdk/openai'
import { Message, streamText } from 'ai'
import { z } from 'zod'

async function main() {
  const messages: Message[] = [
    {
      id: '1',
      role: 'user',
      content: 'What is the weather in Boston in F?',
    },
  ]

  const result = streamText({
    model: openai('gpt-4o'),
    system: 'You are a helpful assistant.',
    messages,
    maxSteps: 5,
    toolCallStreaming: true,
    tools: {
      getWeather: {
        description: 'Get the weather for a location',
        parameters: z.object({
          city: z.string().describe('The city to get the weather for'),
          unit: z
            .enum(['C', 'F'])
            .describe('The unit to display the temperature in'),
        }),
        execute: async ({ city, unit }) => {
          const weather = {
            value: 24,
            description: 'Sunny',
          }

          return `It is currently ${weather.value}°${unit} and ${weather.description} in ${city}!`
        },
      },
    },
  })

  for await (const chunk of result.fullStream) {
    if (chunk.type === 'text-delta') {
      process.stdout.write(chunk.textDelta)
    } else if (chunk.type === 'error') {
      console.log(chunk.error)
      console.log(
        'Validation Error Delta',
        chunk.error?.value?.choices?.[0]?.delta?.tool_calls?.[0]?.function
      )
    } else {
      console.log('Type', chunk.type)
    }
  }
}

main()
