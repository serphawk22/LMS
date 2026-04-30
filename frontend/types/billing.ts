export interface PaymentIntentCreate {
  amount: number;
  currency?: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface PaymentIntentRead {
  id: string;
  amount: number;
  currency: string;
  status: string;
  client_secret?: string | null;
  metadata?: Record<string, string> | null;
}
