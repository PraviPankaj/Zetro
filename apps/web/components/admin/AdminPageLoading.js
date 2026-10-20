export default function AdminPageLoading({ label = "Loading…" }) {
  return (
    <div className="admin-page-loading" role="status" aria-live="polite">
      <div className="admin-nav-spinner" />
      <span>{label}</span>
    </div>
  );
}
