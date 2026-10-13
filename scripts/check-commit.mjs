import { readFileSync } from 'node:fs'

const message = readFileSync(process.argv[2], 'utf8').split('\n')[0]
if (
  !/^(feat|fix|docs|test|refactor|perf|build|ci|chore)(\([a-z0-9-]+\))?!?: .{3,}/.test(
    message,
  )
) {
  console.error(
    'Use a Conventional Commit, for example: feat(tasks): add deadline groups',
  )
  process.exitCode = 1
}
