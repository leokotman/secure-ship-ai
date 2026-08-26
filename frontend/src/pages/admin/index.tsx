/**
 * Admin Auth Page (SPA Auth0 model)
 *
 * Primary path: Auth0 Universal Login → `/admin/callback` → dashboard.
 * Fallback for local/demo: paste an Auth0 access token (API Test tab).
 *
 * Backend `GET /admin/login` and `GET /admin/callback` are unused placeholders;
 * JWT verification happens on each admin API request.
 *
 * To get a test token:
 * 1. Auth0 Dashboard → Applications → APIs → Test tab
 * 2. Copy the test access token
 * 3. Paste it here
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/router";

export default function AdminAuthPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    // Check if already authenticated
    const storedToken = localStorage.getItem("admin_access_token");
    if (storedToken) {
      router.push("/admin/dashboard");
    }
  }, [router]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    if (!token.trim()) {
      setError("Please enter an access token");
      return;
    }

    // Store token in localStorage (in production, use secure httpOnly cookies)
    localStorage.setItem("admin_access_token", token.trim());

    // Redirect to dashboard
    router.push("/admin/dashboard");
  };

  const handleAuth0Login = () => {
    // Placeholder: In production, redirect to Auth0 Universal Login
    const auth0Domain = process.env.NEXT_PUBLIC_AUTH0_DOMAIN;
    const clientId = process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID;
    const redirectUri = `${window.location.origin}/admin/callback`;
    const audience = process.env.NEXT_PUBLIC_AUTH0_AUDIENCE;

    if (auth0Domain && clientId && audience) {
      const authUrl =
        `https://${auth0Domain}/authorize?` +
        `response_type=token&` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `audience=${encodeURIComponent(audience)}&` +
        `scope=openid profile email`;

      window.location.href = authUrl;
    } else {
      setError(
        "Auth0 environment variables not configured. Use manual token entry for testing.",
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Admin Login</h1>
        <p className="text-gray-600 mb-6">SecureShip Admin Panel</p>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Auth0 Login Button (if configured) */}
        {process.env.NEXT_PUBLIC_AUTH0_DOMAIN && (
          <button
            onClick={handleAuth0Login}
            className="w-full mb-4 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Login with Auth0
          </button>
        )}

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Or for testing</span>
          </div>
        </div>

        {/* Manual Token Entry (for testing/development) */}
        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label
              htmlFor="token"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Access Token
            </label>
            <textarea
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste your Auth0 access token here"
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
            <p className="mt-2 text-xs text-gray-500">
              Get a test token from Auth0 Dashboard → Applications → APIs → Test
              tab
            </p>
          </div>

          <button
            type="submit"
            className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors font-medium"
          >
            Login with Token
          </button>
        </form>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-xs text-blue-800">
            <strong>Note:</strong> Prefer Login with Auth0 when env vars are
            set. Manual token paste is for local/demo only. Tokens are verified
            on each admin API call (no backend refresh endpoint).
          </p>
        </div>
      </div>
    </div>
  );
}
