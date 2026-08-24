import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function OAuthSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      navigate('/login?error=google_auth_failed', { replace: true });
      return;
    }

    async function completeLogin() {
      try {
        const res = await api.get('/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        login(res.data, token);
        navigate('/dashboard', { replace: true });
      } catch (err) {
        navigate('/login?error=google_auth_failed', { replace: true });
      }
    }

    completeLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-primary dark:bg-slate-950 text-on-primary">
      <p className="font-body-md text-body-md text-on-primary">Signing you in with Google&hellip;</p>
    </main>
  );
}
