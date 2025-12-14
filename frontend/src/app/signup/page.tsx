'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { signUp } from 'aws-amplify/auth';
import Link from 'next/link';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { PasswordStrength } from '@/components/ui/PasswordStrength';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [nameError, setNameError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // リアルタイムバリデーション（useCallbackでメモ化）
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

  const validateName = useCallback((value: string) => {
    const trimmed = value?.trim() || '';
    if (!trimmed) {
      setNameError('名前を入力してください');
      return false;
    }
    if (trimmed.length < 2) {
      setNameError('名前は2文字以上で入力してください');
      return false;
    }
    setNameError('');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setEmailError('');
    setNameError('');
    setPasswordError('');
    setLoading(true);

    // バリデーション
    const isEmailValid = validateEmail(email);
    const isNameValid = validateName(name);
    const isPasswordValid = validatePassword(password);

    if (!isEmailValid || !isNameValid || !isPasswordValid) {
      setLoading(false);
      return;
    }

    try {
      // データをトリムして送信
      const trimmedEmail = email.trim();
      const trimmedName = name.trim();
      
      await signUp({
        username: trimmedEmail,
        password: password,
        options: {
          userAttributes: {
            email: trimmedEmail,
            name: trimmedName
          }
        }
      });
      
      router.push(`/verify?email=${encodeURIComponent(trimmedEmail)}`);
    } catch (err: any) {
      console.error('Signup error:', err);
      
      if (err.name === 'UsernameExistsException') {
        setError('このメールアドレスは既に登録されています。');
      } else if (err.name === 'InvalidPasswordException') {
        setError('パスワードは8文字以上で、大文字・小文字・数字・記号を含む必要があります。');
      } else {
        setError('登録に失敗しました。もう一度お試しください。');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-[28rem] space-y-8 flex-shrink-0">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            EleKnowledge-AI
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            アカウント作成
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <ErrorMessage 
              message={error} 
              variant="error"
              onDismiss={() => setError('')}
            />
          )}
          
          <div className="space-y-4">
            <Input
              id="name"
              name="name"
              type="text"
              required
              placeholder="名前"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) validateName(e.target.value);
              }}
              onBlur={(e) => validateName(e.target.value)}
              error={nameError}
            />
            
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="メールアドレス"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) validateEmail(e.target.value);
              }}
              onBlur={(e) => validateEmail(e.target.value)}
              error={emailError}
            />
            
            <div className="w-full">
              <div className="relative w-full">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  placeholder="パスワード（8文字以上、大小英数記号含む）"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) validatePassword(e.target.value);
                  }}
                  onBlur={(e) => validatePassword(e.target.value)}
                  className={`w-full px-4 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-colors text-base ${
                    passwordError
                      ? 'border-red-300 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                  aria-label={showPassword ? 'パスワードを非表示' : 'パスワードを表示'}
                >
                  {showPassword ? (
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
              <PasswordStrength password={password} />
            </div>
          </div>

          <div>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={loading}
              className="w-full"
            >
              登録
            </Button>
          </div>

          <div className="text-sm text-center">
            <Link
              href="/login"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              既にアカウントをお持ちの方
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
