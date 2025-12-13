"""
EleKnowledge-AI Confirm Password Reset Lambda Function
Cognito New Password Challenge
"""
import json
import os
import boto3
from botocore.exceptions import ClientError

# Initialize AWS clients
cognito_client = boto3.client('cognito-idp')

# Environment variables
USER_POOL_ID = os.environ.get('COGNITO_USER_POOL_ID')
CLIENT_ID = os.environ.get('COGNITO_CLIENT_ID')


def lambda_handler(event, context):
    """
    Handle password reset confirmation
    
    Expected event body:
    {
        "email": "user@example.com",
        "code": "123456",
        "newPassword": "NewSecurePass123!"
    }
    """
    
    # CORS headers
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
    }
    
    try:
        # Parse request body
        if isinstance(event.get('body'), str):
            body = json.loads(event['body'])
        else:
            body = event.get('body', {})
        
        email = body.get('email')
        code = body.get('code')
        new_password = body.get('newPassword')
        
        # Validate input
        if not email or not code or not new_password:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': 'ValidationError',
                    'message': 'Email, confirmation code, and new password are required'
                })
            }
        
        # Confirm forgot password and set new password
        cognito_client.confirm_forgot_password(
            ClientId=CLIENT_ID,
            Username=email,
            ConfirmationCode=code,
            Password=new_password
        )
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'message': 'Password has been successfully reset. You can now log in with your new password.',
                'email': email
            })
        }
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']
        
        # Handle specific Cognito errors
        if error_code == 'CodeMismatchException':
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': 'InvalidCodeError',
                    'message': 'Invalid confirmation code'
                })
            }
        elif error_code == 'ExpiredCodeException':
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': 'ExpiredCodeError',
                    'message': 'Confirmation code has expired. Please request a new password reset.'
                })
            }
        elif error_code == 'UserNotFoundException':
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({
                    'error': 'UserNotFoundError',
                    'message': 'User account does not exist'
                })
            }
        elif error_code == 'InvalidPasswordException':
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': 'InvalidPasswordError',
                    'message': 'Password does not meet requirements: 8+ characters, uppercase, lowercase, number, symbol'
                })
            }
        elif error_code == 'LimitExceededException':
            return {
                'statusCode': 429,
                'headers': headers,
                'body': json.dumps({
                    'error': 'TooManyAttemptsError',
                    'message': 'Too many failed attempts. Please try again later.'
                })
            }
        else:
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({
                    'error': error_code,
                    'message': error_message
                })
            }
    
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'InternalServerError',
                'message': 'An unexpected error occurred'
            })
        }
