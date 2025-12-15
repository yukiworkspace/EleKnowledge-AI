import { Amplify } from 'aws-amplify';

export const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
      userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
      loginWith: {
        email: true,
        username: false
      },
      signUpVerificationMethod: 'code' as const,
      userAttributes: {
        email: {
          required: true
        },
        name: {
          required: false
        }
      },
      passwordFormat: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireNumbers: true,
        requireSpecialCharacters: true
      }
    }
  }
};

// モジュール読み込み時に自動的に設定（クライアント側のみ）
if (typeof window !== 'undefined') {
  Amplify.configure(amplifyConfig, { ssr: true });
}

export function configureAmplify() {
  // 既に設定されている場合は再設定しない（クライアント側のみ）
  if (typeof window !== 'undefined') {
    Amplify.configure(amplifyConfig, { ssr: true });
  }
}
