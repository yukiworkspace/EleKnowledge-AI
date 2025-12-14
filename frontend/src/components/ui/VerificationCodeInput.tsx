'use client';

import React, { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

export interface VerificationCodeInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  className?: string;
}

export const VerificationCodeInput: React.FC<VerificationCodeInputProps> = ({
  length = 6,
  value,
  onChange,
  error,
  className,
}) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  const handleChange = (index: number, char: string) => {
    if (char.length > 1) return; // 1文字のみ許可
    
    const newValue = value.split('');
    newValue[index] = char;
    const updatedValue = newValue.join('').slice(0, length);
    
    onChange(updatedValue);
    
    // 次の入力フィールドにフォーカス
    if (char && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };
  
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };
  
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, length);
    onChange(pastedData);
    
    // 最後の入力フィールドにフォーカス
    const focusIndex = Math.min(pastedData.length, length - 1);
    inputRefs.current[focusIndex]?.focus();
  };
  
  useEffect(() => {
    // 最初の入力フィールドにフォーカス
    inputRefs.current[0]?.focus();
  }, []);
  
  return (
    <div className={cn('w-full', className)}>
      <div className="flex gap-2 justify-center">
        {Array.from({ length }).map((_, index) => (
          <input
            key={index}
            ref={(el) => { inputRefs.current[index] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={value[index] || ''}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            className={cn(
              'w-12 h-12 text-center text-xl font-semibold border-2 rounded-lg',
              'focus:outline-none focus:ring-2 focus:ring-blue-500',
              'transition-colors',
              error
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-blue-500',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            aria-label={`確認コード ${index + 1}桁目`}
          />
        ))}
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600 text-center" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
