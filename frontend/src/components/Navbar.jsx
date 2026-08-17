import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <nav className="navbar">
      <Link to="/books" className="brand">📚 Library System</Link>
      <div className="nav-links">
        {user ? (
          <>
            <Link to="/books">Catalogue</Link>
            <Link to="/my-borrows">My Borrows</Link>
            <span className="nav-user">{user.name} ({user.role})</span>
            <button onClick={handleLogout}>Log out</button>
          </>
        ) : (
          <>
            <Link to="/login">Log in</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}
