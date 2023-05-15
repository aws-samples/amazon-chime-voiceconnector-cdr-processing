import json
import boto3
import os

glue = boto3.client("glue")

response = {"CrawlerComplete": "", "CrawlerFailure": ""}


def lambda_handler(event, context):
    glueCrawler = event["crawlers"]["rawCrawler"]
    glueResponse = glue.get_crawler(Name=glueCrawler)
    print(glueResponse)

    if not glueResponse.get("Crawler").get("State") == "READY":
        response["CrawlerComplete"] = False
        return response
    else:
        if not glueResponse.get("Crawler").get("LastCrawl").get("Status") == "SUCCEEDED":
            response["CrawlerError"] = True
            response["ErrorMessage"] = "Error in Crawler. Crawler status: " + glueResponse.get("Crawler").get(
                "LastCrawl"
            ).get("Status")
            return response
        else:
            response["CrawlerComplete"] = True
            return response
