"""
EleKnowledge-AI Chat Management Lambda Function
Session and Message Management
"""
import json
import os
import boto3
import time
from datetime import datetime
from botocore.exceptions import ClientError
from decimal import Decimal

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')

# Environment variables
CHATLOGS_TABLE_NAME = os.environ.get('CHATLOGS_TABLE')

# DynamoDB table
chatlogs_table = dynamodb.Table(CHATLOGS_TABLE_NAME)


# Custom JSON encoder for Decimal
class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)


def calculate_days_until_deletion(ttl: int) -> int:
    """Calculate days remaining until TTL deletion"""
    current_time = int(time.time())
    seconds_remaining = ttl - current_time
    days_remaining = max(0, seconds_remaining // (24 * 60 * 60))
    return days_remaining


def get_sessions_by_user(user_id: str, limit: int = 50) -> list:
    """Get all sessions for a user"""
    try:
        response = chatlogs_table.query(
            IndexName='userId-timestamp-index',
            KeyConditionExpression='userId = :uid',
            ExpressionAttributeValues={':uid': user_id},
            ScanIndexForward=False,
            Limit=limit * 10  # Get more messages to find unique sessions
        )
        
        messages = response.get('Items', [])
        
        # Group by sessionId and get session metadata
        sessions_dict = {}
        for msg in messages:
            session_id = msg['sessionId']
            if session_id not in sessions_dict:
                sessions_dict[session_id] = {
                    'sessionId': session_id,
                    'createdAt': msg['timestamp'],
                    'lastMessageTime': msg['timestamp'],
                    'messageCount': 1,
                    'title': msg.get('content', 'Untitled')[:50],
                    'ttl': msg.get('ttl', 0)
                }
            else:
                sessions_dict[session_id]['messageCount'] += 1
                # Update last message time if newer
                if msg['timestamp'] > sessions_dict[session_id]['lastMessageTime']:
                    sessions_dict[session_id]['lastMessageTime'] = msg['timestamp']
        
        # Convert to list and calculate days until deletion
        sessions = list(sessions_dict.values())
        for session in sessions:
            session['daysUntilDeletion'] = calculate_days_until_deletion(session['ttl'])
        
        # Sort by last message time (newest first)
        sessions.sort(key=lambda x: x['lastMessageTime'], reverse=True)
        
        return sessions[:limit]
        
    except ClientError as e:
        print(f"Error getting sessions: {e}")
        raise


def get_session_messages(session_id: str, limit: int = 100) -> list:
    """Get all messages in a session"""
    try:
        response = chatlogs_table.query(
            KeyConditionExpression='sessionId = :sid',
            ExpressionAttributeValues={':sid': session_id},
            ScanIndexForward=True,  # Oldest first
            Limit=limit
        )
        
        messages = response.get('Items', [])
        
        # Calculate days until deletion for each message
        for msg in messages:
            if 'ttl' in msg:
                msg['daysUntilDeletion'] = calculate_days_until_deletion(msg['ttl'])
        
        return messages
        
    except ClientError as e:
        print(f"Error getting messages: {e}")
        raise


def delete_session(session_id: str) -> int:
    """Delete all messages in a session"""
    try:
        # Get all messages
        messages = get_session_messages(session_id)
        
        # Delete each message
        deleted_count = 0
        for msg in messages:
            chatlogs_table.delete_item(
                Key={
                    'sessionId': session_id,
                    'messageId': msg['messageId']
                }
            )
            deleted_count += 1
        
        return deleted_count
        
    except ClientError as e:
        print(f"Error deleting session: {e}")
        raise


def update_message_feedback(session_id: str, message_id: str, feedback: str) -> bool:
    """Update message feedback (thumbs up/down)"""
    try:
        chatlogs_table.update_item(
            Key={
                'sessionId': session_id,
                'messageId': message_id
            },
            UpdateExpression='SET feedback = :feedback',
            ExpressionAttributeValues={
                ':feedback': feedback
            }
        )
        return True
        
    except ClientError as e:
        print(f"Error updating feedback: {e}")
        raise


def lambda_handler(event, context):
    """
    Handle chat management operations
    
    Routes:
    - GET /chat/sessions - List user sessions
    - GET /chat/sessions/{sessionId} - Get session details
    - DELETE /chat/sessions/{sessionId} - Delete session
    - GET /chat/sessions/{sessionId}/messages - Get session messages
    - PUT /chat/messages/{messageId}/feedback - Update message feedback
    """
    
    # CORS headers
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    }
    
    try:
        # Get route info
        http_method = event.get('httpMethod', event.get('requestContext', {}).get('http', {}).get('method'))
        path = event.get('path', event.get('rawPath', ''))
        path_parameters = event.get('pathParameters', {})
        query_parameters = event.get('queryStringParameters', {}) or {}
        
        # Parse body if present
        body = {}
        if event.get('body'):
            if isinstance(event['body'], str):
                body = json.loads(event['body'])
            else:
                body = event['body']
        
        # Route: GET /chat/sessions - List user sessions
        if http_method == 'GET' and path == '/chat/sessions':
            user_id = query_parameters.get('userId')
            
            if not user_id:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({
                        'error': 'ValidationError',
                        'message': 'userId is required'
                    })
                }
            
            sessions = get_sessions_by_user(user_id)
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({'sessions': sessions}, cls=DecimalEncoder, ensure_ascii=False)
            }
        
        # Route: GET /chat/sessions/{sessionId}/messages - Get session messages
        elif http_method == 'GET' and '/messages' in path:
            session_id = path_parameters.get('sessionId')
            
            if not session_id:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({
                        'error': 'ValidationError',
                        'message': 'sessionId is required'
                    })
                }
            
            messages = get_session_messages(session_id)
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({'messages': messages}, cls=DecimalEncoder, ensure_ascii=False)
            }
        
        # Route: DELETE /chat/sessions/{sessionId} - Delete session
        elif http_method == 'DELETE' and path_parameters.get('sessionId'):
            session_id = path_parameters.get('sessionId')
            
            deleted_count = delete_session(session_id)
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({
                    'message': f'Session deleted successfully',
                    'deletedCount': deleted_count
                })
            }
        
        # Route: PUT /chat/messages/{messageId}/feedback - Update feedback
        elif http_method == 'PUT' and '/feedback' in path:
            message_id = path_parameters.get('messageId')
            session_id = body.get('sessionId')
            feedback = body.get('feedback')
            
            if not all([message_id, session_id, feedback]):
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({
                        'error': 'ValidationError',
                        'message': 'messageId, sessionId, and feedback are required'
                    })
                }
            
            if feedback not in ['good', 'bad']:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({
                        'error': 'ValidationError',
                        'message': 'feedback must be "good" or "bad"'
                    })
                }
            
            update_message_feedback(session_id, message_id, feedback)
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({
                    'message': 'Feedback updated successfully'
                })
            }
        
        else:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({
                    'error': 'NotFound',
                    'message': 'Route not found'
                })
            }
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']
        
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
