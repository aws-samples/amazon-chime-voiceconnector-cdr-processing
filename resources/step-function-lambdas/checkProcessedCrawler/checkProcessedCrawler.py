import boto3

glue = boto3.client("glue")

response = {"ProcessedCrawlerComplete": "", "ProcessedCrawlerFailure": ""}


def lambda_handler(event, context):
    glueCrawler = event["crawlers"]["processedCrawler"]
    glueResponse = glue.get_crawler(Name=glueCrawler)
    print(glueResponse)

    if not glueResponse.get("Crawler").get("State") == "READY":
        response["ProcessedCrawlerComplete"] = False
        return response
    else:
        if not glueResponse.get("Crawler").get("LastCrawl").get("Status") == "SUCCEEDED":
            response["ProcessedCrawlerError"] = True
            response["ErrorMessage"] = "Error in Crawler. Crawler status: " + glueResponse.get("Crawler").get(
                "LastCrawl"
            ).get("Status")
            return response
        else:
            response["ProcessedCrawlerComplete"] = True
            return response
