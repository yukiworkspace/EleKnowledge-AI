'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signOut } from 'aws-amplify/auth';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cacheClearAttempted, setCacheClearAttempted] = useState(false);

  // ログインページ読み込み時にキャッシュをクリア
  useEffect(() => {
    const clearAuthCache = async () => {
      try {
        // 前のセッションをクリア
        await signOut({ global: true });
        
        // ローカルストレージをクリア
        if (typeof window !== 'undefined') {
          localStorage.clear();
          sessionStorage.clear();
        }
        
        setCacheClearAttempted(true);
        console.log('Auth cache cleared successfully');
      } catch (err) {
        console.log('Cache clear completed (already signed out or first visit)');
        setCacheClearAttempted(true);
      }
    };

    clearAuthCache();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // クレデンシャル情報をトリム
      const trimmedEmail = email.trim();
      const trimmedPassword = password.trim();

      if (!trimmedEmail || !trimmedPassword) {
        setError('メールアドレスとパスワードを入力してください');
        setLoading(false);
        return;
      }

      // サインイン実行
      await signIn({
        username: trimmedEmail,
        password: trimmedPassword,
      });

      console.log('Sign in successful');
      router.push('/');
    } catch (err: any) {
      console.error('Login error details:', {
        name: err.name,
        code: err.code,
        message: err.message,
        timestamp: new Date().toISOString()
      });
      
      if (err.name === 'UserNotConfirmedException') {
        setError('メールアドレスの確認が必要です。確認メールをチェックしてください。');
        router.push(`/verify?email=${encodeURIComponent(email)}`);
      } else if (err.name === 'NotAuthorizedException') {
        setError('メールアドレスまたはパスワードが正しくありません。');
      } else if (err.name === 'UserNotFoundException') {
        setError('このメールアドレスで登録されたアカウントが見つかりません。');
      } else if (err.name === 'TooManyRequestsException') {
        setError('ログイン試行が多すぎます。後でもう一度お試しください。');
      } else if (err.message?.includes('Network')) {
        setError('ネットワーク接続エラーです。インターネット接続を確認してください。');
      } else {
        setError(`ログインに失敗しました: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            EleKnowledge-AI
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            ログイン
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}
          
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                メールアドレス
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="メールアドレス"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                パスワード
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="パスワード"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
          </div>

          <div className="flex justify-between text-sm">
            <Link
              href="/forgot-password"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              パスワードを忘れた
            </Link>
            <Link
              href="/signup"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              アカウントを作成
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
