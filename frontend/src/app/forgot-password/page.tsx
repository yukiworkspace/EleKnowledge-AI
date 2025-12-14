'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { PasswordStrength } from '@/components/ui/PasswordStrength';
import { StepIndicator } from '@/components/ui/StepIndicator';
import { cn } from '@/lib/utils';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [codeError, setCodeError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  // バリデーション関数（useCallbackでメモ化）
  const validateEmail = useCallback((value: string) => {
    const trimmed = value?.trim() || '';
    if (!trimmed) {
      setEmailError('メールアドレスを入力してください');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setEmailError('有効なメールアドレスを入力してください');
      return false;
    }
    setEmailError('');
    return true;
  }, []);

  const validateCode = useCallback((value: string) => {
    const trimmed = value?.trim() || '';
    if (!trimmed) {
      setCodeError('リセットコードを入力してください');
      return false;
    }
    setCodeError('');
    return true;
  }, []);

  const validatePassword = useCallback((value: string) => {
    const trimmed = value?.trim() || '';
    if (!trimmed) {
      setPasswordError('パスワードを入力してください');
      return false;
    }
    if (value.length < 8) {
      setPasswordError('パスワードは8文字以上である必要があります');
      return false;
    }
    const hasUpperCase = /[A-Z]/.test(value);
    const hasLowerCase = /[a-z]/.test(value);
    const hasNumber = /[0-9]/.test(value);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(value);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecial) {
      setPasswordError('大文字・小文字・数字・記号を含む必要があります');
      return false;
    }
    setPasswordError('');
    return true;
  }, []);

  const validateConfirmPassword = useCallback((value: string, compareValue: string) => {
    const trimmed = value?.trim() || '';
    if (!trimmed) {
      setConfirmPasswordError('パスワードを再入力してください');
      return false;
    }
    if (value !== compareValue) {
      setConfirmPasswordError('パスワードが一致しません');
      return false;
    }
    setConfirmPasswordError('');
    return true;
  }, []);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setEmailError('');
    setLoading(true);

    if (!validateEmail(email)) {
      setLoading(false);
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      
      if (!apiUrl) {
        throw new Error('API設定が見つかりません。環境変数を確認してください。');
      }

      const response = await fetch(
        `${apiUrl}/auth/forgot-password`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        }
      );

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('APIがアクセスできません。Lambda関数がデプロイされているか確認してください。');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'パスワードリセットリクエストに失敗しました');
      }

      setSuccess('パスワードリセットコードがメールアドレスに送信されました');
      setStep('reset');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCodeError('');
    setPasswordError('');
    setConfirmPasswordError('');

    const isCodeValid = validateCode(code);
    const isPasswordValid = validatePassword(newPassword);
    const isConfirmPasswordValid = validateConfirmPassword(confirmPassword, newPassword);

    if (!isCodeValid || !isPasswordValid || !isConfirmPasswordValid) {
      return;
    }

    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      
      if (!apiUrl) {
        throw new Error('API設定が見つかりません。環境変数を確認してください。');
      }

      const response = await fetch(
        `${apiUrl}/auth/confirm-password-reset`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim(),
            code: code.trim(),
            newPassword,
          }),
        }
      );

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('APIがアクセスできません。Lambda関数がデプロイされているか確認してください。');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'パスワードリセットに失敗しました');
      }

      setSuccess('パスワードが正常にリセットされました。ログイン画面にリダイレクトします...');
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-[28rem] flex-shrink-0">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">
          パスワードリセット
        </h1>
        
        <StepIndicator
          steps={['メール送信', 'パスワード変更']}
          currentStep={step === 'email' ? 1 : 2}
          className="mb-6"
        />
        
        <p className="text-gray-600 text-center mb-8">
          {step === 'email'
            ? 'メールアドレスを入力してください'
            : 'リセットコードと新しいパスワードを入力してください'}
        </p>

        {error && (
          <ErrorMessage 
            message={error} 
            variant="error"
            onDismiss={() => setError('')}
            className="mb-4"
          />
        )}

        {success && (
          <ErrorMessage 
            message={success} 
            variant="info"
            onDismiss={() => setSuccess('')}
            className="mb-4"
          />
        )}

        {step === 'email' ? (
          <form onSubmit={handleRequestReset} className="space-y-4">
            <Input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) validateEmail(e.target.value);
              }}
              onBlur={(e) => validateEmail(e.target.value)}
              required
              placeholder="user@example.com"
              error={emailError}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={loading}
              className="w-full"
            >
              リセットコード送信
            </Button>
          </form>
        ) : (
          <form onSubmit={handleConfirmReset} className="space-y-4">
            <Input
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (codeError) validateCode(e.target.value);
              }}
              onBlur={(e) => validateCode(e.target.value)}
              required
              placeholder="メールで受け取ったコード"
              error={codeError}
            />

            <div className="w-full">
              <div className="relative w-full">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (passwordError) validatePassword(e.target.value);
                    if (confirmPassword && confirmPasswordError) {
                      validateConfirmPassword(confirmPassword, e.target.value);
                    }
                  }}
                  onBlur={(e) => validatePassword(e.target.value)}
                  required
                  placeholder="8文字以上、大文字・小文字・数字・特殊文字を含む"
                  className={`w-full px-4 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-colors text-base ${
                    passwordError
                      ? 'border-red-300 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                  aria-label={showNewPassword ? 'パスワードを非表示' : 'パスワードを表示'}
                >
                  {showNewPassword ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.066 5.717m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {passwordError && (
                <p className="mt-1 text-sm text-red-600" role="alert">
                  {passwordError}
                </p>
              )}
              <PasswordStrength password={newPassword} />
            </div>

            <div className="w-full relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (confirmPasswordError) {
                    validateConfirmPassword(e.target.value, newPassword);
                  }
                }}
                onBlur={(e) => validateConfirmPassword(e.target.value, newPassword)}
                required
                placeholder="パスワードを再入力"
                className={cn(
                  'w-full px-4 py-2 pr-10 border rounded-lg',
                  'focus:outline-none focus:ring-2 focus:border-transparent',
                  'transition-colors text-base',
                  confirmPasswordError
                    ? 'border-red-300 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-blue-500'
                )}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                aria-label={showConfirmPassword ? 'パスワードを非表示' : 'パスワードを表示'}
              >
                {showConfirmPassword ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.066 5.717m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {confirmPasswordError && (
              <p className="mt-1 text-sm text-red-600" role="alert">
                {confirmPasswordError}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={loading}
              className="w-full"
            >
              パスワードリセット
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => {
                setStep('email');
                setCode('');
                setNewPassword('');
                setConfirmPassword('');
                setError('');
              }}
              className="w-full"
            >
              メールアドレスを変更する
            </Button>
          </form>
        )}

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            パスワードを思い出しましたか？{' '}
            <Link href="/login" className="text-blue-600 hover:text-blue-700 font-semibold">
              ログイン
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
