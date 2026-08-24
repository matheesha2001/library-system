import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAdmin, isPanelUser } from '../utils/permissions';

// Wraps a page that only admins may access (e.g. category management).
// Staff are sent back to the panel dashboard rather than kicked out of the
// panel entirely, since they still have access to the rest of it.
export default function AdminOnlyRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!isPanelUser(user)) return <Navigate to="/dashboard" replace />;
  if (!isAdmin(user)) return <Navigate to="/admin/dashboard" replace />;
  return children;
}
