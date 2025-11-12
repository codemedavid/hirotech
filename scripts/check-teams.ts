import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkTeams() {
  console.log('Checking teams data...\n')
  
  // Count teams
  const teamCount = await prisma.team.count()
  console.log(`Total teams: ${teamCount}`)
  
  if (teamCount > 0) {
    const teams = await prisma.team.findMany({
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    })
    
    console.log('\nTeams:')
    teams.forEach(team => {
      console.log(`\nTeam: ${team.name} (ID: ${team.id})`)
      console.log(`  Owner: ${team.ownerId}`)
      console.log(`  Members: ${team.members.length}`)
      team.members.forEach(member => {
        console.log(`    - ${member.user.name} (${member.user.email})`)
        console.log(`      Status: ${member.status}, Role: ${member.role}`)
      })
    })
  }
  
  // Count thread
  const threadCount = await prisma.teamThread.count()
  console.log(`\n\nTotal team threads: ${threadCount}`)
  
  if (threadCount > 0) {
    const threads = await prisma.teamThread.findMany({
      take: 5,
      include: {
        _count: {
          select: { messages: true }
        }
      }
    })
    
    console.log('\nSample threads:')
    threads.forEach(thread => {
      console.log(`  - ${thread.title || 'Untitled'} (Team: ${thread.teamId}, Messages: ${thread._count.messages})`)
    })
  }
  
  await prisma.$disconnect()
}

checkTeams().catch(console.error)

