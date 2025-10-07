"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDate, formatTime } from "@/lib/utils";
import Image from "next/image";
import { getPicUrl } from "@/lib/helper";
import {
  Bell,
  Camera,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  MoreHorizontal,
} from "lucide-react";

export function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } =
    useNotifications();

  const handleNotificationClick = async (notificationId: string) => {
    if (!notifications.find((n) => n._id === notificationId)?.processed) {
      await markAsRead([notificationId]);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
  };

  const unreadNotifications = notifications.filter((n) => !n.processed);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setIsOpen((v) => !v)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
          >
            {unreadCount}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <Card className="absolute right-0 top-12 w-96 max-h-96 overflow-hidden z-50 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-lg font-semibold">
              Unknown Faces
            </CardTitle>
            <div className="flex items-center space-x-2">
              {unreadNotifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllRead}
                  className="text-xs"
                >
                  Mark all read
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsOpen(false)}
              >
                ✕
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 text-center text-muted-foreground">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No unknown faces detected today</p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {notifications.map((notification) => (
                  <div
                    key={notification._id}
                    className={`p-4 border-b last:border-b-0 hover:bg-muted/50 cursor-pointer transition-colors ${
                      !notification.processed ? "bg-muted/30" : ""
                    }`}
                    onClick={() => handleNotificationClick(notification._id)}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="relative w-12 h-12">
                        <Image
                          src={getPicUrl(notification.photo)}
                          alt="Unknown face"
                          width={48}
                          height={48}
                          className="rounded-lg object-cover w-12 h-12"
                          onError={(e) => {
                            const el = e.target as HTMLImageElement;
                            el.src = "/api/placeholder/48/48";
                          }}
                          unoptimized
                        />
                        {!notification.processed && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="text-sm font-medium">
                            Unknown Face Detected
                          </h4>
                          {notification.processed && (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          )}
                        </div>

                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <Camera className="h-3 w-3" />
                            <span>Camera: {notification.cameraId}</span>
                          </div>

                          <div className="flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>
                              {formatTime(notification.timestamp)} -{" "}
                              {formatDate(notification.timestamp)}
                            </span>
                          </div>

                          {/* {notification.location && (
                            <div className="flex items-center space-x-1">
                              <MapPin className="h-3 w-3" />
                              <span>{notification.location}</span>
                            </div>
                          )} */}

                          <div className="flex items-center space-x-1">
                            <span>
                              Confidence:{" "}
                              {Math.round(notification.confidence * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
