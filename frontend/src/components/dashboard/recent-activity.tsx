"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
// import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  UserCheck,
  UserX,
  AlertTriangle,
  Clock,
  MoreHorizontal,
  Eye
} from "lucide-react"

interface ActivityItem {
  id: string
  type: "entry" | "exit" | "unknown" | "late"
  studentName?: string
  studentClass?: string
  timestamp: Date
  confidence?: number
  message: string
}

const activities: ActivityItem[] = [
  {
    id: "1",
    type: "entry",
    studentName: "John Doe",
    studentClass: "10A",
    timestamp: new Date(Date.now() - 2 * 60 * 1000),
    confidence: 0.95,
    message: "Student entered the building"
  },
  {
    id: "2",
    type: "exit",
    studentName: "Sarah Smith",
    studentClass: "10B",
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    confidence: 0.92,
    message: "Student left the building"
  },
  {
    id: "3",
    type: "unknown",
    timestamp: new Date(Date.now() - 8 * 60 * 1000),
    message: "Unknown face detected"
  },
  {
    id: "4",
    type: "late",
    studentName: "Mike Johnson",
    studentClass: "11A",
    timestamp: new Date(Date.now() - 12 * 60 * 1000),
    confidence: 0.88,
    message: "Student arrived late"
  },
  {
    id: "5",
    type: "entry",
    studentName: "Emily Davis",
    studentClass: "9C",
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
    confidence: 0.96,
    message: "Student entered the building"
  }
]

const getActivityIcon = (type: ActivityItem["type"]) => {
  switch (type) {
    case "entry":
      return UserCheck
    case "exit":
      return UserX
    case "unknown":
      return AlertTriangle
    case "late":
      return Clock
    default:
      return UserCheck
  }
}

const getActivityColor = (type: ActivityItem["type"]) => {
  switch (type) {
    case "entry":
      return "text-green-500 bg-green-500/10"
    case "exit":
      return "text-blue-500 bg-blue-500/10"
    case "unknown":
      return "text-yellow-500 bg-yellow-500/10"
    case "late":
      return "text-orange-500 bg-orange-500/10"
    default:
      return "text-gray-500 bg-gray-500/10"
  }
}

const getActivityBadge = (type: ActivityItem["type"]) => {
  switch (type) {
    case "entry":
      return <Badge variant="success" className="text-xs">Entry</Badge>
    case "exit":
      return <Badge variant="info" className="text-xs">Exit</Badge>
    case "unknown":
      return <Badge variant="warning" className="text-xs">Unknown</Badge>
    case "late":
      return <Badge variant="outline" className="text-xs">Late</Badge>
    default:
      return <Badge variant="secondary" className="text-xs">Activity</Badge>
  }
}

export function RecentActivity() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
        <Button variant="ghost" size="sm">
          <Eye className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {activities.map((activity) => {
          const Icon = getActivityIcon(activity.type)
          const colorClass = getActivityColor(activity.type)
          
          return (
            <div key={activity.id} className="flex items-start space-x-3 group">
              <div className={cn("p-2 rounded-lg", colorClass)}>
                <Icon className="h-4 w-4" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getActivityBadge(activity.type)}
                    {activity.confidence && (
                      <span className="text-xs text-muted-foreground">
                        {Math.round(activity.confidence * 100)}%
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {activity.timestamp.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                
                <p className="text-sm font-medium mt-1">
                  {activity.studentName ? (
                    <>
                      <span className="text-foreground">{activity.studentName}</span>
                      {activity.studentClass && (
                        <span className="text-muted-foreground ml-1">
                          • Class {activity.studentClass}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-foreground">{activity.message}</span>
                  )}
                </p>
                
                {activity.studentName && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {activity.message}
                  </p>
                )}
              </div>
              
              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </div>
          )
        })}
        
        <div className="pt-2 border-t">
          <Button variant="outline" size="sm" className="w-full">
            View All Activity
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
