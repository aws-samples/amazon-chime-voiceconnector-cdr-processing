import boto3
import os

sns = boto3.client("sns")
SNS_ARN = os.environ["SNS_ARN"]


def lambda_handler(event, context):

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
            Message="CDR Processing Complete:  " + event["PreSignedUrl"],
            Subject="Processing CDRs Complete",
            MessageStructure="string",
        )

    return response
