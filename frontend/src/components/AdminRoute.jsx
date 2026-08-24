import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isPanelUser } from '../utils/permissions';

// Wraps a page and redirects users without panel access (staff or admin)
// to the regular dashboard. Assumes ProtectedRoute (or equivalent) already
// guarantees a logged-in user.
export default function AdminRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!isPanelUser(user)) return <Navigate to="/dashboard" replace />;
  return children;
}
