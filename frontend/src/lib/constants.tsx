export const CAMERAS = [
  {
    id: "cam-entry",
    name: "Entry Camera",
    url: "rtsp://admin:cctv@121@192.168.1.65:554/Streaming/Channels/101",
  },
  {
    id: "cam-exit",
    name: "Exit Camera",
    url: "rtsp://admin:cctv@121@192.168.1.64:554/Streaming/Channels/101",
  },
];

export const STORAGE_KEY = "stream_source_selection";
export const STORAGE_CAMERA_KEY = "stream_selected_camera_id";