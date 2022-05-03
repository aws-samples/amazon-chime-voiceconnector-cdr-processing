import boto3
import uuid
import os
from datetime import datetime, timedelta

athena = boto3.client("athena")
clietRequestToken = str(uuid.uuid4())

DATABASE = os.environ["DATABASE"]
RESULTS_BUCKET = os.environ["RESULTS_BUCKET"]

response = {"QueryExecutionId": "", "AthenaComplete": "", "AthenaFailure": ""}


def lambda_handler(event, context):
    print(event)

    if "Month" in event:
        month = event["Month"]
    else:
        yesterday = datetime.today() - timedelta(days=7)
        month = str(yesterday.month)

    athenaResponse = athena.start_query_execution(
        QueryString="SELECT npanxx, SUM(TotalDuration) AS TotalDuration, COUNT(CallCount) AS CallCount FROM (SELECT npanxx, SUM(duration) AS TotalDuration, COUNT(callid) AS CallCount FROM "
        + DATABASE
        + ".processed_cdrs WHERE month='"
        + month
        + "' GROUP BY npanxx) GROUP BY npanxx",
        ClientRequestToken=clietRequestToken,
        QueryExecutionContext={"Database": DATABASE, "Catalog": "awsdatacatalog"},
        ResultConfiguration={
            "OutputLocation": "s3://" + RESULTS_BUCKET + "/results/",
        },
    )

    response["QueryExecutionId"] = athenaResponse.get("QueryExecutionId")
    return response
