export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // FIX: was "dashboard-shell" but globals.css only defines ".shell"
    // This caused the entire layout grid (gap, display:grid) to not apply
    <div className="shell">
      <div className="dashboard-header">
        <h1>MLB StatCast Dashboard</h1>
        <p style={{ opacity: 0.6 }}>
          Real-time pitch visualization and analytics
        </p>
      </div>
      {children}
    </div>
  );
}
