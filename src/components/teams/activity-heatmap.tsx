'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface HeatmapData {
  [day: string]: {
    [hour: number]: number
  }
}

interface ActivityHeatmapProps {
  data: HeatmapData
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

export function ActivityHeatmap({ data }: ActivityHeatmapProps) {
  // Transform data into a more usable format
  const heatmapMatrix = useMemo(() => {
    const matrix: { day: string; hour: number; count: number; date?: string }[] = []
    
    // Get all dates and sort them
    const dates = Object.keys(data).sort()
    
    if (dates.length === 0) {
      return []
    }
    
    // Group by day of week and hour
    const grouped: { [key: string]: { [hour: number]: number } } = {}
    
    dates.forEach((dateStr) => {
      const date = new Date(dateStr)
      const dayOfWeek = date.getDay()
      const dayName = DAYS_OF_WEEK[dayOfWeek]
      
      if (!grouped[dayName]) {
        grouped[dayName] = {}
      }
      
      const dayData = data[dateStr]
      Object.entries(dayData).forEach(([hourStr, count]) => {
        const hour = parseInt(hourStr)
        grouped[dayName][hour] = (grouped[dayName][hour] || 0) + count
      })
    })
    
    // Create matrix
    DAYS_OF_WEEK.forEach((day) => {
      HOURS.forEach((hour) => {
        matrix.push({
          day,
          hour,
          count: grouped[day]?.[hour] || 0
        })
      })
    })
    
    return matrix
  }, [data])
  
  // Calculate max value for color scaling
  const maxCount = useMemo(() => {
    return Math.max(...heatmapMatrix.map(cell => cell.count), 1)
  }, [heatmapMatrix])
  
  // Get color intensity based on count
  const getColorIntensity = (count: number) => {
    if (count === 0) return 'bg-muted/20'
    const intensity = Math.ceil((count / maxCount) * 5)
    
    const colors = [
      'bg-primary/10 hover:bg-primary/20',
      'bg-primary/30 hover:bg-primary/40',
      'bg-primary/50 hover:bg-primary/60',
      'bg-primary/70 hover:bg-primary/80',
      'bg-primary/90 hover:bg-primary'
    ]
    
    return colors[intensity - 1] || colors[colors.length - 1]
  }
  
  if (heatmapMatrix.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        No activity data available for the selected period
      </div>
    )
  }
  
  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Legend */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="h-3 w-3 rounded-sm bg-primary/10" />
            <div className="h-3 w-3 rounded-sm bg-primary/30" />
            <div className="h-3 w-3 rounded-sm bg-primary/50" />
            <div className="h-3 w-3 rounded-sm bg-primary/70" />
            <div className="h-3 w-3 rounded-sm bg-primary/90" />
          </div>
          <span>More</span>
        </div>
        
        {/* Heatmap Grid */}
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            <div className="flex gap-2">
              {/* Day labels */}
              <div className="flex flex-col justify-around py-4">
                {DAYS_OF_WEEK.map((day) => (
                  <div
                    key={day}
                    className="h-4 text-xs font-medium text-muted-foreground flex items-center"
                  >
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Hour columns */}
              <div className="flex-1 overflow-x-auto">
                <div className="flex gap-1">
                  {HOURS.map((hour) => (
                    <div key={hour} className="flex flex-col gap-1">
                      {/* Hour label */}
                      <div className="h-4 text-xs text-center text-muted-foreground">
                        {hour % 6 === 0 ? `${hour}h` : ''}
                      </div>
                      
                      {/* Day cells for this hour */}
                      {DAYS_OF_WEEK.map((day) => {
                        const cell = heatmapMatrix.find(
                          c => c.day === day && c.hour === hour
                        )
                        
                        return (
                          <Tooltip key={`${day}-${hour}`}>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  'h-4 w-4 rounded-sm cursor-pointer transition-all hover:ring-2 hover:ring-primary hover:ring-offset-1',
                                  getColorIntensity(cell?.count || 0)
                                )}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-xs">
                                <p className="font-semibold">{day} at {hour}:00</p>
                                <p className="text-muted-foreground">
                                  {cell?.count || 0} activities
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
          <div>
            <p className="text-sm font-medium">Total Activities</p>
            <p className="text-2xl font-bold text-primary">
              {heatmapMatrix.reduce((sum, cell) => sum + cell.count, 0)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">Peak Hour</p>
            <p className="text-2xl font-bold text-primary">
              {(() => {
                const peakCell = [...heatmapMatrix].sort((a, b) => b.count - a.count)[0]
                return peakCell ? `${peakCell.hour}:00` : 'N/A'
              })()}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">Busiest Day</p>
            <p className="text-2xl font-bold text-primary">
              {(() => {
                const dayCounts: { [key: string]: number } = {}
                heatmapMatrix.forEach(cell => {
                  dayCounts[cell.day] = (dayCounts[cell.day] || 0) + cell.count
                })
                const busiestDay = Object.entries(dayCounts)
                  .sort(([, a], [, b]) => b - a)[0]
                return busiestDay ? busiestDay[0] : 'N/A'
              })()}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">Avg per Day</p>
            <p className="text-2xl font-bold text-primary">
              {(() => {
                const total = heatmapMatrix.reduce((sum, cell) => sum + cell.count, 0)
                const days = new Set(
                  Object.keys(data).map(d => new Date(d).toDateString())
                ).size
                return days > 0 ? Math.round(total / days) : 0
              })()}
            </p>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

