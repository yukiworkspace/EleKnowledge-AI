'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface PasswordStrengthProps {
  password: string;
  className?: string;
}

export const PasswordStrength: React.FC<PasswordStrengthProps> = ({ password, className }) => {
  const calculateStrength = (pwd: string): { score: number; label: string; color: string } => {
    if (!pwd) return { score: 0, label: '', color: '' };
    
    let score = 0;
    const checks = {
      length: pwd.length >= 8,
      lowercase: /[a-z]/.test(pwd),
      uppercase: /[A-Z]/.test(pwd),
      number: /[0-9]/.test(pwd),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
    };
    
    Object.values(checks).forEach(check => {
      if (check) score++;
    });
    
    if (score <= 2) return { score, label: '弱い', color: 'bg-red-500' };
    if (score <= 4) return { score, label: '普通', color: 'bg-yellow-500' };
    return { score, label: '強い', color: 'bg-green-500' };
  };
  
  const strength = calculateStrength(password);
  
  if (!password) return null;
  
  return (
    <div className={cn('mt-2', className)}>
      <div className="flex items-center gap-2 mb-1">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={cn('h-full transition-all duration-300', strength.color)}
            style={{ width: `${(strength.score / 5) * 100}%` }}
          />
        </div>
        <span className="text-xs font-medium text-gray-600">{strength.label}</span>
      </div>
      <div className="text-xs text-gray-500 space-y-1">
        <div className="flex items-center gap-2">
          <span className={cn('w-1.5 h-1.5 rounded-full', password.length >= 8 ? 'bg-green-500' : 'bg-gray-300')} />
          <span>8文字以上</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('w-1.5 h-1.5 rounded-full', /[a-z]/.test(password) ? 'bg-green-500' : 'bg-gray-300')} />
          <span>小文字</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('w-1.5 h-1.5 rounded-full', /[A-Z]/.test(password) ? 'bg-green-500' : 'bg-gray-300')} />
          <span>大文字</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('w-1.5 h-1.5 rounded-full', /[0-9]/.test(password) ? 'bg-green-500' : 'bg-gray-300')} />
          <span>数字</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('w-1.5 h-1.5 rounded-full', /[!@#$%^&*(),.?":{}|<>]/.test(password) ? 'bg-green-500' : 'bg-gray-300')} />
          <span>記号</span>
        </div>
      </div>
    </div>
  );
};
