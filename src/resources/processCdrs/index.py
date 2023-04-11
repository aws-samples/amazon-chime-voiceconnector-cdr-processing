import boto3
import json
import os
import logging
from datetime import datetime

# Set LOG_LEVEL using environment variable, fallback to INFO if not present
logger = logging.getLogger()
try:
    LOG_LEVEL = os.environ['LOG_LEVEL']
    if LOG_LEVEL not in ['INFO', 'DEBUG', 'WARN', 'ERROR']:
        LOG_LEVEL = 'INFO'
except BaseException:
    LOG_LEVEL = 'INFO'
logger.setLevel(LOG_LEVEL)

KINESIS_STREAM = os.environ['KINESIS_STREAM']

s3 = boto3.client('s3')
firehose = boto3.client('firehose')

# Get the current date and time
now = datetime.now()

# Format the date and time as a string and use it as the partition key
partition_key = now.strftime('%Y-%m-%d-%H-%M-%S')

# Create an S3 client and Kinesis client


def handler(event, context):
    global LOG_PREFIX
    LOG_PREFIX = 'CDR Generation Notification: '

    # Get the bucket and object key from the S3 event
    s3_bucket = event['Records'][0]['s3']['bucket']['name']
    s3_object_key = event['Records'][0]['s3']['object']['key']

    # Read the contents of the S3 object
    s3_object = s3.get_object(Bucket=s3_bucket, Key=s3_object_key)
    data = s3_object['Body'].read().decode('utf-8')

    # Convert the data to JSON and put it to Kinesis Data Stream
    record = json.loads(data)
    logger.info('%s Record: %s', LOG_LEVEL, record)
    firehose.put_record(DeliveryStreamName=KINESIS_STREAM, Record={'Data': json.dumps(record)})

    print(f'Successfully processed file: {s3_object_key}')
