'use client';

import { useState } from 'react';
import { createPaymentIntent } from '@/services/billing';
import type { PaymentIntentRead } from '@/types/billing';

const plans = [
  { id: 'starter', name: 'Starter', price: 2900, description: 'Access to core courses and learning paths for individual learners.' },
  { id: 'growth', name: 'Growth', price: 7900, description: 'Team features, analytics, and instructor tools for small organizations.' },
  { id: 'enterprise', name: 'Enterprise', price: 14900, description: 'Advanced reporting, custom onboarding, and enterprise support.' },
];

export default function BillingPage() {
  const [intent, setIntent] = useState<PaymentIntentRead | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheckout = async (planId: string, amount: number) => {
    setLoading(true);
    setError('');
    setIntent(null);

    try {
      const result = await createPaymentIntent({ amount, currency: 'usd', description: `Checkout for ${planId}` });
      setIntent(result);
    } catch (err) {
      setError('Unable to start payment. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="w-full min-h-screen bg-slate-50 px-6 lg:px-10 py-12 text-slate-900">
      <div className="w-full space-y-10">
        <section className="rounded-3xl bg-white p-10 shadow-sm shadow-slate-200/40">
          <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Billing</p>
          <h1 className="mt-3 text-3xl font-semibold">Payment and subscription plans</h1>
          <p className="mt-2 text-slate-600">Choose a plan for your organization and create a secure payment intent to complete checkout.</p>
        </section>

        {error ? <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div> : null}

        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.id} className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold text-slate-900">{plan.name}</h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">Popular</span>
              </div>
              <p className="mt-4 text-slate-600">{plan.description}</p>
              <p className="mt-8 text-4xl font-semibold text-slate-900">${(plan.price / 100).toFixed(0)}</p>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleCheckout(plan.id, plan.price)}
                className="mt-8 inline-flex w-full justify-center rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {loading ? 'Processing…' : 'Pay now'}
              </button>
            </div>
          ))}
        </div>

        {intent ? (
          <section className="rounded-3xl border border-slate-200 bg-slate-50 p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Payment intent created</h2>
            <p className="mt-3 text-slate-600">Use the client secret below to complete checkout with Stripe or your payment provider.</p>
            <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-700">
              <p><strong>ID:</strong> {intent.id}</p>
              <p><strong>Status:</strong> {intent.status}</p>
              <p><strong>Amount:</strong> ${(intent.amount / 100).toFixed(2)}</p>
              <p><strong>Client secret:</strong></p>
              <pre className="mt-2 overflow-x-auto rounded-2xl bg-slate-900 px-4 py-3 text-xs text-slate-50">{intent.client_secret}</pre>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
