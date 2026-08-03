import { useState, useRef, useEffect } from 'react';
import { verifySmsCode } from '@/lib/api';
import { useSessionStore } from '@/stores/sessionStore';

interface Props {
    onVerified: () => void;
}

export function VerificationFlow({ onVerified }: Props) {
    const { sessionId, setChatState } = useSessionStore();
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus the code input when the modal mounts
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (code.length !== 6 || isSubmitting) return;

        setIsSubmitting(true);
        setError(null);

        try {
            const result = await verifySmsCode({ session_id: sessionId, code });

            if (result.verified) {
                setChatState('verified');
                onVerified();
            } else {
                const msg =
                    result.reason === 'expired' || result.state === 'collecting_identity'
                        ? 'Code has expired. Please re-verify your identity in the chat.'
                        : result.reason === 'code_resent'
                            ? 'No active code was found. A new code was just sent to your phone.'
                            : result.reason === 'no_active_code'
                                ? 'No active code is available. Please ask to send a new verification code.'
                                : result.reason === 'max_attempts_exceeded'
                                    ? 'Too many incorrect attempts. Please restart verification in the chat.'
                                    : 'Incorrect code. Please try again.';
                setError(msg);
                setCode('');
                inputRef.current?.focus();
            }
        } catch {
            setError('Unable to verify. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Allow only digits, max 6 characters
        const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
        setCode(digits);
        setError(null);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4">
                <div className="text-center mb-6">
                    <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg
                            className="w-7 h-7 text-blue-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                            />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900">Enter verification code</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Check your phone for the 6-digit code we just sent.
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <input
                        ref={inputRef}
                        type="text"
                        inputMode="numeric"
                        value={code}
                        onChange={handleCodeChange}
                        placeholder="000000"
                        maxLength={6}
                        className="w-full text-center text-3xl font-mono tracking-widest border-2 border-gray-300 rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-colors"
                        disabled={isSubmitting}
                    />

                    {error && (
                        <p className="text-sm text-red-600 text-center mt-3">{error}</p>
                    )}

                    <button
                        type="submit"
                        disabled={code.length !== 6 || isSubmitting}
                        className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold rounded-xl py-3 transition-colors"
                    >
                        {isSubmitting ? 'Verifying…' : 'Verify'}
                    </button>
                </form>
            </div>
        </div>
    );
}
