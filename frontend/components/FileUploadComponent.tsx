import type { ChangeEvent } from 'react';

interface FileUploadComponentProps {
  file: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
}

export default function FileUploadComponent({ file, onChange, accept = '.pdf,.doc,.docx,.zip,.jpg,.jpeg,.png' }: FileUploadComponentProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.files?.[0] ?? null);
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-slate-900">Upload file (optional)</label>
      <input
        type="file"
        accept={accept}
        onChange={handleChange}
        className="mt-3 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
      />
      <p className="mt-2 text-xs text-slate-500">Supported formats: PDF, DOC, DOCX, ZIP, JPG, PNG</p>
      {file ? (
        <p className="mt-2 text-sm text-slate-600">{file.name} selected</p>
      ) : null}
    </div>
  );
}
