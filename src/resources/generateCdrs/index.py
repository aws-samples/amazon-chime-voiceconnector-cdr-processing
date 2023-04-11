import boto3
from faker import Faker
import json
import time
import random
import os
import logging
from datetime import datetime, timedelta

# Set LOG_LEVEL using environment variable, fallback to INFO if not present
logger = logging.getLogger()
try:
    LOG_LEVEL = os.environ['LOG_LEVEL']
    if LOG_LEVEL not in ['INFO', 'DEBUG', 'WARN', 'ERROR']:
        LOG_LEVEL = 'INFO'
except BaseException:
    LOG_LEVEL = 'INFO'
logger.setLevel(LOG_LEVEL)

TARGET_BUCKET = os.environ['TARGET_BUCKET']
VOICECONNECTOR_ID = os.environ['VOICECONNECTOR_ID']
FILE_COUNT = os.environ['FILE_COUNT']

s3 = boto3.resource('s3')
bucket = s3.Bucket(TARGET_BUCKET)


def handler(event, context):
    global LOG_PREFIX
    LOG_PREFIX = 'CDR Generation Notification: '
    
    start_time = time.time()
    for i in range(int(FILE_COUNT)):
        write_to_s3()
        if (i + 1) % 10 == 0:
            print(f"{i + 1} files uploaded")
        time.sleep(random.uniform(3.5, 4.5))
    end_time = time.time()
    print(f"Time taken: {end_time - start_time:.2f} seconds")


def random_us_e164_number():
    area_code = random.randint(200, 999)
    exchange_code = random.randint(200, 999)
    line_number = random.randint(0000, 9999)
    return f"+1{area_code:03d}{exchange_code:03d}{line_number:04d}"


def generate_json():
    fake = Faker()
    duration_seconds = random.randint(5 * 60, 10 * 60)
    duration_seconds = duration_seconds - (duration_seconds % 6)
    duration_minutes = duration_seconds / 60
    end_time = datetime.now()
    start_time = end_time - timedelta(minutes=random.randint(1, 60))
    start_time_unix = int(time.mktime(start_time.timetuple()))
    end_time_unix = start_time_unix + duration_seconds

    return {
        "AwsAccountId": "654178722619",
        "TransactionId": fake.uuid4(),
        "CallId": fake.uuid4(),
        "VoiceConnectorId": "fb5twdsrnczr5emo8iweix",
        "Status": "Completed",
        "StatusMessage": "Normal Call Clearing",
        "BillableDurationSeconds": duration_seconds,
        "BillableDurationMinutes": duration_minutes,
        "SchemaVersion": "2.0",
        "SourcePhoneNumber": random_us_e164_number(),
        "SourceCountry": "US",
        "DestinationPhoneNumber": random_us_e164_number(),
        "DestinationCountry": "US",
        "UsageType": "USE1-US-inbound-minutes",
        "ServiceCode": "AmazonChimeVoiceConnector",
        "Direction": "Inbound",
        "StartTimeEpochSeconds": start_time_unix,
        "EndTimeEpochSeconds": end_time_unix,
        "Region": "us-east-1",
        "Streaming": True,
        "IsProxyCall": False
    }


def write_to_s3():
    data = generate_json()
    today = datetime.today().strftime('%Y/%m/%d')
    key = f"Amazon-Chime-Voice-Connector-CDRs/json/{VOICECONNECTOR_ID}/{today}/{time.time()}.json"
    obj = bucket.Object(key)
    obj.put(Body=json.dumps(data))
