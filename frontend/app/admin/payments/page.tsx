'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { listOrganizationPayments, updateOrganizationPayment } from '@/services/payments';

interface Payment {
  id: number;
  user_id: number;
  course_id: number;
  amount: number;
  status: string;
  payment_date?: string;
  updated_at?: string;
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const refreshPayments = async () => {
    try {
      setError('');
      const response = await listOrganizationPayments();
      setPayments(response);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Unable to load payments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshPayments();
  }, []);

  const handleStatusChange = async (payment: Payment, newStatus: string) => {
    try {
      await updateOrganizationPayment(payment.id, { status: newStatus });
      setSuccess('Payment status updated.');
      await refreshPayments();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Unable to update payment.');
    }
  };

  const totalRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const completedPayments = payments.filter((p) => p.status === 'completed').length;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex items-center justify-between rounded-3xl bg-white px-8 py-6 shadow-md">
          <div>
            <h1 className="text-2xl font-semibold">Payments</h1>
            <p className="mt-1 text-sm text-slate-600">Manage and track organization payments.</p>
          </div>
          <Link href="/admin" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            Back to admin dashboard
          </Link>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">Total revenue</p>
            <p className="mt-2 text-2xl font-semibold">${totalRevenue.toFixed(2)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">Completed payments</p>
            <p className="mt-2 text-2xl font-semibold">{completedPayments}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">Total transactions</p>
            <p className="mt-2 text-2xl font-semibold">{payments.length}</p>
          </div>
        </div>

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Payment list</h2>
          {success && <p className="mt-2 text-sm text-green-600">{success}</p>}
          {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
          {loading ? (
            <p className="mt-4 text-sm text-slate-500">Loading payments...</p>
          ) : payments.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No payments recorded.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-4 py-2">ID</th>
                    <th className="px-4 py-2">Amount</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-4 py-2">#{payment.id}</td>
                      <td className="px-4 py-2">${payment.amount?.toFixed(2) || '0.00'}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                            payment.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : payment.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {payment.status}
                        </span>
                      </td>
                      <td className="px-4 py-2">{payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-2 space-x-2">
                        {payment.status !== 'completed' && (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(payment, 'completed')}
                            className="rounded-lg bg-green-600 px-3 py-1 text-xs font-semibold text-white"
                          >
                            Mark complete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
