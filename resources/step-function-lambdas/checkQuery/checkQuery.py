import boto3
from botocore.exceptions import ClientError
import os
import logging

athena = boto3.client("athena")
s3 = boto3.client("s3")

RESULTS_BUCKET = os.environ["RESULTS_BUCKET"]

response = {"AthenaComplete": "", "AthenaFailure": ""}


def create_presigned_url(queryExecutionId):
    params = {"Bucket": RESULTS_BUCKET, "Key": "results/" + queryExecutionId + ".csv"}

    try:
        response = s3.generate_presigned_url("get_object", params, ExpiresIn=3600)
    except ClientError as e:
        logging.error(e)
        return None
    return response


def lambda_handler(event, context):
    queryExecutionId = event["QueryExecutionId"]
    print(queryExecutionId)
    queryResponse = athena.get_query_execution(QueryExecutionId=queryExecutionId)

    if queryResponse.get("QueryExecution").get("Status").get("State") == "SUCCEEDED":
        # athenaResponse = athena.get_query_results(QueryExecutionId=queryExecutionId)
        presigned_url = create_presigned_url(queryExecutionId)
        # presigned_url = s3.generate_presigned_url('get_object', )
        response["AthenaComplete"] = True
        # response['AthenaResults'] = athenaResponse.get('ResultSet')
        response["PreSignedUrl"] = presigned_url
        return response
    elif queryResponse.get("QueryExecution").get("Status").get("State") == "FAILED":
        response["AthenaFailure"] = True
        response["ErrorMessage"] = "Athena Error.  Status: " + queryResponse.get("QueryExecution").get("Status").get(
            "State"
        )
        return response
    else:
        response["AthenaComplete"] = False
        response["QueryExecutionId"] = queryExecutionId
        return response
