import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { JoinTeamForm } from '@/components/teams/join-team-form'
import { TeamDashboard } from '@/components/teams/team-dashboard'
import { CreateTeamDialog } from '@/components/teams/create-team-dialog'

export default async function TeamPage() {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect('/login')
  }

  // Get user's teams
  const teams = await prisma.team.findMany({
    where: {
      members: {
        some: {
          userId: session.user.id,
          status: { in: ['ACTIVE', 'PENDING'] }
        }
      }
    },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true
        }
      },
      members: {
        where: { userId: session.user.id },
        select: {
          id: true,
          role: true,
          status: true,
          lastActiveAt: true
        }
      },
      _count: {
        select: {
          members: true,
          tasks: true,
          messages: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  // Get user's active team
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { activeTeamId: true }
  })

  const activeTeam = user?.activeTeamId 
    ? teams.find(t => t.id === user.activeTeamId)
    : teams.find(t => t.members[0]?.status === 'ACTIVE')

  // Get pending join requests for teams where user is admin
  const pendingRequests = await prisma.teamJoinRequest.findMany({
    where: {
      status: 'PENDING',
      invite: {
        team: {
          members: {
            some: {
              userId: session.user.id,
              role: { in: ['OWNER', 'ADMIN'] },
              status: 'ACTIVE'
            }
          }
        }
      }
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true
        }
      },
      invite: {
        include: {
          team: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    }
  })

  // If no teams, show join/create team form
  if (teams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] p-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <div>
            <h1 className="text-3xl font-bold">Welcome to Teams</h1>
            <p className="mt-2 text-muted-foreground">
              Join an existing team or create your own to collaborate with your colleagues.
            </p>
          </div>

          <div className="space-y-4">
            <JoinTeamForm />
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or
                </span>
              </div>
            </div>

            <CreateTeamDialog />
          </div>
        </div>
      </div>
    )
  }

  // If user has teams, show dashboard
  return (
    <TeamDashboard 
      teams={teams}
      activeTeam={activeTeam}
      currentUserId={session.user.id}
      pendingRequests={pendingRequests}
    />
  )
}

