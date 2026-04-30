import api from '@/lib/api';

export interface PaymentRead {
  id: number;
  user_id: number;
  course_id: number;
  amount: number;
  status: string;
  payment_date?: string;
  updated_at?: string;
}

export interface PaymentUpdate {
  status?: string;
}

export async function listOrganizationPayments(): Promise<PaymentRead[]> {
  const response = await api.get('/organizations/payments');
  return response.data;
}

export async function getOrganizationPayment(paymentId: number): Promise<PaymentRead> {
  const response = await api.get(`/organizations/payments/${paymentId}`);
  return response.data;
}

export async function updateOrganizationPayment(paymentId: number, payload: PaymentUpdate): Promise<PaymentRead> {
  const response = await api.patch(`/organizations/payments/${paymentId}`, payload);
  return response.data;
}
