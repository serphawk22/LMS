'use client';

import { useState } from 'react';
import { verifyCertificate } from '../../../services/certificates';
import type { CertificateVerificationResult } from '../../../types/certificate';

export default function CertificateVerifyPage() {
  const [token, setToken] = useState('');
  const [result, setResult] = useState<CertificateVerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    setError(null);
    setLoading(true);
    setResult(null);

    try {
      const verification = await verifyCertificate(token);
      setResult(verification);
    } catch {
      setError('Unable to verify the certificate at this time.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="w-full px-6 lg:px-10 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold">Verify Certificate</h1>
          <p className="mt-2 text-slate-600">Enter a certificate verification token to confirm whether the certificate is valid.</p>
        </div>

        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <label className="block text-sm font-medium text-slate-700">Verification Token</label>
          <input
            type="text"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            placeholder="Enter verification token"
          />

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleVerify}
              className="rounded-full bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
              disabled={loading || token.trim().length === 0}
            >
              {loading ? 'Verifying…' : 'Verify'}
            </button>
          </div>

          {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}

          {result && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-800">
              <p className="font-semibold">Result:</p>
              <p className="mt-2">Status: {result.valid ? 'Valid' : 'Invalid'}</p>
              {result.valid && result.certificate && (
                <div className="mt-4 space-y-2 text-sm text-slate-700">
                  <p>Certificate ID: {result.certificate.id}</p>
                  <p>Course ID: {result.certificate.course_id}</p>
                  <p>Issued on: {new Date(result.certificate.issued_at).toLocaleDateString()}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
