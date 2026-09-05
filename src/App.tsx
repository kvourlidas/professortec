import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import type { ReactElement } from 'react';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ClassesPage = lazy(() => import('./pages/ClassesPage'));
const StudentsPage = lazy(() => import('./pages/StudentsPage'));
const StudentCardPage = lazy(() => import('./pages/StudentCardPage'));
const SubjectsPage = lazy(() => import('./pages/SubjectsPage'));
const AttendancePage = lazy(() => import('./pages/AttendancePage'));
const PrivateAttendancePage = lazy(() => import('./pages/PrivateAttendancePage'));
const PrivateSchedulePage = lazy(() => import('./pages/PrivateSchedulePage'));
const TutorsPage = lazy(() => import('./pages/TutorsPage'));
const TutorCardPage = lazy(() => import('./pages/TutorCardPage'));
const ProgramPage = lazy(() => import('./pages/ProgramPage'));
const HolidaysPage = lazy(() => import('./pages/HolidaysPage'));
const EventsPage = lazy(() => import('./pages/EventsPage'));
const TestsPage = lazy(() => import('./pages/TestsPage'));
const TestResultsPage = lazy(() => import('./pages/TestResultsPage'));
const GradesPage = lazy(() => import('./pages/GradesPage'));
const SchoolInfoPage = lazy(() => import('./pages/SchoolInfoPage'));
const TutorInfoPage = lazy(() => import('./pages/TutorInfoPage'));

const EconomicsAnalysisPage = lazy(() => import('./pages/economics/EconomicsAnalysisPage'));
const PackageSubscriptionsPage = lazy(() => import('./pages/economics/PackageSubscriptionsPage'));
const StudentsSubscriptionsPage = lazy(() => import('./pages/economics/StudentsSubscriptionsPage'));
const TutorsPaymentsPage = lazy(() => import('./pages/economics/TutorsPaymentsPage'));

const StudentFeedbackPage = lazy(() => import('./pages/student-app/StudentFeedbackPage'));
const StudentMessagesPage = lazy(() => import('./pages/student-app/StudentMessagesPage'));
const SendNotificationsPage = lazy(() => import('./pages/student-app/SendNotificationsPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const HelpSupportPage = lazy(() => import('./pages/HelpSupportPage'));

import { useAuth } from './auth';
import Layout from './components/Layout';
import LoadingScreen from './components/LoadingScreen';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';

function RouteFallback() {
  return <LoadingScreen />;
}

const BASE = '';

function p(path: string) {
  if (!BASE) return path;
  return `${BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}

function ProtectedRoute({ children }: { children: ReactElement }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to={p('/login')} replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  if (profile && !profile.school_id) {
    return <Navigate to={p('/onboarding')} replace />;
  }

  return <Layout>{children}</Layout>;
}

function OnboardingRoute({ children }: { children: ReactElement }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to={p('/login')} replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  if (profile && profile.school_id) {
    return <Navigate to={p('/dashboard')} replace />;
  }

  return children;
}

function FrontistirioOnly({ children }: { children: ReactElement }) {
  const { profile } = useAuth();
  if (profile?.account_type === 'idiaiterou') return <Navigate to={p('/dashboard')} replace />;
  return children;
}

function AttendanceRoute() {
  const { profile } = useAuth();
  return profile?.account_type === 'idiaiterou' ? <PrivateAttendancePage /> : <AttendancePage />;
}

function ProgramRoute() {
  const { profile } = useAuth();
  return profile?.account_type === 'idiaiterou' ? <PrivateSchedulePage /> : <ProgramPage />;
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path={p('/login')} element={<LoginPage />} />
        <Route path={p('/onboarding')} element={<OnboardingRoute><OnboardingPage /></OnboardingRoute>} />

        <Route
          path={p('/dashboard')}
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        {/* Frontistirio-only routes */}
        <Route path={p('/classes')} element={<ProtectedRoute><FrontistirioOnly><ClassesPage /></FrontistirioOnly></ProtectedRoute>} />
        <Route path={p('/tutors')} element={<ProtectedRoute><FrontistirioOnly><TutorsPage /></FrontistirioOnly></ProtectedRoute>} />
        <Route path={p('/tutors/:id')} element={<ProtectedRoute><FrontistirioOnly><TutorCardPage /></FrontistirioOnly></ProtectedRoute>} />
        <Route path={p('/program/events')} element={<ProtectedRoute><FrontistirioOnly><EventsPage /></FrontistirioOnly></ProtectedRoute>} />
        <Route path={p('/school-info')} element={<ProtectedRoute><FrontistirioOnly><SchoolInfoPage /></FrontistirioOnly></ProtectedRoute>} />
        <Route path={p('/tutor-info')} element={<ProtectedRoute><TutorInfoPage /></ProtectedRoute>} />
        <Route path={p('/economics/package-subscriptions')} element={<ProtectedRoute><FrontistirioOnly><PackageSubscriptionsPage /></FrontistirioOnly></ProtectedRoute>} />
        <Route path={p('/economics/student-subscriptions')} element={<ProtectedRoute><FrontistirioOnly><StudentsSubscriptionsPage /></FrontistirioOnly></ProtectedRoute>} />
        <Route path={p('/economics/tutors-payments')} element={<ProtectedRoute><FrontistirioOnly><TutorsPaymentsPage /></FrontistirioOnly></ProtectedRoute>} />

        {/* Shared routes (both account types) */}
        <Route path={p('/calendar')} element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
        <Route path={p('/attendance')} element={<ProtectedRoute><AttendanceRoute /></ProtectedRoute>} />
        <Route path={p('/program')} element={<ProtectedRoute><ProgramRoute /></ProtectedRoute>} />
        <Route path={p('/students')} element={<ProtectedRoute><StudentsPage /></ProtectedRoute>} />
        <Route path={p('/students/:id')} element={<ProtectedRoute><StudentCardPage /></ProtectedRoute>} />
        <Route path={p('/subjects')} element={<ProtectedRoute><SubjectsPage /></ProtectedRoute>} />
        <Route path={p('/program/tests')} element={<ProtectedRoute><TestsPage /></ProtectedRoute>} />
        <Route path={p('/program/tests/:id/results')} element={<ProtectedRoute><TestResultsPage /></ProtectedRoute>} />
        <Route path={p('/program/holidays')} element={<ProtectedRoute><HolidaysPage /></ProtectedRoute>} />
        <Route path={p('/grades')} element={<ProtectedRoute><GradesPage /></ProtectedRoute>} />
        <Route path={p('/economics/analysis')} element={<ProtectedRoute><EconomicsAnalysisPage /></ProtectedRoute>} />
        <Route path={p('/student-app/feedback')} element={<ProtectedRoute><StudentFeedbackPage /></ProtectedRoute>} />
        <Route path={p('/student-app/messages')} element={<ProtectedRoute><StudentMessagesPage /></ProtectedRoute>} />
        <Route path={p('/student-app/notifications')} element={<ProtectedRoute><SendNotificationsPage /></ProtectedRoute>} />

        <Route path={p('/help')} element={<ProtectedRoute><HelpSupportPage /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to={p('/dashboard')} replace />} />
      </Routes>
      </Suspense>
      </ToastProvider>
    </ThemeProvider>
  );
}