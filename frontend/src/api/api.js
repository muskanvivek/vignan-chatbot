import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const getAuthHeader = () => {
  const adminCredentials = localStorage.getItem('adminCredentials');
  if (adminCredentials) {
    const { username, password } = JSON.parse(adminCredentials);
    const base64 = btoa(`${username}:${password}`);
    return { 'Authorization': `Basic ${base64}` };
  }
  return {};
};

const api = {
  chat: (question, language, history = []) => axios.post(`${API_BASE_URL}/chat`, { question, language, history }),
  
  verifyAuth: (username, password) => {
    const base64 = btoa(`${username}:${password}`);
    return axios.get(`${API_BASE_URL}/admin/verify`, {
      headers: { 'Authorization': `Basic ${base64}` }
    });
  },
  
  ingestPDF: (formData) => axios.post(`${API_BASE_URL}/ingest/pdf`, formData, {
    headers: { 
      ...getAuthHeader(),
      'Content-Type': 'multipart/form-data' 
    }
  }),
  ingestURL: (url, name, folder) => axios.post(`${API_BASE_URL}/ingest/url`, { url, name, folder }, { headers: getAuthHeader() }),
  ingestDeepURL: (url, folder) => axios.post(`${API_BASE_URL}/ingest/deep-url`, { url, folder }, { headers: getAuthHeader() }),
  ingestFAQ: (question, answer, folder) => axios.post(`${API_BASE_URL}/ingest/faq`, { question, answer, folder }, { headers: getAuthHeader() }),
  
  getContacts: () => axios.get(`${API_BASE_URL}/admin/contacts`, { headers: getAuthHeader() }),
  addContact: (contact) => axios.post(`${API_BASE_URL}/admin/contacts`, contact, { headers: getAuthHeader() }),
  
  getSources: () => axios.get(`${API_BASE_URL}/admin/sources`, { headers: getAuthHeader() }),
  updateSource: (id, data) => axios.put(`${API_BASE_URL}/admin/sources/${id}`, data, { headers: getAuthHeader() }),
  deleteSource: (id) => axios.delete(`${API_BASE_URL}/admin/sources/${id}`, { headers: getAuthHeader() })
};

export default api;

