"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SheetProps {
  children: React.ReactNode;
  className?: string;
}

interface SheetContentProps {
  children: React.ReactNode;
  className?: string;
  side?: "left" | "right" | "top" | "bottom";
}

interface SheetTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
  className?: string;
  onClick?: () => void;
}

const Sheet = ({ children, className }: SheetProps) => {
  return <div className={cn("", className)}>{children}</div>;
};

const SheetTrigger = ({
  children,
  asChild,
  className,
  onClick,
}: SheetTriggerProps) => {
  if (asChild && React.isValidElement(children)) {
    const childProps = children.props as {
      className?: string;
      onClick?: () => void;
    };
    return React.cloneElement(children, {
      ...childProps,
      onClick,
      className: cn(childProps?.className, className),
    } as React.HTMLAttributes<HTMLElement>);
  }

  return (
    <button onClick={onClick} className={cn("", className)}>
      {children}
    </button>
  );
};

const SheetContent = ({
  children,
  className,
  side = "left",
}: SheetContentProps) => {
  return (
    <div className={cn("fixed inset-0 z-50 bg-black/50", className)}>
      <div
        className={cn(
          "fixed bg-background border-r shadow-lg",
          side === "left" && "left-0 top-0 h-full w-80",
          side === "right" && "right-0 top-0 h-full w-80",
          side === "top" && "top-0 left-0 w-full h-80",
          side === "bottom" && "bottom-0 left-0 w-full h-80"
        )}
      >
        {children}
      </div>
    </div>
  );
};

export { Sheet, SheetContent, SheetTrigger };
