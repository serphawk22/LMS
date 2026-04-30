'use client';

import { useEffect, useState } from 'react';

import { fetchCertificates, downloadCertificate, shareCertificate } from '../../services/certificates';
import type { Certificate } from '../../types/certificate';

export default function CertificatesPage() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareUrls, setShareUrls] = useState<Record<number, string>>({});

  useEffect(() => {
    async function loadCertificates() {
      try {
        const data = await fetchCertificates();
        setCertificates(data);
      } catch (err) {
        setError('Unable to load certificates. Please sign in and try again.');
      } finally {
        setLoading(false);
      }
    }

    loadCertificates();
  }, []);

  const handleDownload = async (certificateId: number) => {
    try {
      const blob = await downloadCertificate(certificateId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `certificate-${certificateId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Failed to download the certificate PDF.');
    }
  };

  const handleShare = async (certificateId: number) => {
    try {
      const result = await shareCertificate(certificateId);
      setShareUrls((current) => ({ ...current, [certificateId]: result.share_url }));
    } catch {
      setError('Unable to generate a share link for this certificate.');
    }
  };

  return (
    <main className="w-full min-h-screen bg-slate-50 px-6 lg:px-10 py-10 text-slate-900">
      <div className="w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold">Certificates</h1>
          <p className="mt-2 text-slate-600">View issued certificates, download PDF copies, and create shareable certificate links.</p>
        </div>

        {loading ? (
          <p>Loading certificates...</p>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
        ) : certificates.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-700">No certificates found yet.</div>
        ) : (
          <div className="space-y-4">
            {certificates.map((certificate) => (
              <div key={certificate.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.24em] text-sky-600">Certificate #{certificate.id}</p>
                    <p className="mt-2 text-lg font-semibold">Course ID {certificate.course_id}</p>
                    <p className="mt-1 text-sm text-slate-600">Issued on {new Date(certificate.issued_at).toLocaleDateString()}</p>
                    {certificate.expires_at && (
                      <p className="mt-1 text-sm text-slate-500">Expires on {new Date(certificate.expires_at).toLocaleDateString()}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => handleDownload(certificate.id)}
                      className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
                    >
                      Download PDF
                    </button>
                    <button
                      onClick={() => handleShare(certificate.id)}
                      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
                    >
                      Share Certificate
                    </button>
                  </div>
                </div>

                {shareUrls[certificate.id] && (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
                    <p className="text-sm font-medium">Share link:</p>
                    <a href={shareUrls[certificate.id]} className="break-all text-sky-600 hover:underline">
                      {shareUrls[certificate.id]}
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
