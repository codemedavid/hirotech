'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon, Download, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { ActivityHeatmap } from './activity-heatmap'
import { toast } from 'sonner'

interface TeamMember {
  id: string
  user: {
    name: string | null
    email: string
  }
}

interface EnhancedActivityHeatmapProps {
  teamId: string
  isAdmin: boolean
}

type DateRange = {
  from: Date | undefined
  to: Date | undefined
}

export function EnhancedActivityHeatmap({ teamId, isAdmin }: EnhancedActivityHeatmapProps) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [selectedMember, setSelectedMember] = useState<string>('all')
  const [days, setDays] = useState<string>('30')
  const [dateRange, setDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined
  })
  const [heatmapData, setHeatmapData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Fetch members
  useEffect(() => {
    if (isAdmin) {
      fetchMembers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, isAdmin])

  // Fetch heatmap data when filters change
  useEffect(() => {
    fetchHeatmapData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, selectedMember, days, dateRange])

  async function fetchMembers() {
    try {
      const response = await fetch(`/api/teams/${teamId}/members`)
      if (response.ok) {
        const data = await response.json()
        setMembers(data.members.filter((m: TeamMember) => m.user))
      }
    } catch (error) {
      console.error('Error fetching members:', error)
    }
  }

  async function fetchHeatmapData() {
    setLoading(true)
    try {
      let url = `/api/teams/${teamId}/activities?view=heatmap&days=${days}`
      
      if (selectedMember && selectedMember !== 'all') {
        url += `&memberId=${selectedMember}`
      }
      
      if (dateRange.from) {
        url += `&startDate=${dateRange.from.toISOString()}`
      }
      
      if (dateRange.to) {
        url += `&endDate=${dateRange.to.toISOString()}`
      }

      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setHeatmapData(data.heatmap)
      }
    } catch (error) {
      console.error('Error fetching heatmap data:', error)
      toast.error('Failed to load heatmap data')
    } finally {
      setLoading(false)
    }
  }

  async function exportData(format: 'csv' | 'json') {
    setExporting(true)
    try {
      let url = `/api/teams/${teamId}/activities/export?format=${format}&days=${days}`
      
      if (selectedMember && selectedMember !== 'all') {
        url += `&memberId=${selectedMember}`
      }

      if (dateRange.from) {
        url += `&startDate=${dateRange.from.toISOString()}`
      }
      
      if (dateRange.to) {
        url += `&endDate=${dateRange.to.toISOString()}`
      }

      const response = await fetch(url)
      if (response.ok) {
        const blob = await response.blob()
        const downloadUrl = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = downloadUrl
        link.download = `team-activities-${Date.now()}.${format}`
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(downloadUrl)
        toast.success(`Exported as ${format.toUpperCase()}`)
      } else {
        throw new Error('Export failed')
      }
    } catch (error) {
      console.error('Error exporting data:', error)
      toast.error('Failed to export data')
    } finally {
      setExporting(false)
    }
  }

  function resetFilters() {
    setSelectedMember('all')
    setDays('30')
    setDateRange({ from: undefined, to: undefined })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Activity Heatmap</CardTitle>
            <CardDescription>
              Visual representation of team activity by day and hour
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportData('csv')}
              disabled={exporting || loading}
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportData('json')}
              disabled={exporting || loading}
            >
              Export JSON
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Member Filter */}
          {isAdmin && (
            <div className="space-y-2">
              <Label htmlFor="member-filter">Filter by Member</Label>
              <Select value={selectedMember} onValueChange={setSelectedMember}>
                <SelectTrigger id="member-filter">
                  <SelectValue placeholder="All members" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Members</SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.user.name || member.user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Time Period Filter */}
          <div className="space-y-2">
            <Label htmlFor="period-filter">Time Period</Label>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger id="period-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="60">Last 60 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom Date Range */}
          <div className="space-y-2">
            <Label>Custom Date Range</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !dateRange.from && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, 'MMM dd')} - {format(dateRange.to, 'MMM dd, yyyy')}
                      </>
                    ) : (
                      format(dateRange.from, 'MMM dd, yyyy')
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={{
                    from: dateRange.from,
                    to: dateRange.to
                  }}
                  onSelect={(range) => {
                    setDateRange({
                      from: range?.from,
                      to: range?.to
                    })
                  }}
                  numberOfMonths={2}
                  disabled={(date) => date > new Date()}
                />
                <div className="p-3 border-t flex justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDateRange({ from: undefined, to: undefined })}
                  >
                    Clear
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Reset Button */}
        {(selectedMember !== 'all' || days !== '30' || dateRange.from) && (
          <div>
            <Button variant="outline" size="sm" onClick={resetFilters}>
              Reset Filters
            </Button>
          </div>
        )}

        {/* Heatmap */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : heatmapData ? (
          <ActivityHeatmap data={heatmapData} />
        ) : (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            No activity data available for the selected period
          </div>
        )}

        {/* Filter Info */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Showing:</span>
          {selectedMember !== 'all' && (
            <span className="px-2 py-1 bg-muted rounded">
              {members.find(m => m.id === selectedMember)?.user.name || 'Selected member'}
            </span>
          )}
          <span className="px-2 py-1 bg-muted rounded">
            {dateRange.from && dateRange.to
              ? `${format(dateRange.from, 'MMM dd')} - ${format(dateRange.to, 'MMM dd, yyyy')}`
              : `Last ${days} days`}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

