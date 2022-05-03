import json
import boto3
import os
from datetime import datetime, timedelta


glue = boto3.client("glue")

DEST_BUCKET = os.environ["DEST_BUCKET"]
DATABASE = os.environ["DATABASE"]
TABLE = "amazon_chime_voice_connector_cdrs"
response = {"ETLComplete": "", "ETLFailure": "", "runId": ""}


def lambda_handler(event, context):

    glue_job = event["jobs"]["etlJob"]
    print(event)
    if "Date" in event["input"]:
        date = int(event["input"]["Date"][8:10])
        month = int(event["input"]["Date"][5:7])
        year = int(event["input"]["Date"][0:4])
    else:
        yesterday = datetime.today() - timedelta(days=1)  # Does this check for day before on month change
        date = yesterday.day
        month = yesterday.month
        year = yesterday.year

    print(date)
    print(month)
    print(year)

    glueResponse = glue.start_job_run(
        JobName=glue_job,
        Arguments={
            "--DEST_BUCKET": DEST_BUCKET,
            "--DATABASE": DATABASE,
            "--TABLE": TABLE,
            "--YEAR": str(year),
            "--MONTH": str(month).zfill(2),
            "--DATE": str(date).zfill(2),
        },
    )
    response["runId"] = glueResponse.get("JobRunId")
    return response
