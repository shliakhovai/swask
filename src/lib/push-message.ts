import { isRecord } from './tasks'

export function pushMessage(value: unknown): {
  title: string
  body: string
  tag: string
} {
  if (
    !isRecord(value) ||
    typeof value.title !== 'string' ||
    typeof value.body !== 'string' ||
    typeof value.tag !== 'string'
  )
    return {
      title: 'swask',
      body: 'На тебе чекає наступний маленький крок.',
      tag: 'swask-reminder',
    }
  return {
    title: value.title.slice(0, 100),
    body: value.body.slice(0, 500),
    tag: value.tag.slice(0, 100),
  }
}
