'use client'

import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface Team {
  id: string
  name: string
  _count: {
    members: number
  }
  members: Array<{
    role: string
    status: string
  }>
}

interface TeamSelectorProps {
  teams: Team[]
  selectedTeamId: string
  onSelect: (teamId: string) => void
}

export function TeamSelector({ teams, selectedTeamId, onSelect }: TeamSelectorProps) {
  const [open, setOpen] = useState(false)

  const selectedTeam = teams.find(t => t.id === selectedTeamId)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[300px] justify-between"
        >
          <span className="truncate">
            {selectedTeam ? selectedTeam.name : 'Select team...'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder="Search teams..." />
          <CommandEmpty>No team found.</CommandEmpty>
          <CommandGroup>
            {teams.map((team) => {
              const member = team.members[0]
              return (
                <CommandItem
                  key={team.id}
                  value={team.name}
                  onSelect={() => {
                    onSelect(team.id)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedTeamId === team.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {team.name}
                      {member?.status === 'PENDING' && (
                        <Badge variant="secondary" className="text-xs">
                          Pending
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {team._count.members} members • {member?.role}
                    </div>
                  </div>
                </CommandItem>
              )
            })}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

