'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useSession } from '@/hooks/use-session';

interface TeamContext {
  activeTeamId: string | null | undefined;
  teamContext: {
    teamId: string;
    teamName: string;
    memberId: string;
    memberRole: string;
    memberStatus: string;
  } | null | undefined;
  isTeamMember: boolean;
  isTeamAdmin: boolean;
  isTeamOwner: boolean;
}

const TeamContext = createContext<TeamContext | undefined>(undefined);

export function TeamProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  
  const activeTeamId = session?.user?.activeTeamId;
  const teamContext = session?.user?.teamContext;
  const isTeamMember = !!teamContext && teamContext.memberStatus === 'ACTIVE';
  const isTeamAdmin = isTeamMember && (teamContext.memberRole === 'OWNER' || teamContext.memberRole === 'ADMIN');
  const isTeamOwner = isTeamMember && teamContext.memberRole === 'OWNER';

  return (
    <TeamContext.Provider
      value={{
        activeTeamId,
        teamContext,
        isTeamMember,
        isTeamAdmin,
        isTeamOwner,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
}

export function useTeamContext() {
  const context = useContext(TeamContext);
  if (context === undefined) {
    throw new Error('useTeamContext must be used within a TeamProvider');
  }
  return context;
}

