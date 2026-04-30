import api from '../lib/api';
import type { Certificate, CertificateShareResponse, CertificateVerificationResult } from '../types/certificate';

export async function fetchCertificates(): Promise<Certificate[]> {
  const response = await api.get('/certificates');
  return response.data;
}

export async function downloadCertificate(certificateId: number): Promise<Blob> {
  const response = await api.get(`/certificates/${certificateId}/download`, {
    responseType: 'blob',
  });
  return response.data;
}

export async function shareCertificate(certificateId: number): Promise<CertificateShareResponse> {
  const response = await api.post(`/certificates/${certificateId}/share`);
  return response.data;
}

export async function verifyCertificate(token: string): Promise<CertificateVerificationResult> {
  const response = await api.get('/certificates/verify', {
    params: { token },
  });
  return response.data;
}
