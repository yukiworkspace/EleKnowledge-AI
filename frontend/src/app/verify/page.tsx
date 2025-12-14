'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { confirmSignUp, resendSignUpCode } from 'aws-amplify/auth';
import Link from 'next/link';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { VerificationCodeInput } from '@/components/ui/VerificationCodeInput';

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);
  
  // 再送信タイマー
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => {
        setResendTimer(resendTimer - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await confirmSignUp({
        username: email,
        confirmationCode: code
      });
      
      setSuccess('メールアドレスが確認されました。ログインページに移動します...');
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err: any) {
      console.error('Verify error:', err);
      
      if (err.name === 'CodeMismatchException') {
        setError('確認コードが正しくありません。');
      } else if (err.name === 'ExpiredCodeException') {
        setError('確認コードの有効期限が切れています。新しいコードを再送信してください。');
      } else {
        setError('確認に失敗しました。もう一度お試しください。');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendTimer > 0) return;
    
    setError('');
    setSuccess('');
    
    try {
      await resendSignUpCode({ username: email });
      setSuccess('確認コードを再送信しました。メールをチェックしてください。');
      setResendTimer(60); // 60秒のタイマー
    } catch (err: any) {
      console.error('Resend code error:', err);
      setError('確認コードの再送信に失敗しました。');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-[28rem] space-y-8 flex-shrink-0">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            メールアドレスの確認
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {email ? `${email} に送信された` : ''}確認コードを入力してください
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
          
          {success && (
            <ErrorMessage 
              message={success} 
              variant="info"
              onDismiss={() => setSuccess('')}
            />
          )}
          
          <div className="space-y-6">
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="メールアドレス"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              disabled={!!searchParams.get('email')}
            />
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                確認コード（6桁）
              </label>
              <VerificationCodeInput
                length={6}
                value={code}
                onChange={(value) => {
                  setCode(value);
                  setError('');
                }}
                error={error && code.length === 6 ? error : undefined}
              />
              {code.length > 0 && code.length < 6 && (
                <p className="mt-2 text-sm text-gray-500 text-center">
                  {6 - code.length}桁残り
                </p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={loading}
              disabled={code.length !== 6}
              className="w-full"
            >
              確認
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={handleResendCode}
              disabled={resendTimer > 0}
              className="w-full"
            >
              {resendTimer > 0 
                ? `確認コードを再送信（${resendTimer}秒）` 
                : '確認コードを再送信'}
            </Button>
          </div>

          <div className="text-sm text-center">
            <Link
              href="/login"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              ログインページに戻る
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyContent />
    </Suspense>
  );
}
