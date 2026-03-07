import { Routes, Route, Navigate } from 'react-router-dom';
import type { ReactElement } from 'react';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ClassesPage from './pages/ClassesPage';
import LevelsPage from './pages/LevelsPage';
import StudentsPage from './pages/StudentsPage';
import StudentCardPage from './pages/StudentCardPage';
import SubjectsPage from './pages/SubjectsPage';
import TutorsPage from './pages/TutorsPage';
import ProgramPage from './pages/ProgramPage';
import HolidaysPage from './pages/HolidaysPage';
import EventsPage from './pages/EventsPage';
import TestsPage from './pages/TestsPage';
import GradesPage from './pages/GradesPage';
import SchoolInfoPage from './pages/SchoolInfoPage';

import EconomicsAnalysisPage from './pages/economics/EconomicsAnalysisPage';
import PackageSubscriptionsPage from './pages/economics/PackageSubscriptionsPage';
import StudentsSubscriptionsPage from './pages/economics/StudentsSubscriptionsPage';
import TutorsPaymentsPage from './pages/economics/TutorsPaymentsPage';

import StudentFeedbackPage from './pages/student-app/StudentFeedbackPage';
import StudentMessagesPage from './pages/student-app/StudentMessagesPage';
import SendNotificationsPage from './pages/student-app/SendNotificationsPage';

import { useAuth } from './auth';
import Layout from './components/Layout';
import { ThemeProvider } from './context/ThemeContext';

const BASE = '';

function p(path: string) {
  if (!BASE) return path;
  return `${BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}

function ProtectedRoute({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-700">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to={p('/login')} replace />;
  }

  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <ThemeProvider>
      <Routes>
        <Route path={p('/login')} element={<LoginPage />} />

        <Route
          path={p('/dashboard')}
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route path={p('/classes')} element={<ProtectedRoute><ClassesPage /></ProtectedRoute>} />
        <Route path={p('/levels')} element={<ProtectedRoute><LevelsPage /></ProtectedRoute>} />
        <Route path={p('/students')} element={<ProtectedRoute><StudentsPage /></ProtectedRoute>} />
        <Route path={p('/students/:id')} element={<ProtectedRoute><StudentCardPage /></ProtectedRoute>} />
        <Route path={p('/tutors')} element={<ProtectedRoute><TutorsPage /></ProtectedRoute>} />
        <Route path={p('/subjects')} element={<ProtectedRoute><SubjectsPage /></ProtectedRoute>} />

        <Route path={p('/program')} element={<ProtectedRoute><ProgramPage /></ProtectedRoute>} />
        <Route path={p('/program/tests')} element={<ProtectedRoute><TestsPage /></ProtectedRoute>} />
        <Route path={p('/program/events')} element={<ProtectedRoute><EventsPage /></ProtectedRoute>} />
        <Route path={p('/program/holidays')} element={<ProtectedRoute><HolidaysPage /></ProtectedRoute>} />

        <Route path={p('/grades')} element={<ProtectedRoute><GradesPage /></ProtectedRoute>} />
        <Route path={p('/school-info')} element={<ProtectedRoute><SchoolInfoPage /></ProtectedRoute>} />

        <Route path={p('/student-app/feedback')} element={<ProtectedRoute><StudentFeedbackPage /></ProtectedRoute>} />
        <Route path={p('/student-app/messages')} element={<ProtectedRoute><StudentMessagesPage /></ProtectedRoute>} />
        <Route path={p('/student-app/notifications')} element={<ProtectedRoute><SendNotificationsPage /></ProtectedRoute>} />

        <Route path={p('/economics/analysis')} element={<ProtectedRoute><EconomicsAnalysisPage /></ProtectedRoute>} />
        <Route path={p('/economics/package-subscriptions')} element={<ProtectedRoute><PackageSubscriptionsPage /></ProtectedRoute>} />
        <Route path={p('/economics/student-subscriptions')} element={<ProtectedRoute><StudentsSubscriptionsPage /></ProtectedRoute>} />
        <Route path={p('/economics/tutors-payments')} element={<ProtectedRoute><TutorsPaymentsPage /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to={p('/dashboard')} replace />} />
      </Routes>
    </ThemeProvider>
  );
}