import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, setCsrf } from '../services/api';
import Brand from '../components/Brand';
import CircuitBackground from '../components/CircuitBackground';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const me = await api.login(username, password);
      setCsrf(me.csrfToken);
      navigate('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión');
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4">
      <CircuitBackground />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Brand size="lg" />
        </div>
        <form
          onSubmit={handleSubmit}
          className="panel !border-neon/30 shadow-neon p-7 space-y-5"
        >
          <div>
            <h1 className="font-display font-black italic text-2xl text-silver skew-racing">
              Panel administrativo
            </h1>
            <p className="mt-1 font-tech text-sm text-ash">
              Acceso restringido al organizador
            </p>
          </div>

          <div>
            <label htmlFor="username" className="block font-tech text-sm text-ash mb-1">
              Usuario
            </label>
            <input
              id="username"
              className="input-dark"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block font-tech text-sm text-ash mb-1">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              className="input-dark"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 font-tech text-sm text-red-300">
              {error}
            </div>
          )}

          <button type="submit" className="btn-neon w-full" disabled={loading}>
            {loading ? 'Verificando…' : 'Entrar'}
          </button>
        </form>
        <p className="mt-5 text-center">
          <Link to="/" className="font-tech text-xs text-ash hover:text-neon transition-colors">
            ← Volver a la página pública
          </Link>
        </p>
      </div>
    </div>
  );
}
