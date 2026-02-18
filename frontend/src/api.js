import axios from "axios";

const API_BASE_URL = "/api";

axios.defaults.withCredentials = true;

export const uploadAudio = async (file, options = {}) => {
  const formData = new FormData();
  formData.append("file", file);

  if (options.language) formData.append("language", options.language);
  if (options.model) formData.append("model", options.model);
  if (options.task) formData.append("task", options.task);

  try {
    const response = await axios.post(`${API_BASE_URL}/transcribe`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const transcribeLink = async (url, options = {}) => {
  const params = new URLSearchParams();
  params.append("url", url);
  if (options.language) params.append("language", options.language);
  if (options.model) params.append("model", options.model);
  if (options.task) params.append("task", options.task);

  try {
    const response = await axios.post(`${API_BASE_URL}/transcribe-link`, params);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const checkStatus = async (jobId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/status/${jobId}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getDownloadUrl = (jobId, format = 'txt') => {
  return `${API_BASE_URL}/download/${jobId}?format=${format}`;
};

export const getHistory = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/history`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const login = async (username, password) => {
  const response = await axios.post(`${API_BASE_URL}/auth/login`, { username, password });
  return response.data;
};

export const register = async (username, password, email) => {
  const response = await axios.post(`${API_BASE_URL}/auth/register`, { username, password, email });
  return response.data;
};

export const getMe = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/auth/me`);
    return response.data;
  } catch (error) {
    return null;
  }
};

export const logout = async () => {
  await axios.post(`${API_BASE_URL}/logout`);
};
