import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CryptoSessionProvider } from './context/CryptoSessionContext';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import PatientDashboard from './pages/patient/PatientDashboard';
import DoctorDashboard from './pages/doctor/DoctorDashboard';
import './App.css';

export default function App() {
  return (
    <CryptoSessionProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route element={<Layout />}>
              <Route
                path="/patient"
                element={
                  <ProtectedRoute role="patient">
                    <PatientDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/doctor"
                element={
                  <ProtectedRoute role={['doctor', 'clinic_admin']}>
                    <DoctorDashboard />
                  </ProtectedRoute>
                }
              />
            </Route>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </CryptoSessionProvider>
  );
}
