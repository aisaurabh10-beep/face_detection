"use client";

import { useEffect } from "react";
import { socketManager } from "@/lib/socket";
import { ReduxProvider } from "@/redux/ReduxProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize socket connection
    socketManager.connect();

    // Cleanup on unmount
    return () => {
      socketManager.disconnect();
    };
  }, []);

  return <ReduxProvider>{children}</ReduxProvider>;
}
