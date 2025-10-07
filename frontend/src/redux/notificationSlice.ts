import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Notification } from "@/lib/types";

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
}

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
};

const notificationSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload ?? null;
    },
    setNotifications: (state, action: PayloadAction<Notification[]>) => {
      state.notifications = action.payload;
    },
    setUnreadCount: (state, action: PayloadAction<number>) => {
      state.unreadCount = action.payload;
    },
    addNotification: (state, action: PayloadAction<Notification>) => {
      state.notifications.unshift(action.payload);
      if (!action.payload.processed) {
        state.unreadCount += 1;
      }
    },
    markAsReadLocal: (state, action: PayloadAction<string[]>) => {
      const readIds = action.payload;
      state.unreadCount = Math.max(0, state.unreadCount - readIds.length);
      state.notifications = state.notifications.map((notification) =>
        readIds.includes(notification._id)
          ? { ...notification, processed: true }
          : notification
      );
    },
    markAllAsReadLocal: (state) => {
      state.unreadCount = 0;
      state.notifications = state.notifications.map((notification) => ({
        ...notification,
        processed: true,
      }));
    },
    resetNotifications: () => initialState,
  },
  extraReducers: () => {},
});

export const {
  setLoading,
  setError,
  setNotifications,
  setUnreadCount,
  addNotification,
  markAsReadLocal,
  markAllAsReadLocal,
  resetNotifications,
} = notificationSlice.actions;
export default notificationSlice.reducer;
