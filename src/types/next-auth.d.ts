import { Role, TeamRole, TeamMemberStatus } from '@prisma/client';
import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    id: string;
    email: string;
    name?: string;
    image?: string;
    role: Role;
    organizationId: string;
    activeTeamId?: string | null;
    teamContext?: {
      teamId: string;
      teamName: string;
      memberId: string;
      memberRole: TeamRole;
      memberStatus: TeamMemberStatus;
    } | null;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name?: string;
      image?: string;
      role: Role;
      organizationId: string;
      activeTeamId?: string | null;
      teamContext?: {
        teamId: string;
        teamName: string;
        memberId: string;
        memberRole: TeamRole;
        memberStatus: TeamMemberStatus;
      } | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: Role;
    organizationId: string;
    image?: string;
    activeTeamId?: string | null;
    teamContext?: {
      teamId: string;
      teamName: string;
      memberId: string;
      memberRole: TeamRole;
      memberStatus: TeamMemberStatus;
    } | null;
  }
}
