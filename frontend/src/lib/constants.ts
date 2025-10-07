export const MAX_UPLOAD = 3;
export const STORAGE_KEY = "stream_source_selection";
export const STORAGE_CAMERA_KEY = "stream_selected_camera_id";
export const CAMERAS = [
  {
    id: "cam-entrance",
    name: "Entrance HLS",
    url: "/rtsp-examples/hls/index.html",
  },
  {
    id: "cam-lab",
    name: "Lab WebRTC",
    url: "/rtsp-examples/webrtc/index.html",
  },
];
