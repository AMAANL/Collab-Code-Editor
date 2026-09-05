import { useState, type FormEvent } from "react";
import type { AuthUser } from "../types";

interface Props {
  onAuth: (token: string, user: AuthUser) => void;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export function AuthScreen({ onAuth }: Props) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = isLogin ? "/auth/login" : "/auth/register";
      const payload = isLogin ? { email, password } : { email, password, displayName };

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      onAuth(data.token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="join-screen">
      <form className="join-card" onSubmit={handleSubmit}>
        <h1>{isLogin ? "Welcome Back" : "Create Account"}</h1>
        
        {error && <div className="error-message">{error}</div>}

        {!isLogin && (
          <label>
            Display Name
            <input 
              value={displayName} 
              onChange={(e) => setDisplayName(e.target.value)} 
              required={!isLogin} 
              maxLength={40} 
            />
          </label>
        )}

        <label>
          Email
          <input 
            type="email"
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </label>

        <button type="submit" disabled={loading}>
          {loading ? "Please wait..." : (isLogin ? "Sign In" : "Register")}
        </button>
        
        <p className="auth-toggle">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button type="button" className="link-button" onClick={() => { setIsLogin(!isLogin); setError(""); }}>
            {isLogin ? "Register here" : "Sign In here"}
          </button>
        </p>
      </form>
    </div>
  );
}
