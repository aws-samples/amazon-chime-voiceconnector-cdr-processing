import boto3
import os
from datetime import datetime, timedelta

sns = boto3.client("sns")
SNS_ARN = os.environ["SNS_ARN"]


def lambda_handler(event, context):
    print(event)
    if "Date" in event["input"]:
        date = int(event["input"]["Date"][8:10])
        month = int(event["input"]["Date"][5:7])
        year = int(event["input"]["Date"][0:4])
    else:
        yesterday = datetime.today() - timedelta(days=1)
        date = yesterday.day
        month = yesterday.month
        year = yesterday.year

    if "ErrorMessage" in event:
        response = sns.publish(
            TopicArn=SNS_ARN,
            Message="Error Processing:  " + event["ErrorMessage"],
            Subject="Error Processing CDRs",
            MessageStructure="string",
        )
    else:
        response = sns.publish(
            TopicArn=SNS_ARN,
            Message="CDR Processing Complete:  " + str(year) + "-" + str(month) + "-" + str(date),
            Subject="Processing CDRs Complete",
            MessageStructure="string",
        )

    return response
