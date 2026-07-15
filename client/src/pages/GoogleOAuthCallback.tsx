/**
 * Google OAuth Callback Page
 *
 * This page is opened in a popup by the Settings > Google Calendar connect flow.
 * Google redirects here with ?code=... after the user grants permission.
 * We exchange the code for tokens on the server, then post a message back to the opener.
 *
 * Route: /google-oauth-callback
 */
import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';

export default function GoogleOAuthCallback() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const exchangeMutation = trpc.googleCalendar.exchangeCode.useMutation({
    onSuccess: (data) => {
      setStatus('success');
      // Post tokens back to the opener window
      if (window.opener) {
        window.opener.postMessage(
          {
            type: 'google-oauth-success',
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            expiresAt: data.expiresAt,
            scope: data.scope,
            email: data.email,
          },
          window.location.origin
        );
        setTimeout(() => window.close(), 800);
      }
    },
    onError: (err) => {
      setStatus('error');
      setErrorMsg(err.message);
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error) {
      setStatus('error');
      setErrorMsg(error === 'access_denied' ? 'You cancelled the Google sign-in.' : error);
      return;
    }

    if (!code) {
      setStatus('error');
      setErrorMsg('No authorisation code received from Google.');
      return;
    }

    const redirectUri = `${window.location.origin}/google-oauth-callback`;
    exchangeMutation.mutate({ code, redirectUri });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center p-8">
        {status === 'loading' && (
          <>
            <div className="w-12 h-12 border-4 border-[#4285F4] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-500">Connecting Google Calendar…</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-700">Connected! Closing…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Connection failed</p>
            <p className="text-xs text-gray-400">{errorMsg}</p>
            <button onClick={() => window.close()} className="mt-4 px-4 py-2 rounded-xl text-sm border border-gray-200 text-gray-500 hover:bg-gray-50">
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}
