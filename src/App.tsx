// src/App.tsx
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
import PackageSubscriptionsPage from './pages/economics/PackageSubscriptionsPage';
import StudentsSubscriptionsPage from './pages/economics/StudentsSubscriptionsPage';

import { useAuth } from './auth';
import Layout from './components/Layout';

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
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/classes"
        element={
          <ProtectedRoute>
            <ClassesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/levels"
        element={
          <ProtectedRoute>
            <LevelsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/students"
        element={
          <ProtectedRoute>
            <StudentsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/tutors"
        element={
          <ProtectedRoute>
            <TutorsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/subjects"
        element={
          <ProtectedRoute>
            <SubjectsPage />
          </ProtectedRoute>
        }
      />

      {/* Program main page */}
      <Route
        path="/program"
        element={
          <ProtectedRoute>
            <ProgramPage />
          </ProtectedRoute>
        }
      />

      {/* Tests page under Προγράμματα */}
      <Route
        path="/program/tests"
        element={
          <ProtectedRoute>
            <TestsPage />
          </ProtectedRoute>
        }
      />

      {/* Events page under Προγράμματα */}
      <Route
        path="/program/events"
        element={
          <ProtectedRoute>
            <EventsPage />
          </ProtectedRoute>
        }
      />

      {/* Holidays page under Προγράμματα */}
      <Route
        path="/program/holidays"
        element={
          <ProtectedRoute>
            <HolidaysPage />
          </ProtectedRoute>
        }
      />

      {/* Grades */}
      <Route
        path="/grades"
        element={
          <ProtectedRoute>
            <GradesPage />
          </ProtectedRoute>
        }
      />

      {/* ✅ Economics -> Package Subscriptions */}
      <Route
        path="/economics/package-subscriptions"
        element={
          <ProtectedRoute>
            <PackageSubscriptionsPage />
          </ProtectedRoute>
        }
      />

      {/* ✅ Economics -> Students Subscriptions */}
      <Route
        path="/economics/student-subscriptions"
        element={
          <ProtectedRoute>
            <StudentsSubscriptionsPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
