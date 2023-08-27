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

DATABASE = os.environ['DATABASE']  # 'amazon_chime_sdk_voice_connector_cdrs'
TABLE = os.environ['TABLE']  # 'processed_cdrs'
TARGET_BUCKET = os.environ['TARGET_BUCKET']
OUTPUT_PREFIX = os.environ['OUTPUT_PREFIX']

client = boto3.client('athena')


def handler(event, context):

    query = os.environ['ATHENA_QUERY']
    print(query.format(database=DATABASE, table=TABLE))

    try:
        response = client.start_query_execution(
            QueryString=query.format(database=DATABASE, table=TABLE),
            QueryExecutionContext={
                'Database': DATABASE
            },
            ResultConfiguration={
                'OutputLocation': f's3://{TARGET_BUCKET}/{OUTPUT_PREFIX}/',
            }
        )

        query_execution_id = response['QueryExecutionId']

        # Wait for the query to complete
        while True:
            query_execution = client.get_query_execution(QueryExecutionId=query_execution_id)
            query_status = query_execution['QueryExecution']['Status']['State']

            if query_status in ['SUCCEEDED', 'FAILED', 'CANCELLED']:
                break

            time.sleep(5)  # Wait for a few seconds before checking again

        if query_status == 'SUCCEEDED':
            print("Query execution succeeded")
        else:
            print("Query execution failed or was cancelled - " + query_status)
        print(query_execution['QueryExecution']['ResultConfiguration']['OutputLocation'])

    except Exception as e:
        print("An error occurred:", str(e))

    return
