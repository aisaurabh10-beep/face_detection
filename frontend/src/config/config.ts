interface Config {
  apiBaseUrl: string;
  socketUrl: string;
  defaultStream: "device" | "actual";
}

const config: Config = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api",
  socketUrl: process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000",
  defaultStream:
    (process.env.NEXT_PUBLIC_DEFAULT_STREAM as "device" | "actual") || "device",
};

export default config;
