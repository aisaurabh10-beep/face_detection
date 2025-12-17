"use client";

import { useEffect } from "react";
import { CheckCircle2, X } from "lucide-react";
import { Button } from "./button";

interface SuccessPopupProps {
  message: string;
  onClose: () => void;
  autoClose?: boolean;
  autoCloseDelay?: number;
}

export function SuccessPopup({
  message,
  onClose,
  autoClose = true,
  autoCloseDelay = 3000,
}: SuccessPopupProps) {
  useEffect(() => {
    if (autoClose) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseDelay);

      return () => clearTimeout(timer);
    }
  }, [autoClose, autoCloseDelay, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-background border border-green-500/20 rounded-xl shadow-2xl p-6 animate-in fade-in-0 zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center text-center space-y-4">
          <div className="rounded-full bg-green-500/10 p-3">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">Success!</h3>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
          <Button
            onClick={onClose}
            variant="default"
            size="sm"
            className="mt-2"
          >
            OK
          </Button>
        </div>
      </div>
    </div>
  );
}

