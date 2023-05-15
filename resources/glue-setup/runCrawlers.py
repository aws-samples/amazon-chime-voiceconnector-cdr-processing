import boto3
import os

response = {"CrawlerComplete": False, "CrawlerFailure": False}

glue = boto3.client("glue")
rawCdrCrawler = os.environ["RAW_CDR_CRAWLER"]
processedCdrCrawler = os.environ["PROCESSED_CDR_CRAWLER"]


def lambda_handler(event, context):
    print(event)
    if event["RequestType"] == "Create":
        responseData = {}

        responseData["rawCrawler"] = glue.start_crawler(Name=rawCdrCrawler)

        responseData["processedCrawler"] = glue.start_crawler(Name=processedCdrCrawler)

        return {"PhysicalResourceId": "GlueSetup", "Data": responseData}
    else:
        return {"Data": None}
