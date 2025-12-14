'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  citations?: string[];
  sourceDocuments?: Array<{
    documentName: string;
    sourceUri: string;
    documentType: string;
    product: string;
    model: string;
    relevance: number;
  }>;
  feedback?: 'good' | 'bad' | null;
}

interface Session {
  sessionId: string;
  title: string;
  createdAt: string;
  lastMessageTime: string;
  messageCount: number;
  daysUntilDeletion: number;
}

export default function ChatPage() {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingMessages, setStreamingMessages] = useState<Record<string, string>>({});
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({
    documentType: '',
    product: '',
    model: ''
  });

  const API_URL = process.env.NEXT_PUBLIC_RAG_API_URL || '';
  const CHAT_API_URL = process.env.NEXT_PUBLIC_CHAT_API_URL || '';

  const markdownComponents: Components = {
    p: ({ children }: any) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
    h1: ({ children }: any) => <h1 className="text-xl font-bold mb-3 mt-3 first:mt-0">{children}</h1>,
    h2: ({ children }: any) => <h2 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h2>,
    h3: ({ children }: any) => <h3 className="text-base font-semibold mb-2 mt-2 first:mt-0">{children}</h3>,
    ul: ({ children }: any) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
    ol: ({ children }: any) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
    li: ({ children }: any) => <li className="ml-2">{children}</li>,
    code: ({ children, className, ...props }: any) => {
      const isInline = !className;
      if (isInline) {
        return <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-blue-600" {...props}>{children}</code>;
      }
      return <code className="block bg-gray-900 text-gray-100 p-3 rounded-lg text-sm font-mono overflow-x-auto mb-3" {...props}>{children}</code>;
    },
    pre: ({ children }: any) => {
      const child = children as any;
      if (child?.props?.className?.includes('language-')) {
        return <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto mb-3">{children}</pre>;
      }
      return <pre className="bg-gray-100 p-3 rounded-lg overflow-x-auto mb-3">{children}</pre>;
    },
    blockquote: ({ children }: any) => <blockquote className="border-l-4 border-blue-500 pl-4 italic my-3 text-gray-600">{children}</blockquote>,
    a: ({ href, children }: any) => <a href={href} className="text-blue-600 hover:text-blue-700 underline" target="_blank" rel="noopener noreferrer">{children}</a>,
    strong: ({ children }: any) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }: any) => <em className="italic">{children}</em>,
  };

  // 認可トークン取得関数
  const getAuthToken = async (): Promise<string | null> => {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.idToken?.toString() || null;
    } catch (err) {
      console.error('Error fetching auth token:', err);
      return null;
    }
  };

  // 初期化：ユーザー情報取得とセッション読み込み
  useEffect(() => {
    const initializeChat = async () => {
      // 開発モード: 認証をスキップする場合
      const skipAuth = process.env.NEXT_PUBLIC_SKIP_AUTH === 'true';
      
      if (skipAuth) {
        // モックユーザーIDを設定
        const mockUserId = 'dev-user-123';
        setUserId(mockUserId);
        // セッション取得はスキップ（APIが利用できないため）
        setIsLoadingSessions(false);
        setSessions([]);
        return;
      }

      try {
        const user = await getCurrentUser();
        const subId = user.userId;
        setUserId(subId);

        // セッション一覧を取得
        await fetchSessions(subId);
      } catch (err) {
        console.error('Initialize error:', err);
        router.push('/login');
      }
    };

    initializeChat();
  }, [router]);

  // タイプライター効果の実装
  useEffect(() => {
    if (!streamingMessageId) return;

    const message = messages.find(m => m.id === streamingMessageId);
    if (!message || message.role !== 'assistant') return;

    const fullText = message.content;
    const currentText = streamingMessages[streamingMessageId] || '';

    if (currentText.length >= fullText.length) {
      // タイプライター効果完了
      setStreamingMessageId(null);
      return;
    }

    // 文字を追加（日本語の場合は2文字ずつ、英語の場合は5文字ずつ）
    const isJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(fullText[currentText.length] || '');
    const chunkSize = isJapanese ? 2 : 5;
    const nextText = fullText.slice(0, currentText.length + chunkSize);

    const timer = setTimeout(() => {
      setStreamingMessages(prev => ({
        ...prev,
        [streamingMessageId]: nextText
      }));
    }, isJapanese ? 30 : 20); // 日本語は少し遅めに

    return () => clearTimeout(timer);
  }, [streamingMessages, streamingMessageId, messages]);

  // メッセージ自動スクロール（最適化）
  useEffect(() => {
    if (messagesEndRef.current) {
      const timer = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages, loading, streamingMessages]);

  const fetchSessions = async (subId: string) => {
    try {
      setIsLoadingSessions(true);
      const token = await getAuthToken();
      
      console.log('Fetching sessions with URL:', `${CHAT_API_URL}/chat/sessions?userId=${subId}`);
      console.log('API_URL:', CHAT_API_URL);
      console.log('Token available:', !!token);
      
      const response = await axios.get(`${CHAT_API_URL}/chat/sessions?userId=${subId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('Sessions fetched successfully:', response.data);
      setSessions(response.data.sessions || []);
    } catch (err: any) {
      console.error('Error fetching sessions - Full error:', {
        message: err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        config: err.config
      });
      setError(`セッション取得に失敗しました: ${err.response?.status || err.message}`);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const fetchSessionMessages = async (sessionId: string) => {
    try {
      const token = await getAuthToken();
      const response = await axios.get(`${CHAT_API_URL}/chat/sessions/${sessionId}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const fetchedMessages = response.data.messages || [];
      setMessages(fetchedMessages);
      
      // 既存のメッセージはタイプライター効果なしで表示
      const completedMessages: Record<string, string> = {};
      fetchedMessages.forEach((msg: Message) => {
        if (msg.role === 'assistant') {
          completedMessages[msg.id] = msg.content;
        }
      });
      setStreamingMessages(completedMessages);
      setStreamingMessageId(null);
      
      setCurrentSession(sessionId);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError('メッセージ取得に失敗しました');
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || loading || !userId) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };

    // ローカル UI 更新
    setMessages([...messages, userMessage]);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const token = await getAuthToken();
      const payload = {
        sessionId: currentSession,
        userId: userId,
        query: input,
        filters: {
          documentType: selectedFilters.documentType || undefined,
          product: selectedFilters.product || undefined,
          model: selectedFilters.model || undefined
        }
      };
      
      console.log('Sending RAG query:', {
        url: `${API_URL}/rag/query`,
        payload: payload
      });

      const response = await axios.post(`${API_URL}/rag/query`, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('RAG query response:', response.data);

      const aiMessage: Message = {
        id: response.data.aiMessageId,
        role: 'assistant',
        content: response.data.content,
        timestamp: response.data.timestamp,
        citations: response.data.citations,
        sourceDocuments: response.data.sourceDocuments
      };

      setMessages(prev => [...prev, aiMessage]);
      
      // タイプライター効果を開始
      setStreamingMessageId(response.data.aiMessageId);
      setStreamingMessages(prev => ({
        ...prev,
        [response.data.aiMessageId]: ''
      }));

      // 新規セッションの場合はセッション一覧を更新
      if (!currentSession && response.data.sessionId) {
        setCurrentSession(response.data.sessionId);
        await fetchSessions(userId);
        await fetchSessionMessages(response.data.sessionId);
      }
    } catch (err: any) {
      console.error('Error sending RAG query - Full error:', {
        message: err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        config: err.config,
        url: err.config?.url
      });
      setError(`エラーが発生しました: ${err.response?.data?.message || err.message || 'Unknown error'}`);
      // ユーザーメッセージは残す
    } finally {
      setLoading(false);
    }
  };

  const handleNewSession = () => {
    setCurrentSession(null);
    setMessages([]);
    setStreamingMessages({});
    setStreamingMessageId(null);
    setInput('');
    setError('');
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!window.confirm('このセッションを削除しますか？')) return;

    try {
      const token = await getAuthToken();
      await axios.delete(`${CHAT_API_URL}/chat/sessions/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      setSessions(sessions.filter(s => s.sessionId !== sessionId));
      if (currentSession === sessionId) {
        handleNewSession();
      }
    } catch (err) {
      setError('セッション削除に失敗しました');
    }
  };

  const handleFeedback = async (messageId: string, feedback: 'good' | 'bad') => {
    if (!currentSession) return;

    try {
      const token = await getAuthToken();
      await axios.put(`${CHAT_API_URL}/chat/messages/${messageId}/feedback`, {
        sessionId: currentSession,
        feedback
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      setMessages(messages.map(m =>
        m.id === messageId ? { ...m, feedback } : m
      ));
    } catch (err) {
      console.error('Error submitting feedback:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex justify-between items-center flex-shrink-0 shadow-sm backdrop-blur-sm bg-white/95">
        <div className="flex items-center gap-3">
          {/* Mobile Menu Button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            aria-label="メニューを開く"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">EleKnowledge-AI</h1>
              <span className="hidden sm:inline-block text-xs text-gray-500 mt-0.5">RAGチャット</span>
            </div>
          </div>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="hidden sm:inline">ホームへ戻る</span>
          <span className="sm:hidden">ホーム</span>
        </Link>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar - Session List */}
        <div className={`fixed md:static inset-y-0 left-0 z-50 md:z-auto w-64 bg-white border-r border-gray-200 flex flex-col h-full transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}>
          {/* Mobile Sidebar Header */}
          <div className="md:hidden flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
            <h2 className="text-lg font-semibold text-gray-900">メニュー</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 rounded-md text-gray-600 hover:bg-gray-100 focus:outline-none"
              aria-label="メニューを閉じる"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* New Session Button */}
          <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-gradient-to-b from-white to-gray-50">
            <button
              onClick={() => {
                handleNewSession();
                setSidebarOpen(false);
              }}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-medium text-sm shadow-md hover:shadow-lg transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              新規チャット
            </button>
          </div>

          {/* Session List */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {isLoadingSessions ? (
              <div className="p-4 text-center text-gray-500">
                読み込み中...
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                セッションはまだありません
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {sessions.map((session, index) => (
                  <div
                    key={session.sessionId}
                    onClick={() => {
                      fetchSessionMessages(session.sessionId);
                      setSidebarOpen(false);
                    }}
                    className={`p-3 rounded-lg cursor-pointer transition-all duration-200 group ${
                      currentSession === session.sessionId
                        ? 'bg-gradient-to-r from-blue-50 to-blue-100/50 border-l-4 border-blue-600 shadow-sm'
                        : 'hover:bg-gray-50 hover:shadow-sm'
                    }`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 truncate min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">
                          {session.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {session.messageCount}件のメッセージ
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSession(session.sessionId);
                        }}
                        className="opacity-0 group-hover:opacity-100 ml-2 text-gray-400 hover:text-red-600 flex-shrink-0 transition-all duration-200 hover:bg-red-50 rounded p-1"
                        title="削除"
                        aria-label="セッションを削除"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">
                      残り {session.daysUntilDeletion} 日
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Filters Section - Fixed at bottom */}
          <div className="border-t border-gray-200 p-4 bg-gradient-to-b from-gray-50 to-white flex-shrink-0 shadow-inner">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              フィルター
            </h3>
            <div className="space-y-2.5">
              <div>
                <label className="block text-xs text-gray-600 mb-1">資料タイプ</label>
                <input
                  type="text"
                  placeholder="例: マニュアル"
                  value={selectedFilters.documentType}
                  onChange={(e) => setSelectedFilters({
                    ...selectedFilters,
                    documentType: e.target.value
                  })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500 placeholder:opacity-100 transition-all bg-white hover:border-gray-400 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">製品</label>
                <input
                  type="text"
                  placeholder="例: 製品名"
                  value={selectedFilters.product}
                  onChange={(e) => setSelectedFilters({
                    ...selectedFilters,
                    product: e.target.value
                  })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500 placeholder:opacity-100 transition-all bg-white hover:border-gray-400 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">モデル</label>
                <input
                  type="text"
                  placeholder="例: モデル名"
                  value={selectedFilters.model}
                  onChange={(e) => setSelectedFilters({
                    ...selectedFilters,
                    model: e.target.value
                  })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500 placeholder:opacity-100 transition-all bg-white hover:border-gray-400 text-gray-900"
                />
              </div>
              {(selectedFilters.documentType || selectedFilters.product || selectedFilters.model) && (
                <button
                  onClick={() => setSelectedFilters({ documentType: '', product: '', model: '' })}
                  className="w-full mt-2 px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-100 transition-all hover:shadow-sm flex items-center justify-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  フィルターをクリア
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col bg-white">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 min-h-0 scroll-smooth">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full w-full min-w-0" style={{ flexDirection: 'row', writingMode: 'horizontal-tb' }}>
                <div className="text-center w-full max-w-md px-4 mx-auto" style={{ width: '100%', maxWidth: '28rem' }}>
                  <div className="mb-6">
                    <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                    </div>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 whitespace-nowrap leading-tight" style={{ writingMode: 'horizontal-tb', textOrientation: 'mixed' }}>
                    EleKnowledge-AIへようこそ！
                  </h2>
                  <p className="text-gray-600 text-base sm:text-lg mb-6 break-words whitespace-normal leading-relaxed" style={{ writingMode: 'horizontal-tb', textOrientation: 'mixed' }}>
                    技術資料を検索して質問にお答えします
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center text-sm text-gray-500">
                    <span className="px-3 py-1.5 bg-gray-100 rounded-full whitespace-nowrap inline-block">💡 質問を入力</span>
                    <span className="px-3 py-1.5 bg-gray-100 rounded-full whitespace-nowrap inline-block">📚 資料検索</span>
                    <span className="px-3 py-1.5 bg-gray-100 rounded-full whitespace-nowrap inline-block">🔍 フィルター機能</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-w-5xl mx-auto w-full px-2 sm:px-4">
              <>
                {messages.map((message, index) => (
                  <div
                    key={message.id}
                    className={`flex min-w-0 animate-fade-in ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div
                      className={`px-5 py-4 rounded-2xl shadow-md break-words flex-shrink-0 transition-all duration-200 hover:shadow-lg ${
                        message.role === 'user'
                          ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-sm max-w-[72%] sm:max-w-[70%] lg:max-w-[65%]'
                          : 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm hover:border-gray-300 max-w-full sm:max-w-[92%] lg:max-w-[98%]'
                      }`}
                      style={{ minWidth: '200px' }}
                    >
                      {/* Role Indicator */}
                      <div className={`flex items-center gap-2 mb-2.5 ${
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}>
                        {message.role === 'assistant' && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                            </div>
                            <span className="text-sm font-semibold text-gray-700">AI</span>
                          </div>
                        )}
                        {message.role === 'user' && (
                          <span className="text-sm font-semibold text-white">あなた</span>
                        )}
                      </div>

                      <div className="w-full">
                        {message.role === 'assistant' ? (
                          <div className="chat-markdown text-gray-800">
                            {streamingMessageId === message.id ? (
                              <>
                                <ReactMarkdown components={markdownComponents}>
                                  {streamingMessages[message.id] || ''}
                                </ReactMarkdown>
                                <span className="inline-block w-2 h-5 bg-blue-500 ml-1 animate-pulse" />
                              </>
                            ) : (
                              <ReactMarkdown components={markdownComponents}>
                                {streamingMessages[message.id] || message.content}
                              </ReactMarkdown>
                            )}
                          </div>
                        ) : (
                          <p className={`whitespace-pre-wrap break-words text-base leading-relaxed font-normal text-white`}>
                            {message.content}
                          </p>
                        )}
                      </div>

                      {/* Citations */}
                      {message.role === 'assistant' && message.sourceDocuments && message.sourceDocuments.length > 0 && 
                       (!streamingMessageId || streamingMessageId !== message.id || (streamingMessages[message.id] || '').length >= message.content.length) && (
                        <div className="mt-4 pt-3 border-t border-gray-200 space-y-2">
                          <p className="text-sm font-semibold text-gray-700 mb-2.5 flex items-center gap-1.5">
                            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            参考資料
                          </p>
                          <div className="space-y-2">
                            {message.sourceDocuments.map((doc, idx) => (
                              <a
                                key={idx}
                                href={doc.sourceUri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline transition-all duration-200 p-2 rounded-lg hover:bg-blue-50 group"
                              >
                                <svg className="w-4 h-4 flex-shrink-0 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span className="truncate flex-1">{doc.documentName}</span>
                                <span className="text-gray-500 text-xs bg-gray-100 px-2 py-0.5 rounded-full">{(doc.relevance * 100).toFixed(0)}%</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Feedback Buttons */}
                      {message.role === 'assistant' && 
                       (!streamingMessageId || streamingMessageId !== message.id || (streamingMessages[message.id] || '').length >= message.content.length) && (
                        <div className="mt-4 pt-3 border-t border-gray-200 flex gap-2.5">
                          <button
                            onClick={() => handleFeedback(message.id, 'good')}
                            className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg transition-all duration-200 font-medium transform hover:scale-105 active:scale-95 ${
                              message.feedback === 'good'
                                ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md'
                                : 'bg-gray-100 text-gray-700 hover:bg-green-50 hover:text-green-700 hover:shadow-sm'
                            }`}
                            aria-label="役立つ"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                            </svg>
                            役立つ
                          </button>
                          <button
                            onClick={() => handleFeedback(message.id, 'bad')}
                            className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg transition-all duration-200 font-medium transform hover:scale-105 active:scale-95 ${
                              message.feedback === 'bad'
                                ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-md'
                                : 'bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-700 hover:shadow-sm'
                            }`}
                            aria-label="改善を"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                            </svg>
                            改善を
                          </button>
                        </div>
                      )}

                      <p className={`text-xs mt-3 opacity-80 ${
                        message.role === 'user' ? 'text-white' : 'text-gray-500'
                      }`}>
                        {new Date(message.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                {/* Typing Indicator */}
                {loading && (
                  <div className="flex justify-start animate-fade-in">
                    <div className="min-w-[200px] max-w-[85%] sm:max-w-2xl px-5 py-4 rounded-2xl rounded-bl-sm bg-white border border-gray-200 shadow-md flex-shrink-0">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center animate-pulse">
                          <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        </div>
                        <div className="flex gap-1.5">
                          <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                        <span className="text-sm text-gray-500 ml-2">考え中...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="border-t border-red-200 bg-red-50 px-4 sm:px-6 py-3 flex-shrink-0">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-800 flex-1">{error}</p>
                <button
                  onClick={() => setError('')}
                  className="text-red-600 hover:text-red-800 flex-shrink-0"
                  aria-label="エラーを閉じる"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="border-t border-gray-200 bg-white/95 backdrop-blur sticky bottom-0 z-10 flex-shrink-0">
            <div className="p-4 sm:p-6">
              <div className="flex gap-2 sm:gap-3 items-end">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="質問を入力してください... (Enterで送信)"
                    disabled={loading}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 text-sm sm:text-base transition-all placeholder:text-gray-500 placeholder:opacity-100 shadow-sm hover:border-gray-400 bg-white text-gray-900"
                  />
                  {input.trim() && (
                    <button
                      onClick={() => setInput('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      aria-label="入力をクリア"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={loading || !input.trim()}
                  className="px-4 sm:px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg font-medium text-sm sm:text-base flex items-center gap-2 flex-shrink-0 transform hover:scale-105 active:scale-95 disabled:transform-none"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="hidden sm:inline">送信中</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      <span className="hidden sm:inline">送信</span>
                    </>
                  )}
                </button>
              </div>
              {(selectedFilters.documentType || selectedFilters.product || selectedFilters.model) && (
                <div className="mt-3 flex flex-wrap gap-2 items-center animate-fade-in">
                  <span className="text-xs text-gray-500 font-medium">適用中のフィルター:</span>
                  {selectedFilters.documentType && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-gradient-to-r from-blue-100 to-blue-50 text-blue-700 rounded-full border border-blue-200 shadow-sm">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      資料タイプ: {selectedFilters.documentType}
                    </span>
                  )}
                  {selectedFilters.product && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-gradient-to-r from-blue-100 to-blue-50 text-blue-700 rounded-full border border-blue-200 shadow-sm">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      製品: {selectedFilters.product}
                    </span>
                  )}
                  {selectedFilters.model && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-gradient-to-r from-blue-100 to-blue-50 text-blue-700 rounded-full border border-blue-200 shadow-sm">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                      </svg>
                      モデル: {selectedFilters.model}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
