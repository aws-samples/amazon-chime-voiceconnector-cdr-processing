import boto3

response = {"CrawlerComplete": False, "CrawlerFailure": False}

glue = boto3.client("glue")


def lambda_handler(event, context):
    glueCrawler = event["crawlers"]["rawCrawler"]
    glue.start_crawler(Name=glueCrawler)

    return response
