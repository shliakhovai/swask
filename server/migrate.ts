import { createNeonRepository } from './repository.ts'

if (!process.env.DATABASE_URL)
  throw new Error('Add DATABASE_URL to .env first.')
await createNeonRepository(process.env.DATABASE_URL).initialize()
console.log('swask database schema is ready.')
