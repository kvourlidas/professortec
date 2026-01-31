import { Routes, Route, Navigate } from 'react-router-dom';
import type { ReactElement } from 'react';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ClassesPage from './pages/ClassesPage';
import LevelsPage from './pages/LevelsPage';
import StudentsPage from './pages/StudentsPage';
import SubjectsPage from './pages/SubjectsPage';
import TutorsPage from './pages/TutorsPage';
import ProgramPage from './pages/ProgramPage';
import HolidaysPage from './pages/HolidaysPage';
import EventsPage from './pages/EventsPage';
import TestsPage from './pages/TestsPage';
import GradesPage from './pages/GradesPage';

// ✅ Economics pages
import EconomicsAnalysisPage from './pages/economics/EconomicsAnalysisPage';
import PackageSubscriptionsPage from './pages/economics/PackageSubscriptionsPage';
import StudentsSubscriptionsPage from './pages/economics/StudentsSubscriptionsPage';
import TutorsPaymentsPage from './pages/economics/TutorsPaymentsPage';

// ✅ Student App pages
import StudentFeedbackPage from './pages/student-app/StudentFeedbackPage';
import StudentMessagesPage from './pages/student-app/StudentMessagesPage'; // ✅ NEW

import { useAuth } from './auth';
import Layout from './components/Layout';

/**
 * ✅ If your app is hosted under a subpath (basename),
 * set BASE accordingly (e.g. '/admin').
 *
 * If you don't use a basename, keep it ''.
 */
const BASE = ''; // <-- change to '/admin' if needed

function p(path: string) {
  // ensures BASE + path works without double slashes
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

      <Route
        path={p('/classes')}
        element={
          <ProtectedRoute>
            <ClassesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path={p('/levels')}
        element={
          <ProtectedRoute>
            <LevelsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path={p('/students')}
        element={
          <ProtectedRoute>
            <StudentsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path={p('/tutors')}
        element={
          <ProtectedRoute>
            <TutorsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path={p('/subjects')}
        element={
          <ProtectedRoute>
            <SubjectsPage />
          </ProtectedRoute>
        }
      />

      {/* Program main page */}
      <Route
        path={p('/program')}
        element={
          <ProtectedRoute>
            <ProgramPage />
          </ProtectedRoute>
        }
      />

      {/* Tests page under Προγράμματα */}
      <Route
        path={p('/program/tests')}
        element={
          <ProtectedRoute>
            <TestsPage />
          </ProtectedRoute>
        }
      />

      {/* Events page under Προγράμματα */}
      <Route
        path={p('/program/events')}
        element={
          <ProtectedRoute>
            <EventsPage />
          </ProtectedRoute>
        }
      />

      {/* Holidays page under Προγράμματα */}
      <Route
        path={p('/program/holidays')}
        element={
          <ProtectedRoute>
            <HolidaysPage />
          </ProtectedRoute>
        }
      />

      {/* Grades */}
      <Route
        path={p('/grades')}
        element={
          <ProtectedRoute>
            <GradesPage />
          </ProtectedRoute>
        }
      />

      {/* ✅ Student App -> Feedback */}
      <Route
        path={p('/student-app/feedback')}
        element={
          <ProtectedRoute>
            <StudentFeedbackPage />
          </ProtectedRoute>
        }
      />

      {/* ✅ Student App -> Messages (NEW) */}
      <Route
        path={p('/student-app/messages')}
        element={
          <ProtectedRoute>
            <StudentMessagesPage />
          </ProtectedRoute>
        }
      />

      {/* ✅ Economics -> Analysis */}
      <Route
        path={p('/economics/analysis')}
        element={
          <ProtectedRoute>
            <EconomicsAnalysisPage />
          </ProtectedRoute>
        }
      />

      {/* ✅ Economics -> Package Subscriptions */}
      <Route
        path={p('/economics/package-subscriptions')}
        element={
          <ProtectedRoute>
            <PackageSubscriptionsPage />
          </ProtectedRoute>
        }
      />

      {/* ✅ Economics -> Students Subscriptions */}
      <Route
        path={p('/economics/student-subscriptions')}
        element={
          <ProtectedRoute>
            <StudentsSubscriptionsPage />
          </ProtectedRoute>
        }
      />

      {/* ✅ Economics -> Tutors Payments */}
      <Route
        path={p('/economics/tutors-payments')}
        element={
          <ProtectedRoute>
            <TutorsPaymentsPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to={p('/dashboard')} replace />} />
    </Routes>
  );
}
