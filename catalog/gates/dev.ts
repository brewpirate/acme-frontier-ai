import { resolve } from 'node:path'

const rootDir = resolve(import.meta.dir, '..')

const CYAN = '\x1b[36m'
const MAGENTA = '\x1b[35m'
const RESET = '\x1b[0m'

const SERVER_PORT = 8765
const UI_PORT = 5173

async function pipeWithPrefix(
  stream: ReadableStream<Uint8Array>,
  prefix: string,
  color: string,
): Promise<void> {
  const decoder = new TextDecoder()
  const reader = stream.getReader()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        if (buffer.length > 0) {
          process.stdout.write(`${color}[${prefix}]${RESET} ${buffer}\n`)
        }
        break
      }
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        process.stdout.write(`${color}[${prefix}]${RESET} ${line}\n`)
      }
    }
  } finally {
    reader.releaseLock()
  }
}

const serverProcess = Bun.spawn(
  [process.execPath, '--hot', 'packages/server/index.ts'],
  {
    cwd: rootDir,
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env,
  },
)

const dashboardProcess = Bun.spawn(
  [process.execPath, 'scripts/dev.ts'],
  {
    cwd: resolve(rootDir, 'packages/dashboard'),
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env,
  },
)

console.log(`${CYAN}[server]${RESET} http://localhost:${SERVER_PORT}`)
console.log(`${MAGENTA}[ui]${RESET}     http://localhost:${UI_PORT}`)

void pipeWithPrefix(serverProcess.stdout, 'server', CYAN)
void pipeWithPrefix(serverProcess.stderr, 'server', CYAN)
void pipeWithPrefix(dashboardProcess.stdout, 'ui', MAGENTA)
void pipeWithPrefix(dashboardProcess.stderr, 'ui', MAGENTA)

function shutdown(): void {
  serverProcess.kill()
  dashboardProcess.kill()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

const exitedProcess = await Promise.race([
  serverProcess.exited.then((code: number | null) => ({ name: 'server', code })),
  dashboardProcess.exited.then((code: number | null) => ({ name: 'ui', code })),
])

console.error(`\n[dev] ${exitedProcess.name} exited unexpectedly (code ${exitedProcess.code ?? 'null'}) — shutting down`)
serverProcess.kill()
dashboardProcess.kill()
process.exit(1)
