import { Link } from 'react-router-dom';

const NotAuthorized = () => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: 'calc(100vh - 56px)',
    gap: '16px',
    color: 'var(--text-secondary)',
  }}>
    <h1 style={{ fontSize: '48px', margin: 0, color: 'var(--text-primary)' }}>403</h1>
    <p style={{ margin: 0 }}>You don't have access to this page.</p>
    <Link
      to="/dashboards"
      style={{
        color: 'var(--accent)',
        textDecoration: 'none',
        fontWeight: 500,
      }}
    >
      Go to Dashboards
    </Link>
  </div>
);

export default NotAuthorized;
