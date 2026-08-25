/**
 * Error Alert Component
 * 
 * Dismissible error message display.
 */

interface ErrorAlertProps {
  error: string;
  onDismiss: () => void;
}

export default function ErrorAlert({ error, onDismiss }: ErrorAlertProps) {
  if (!error) return null;

  return (
<div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg" role="alert">
      {error}
      <button onClick={onDismiss} className="ml-4 underline">
        Dismiss
      </button>
    </div>
  );
}
