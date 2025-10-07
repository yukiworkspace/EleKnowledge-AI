"""
EleKnowledge-AI Login Lambda Function
Cognito User Pool Authentication
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
    Handle user login
    
    Expected event body:
    {
        "email": "user@example.com",
        "password": "SecurePassword123!"
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
        
        # Authenticate with Cognito
        auth_response = cognito_client.initiate_auth(
            ClientId=CLIENT_ID,
            AuthFlow='USER_PASSWORD_AUTH',
            AuthParameters={
                'USERNAME': email,
                'PASSWORD': password
            }
        )
        
        # Get user attributes from Cognito
        user_response = cognito_client.get_user(
            AccessToken=auth_response['AuthenticationResult']['AccessToken']
        )
        
        user_sub = user_response['Username']
        
        # Update last login time in DynamoDB
        try:
            import time
            users_table.update_item(
                Key={'userId': user_sub},
                UpdateExpression='SET lastLoginAt = :timestamp',
                ExpressionAttributeValues={
                    ':timestamp': int(time.time())
                }
            )
        except Exception as update_error:
            print(f"Failed to update last login: {str(update_error)}")
        
        # Return tokens and user info
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'message': 'Login successful',
                'tokens': {
                    'accessToken': auth_response['AuthenticationResult']['AccessToken'],
                    'idToken': auth_response['AuthenticationResult']['IdToken'],
                    'refreshToken': auth_response['AuthenticationResult']['RefreshToken'],
                    'expiresIn': auth_response['AuthenticationResult']['ExpiresIn']
                },
                'user': {
                    'userId': user_sub,
                    'email': email
                }
            })
        }
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']
        
        # Handle specific Cognito errors
        if error_code == 'NotAuthorizedException':
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({
                    'error': 'AuthenticationError',
                    'message': 'Incorrect email or password'
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
        elif error_code == 'UserNotConfirmedException':
            return {
                'statusCode': 403,
                'headers': headers,
                'body': json.dumps({
                    'error': 'UserNotConfirmedError',
                    'message': 'Please verify your email before logging in'
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
