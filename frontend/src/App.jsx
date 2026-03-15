import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Chatbot from './pages/Chatbot';
import AdminDashboard from './pages/AdminDashboard';
import AdminLogin from './pages/AdminLogin';
import AddPDF from './pages/AddPDF';
import AddFAQ from './pages/AddFAQ';
import AddLink from './pages/AddLink';
import AddContact from './pages/AddContact';
import ManageSources from './pages/ManageSources';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Chatbot />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        
        <Route path="/admin" element={<AdminDashboard />}>
          <Route index element={<ManageSources />} />
          <Route path="add-pdf" element={<AddPDF />} />
          <Route path="add-faq" element={<AddFAQ />} />
          <Route path="add-link" element={<AddLink />} />
          <Route path="add-contact" element={<AddContact />} />
          <Route path="manage-sources" element={<ManageSources />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
