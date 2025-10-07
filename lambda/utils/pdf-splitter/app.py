"""
EleKnowledge-AI PDF Splitter Lambda
Automatically split large PDFs (>45MB) into smaller chunks
Triggered by S3 upload events
"""
import json
import os
import boto3
from io import BytesIO
from pypdf import PdfReader, PdfWriter
from botocore.exceptions import ClientError

s3_client = boto3.client('s3')

# File size limits
MAX_FILE_SIZE_MB = 45
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024


def get_file_size(bucket: str, key: str) -> int:
    """Get S3 object size in bytes"""
    try:
        response = s3_client.head_object(Bucket=bucket, Key=key)
        return response['ContentLength']
    except ClientError as e:
        print(f"Error getting file size: {e}")
        raise


def download_pdf_from_s3(bucket: str, key: str) -> BytesIO:
    """Download PDF from S3 to memory"""
    try:
        response = s3_client.get_object(Bucket=bucket, Key=key)
        pdf_data = response['Body'].read()
        return BytesIO(pdf_data)
    except ClientError as e:
        print(f"Error downloading PDF: {e}")
        raise


def get_object_metadata(bucket: str, key: str) -> dict:
    """Get S3 object metadata"""
    try:
        response = s3_client.head_object(Bucket=bucket, Key=key)
        return response.get('Metadata', {})
    except ClientError as e:
        print(f"Error getting metadata: {e}")
        return {}


def split_pdf(pdf_stream: BytesIO, max_size_bytes: int) -> list:
    """
    Split PDF into chunks under max_size_bytes
    
    Returns:
        list: List of PdfWriter objects
    """
    reader = PdfReader(pdf_stream)
    total_pages = len(reader.pages)
    
    chunks = []
    current_writer = PdfWriter()
    current_size = 0
    
    for page_num in range(total_pages):
        page = reader.pages[page_num]
        
        # Create temporary writer to estimate page size
        temp_writer = PdfWriter()
        temp_writer.add_page(page)
        temp_stream = BytesIO()
        temp_writer.write(temp_stream)
        page_size = temp_stream.tell()
        
        # Check if adding this page exceeds limit
        if current_size + page_size > max_size_bytes and len(current_writer.pages) > 0:
            # Save current chunk and start new one
            chunks.append(current_writer)
            current_writer = PdfWriter()
            current_size = 0
        
        # Add page to current writer
        current_writer.add_page(page)
        current_size += page_size
    
    # Add last chunk
    if len(current_writer.pages) > 0:
        chunks.append(current_writer)
    
    return chunks


def upload_pdf_chunk(bucket: str, base_key: str, chunk_index: int, 
                     pdf_writer: PdfWriter, metadata: dict) -> str:
    """Upload PDF chunk to S3"""
    try:
        # Generate new key
        key_parts = base_key.rsplit('.', 1)
        if len(key_parts) == 2:
            new_key = f"{key_parts[0]}_part{chunk_index + 1}.{key_parts[1]}"
        else:
            new_key = f"{base_key}_part{chunk_index + 1}"
        
        # Write PDF to bytes
        pdf_stream = BytesIO()
        pdf_writer.write(pdf_stream)
        pdf_stream.seek(0)
        pdf_bytes = pdf_stream.read()
        
        # Upload to S3 with metadata
        s3_client.put_object(
            Bucket=bucket,
            Key=new_key,
            Body=pdf_bytes,
            ContentType='application/pdf',
            Metadata=metadata
        )
        
        print(f"Uploaded chunk {chunk_index + 1}: {new_key} ({len(pdf_bytes) / 1024 / 1024:.2f} MB)")
        return new_key
        
    except ClientError as e:
        print(f"Error uploading chunk: {e}")
        raise


def tag_original_file(bucket: str, key: str):
    """Tag original file as 'split'"""
    try:
        s3_client.put_object_tagging(
            Bucket=bucket,
            Key=key,
            Tagging={
                'TagSet': [
                    {'Key': 'Status', 'Value': 'Split'},
                    {'Key': 'ProcessedDate', 'Value': str(int(os.environ.get('AWS_REQUEST_TIME', 0)))}
                ]
            }
        )
    except ClientError as e:
        print(f"Error tagging file: {e}")


def lambda_handler(event, context):
    """
    Handle S3 upload event and split large PDFs
    
    Event triggered by:
    - S3 ObjectCreated event
    - For .pdf files only
    - In eleknowledge-documents bucket
    """
    
    try:
        # Parse S3 event
        for record in event.get('Records', []):
            bucket = record['s3']['bucket']['name']
            key = record['s3']['object']['key']
            
            # Skip if not PDF
            if not key.lower().endswith('.pdf'):
                print(f"Skipping non-PDF file: {key}")
                continue
            
            # Skip if already a split file (contains '_part')
            if '_part' in key:
                print(f"Skipping split file: {key}")
                continue
            
            # Skip if in processed/ or tmp/ directory
            if '/processed/' in key or '/tmp/' in key:
                print(f"Skipping processed/tmp file: {key}")
                continue
            
            # Check file size
            file_size = get_file_size(bucket, key)
            file_size_mb = file_size / 1024 / 1024
            
            print(f"Processing file: {key} ({file_size_mb:.2f} MB)")
            
            # If file is under limit, no action needed
            if file_size <= MAX_FILE_SIZE_BYTES:
                print(f"File size OK, no splitting needed")
                continue
            
            # File exceeds limit - split it
            print(f"File exceeds {MAX_FILE_SIZE_MB}MB, splitting...")
            
            # Get metadata
            metadata = get_object_metadata(bucket, key)
            
            # Download PDF
            pdf_stream = download_pdf_from_s3(bucket, key)
            
            # Split PDF
            chunks = split_pdf(pdf_stream, MAX_FILE_SIZE_BYTES)
            
            print(f"Split into {len(chunks)} chunks")
            
            # Upload chunks
            chunk_keys = []
            for i, chunk in enumerate(chunks):
                chunk_key = upload_pdf_chunk(bucket, key, i, chunk, metadata)
                chunk_keys.append(chunk_key)
            
            # Tag original file
            tag_original_file(bucket, key)
            
            print(f"Successfully split {key} into {len(chunks)} parts")
            
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message': 'PDF split successfully',
                    'originalFile': key,
                    'originalSize': file_size_mb,
                    'chunks': chunk_keys,
                    'chunkCount': len(chunks)
                })
            }
        
        return {
            'statusCode': 200,
            'body': json.dumps({'message': 'No files to process'})
        }
        
    except Exception as e:
        print(f"Error processing file: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'InternalServerError',
                'message': str(e)
            })
        }
