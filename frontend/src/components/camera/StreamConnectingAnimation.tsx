"use client";

import { Camera, Wifi, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import Lottie from "lottie-react";
import { useEffect, useState } from "react";

interface StreamConnectingAnimationProps {
  className?: string;
}

export function StreamConnectingAnimation({
  className,
}: StreamConnectingAnimationProps) {
  const [cctvAnimation, setCctvAnimation] = useState<any>(null);

  // Load Lottie animation
  useEffect(() => {
    fetch("/cctv.json")
      .then((res) => res.json())
      .then((data) => setCctvAnimation(data))
      .catch((err) => console.error("Failed to load Lottie animation:", err));
  }, []);

  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900 z-20",
        className
      )}
    >
      {/* Animated Background Pattern */}
      <div className="absolute inset-0 overflow-hidden opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_50%)] animate-pulse" />
        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_30%,rgba(59,130,246,0.05)_50%,transparent_70%)] animate-shimmer" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center space-y-8">
        {/* Camera Icon with Animation */}
        <div className="relative">
          {cctvAnimation ? (
            <div className="w-32 h-32">
              <Lottie
                animationData={cctvAnimation}
                loop={true}
                autoplay={true}
                className="w-full h-full"
              />
            </div>
          ) : (
            <Camera className="h-16 w-16 text-white animate-pulse" />
          )}
        </div>

        {/* Connection Animation */}
        <div className="flex items-center space-x-4">
          {/* Left Dot */}
          <div className="relative">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-ping" />
            <div className="absolute inset-0 w-3 h-3 bg-blue-500 rounded-full" />
          </div>

          {/* Animated Wiring */}
          <div className="relative w-32 h-1 bg-gray-700 rounded-full overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-flow" />
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400 via-blue-300 to-blue-400 animate-flow-delayed" />
          </div>

          {/* Socket Icon */}
          <div className="relative">
            <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center border border-blue-400/30">
              <Wifi className="h-4 w-4 text-blue-400 animate-pulse" />
            </div>
            <div className="absolute -top-1 -right-1">
              <Zap className="h-3 w-3 text-yellow-400 animate-pulse" />
            </div>
          </div>

          {/* Right Dot */}
          <div className="relative">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-ping" />
            <div className="absolute inset-0 w-3 h-3 bg-green-500 rounded-full" />
          </div>
        </div>

        {/* Status Text */}
        <div className="text-center space-y-2">
          <h3 className="text-xl font-semibold text-white animate-pulse">
            Connecting Camera to Socket
          </h3>
          <p className="text-sm text-gray-400 flex items-center justify-center space-x-2">
            <span>Establishing WebRTC connection...</span>
          </p>
        </div>

        {/* Loading Dots */}
        <div className="flex space-x-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
        </div>
      </div>
    </div>
  );
}

