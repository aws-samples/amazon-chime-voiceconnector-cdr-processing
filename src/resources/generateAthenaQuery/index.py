import time
import boto3
import logging
import os

# Set LOG_LEVEL using environment variable, fallback to INFO if not present
logger = logging.getLogger()
try:
    LOG_LEVEL = os.environ['LOG_LEVEL']
    if LOG_LEVEL not in ['INFO', 'DEBUG', 'WARN', 'ERROR']:
        LOG_LEVEL = 'INFO'
except BaseException:
    LOG_LEVEL = 'INFO'
logger.setLevel(LOG_LEVEL)

DATABASE = os.environ['DATABASE'] #'amazon_chime_sdk_voice_connector_cdrs'
TABLE = os.environ['TABLE'] #'processed_cdrs'
TARGET_BUCKET = os.environ['TARGET_BUCKET']

def lambda_handler(event, context):

    query = os.environ['ATHENA_QUERY']
    
    client = boto3.client('athena')
    response = client.start_query_execution(
        QueryString=query,
        QueryExecutionContext={
            'Database': DATABASE
        },
        ResultConfiguration={
            'OutputLocation': TARGET_BUCKET,
        }
    )
    
    return
