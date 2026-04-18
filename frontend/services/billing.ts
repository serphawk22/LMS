import api from '@/lib/api';
import type { PaymentIntentCreate, PaymentIntentRead } from '@/types/billing';

export async function createPaymentIntent(payload: PaymentIntentCreate): Promise<PaymentIntentRead> {
  const response = await api.post('/billing/payment-intents', payload);
  return response.data;
}
