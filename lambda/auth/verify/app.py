"""
EleKnowledge-AI Email Verification Lambda Function
Cognito Email Confirmation
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
    Handle email verification
    
    Expected event body:
    {
        "email": "user@example.com",
        "code": "123456"
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
        
        # Validate input
        if not email or not code:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': 'ValidationError',
                    'message': 'Email and verification code are required'
                })
            }
        
        # Confirm signup with verification code
        cognito_client.confirm_sign_up(
            ClientId=CLIENT_ID,
            Username=email,
            ConfirmationCode=code
        )
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'message': 'Email verified successfully. You can now log in.',
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
                    'message': 'Invalid verification code'
                })
            }
        elif error_code == 'ExpiredCodeException':
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': 'ExpiredCodeError',
                    'message': 'Verification code has expired. Please request a new code.'
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
        elif error_code == 'NotAuthorizedException':
            return {
                'statusCode': 403,
                'headers': headers,
                'body': json.dumps({
                    'error': 'AlreadyConfirmedError',
                    'message': 'User is already confirmed'
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
