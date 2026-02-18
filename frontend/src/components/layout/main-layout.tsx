"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import { useState } from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import "driver.js/dist/driver.css";

interface MainLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function MainLayout({ children, className }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background">
      <div className="hidden md:flex md:flex-shrink-0">
        <Sidebar />
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-64">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className={cn("flex-1 overflow-auto p-6", className)}>
          {children}
        </main>
      </div>

      {/* Floating Logo - Bottom Right Corner */}

      <div className="fixed bottom-6 right-6 z-50">
        <div className="shadow-lg hover:shadow-xl transition-shadow">
          <Image
            src="/logo2.svg"
            alt="BharathaTechno Logo"
            width={25}
            height={25}
            unoptimized
          />
        </div>
      </div>
    </div>
  );
}
