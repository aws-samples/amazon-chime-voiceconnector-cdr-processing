import boto3

response = {"ProcessedCrawlerComplete": False, "ProcessedCrawlerFailure": False}

glue = boto3.client("glue")


def lambda_handler(event, context):
    glueCrawler = event["crawlers"]["processedCrawler"]
    glue.start_crawler(Name=glueCrawler)

    return response
