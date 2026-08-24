/**
 * Auth0 Callback Handler
 *
 * Handles the redirect from Auth0 Universal Login.
 * Extracts the access token from the URL fragment and stores it.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function AdminCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    // Parse the URL fragment (Auth0 returns token in hash for implicit flow)
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);

    const accessToken = params.get("access_token");
    const errorParam = params.get("error");
    const errorDescription = params.get("error_description");

    if (errorParam) {
      setError(errorDescription || errorParam);
      return;
    }

    if (accessToken) {
      // Store the access token
      localStorage.setItem("admin_access_token", accessToken);

      // Redirect to dashboard
      router.push("/admin/dashboard");
    } else {
      setError("No access token received from Auth0");
    }
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            Authentication Error
          </h1>
          <p className="text-gray-700 mb-6">{error}</p>
          <button
            onClick={() => router.push("/admin")}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Processing authentication...</p>
      </div>
    </div>
  );
}
