import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { useSocket } from "@/lib/socket";
import { api } from "@/lib/api";
import {
  addNotification,
  markAllAsReadLocal,
  markAsReadLocal,
  setError,
  setLoading,
  setNotifications,
  setUnreadCount,
} from "@/redux/notificationSlice";
import { Notification } from "@/lib/types";

export function useNotifications() {
  const dispatch = useAppDispatch();
  const { notifications, unreadCount, loading, error } = useAppSelector(
    (state) => state.notifications
  );
  const { on, off } = useSocket();

  // Set up socket listeners
  useEffect(() => {
    const handleUnknownFaceDetected = (data: {
      unknownFace: any;
      message: string;
    }) => {
      const notification: Notification = {
        _id: data.unknownFace._id,
        timestamp: data.unknownFace.timestamp,
        cameraId: data.unknownFace.cameraId,
        photo: data.unknownFace.photo,
        confidence: data.unknownFace.confidence,
        location: data.unknownFace.location,
        processed: false,
        adminNotes: data.unknownFace.adminNotes,
        createdAt: data.unknownFace.createdAt || new Date().toISOString(),
      };
      dispatch(addNotification(notification));
    };

    on("unknown_face_detected", handleUnknownFaceDetected);

    return () => {
      off("unknown_face_detected", handleUnknownFaceDetected);
    };
  }, [dispatch, on, off]);

  // Fetch initial data (simple, no thunks)
  useEffect(() => {
    const run = async () => {
      try {
        dispatch(setLoading(true));
        dispatch(setError(null));
        const [listRes, countRes] = await Promise.all([
          api.getNotifications({ limit: 20 }),
          api.getUnreadCount(),
        ]);
        dispatch(setNotifications(listRes.data.data.notifications));
        dispatch(setUnreadCount(countRes.data.data.unreadCount));
      } catch (e: any) {
        console.error("Failed to load notifications:", e);
        dispatch(setError("Failed to load notifications"));
      } finally {
        dispatch(setLoading(false));
      }
    };
    run();
  }, [dispatch]);

  const markAsRead = async (ids: string[]) => {
    try {
      await api.markNotificationsAsRead(ids);
      dispatch(markAsReadLocal(ids));
    } catch (e) {
      console.error("Failed to mark notifications as read:", e);
      // swallow for POC
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.markAllNotificationsAsRead();
      dispatch(markAllAsReadLocal());
    } catch (e) {
      console.error("Failed to mark all notifications as read:", e);
      // swallow for POC
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
  };
}
