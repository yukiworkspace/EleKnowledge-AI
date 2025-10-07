"""
EleKnowledge-AI RAG Lambda Function
Knowledge Base + Claude 4 Integration
"""
import json
import os
import boto3
import time
from datetime import datetime
from botocore.exceptions import ClientError

# Initialize AWS clients
bedrock_agent = boto3.client('bedrock-agent-runtime', region_name='us-east-1')
bedrock_runtime = boto3.client('bedrock-runtime', region_name='us-east-1')
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')

# Environment variables
KNOWLEDGE_BASE_ID = os.environ.get('KNOWLEDGE_BASE_ID', 'PLACEHOLDER')
BEDROCK_MODEL_ID = os.environ.get('BEDROCK_MODEL_ID', 'anthropic.claude-sonnet-4-20250514-v1:0')
CHATLOGS_TABLE_NAME = os.environ.get('CHATLOGS_TABLE')

# DynamoDB table
chatlogs_table = dynamodb.Table(CHATLOGS_TABLE_NAME)


def generate_message_id():
    """Generate unique message ID using timestamp"""
    return f"msg_{int(time.time() * 1000)}"


def generate_session_title(query: str) -> str:
    """Generate session title from first query"""
    max_length = 50
    title = query[:max_length]
    if len(query) > max_length:
        title += "..."
    return title


def save_message_to_dynamodb(session_id: str, user_id: str, role: str, content: str, 
                             citations: list = None, source_documents: list = None):
    """Save message to DynamoDB with TTL"""
    message_id = generate_message_id()
    ttl_timestamp = int(time.time()) + (30 * 24 * 60 * 60)  # 30 days
    
    item = {
        'sessionId': session_id,
        'messageId': message_id,
        'userId': user_id,
        'role': role,
        'content': content,
        'timestamp': datetime.now().isoformat(),
        'ttl': ttl_timestamp
    }
    
    if citations:
        item['citations'] = citations
    
    if source_documents:
        item['sourceDocuments'] = source_documents
    
    chatlogs_table.put_item(Item=item)
    return message_id


def query_knowledge_base(query: str, filters: dict = None) -> dict:
    """
    Query Knowledge Base with optional metadata filters
    
    Args:
        query: User query
        filters: Optional metadata filters
            - documentType: 'manual' | 'policy' | 'report' | 'specification'
            - product: Product name
            - model: Model name
    
    Returns:
        dict: Search results with citations
    """
    try:
        retrieval_config = {
            'vectorSearchConfiguration': {
                'numberOfResults': 10
            }
        }
        
        # Add metadata filters if provided
        if filters:
            filter_list = []
            for key, value in filters.items():
                if value:
                    filter_list.append({
                        'equals': {
                            'key': key,
                            'value': value
                        }
                    })
            
            if filter_list:
                retrieval_config['vectorSearchConfiguration']['filter'] = {
                    'andAll': filter_list
                }
        
        response = bedrock_agent.retrieve(
            knowledgeBaseId=KNOWLEDGE_BASE_ID,
            retrievalQuery={'text': query},
            retrievalConfiguration=retrieval_config
        )
        
        return response
        
    except ClientError as e:
        print(f"Knowledge Base query error: {e}")
        raise


def generate_response_with_claude(query: str, kb_results: dict, chat_history: list = None) -> str:
    """
    Generate response using Claude 4 with Knowledge Base results
    
    Args:
        query: User query
        kb_results: Knowledge Base search results
        chat_history: Previous conversation history
    
    Returns:
        str: Generated response
    """
    try:
        # Extract search results
        search_results = ""
        for i, result in enumerate(kb_results.get('retrievalResults', [])[:10], 1):
            content = result['content']['text']
            metadata = result.get('metadata', {})
            doc_name = metadata.get('x-amz-bedrock-kb-source-uri', 'Unknown')
            
            search_results += f"\n[Document {i}: {doc_name}]\n{content}\n"
        
        # Build chat history context
        history_context = ""
        if chat_history:
            for msg in chat_history[-5:]:  # Last 5 messages
                role = "ユーザー" if msg['role'] == 'user' else "AI"
                history_context += f"\n{role}: {msg['content']}\n"
        
        # Build prompt
        system_prompt = """あなたはEleKnowledge-AIの技術サポートアシスタントです。
電気設備・昇降機に関する専門知識を持ち、以下の資料を参照して正確に回答します。

【回答ルール】
1. 必ず参照資料に基づいて回答してください
2. 引用元の文書名を明記してください
3. 不明な点は推測せず「資料に記載がありません」と答えてください
4. 安全に関わる情報は特に正確性を重視してください
5. 技術用語は正確に使用してください
6. 日本語で丁寧に回答してください

【参照資料】
{search_results}

{history_context}
"""
        
        prompt = system_prompt.format(
            search_results=search_results,
            history_context=f"\n【これまでの会話】{history_context}" if history_context else ""
        )
        
        # Call Claude 4
        request_body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 4096,
            "temperature": 0.3,
            "messages": [
                {
                    "role": "user",
                    "content": f"{prompt}\n\nユーザーの質問: {query}"
                }
            ]
        }
        
        response = bedrock_runtime.invoke_model(
            modelId=BEDROCK_MODEL_ID,
            body=json.dumps(request_body)
        )
        
        response_body = json.loads(response['body'].read())
        assistant_message = response_body['content'][0]['text']
        
        return assistant_message
        
    except ClientError as e:
        print(f"Claude 4 generation error: {e}")
        raise


def extract_citations(kb_results: dict) -> tuple:
    """
    Extract citations and source documents from KB results
    
    Returns:
        tuple: (citations list, source documents list)
    """
    citations = []
    source_documents = []
    
    for result in kb_results.get('retrievalResults', [])[:10]:
        metadata = result.get('metadata', {})
        doc_uri = metadata.get('x-amz-bedrock-kb-source-uri', '')
        
        if doc_uri:
            doc_name = doc_uri.split('/')[-1]
            citations.append(doc_name)
            
            source_doc = {
                'documentName': doc_name,
                'sourceUri': doc_uri,
                'documentType': metadata.get('document-type', 'unknown'),
                'product': metadata.get('product', ''),
                'model': metadata.get('model', ''),
                'relevance': result.get('score', 0.0)
            }
            source_documents.append(source_doc)
    
    return citations, source_documents


def get_chat_history(session_id: str, limit: int = 10) -> list:
    """Get recent chat history for context"""
    try:
        response = chatlogs_table.query(
            KeyConditionExpression='sessionId = :sid',
            ExpressionAttributeValues={':sid': session_id},
            ScanIndexForward=False,
            Limit=limit
        )
        
        messages = response.get('Items', [])
        messages.reverse()  # Oldest first
        return messages
        
    except ClientError as e:
        print(f"Error getting chat history: {e}")
        return []


def lambda_handler(event, context):
    """
    Handle RAG query
    
    Expected event body:
    {
        "sessionId": "session_xxxxx" or null (for new session),
        "userId": "user_xxxxx",
        "query": "User question",
        "filters": {
            "documentType": "manual",
            "product": "ProductA",
            "model": "v2.0"
        }
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
        # Parse request
        if isinstance(event.get('body'), str):
            body = json.loads(event['body'])
        else:
            body = event.get('body', {})
        
        session_id = body.get('sessionId')
        user_id = body.get('userId')
        query = body.get('query')
        filters = body.get('filters', {})
        
        # Validate input
        if not query or not user_id:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': 'ValidationError',
                    'message': 'Query and userId are required'
                })
            }
        
        # Generate new session ID if not provided
        if not session_id:
            session_id = f"session_{int(time.time())}"
        
        # Get chat history for context
        chat_history = get_chat_history(session_id, limit=5)
        
        # Query Knowledge Base
        kb_results = query_knowledge_base(query, filters)
        
        # Generate response with Claude 4
        ai_response = generate_response_with_claude(query, kb_results, chat_history)
        
        # Extract citations
        citations, source_documents = extract_citations(kb_results)
        
        # Save user message
        user_message_id = save_message_to_dynamodb(
            session_id=session_id,
            user_id=user_id,
            role='user',
            content=query
        )
        
        # Save AI message
        ai_message_id = save_message_to_dynamodb(
            session_id=session_id,
            user_id=user_id,
            role='assistant',
            content=ai_response,
            citations=citations,
            source_documents=source_documents
        )
        
        # Generate session title if new session
        session_title = None
        if not chat_history:
            session_title = generate_session_title(query)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'sessionId': session_id,
                'sessionTitle': session_title,
                'userMessageId': user_message_id,
                'aiMessageId': ai_message_id,
                'content': ai_response,
                'citations': citations,
                'sourceDocuments': source_documents,
                'timestamp': datetime.now().isoformat()
            }, ensure_ascii=False)
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
