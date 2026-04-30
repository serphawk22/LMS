'use client';

import type { ChangeEvent, ReactNode } from 'react';

interface InputFieldProps {
  label: string;
  name: string;
  type?: string;
  value: string | number;
  placeholder?: string;
  icon: ReactNode;
  disabled?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

export default function InputField({
  label,
  name,
  type = 'text',
  value,
  placeholder,
  icon,
  disabled = false,
  onChange,
}: InputFieldProps) {
  return (
    <label className="block space-y-3">
      <span className="text-sm font-medium text-slate-700">{label}</span>

      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
          {icon}
        </span>
        <input
          type={type}
          name={name}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={onChange}
          className={`w-full rounded-3xl border border-slate-200 bg-white py-3 pl-14 pr-4 text-sm text-slate-900 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-100 ${
            disabled ? 'cursor-not-allowed bg-slate-100 text-slate-500' : ''
          }`}
        />
      </div>
    </label>
  );
}
