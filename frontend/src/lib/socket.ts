import { io, Socket } from "socket.io-client";
import config from "@/config/config";
import {
  SocketAttendance,
  SocketEvents,
  SocketStudent,
  SocketUnknownFace,
} from "@/lib/types";

const SOCKET_URL = config.socketUrl;

class SocketManager {
  private socket: Socket | null = null;
  private listeners: Map<string, ((...args: unknown[]) => void)[]> = new Map();

  connect(): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      timeout: 20000,
      forceNew: true,
    });

    this.socket.on("connect", () => {
      console.log("🔌 Connected to server:", this.socket?.id);
      this.emit("connect");
    });

    this.socket.on("disconnect", (reason) => {
      console.log("🔌 Disconnected from server:", reason);
      this.emit("disconnect");
    });

    this.socket.on("connect_error", (error) => {
      console.error("🔌 Connection error:", error);
      this.emit("connect_error", error);
    });

    // Set up event listeners
    this.socket.on(
      "attendance_marked",
      (data: {
        attendance: SocketAttendance;
        student: SocketStudent;
        message: string;
      }) => {
        console.log("📊 Attendance marked:", data);
        this.emit("attendance_marked", data);
      }
    );

    this.socket.on(
      "student_registered",
      (data: { student: SocketStudent; message: string }) => {
        console.log("👤 Student registered:", data);
        this.emit("student_registered", data);
      }
    );

    this.socket.on(
      "unknown_face_detected",
      (data: { unknownFace: SocketUnknownFace; message: string }) => {
        console.log("❓ Unknown face detected:", data);
        this.emit("unknown_face_detected", data);
      }
    );

    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  // Event listener management
  on<K extends keyof SocketEvents>(event: K, listener: SocketEvents[K]): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  off<K extends keyof SocketEvents>(event: K, listener: SocketEvents[K]): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit<K extends keyof SocketEvents>(
    event: K,
    ...args: Parameters<SocketEvents[K]>
  ): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  // Utility methods
  emitEvent(event: string, data: unknown): void {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }
}

export const socketManager = new SocketManager();

export function useSocket() {
  return {
    connect: () => socketManager.connect(),
    disconnect: () => socketManager.disconnect(),
    isConnected: () => socketManager.isConnected(),
    on: socketManager.on.bind(socketManager),
    off: socketManager.off.bind(socketManager),
    emit: socketManager.emitEvent.bind(socketManager),
  };
}
