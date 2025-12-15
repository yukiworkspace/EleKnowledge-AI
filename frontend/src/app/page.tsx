'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser, fetchUserAttributes, signOut } from 'aws-amplify/auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [userAttributes, setUserAttributes] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDevBypass, setIsDevBypass] = useState(false);
  const [infoModal, setInfoModal] = useState<null | {
    title: string;
    description: string;
    bullets?: string[];
  }>(null);

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (!infoModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInfoModal(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [infoModal]);

  const checkUser = async () => {
    // 開発モード: 認証をスキップする場合
    const skipAuth = process.env.NEXT_PUBLIC_SKIP_AUTH === 'true';
    const canBypassAuth = skipAuth && process.env.NODE_ENV !== 'production';
    setIsDevBypass(canBypassAuth);

    if (skipAuth && !canBypassAuth) {
      console.warn('[HomePage] NEXT_PUBLIC_SKIP_AUTH is enabled, but bypass is disabled in production.');
    }

    if (canBypassAuth) {
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

  const openInfoModal = (payload: { title: string; description: string; bullets?: string[] }) => {
    setInfoModal(payload);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loading size="lg" text="読み込み中..." />
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
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right leading-tight">
              <div className="text-sm font-semibold text-gray-900">
                {userAttributes?.name || userAttributes?.email || 'ユーザー'}
              </div>
              <div className="text-xs text-gray-500">
                {userAttributes?.email || ''}
              </div>
            </div>
            <Button
              onClick={handleSignOut}
              variant="danger"
              size="md"
            >
              ログアウト
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isDevBypass && (
          <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-yellow-700 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
              </svg>
              <div>
                <div className="font-semibold">開発モード</div>
                <div className="text-yellow-800">
                  認証スキップが有効です（本番環境では無効化してください）。
                </div>
              </div>
            </div>
          </div>
        )}

        <Card variant="elevated" className="mb-8 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-6 text-white">
            <div className="flex flex-col gap-2">
              <div className="text-sm text-blue-100">ログインが完了しました</div>
              <h2 className="text-2xl sm:text-3xl font-bold">
                ようこそ、{userAttributes?.name || userAttributes?.email || 'ユーザー'}さん
              </h2>
              <p className="text-blue-100 text-sm sm:text-base">
                まずはチャットで質問して、必要な資料の根拠と一緒に回答を得ましょう。
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/chat" className="inline-block">
                  <Button variant="primary" size="lg" className="bg-white text-blue-700 hover:bg-blue-50 focus:ring-white">
                    RAGチャットを始める
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="lg"
                  className="border-white/60 text-white hover:bg-white/10 focus:ring-white"
                  onClick={() =>
                    openInfoModal({
                      title: 'Knowledge Base について',
                      description: 'Knowledge Baseは、回答の根拠となる技術資料の集合です。開発者が資料を登録・管理しており、あなたはチャットで質問することで、これらの資料を検索して回答を得られます。',
                      bullets: [
                        '技術資料（マニュアル/据付基準など）が登録されています',
                        '資料タイプ/製品/モデルでフィルター検索が可能です',
                        '回答には参考資料（根拠）が自動で表示されます',
                      ],
                    })
                  }
                >
                  Knowledge Baseとは
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  className="text-white hover:bg-white/10 focus:ring-white"
                  onClick={() =>
                    openInfoModal({
                      title: 'おすすめの質問例',
                      description: 'そのままチャットに入力して試せます。',
                      bullets: [
                        'KE-LG の据付で注意すべきポイントは？',
                        '異音が出るときに最初に確認する項目は？',
                        'エラーコードの原因と対処を手順で教えて',
                      ],
                    })
                  }
                >
                  質問例を見る
                </Button>
              </div>
            </div>
          </div>

          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="text-xs font-semibold text-gray-500">STEP 1</div>
                <div className="mt-1 font-semibold text-gray-900">質問する</div>
                <div className="mt-1 text-sm text-gray-600">困りごとをそのまま入力し、必要ならフィルターで絞り込みます。</div>
                <Link href="/chat" className="inline-block mt-3">
                  <span className="text-sm font-semibold text-blue-600 hover:text-blue-700 underline underline-offset-2">
                    チャットへ移動
                  </span>
                </Link>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="text-xs font-semibold text-gray-500">STEP 2</div>
                <div className="mt-1 font-semibold text-gray-900">根拠を確認する</div>
                <div className="mt-1 text-sm text-gray-600">回答の参考資料（引用）を見て、現場判断に使える形で確認します。</div>
                <button
                  className="mt-3 text-sm font-semibold text-blue-600 hover:text-blue-700 underline underline-offset-2"
                  onClick={() =>
                    openInfoModal({
                      title: '根拠（参考資料）の見方',
                      description: 'チャット画面で「参考資料」から資料名を確認できます。必要ならフィルターで資料タイプ/モデルを指定して再質問できます。',
                      bullets: [
                        '参考資料の上位3件をまず確認',
                        '必要なら「さらに表示」で追加資料も確認',
                        'フィルター指定で資料のブレを減らす',
                      ],
                    })
                  }
                  type="button"
                >
                  参考資料の見方
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/chat" className="group block h-full">
            <Card variant="default" padding="md" className="h-full group-hover:shadow-xl transition-all duration-300 transform group-hover:-translate-y-2 border-2 border-transparent group-hover:border-blue-200">
              <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white mb-4 group-hover:from-blue-600 group-hover:to-blue-700 transition-all duration-300 shadow-md group-hover:shadow-lg">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 transition-colors mb-2">RAGチャット</h3>
              <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                Knowledge Baseを検索して質問に答える
              </p>
              <span className="inline-flex items-center px-3 py-1.5 bg-green-100 text-green-800 text-xs font-semibold rounded-full border border-green-200">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                利用可能
              </span>
            </Card>
          </Link>

          <button
            type="button"
            className="text-left"
            onClick={() =>
              openInfoModal({
                title: 'トラブルシューティング（近日公開）',
                description: '現場トラブルの状況から、原因候補と確認手順を整理して提案します。',
                bullets: [
                  '症状の聞き取りテンプレート',
                  '原因候補の優先度付け',
                  '安全な確認手順と記録',
                ],
              })
            }
          >
            <Card variant="default" padding="md" className="h-full hover:shadow-lg transition-all duration-300 border-2 border-transparent hover:border-purple-200">
            <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 text-white mb-4 shadow-md">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">トラブルシューティング</h3>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              現場トラブルの原因分析と対処方法提案
            </p>
            <span className="inline-flex items-center px-3 py-1.5 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full border border-yellow-200">
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              近日公開
            </span>
            </Card>
          </button>

          <button
            type="button"
            className="text-left"
            onClick={() =>
              openInfoModal({
                title: '品質書類チェック（近日公開）',
                description: '技評写真やチェックリストなどの品質書類を自動チェックし、指摘と改善案を提示します。',
                bullets: [
                  '不足項目や矛盾の検出',
                  '指摘の根拠の提示',
                  '是正のためのテンプレート提案',
                ],
              })
            }
          >
            <Card variant="default" padding="md" className="h-full hover:shadow-lg transition-all duration-300 border-2 border-transparent hover:border-green-200">
            <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-gradient-to-br from-green-500 to-green-600 text-white mb-4 shadow-md">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">品質書類チェック</h3>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              技評写真の自動判定と品質管理
            </p>
            <span className="inline-flex items-center px-3 py-1.5 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full border border-yellow-200">
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              近日公開
            </span>
            </Card>
          </button>
        </div>
      </main>

      {/* Info Modal */}
      {infoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-label={infoModal.title}
          onClick={() => setInfoModal(null)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-2xl mx-auto rounded-xl bg-white shadow-xl border border-gray-200 p-6"
            onClick={(e) => e.stopPropagation()}
            style={{ minWidth: '320px' }}
          >
            {/* Header */}
            <div className="mb-4">
              <div className="flex items-start justify-between gap-4 mb-2">
                <h3 className="text-xl font-bold text-gray-900 whitespace-nowrap flex-1">{infoModal.title}</h3>
                <button
                  type="button"
                  className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                  onClick={() => setInfoModal(null)}
                  aria-label="閉じる"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed break-words">{infoModal.description}</p>
            </div>

            {/* Bullets */}
            {infoModal.bullets && infoModal.bullets.length > 0 && (
              <div className="mt-6">
                <ul className="space-y-3">
                  {infoModal.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm text-gray-700 leading-relaxed flex-1">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Footer */}
            <div className="mt-6 flex justify-end">
              <Button variant="secondary" onClick={() => setInfoModal(null)}>
                閉じる
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
