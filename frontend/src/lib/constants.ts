export const MAX_UPLOAD = 6;
export const STORAGE_KEY = "stream_source_selection";
export const STORAGE_CAMERA_KEY = "stream_selected_camera_id";
export const CAMERAS = [
  {
    id: "camera1",
    name: "Camera 1",
    url: "rtsp://admin:cctv@121@192.168.1.65:554/Streaming/Channels/101",
  },
  {
    id: "camera2",
    name: "Camera 2",
    url: "rtsp://admin:cctv@121@192.168.1.64:554/Streaming/Channels/101",
  },
];

export const PAGE_SIZE = 10;
export const MAX_LAST_DETECTIONS = 50;


export const dashboardSteps = [
  {
    popover: {
      title: '👋 Welcome to BharathaTechno!',
      description: 'Let us take a quick tour of your AI-powered attendance system. This will help you understand how to navigate and use the key features.',
      side: 'center',
      align: 'start'
    }
  },
  {
    element: '#tour-sidebar',
    popover: {
      title: '🧭 Navigation Menu',
      description: 'Access all features from here: Dashboard, Live Stream, Students Management, and Attendance Reports.',
      side: 'right',
      align: 'start'
    }
  },
  {
    element: '#tour-stats',
    popover: {
      title: '📊 Real-time Statistics',
      description: 'Monitor total students, today\'s attendance count, and overall attendance rates in real-time.',
      side: 'bottom',
      align: 'start'
    }
  },
  {
    element: '#tour-stream-card',
    popover: {
      title: '📹 Live Face Detection',
      description: 'View your camera feeds here. The system automatically detects and recognizes faces to mark attendance.',
      side: 'bottom',
      align: 'start'
    }
  },
  {
    element: '#tour-detections',
    popover: {
      title: '🔍 Recent Detections',
      description: 'See the most recent face detections and recognition results as they happen.',
      side: 'left',
      align: 'start'
    }
  },
  {
    element: '#tour-charts',
    popover: {
      title: '📈 Attendance Analytics',
      description: 'Visualize attendance trends and distribution across different divisions through interactive charts.',
      side: 'top',
      align: 'start'
    }
  },
  {
    element: '#tour-system-status',
    popover: {
      title: '🟢 System Health',
      description: 'Check if all systems are operational and connected to the backend services.',
      side: 'top',
      align: 'start'
    }
  }
];

export const streamSteps = [
  {
    popover: {
      title: '📹 Live Stream View',
      description: 'This is where you can monitor all your camera feeds in real-time with AI face detection.',
      side: 'center',
      align: 'start'
    }
  },
  {
    element: '#tour-stream-player',
    popover: {
      title: '🖥️ Camera Feeds',
      description: 'You can switch between multiple cameras and expand the view for better monitoring.',
      side: 'bottom',
      align: 'start'
    }
  }
];

export const studentsSteps = [
  {
    popover: {
      title: '👥 Student Management',
      description: 'Manage all student profiles, register new students, and update their information here.',
      side: 'center',
      align: 'start'
    }
  },
  {
    element: '#tour-add-student',
    popover: {
      title: '➕ Register New Student',
      description: 'Click here to add a new student to the system with their photos for AI recognition.',
      side: 'left',
      align: 'start'
    }
  },
  {
    element: '#tour-student-filters',
    popover: {
      title: '🔍 Search & Filter',
      description: 'Easily find students by their name, class, division, roll number, or email.',
      side: 'bottom',
      align: 'start'
    }
  },
  {
    element: '#tour-student-list',
    popover: {
      title: '📋 Student List',
      description: 'View and manage all registered students, their status, and perform actions like editing or deactivating.',
      side: 'top',
      align: 'start'
    }
  }
];

export const attendanceSteps = [
  {
    popover: {
      title: '📅 Attendance Reports',
      description: 'Analyze detailed attendance records and generate reports for specific periods.',
      side: 'center',
      align: 'start'
    }
  },
  {
    element: '#tour-attendance-filters',
    popover: {
      title: '📆 Date & Filter',
      description: 'Filter attendance by class, division, or date range to get precise data.',
      side: 'bottom',
      align: 'start'
    }
  },
  {
    element: '#tour-export-report',
    popover: {
      title: '📥 Export Reports',
      description: 'Download attendance reports in CSV or PDF format for offline record keeping.',
      side: 'left',
      align: 'start'
    }
  },
  {
    element: '#tour-attendance-list',
    popover: {
      title: '📊 Detailed Records',
      description: 'See the number of working days, present/absent counts, and a visual attendance chart for each student.',
      side: 'top',
      align: 'start'
    }
  }
];