"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatDate, formatTime } from "@/lib/utils";
import { getPageName } from "@/lib/helper";
import { useSocket } from "@/lib/socket";
import { NotificationDropdown } from "@/components/ui/notification-dropdown";
import { Menu, Search, Wifi, WifiOff, Activity, Clock } from "lucide-react";

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { isConnected } = useSocket();
  const pathname = usePathname();
  const pageName = getPageName(pathname);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <header className="bg-card border-b px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left side */}
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="md:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="hidden md:block">
            <h1 className="text-2xl font-bold">{pageName}</h1>
            <p className="text-sm text-muted-foreground">
              {formatDate(currentTime)}
            </p>
          </div>
        </div>

        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search students, attendance..."
              className="w-full pl-10 pr-4 py-2 bg-muted border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Connection Status */}
          <div className="flex items-center space-x-2">
            {isConnected() ? (
              <div className="flex items-center space-x-1 text-green-500">
                <Wifi className="h-4 w-4" />
                <span className="text-xs hidden sm:inline">Connected</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1 text-red-500">
                <WifiOff className="h-4 w-4" />
                <span className="text-xs hidden sm:inline">Disconnected</span>
              </div>
            )}
          </div>

          <div className="hidden lg:flex items-center space-x-4">
            {isConnected() ? (
              <div className="flex items-center space-x-1 text-sm">
                <Activity className="h-4 w-4 text-green-500" />
                <span className="text-muted-foreground text-green-500!">
                  Live
                </span>
              </div>
            ) : null}
          </div>

          <div className="hidden sm:flex items-center space-x-1 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono">{formatTime(currentTime)}</span>
          </div>

          {/* Notifications */}
          <NotificationDropdown />

          {/* User Avatar */}
          {/* <div className="flex items-center space-x-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src="/api/placeholder/32/32" alt="Admin" />
              <AvatarFallback>AD</AvatarFallback>
            </Avatar>
            <div className="hidden sm:block">
              <p className="text-sm font-medium">Admin User</p>
              <p className="text-xs text-muted-foreground">
                System Administrator
              </p>
            </div>
          </div> */}
        </div>
      </div>
    </header>
  );
}
