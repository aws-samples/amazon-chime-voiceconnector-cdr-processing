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

TopicArn = os.environ['TOPIC_ARN']

def handler(event, context):
    print(event)

    # Retrieve the bucket name and object key from the event
    bucket_name = event['Records'][0]['s3']['bucket']['name']
    object_key = event['Records'][0]['s3']['object']['key']

    # Create a new S3 client
    s3_client = boto3.client('s3')

    # Generate a signed URL for the object
    signed_url = s3_client.generate_presigned_url(
        'get_object',  # The S3 operation to allow (e.g., 'get_object')
        Params={'Bucket': bucket_name, 'Key': object_key},
        ExpiresIn=86400  # The URL will expire in 24 hours (you can adjust the expiration time)
    )

    sns = boto3.client('sns')
    message = "Please open the following link to view the generated CDR report. " + signed_url

    response = sns.publish(
        TopicArn=TopicArn,
        Message=message
    )

    return {
        'statusCode': 200,
        'body': 'SNS message sent successfully.'
    }