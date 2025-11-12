import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface SystemStatus {
  service: string
  status: 'running' | 'stopped' | 'error' | 'unknown'
  details?: string
  port?: number
}

async function checkPort(port: number): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`netstat -ano | findstr ":${port}"`)
    return stdout.includes('LISTENING')
  } catch {
    return false
  }
}

async function checkDatabase(): Promise<SystemStatus> {
  try {
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()
    await prisma.$queryRaw`SELECT 1`
    await prisma.$disconnect()
    return {
      service: 'PostgreSQL Database',
      status: 'running',
      details: 'Connected successfully'
    }
  } catch (error) {
    return {
      service: 'PostgreSQL Database',
      status: 'error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function checkNextDevServer(): Promise<SystemStatus> {
  const isRunning = await checkPort(3000)
  return {
    service: 'Next.js Dev Server',
    status: isRunning ? 'running' : 'stopped',
    port: 3000,
    details: isRunning ? 'Running on http://localhost:3000' : 'Not running'
  }
}

async function checkRedis(): Promise<SystemStatus> {
  const redisUrl = process.env.REDIS_URL
  
  if (!redisUrl) {
    return {
      service: 'Redis',
      status: 'error',
      details: 'REDIS_URL environment variable not set'
    }
  }

  try {
    // Try to connect using fetch to a simple health check
    const isLocal = redisUrl.includes('localhost')
    const isRunning = await checkPort(6379)
    
    return {
      service: 'Redis',
      status: isLocal ? (isRunning ? 'running' : 'stopped') : 'unknown',
      port: 6379,
      details: isLocal 
        ? (isRunning ? 'Running locally' : 'Not running locally')
        : 'External Redis (cannot check from here)'
    }
  } catch (error) {
    return {
      service: 'Redis',
      status: 'error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function checkNgrok(): Promise<SystemStatus> {
  const isRunning = await checkPort(4040)
  return {
    service: 'Ngrok Tunnel',
    status: isRunning ? 'running' : 'stopped',
    port: 4040,
    details: isRunning ? 'Running on http://localhost:4040' : 'Not running'
  }
}

async function checkWorker(): Promise<SystemStatus> {
  try {
    // Check if there's a worker process by looking for specific node processes
    const { stdout } = await execAsync('tasklist | findstr "node.exe"')
    // This is a rough check - we can't definitively say if it's the worker
    const nodeProcesses = stdout.split('\n').filter(line => line.includes('node.exe'))
    
    return {
      service: 'Campaign Worker',
      status: nodeProcesses.length > 2 ? 'unknown' : 'stopped',
      details: `Found ${nodeProcesses.length} Node.js processes (cannot determine if worker is running)`
    }
  } catch {
    return {
      service: 'Campaign Worker',
      status: 'stopped',
      details: 'Worker script not detected'
    }
  }
}

async function main() {
  console.log('\n🔍 System Status Check\n')
  console.log('═'.repeat(70))
  console.log('\n')

  const checks: Promise<SystemStatus>[] = [
    checkDatabase(),
    checkNextDevServer(),
    checkRedis(),
    checkNgrok(),
    checkWorker()
  ]

  const results = await Promise.all(checks)

  results.forEach(result => {
    const icon = 
      result.status === 'running' ? '✅' :
      result.status === 'stopped' ? '⭕' :
      result.status === 'error' ? '❌' :
      '❔'

    console.log(`${icon} ${result.service}`)
    console.log(`   Status: ${result.status.toUpperCase()}`)
    if (result.port) {
      console.log(`   Port: ${result.port}`)
    }
    if (result.details) {
      console.log(`   Details: ${result.details}`)
    }
    console.log()
  })

  console.log('═'.repeat(70))
  
  const runningCount = results.filter(r => r.status === 'running').length
  const totalCount = results.length
  
  console.log(`\n📊 Summary: ${runningCount}/${totalCount} services running\n`)

  // Recommendations
  const stopped = results.filter(r => r.status === 'stopped' || r.status === 'error')
  if (stopped.length > 0) {
    console.log('💡 Recommendations:\n')
    stopped.forEach(service => {
      switch (service.service) {
        case 'Next.js Dev Server':
          console.log('   • Start dev server: npm run dev')
          break
        case 'Redis':
          console.log('   • Start Redis: docker run -d --name redis -p 6379:6379 redis:alpine')
          console.log('   • Or use Upstash cloud Redis')
          break
        case 'Ngrok Tunnel':
          console.log('   • Start ngrok: ngrok http 3000')
          break
        case 'Campaign Worker':
          console.log('   • Start worker: npm run worker (if script exists)')
          break
      }
    })
    console.log()
  }
}

main().catch(console.error)

