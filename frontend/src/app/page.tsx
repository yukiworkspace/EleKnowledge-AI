'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser, fetchUserAttributes, signOut } from 'aws-amplify/auth';

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [userAttributes, setUserAttributes] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    // 開発モード: 認証をスキップする場合
    const skipAuth = process.env.NEXT_PUBLIC_SKIP_AUTH === 'true';
    
    if (skipAuth) {
      // モックユーザーデータを設定
      setUser({ userId: 'dev-user-123', username: 'dev@example.com' });
      setUserAttributes({ 
        email: 'dev@example.com', 
        name: '開発ユーザー' 
      });
      setLoading(false);
      return;
    }

    try {
      const currentUser = await getCurrentUser();
      const attributes = await fetchUserAttributes();
      setUser(currentUser);
      setUserAttributes(attributes);
    } catch (err) {
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">
            EleKnowledge-AI
          </h1>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            ログアウト
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            ようこそ、{userAttributes?.name || userAttributes?.email || 'ユーザー'}さん
          </h2>
          
          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4 py-2">
              <h3 className="font-medium text-gray-900">Phase 1 完了</h3>
              <p className="text-sm text-gray-600">
                認証機能が正常に動作しています
              </p>
            </div>

            <div className="border-l-4 border-yellow-500 pl-4 py-2">
              <h3 className="font-medium text-gray-900">次のステップ</h3>
              <ul className="text-sm text-gray-600 list-disc list-inside mt-2 space-y-1">
                <li>Knowledge Base の構築</li>
                <li>RAG チャット機能の実装</li>
                <li>ドキュメント管理機能</li>
              </ul>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mt-6">
              <h3 className="font-medium text-gray-900 mb-2">システム情報</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-600">ユーザー名:</dt>
                  <dd className="text-gray-900">{userAttributes?.name || 'N/A'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">メールアドレス:</dt>
                  <dd className="text-gray-900">{userAttributes?.email || 'N/A'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">ユーザーID:</dt>
                  <dd className="text-gray-900 font-mono text-xs">{user?.userId || user?.username}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">ステータス:</dt>
                  <dd className="text-green-600 font-semibold">認証済み</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/chat" className="group">
            <div className="bg-white shadow rounded-lg p-6 group-hover:shadow-lg transition-shadow cursor-pointer h-full">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white mb-4 group-hover:bg-blue-600 transition-colors">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 group-hover:text-blue-600 transition-colors">🤖 RAGチャット</h3>
              <p className="mt-2 text-sm text-gray-600">
                Knowledge Baseを検索して質問に答える
              </p>
              <p className="mt-3 inline-block px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                ✓ 利用可能 (Phase 2)
              </p>
            </div>
          </Link>

          <div className="bg-white shadow rounded-lg p-6 opacity-60">
            <div className="flex items-center justify-center h-12 w-12 rounded-md bg-purple-500 text-white mb-4">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m6 2a8 8 0 11-16 0 8 8 0 0116 0zm-5-3v8l6 3" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900">🔧 トラブルシューティング</h3>
            <p className="mt-2 text-sm text-gray-600">
              現場トラブルの原因分析と対処方法提案
            </p>
            <p className="mt-3 inline-block px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
              🚧 開発中 (Phase 3)
            </p>
          </div>

          <div className="bg-white shadow rounded-lg p-6 opacity-60">
            <div className="flex items-center justify-center h-12 w-12 rounded-md bg-green-500 text-white mb-4">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900">✅ 品質書類チェック</h3>
            <p className="mt-2 text-sm text-gray-600">
              技評写真の自動判定と品質管理
            </p>
            <p className="mt-3 inline-block px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
              🚧 開発中 (Phase 3)
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
