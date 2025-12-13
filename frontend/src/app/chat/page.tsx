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
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">EleKnowledge-AI</h1>
          <span className="text-sm text-gray-500">📚 RAGチャット</span>
        </div>
        <Link
          href="/"
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          ホームへ戻る
        </Link>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Session List */}
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
          {/* New Session Button */}
          <button
            onClick={handleNewSession}
            className="m-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
                    onClick={() => fetchSessionMessages(session.sessionId)}
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
                    }`}
                  >
                    <div
                      className={`max-w-2xl px-4 py-3 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {message.content}
                      </p>

                      {/* Citations */}
                      {message.role === 'assistant' && message.sourceDocuments && (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs font-semibold opacity-70">📄 参考資料:</p>
                          {message.sourceDocuments.map((doc, idx) => (
                            <a
                              key={idx}
                              href={doc.sourceUri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-xs underline opacity-70 hover:opacity-100"
                            >
                              {doc.documentName} ({doc.relevance.toFixed(2)})
                            </a>
                          ))}
                        </div>
                      )}

                      {/* Feedback Buttons */}
                      {message.role === 'assistant' && (
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => handleFeedback(message.id, 'good')}
                            className={`text-sm px-2 py-1 rounded transition-colors ${
                              message.feedback === 'good'
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-green-400'
                            }`}
                          >
                            👍 役立つ
                          </button>
                          <button
                            onClick={() => handleFeedback(message.id, 'bad')}
                            className={`text-sm px-2 py-1 rounded transition-colors ${
                              message.feedback === 'bad'
                                ? 'bg-red-500 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-red-400'
                            }`}
                          >
                            👎 改善を
                          </button>
                        </div>
                      )}

                      <p className="text-xs opacity-50 mt-2">
                        {new Date(message.timestamp).toLocaleTimeString('ja-JP')}
                      </p>
                    </div>
                  </div>
                ))}
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
          <div className="border-t border-gray-200 p-6">
            <div className="flex gap-2">
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
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              <button
                onClick={handleSendMessage}
                disabled={loading || !input.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? '送信中...' : '送信'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
