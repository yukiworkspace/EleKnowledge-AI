'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
import axios from 'axios';

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

  // メッセージ自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      setMessages(response.data.messages || []);
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          {/* Mobile Menu Button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="メニューを開く"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">EleKnowledge-AI</h1>
          <span className="hidden sm:inline text-sm text-gray-500">📚 RAGチャット</span>
        </div>
        <Link
          href="/"
          className="inline-flex items-center px-3 sm:px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
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
        <div className={`fixed md:static inset-y-0 left-0 z-50 md:z-auto w-64 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}>
          {/* Mobile Sidebar Header */}
          <div className="md:hidden flex items-center justify-between p-4 border-b border-gray-200">
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
          <button
            onClick={() => {
              handleNewSession();
              setSidebarOpen(false);
            }}
            className="m-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            + 新規チャット
          </button>

          {/* Session List */}
          <div className="flex-1 overflow-y-auto">
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
                {sessions.map(session => (
                  <div
                    key={session.sessionId}
                    onClick={() => {
                      fetchSessionMessages(session.sessionId);
                      setSidebarOpen(false);
                    }}
                    className={`p-3 rounded-lg cursor-pointer transition-colors group ${
                      currentSession === session.sessionId
                        ? 'bg-blue-50 border-l-4 border-blue-600'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 truncate">
                        <p className="font-medium text-sm text-gray-900 truncate">
                          {session.title}
                        </p>
                        <p className="text-xs text-gray-500">
                          {session.messageCount}件のメッセージ
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSession(session.sessionId);
                        }}
                        className="opacity-0 group-hover:opacity-100 ml-2 text-gray-400 hover:text-red-600"
                        title="削除"
                      >
                        ✕
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      残り {session.daysUntilDeletion} 日
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Filters Section */}
          <div className="border-t border-gray-200 p-4 bg-gray-50">
            <h3 className="text-xs font-semibold text-gray-700 mb-3">フィルター</h3>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="資料タイプ"
                value={selectedFilters.documentType}
                onChange={(e) => setSelectedFilters({
                  ...selectedFilters,
                  documentType: e.target.value
                })}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
              />
              <input
                type="text"
                placeholder="製品"
                value={selectedFilters.product}
                onChange={(e) => setSelectedFilters({
                  ...selectedFilters,
                  product: e.target.value
                })}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
              />
              <input
                type="text"
                placeholder="モデル"
                value={selectedFilters.model}
                onChange={(e) => setSelectedFilters({
                  ...selectedFilters,
                  model: e.target.value
                })}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
              />
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col bg-white">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    🤖 EleKnowledge-AIへようこそ！
                  </h2>
                  <p className="text-gray-600">
                    技術資料を検索して質問にお答えします
                  </p>
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    } mb-4`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-2xl px-4 py-3 rounded-2xl shadow-sm ${
                        message.role === 'user'
                          ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-sm'
                          : 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm'
                      }`}
                    >
                      {/* Role Indicator */}
                      <div className={`flex items-center gap-2 mb-2 ${
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}>
                        {message.role === 'assistant' && (
                          <div className="flex items-center gap-1">
                            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                            </div>
                            <span className="text-xs font-medium text-gray-500">AI</span>
                          </div>
                        )}
                        {message.role === 'user' && (
                          <span className="text-xs font-medium text-blue-100">あなた</span>
                        )}
                      </div>

                      <p className={`whitespace-pre-wrap text-sm leading-relaxed ${
                        message.role === 'user' ? 'text-white' : 'text-gray-900'
                      }`}>
                        {message.content}
                      </p>

                      {/* Citations */}
                      {message.role === 'assistant' && message.sourceDocuments && message.sourceDocuments.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-gray-200 space-y-2">
                          <p className="text-xs font-semibold text-gray-600 mb-2">📄 参考資料:</p>
                          <div className="space-y-1.5">
                            {message.sourceDocuments.map((doc, idx) => (
                              <a
                                key={idx}
                                href={doc.sourceUri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                              >
                                <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span className="truncate">{doc.documentName}</span>
                                <span className="text-gray-400 text-[10px]">({(doc.relevance * 100).toFixed(0)}%)</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Feedback Buttons */}
                      {message.role === 'assistant' && (
                        <div className="mt-3 pt-3 border-t border-gray-200 flex gap-2">
                          <button
                            onClick={() => handleFeedback(message.id, 'good')}
                            className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-all ${
                              message.feedback === 'good'
                                ? 'bg-green-500 text-white shadow-md'
                                : 'bg-gray-100 text-gray-700 hover:bg-green-50 hover:text-green-700'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                            </svg>
                            役立つ
                          </button>
                          <button
                            onClick={() => handleFeedback(message.id, 'bad')}
                            className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-all ${
                              message.feedback === 'bad'
                                ? 'bg-red-500 text-white shadow-md'
                                : 'bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-700'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                            </svg>
                            改善を
                          </button>
                        </div>
                      )}

                      <p className={`text-xs mt-2 ${
                        message.role === 'user' ? 'text-blue-100' : 'text-gray-400'
                      }`}>
                        {new Date(message.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                {/* Typing Indicator */}
                {loading && (
                  <div className="flex justify-start mb-4">
                    <div className="max-w-[85%] sm:max-w-2xl px-4 py-3 rounded-2xl rounded-bl-sm bg-white border border-gray-200 shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                          <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        </div>
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="px-6 py-3 bg-red-50 border-t border-red-200">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Input Area */}
          <div className="border-t border-gray-200 p-4 sm:p-6 bg-white">
            <div className="flex gap-2 sm:gap-3">
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
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 text-sm sm:text-base transition-all"
              />
              <button
                onClick={handleSendMessage}
                disabled={loading || !input.trim()}
                className="px-4 sm:px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg font-medium text-sm sm:text-base"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="hidden sm:inline">送信中...</span>
                    <span className="sm:hidden">送信中</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    <span className="hidden sm:inline">送信</span>
                    <span className="sm:hidden">送信</span>
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
