"""
EleKnowledge-AI Signup Lambda Function
Cognito User Pool Integration
"""
import json
import os
import boto3
from botocore.exceptions import ClientError

# Initialize AWS clients
cognito_client = boto3.client('cognito-idp')
dynamodb = boto3.resource('dynamodb')

# Environment variables
USER_POOL_ID = os.environ.get('COGNITO_USER_POOL_ID')
CLIENT_ID = os.environ.get('COGNITO_CLIENT_ID')
USERS_TABLE_NAME = os.environ.get('USERS_TABLE')

# DynamoDB table
users_table = dynamodb.Table(USERS_TABLE_NAME)


def lambda_handler(event, context):
    """
    Handle user signup
    
    Expected event body:
    {
        "email": "user@example.com",
        "password": "SecurePassword123!",
        "name": "User Name" (optional)
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
        password = body.get('password')
        name = body.get('name', '')
        
        # Validate input
        if not email or not password:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': 'ValidationError',
                    'message': 'Email and password are required'
                })
            }
        
        # Create user in Cognito
        user_attributes = [
            {'Name': 'email', 'Value': email}
        ]
        
        if name:
            user_attributes.append({'Name': 'name', 'Value': name})
        
        cognito_response = cognito_client.sign_up(
            ClientId=CLIENT_ID,
            Username=email,
            Password=password,
            UserAttributes=user_attributes
        )
        
        user_sub = cognito_response['UserSub']
        
        # Store user info in DynamoDB
        users_table.put_item(
            Item={
                'userId': user_sub,
                'email': email,
                'username': name if name else email.split('@')[0],
                'createdAt': context.request_time_epoch if hasattr(context, 'request_time_epoch') else None,
                'role': 'user'
            }
        )
        
        return {
            'statusCode': 201,
            'headers': headers,
            'body': json.dumps({
                'message': 'User registered successfully. Please check your email for verification code.',
                'userId': user_sub,
                'email': email
            })
        }
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']
        
        # Handle specific Cognito errors
        if error_code == 'UsernameExistsException':
            return {
                'statusCode': 409,
                'headers': headers,
                'body': json.dumps({
                    'error': 'UserExistsError',
                    'message': 'An account with this email already exists'
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
