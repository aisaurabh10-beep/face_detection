import axios from "axios";
import config from "@/config/config";

export const axiosInstance = axios.create({
  baseURL: config.apiBaseUrl,
  withCredentials: false,
  timeout: 20000,
});

axiosInstance.interceptors.request.use(
  async (config) => {
    return config;
  },
  function (error) {
    return Promise.reject(error);
  }
);

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);
