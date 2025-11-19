import { useAuth } from '../auth';

export default function DashboardPage() {
  const { user, profile, signOut } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div className="text-sm font-semibold text-slate-900">
          Tutor Admin Dashboard
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right text-xs">
            <div className="font-medium text-slate-900">
              {profile?.full_name || user?.email}
            </div>
            <div className="text-slate-500">
              {profile?.role || 'no role'}
            </div>
          </div>
          <button
            onClick={signOut}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 bg-slate-100 px-6 py-6">
        <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-[2fr,1fr]">
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-1 text-lg font-semibold text-slate-900">
              Welcome
            </h2>

            <p className="text-sm text-slate-700">
              Logged in as <span className="font-medium">{user?.email}</span>
            </p>
            <p className="text-sm text-slate-700">
              Role:{' '}
              <span className="font-medium">
                {profile?.role ?? 'unknown'}
              </span>
            </p>
            <p className="text-sm text-slate-700">
              School ID:{' '}
              <span className="font-medium">
                {profile?.school_id ?? 'not linked to a school yet'}
              </span>
            </p>

            <hr className="my-4 border-slate-200" />

            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Next steps
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>Create pages for managing <span className="font-medium">Classes</span></li>
              <li>Create pages for managing <span className="font-medium">Students</span></li>
              <li>Create timetable from <span className="font-medium">class_sessions</span></li>
            </ul>
          </section>

          <aside className="rounded-2xl bg-white p-4 shadow-sm text-sm text-slate-700">
            <h3 className="mb-2 text-base font-semibold text-slate-900">
              Quick Info
            </h3>
            <p className="mb-2 text-slate-600">
              This is your first version of the tutor school admin dashboard.
            </p>
            <p className="mb-1 text-slate-600">
              Later you’ll add:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Class list &amp; CRUD</li>
              <li>Student list &amp; subscriptions</li>
              <li>Booking &amp; attendance screens</li>
            </ul>
          </aside>
        </div>
      </main>
    </div>
  );
}
