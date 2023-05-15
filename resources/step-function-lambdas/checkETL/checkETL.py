import boto3

glue = boto3.client("glue")

response = {"ETLComplete": "", "ETLFailure": ""}


def lambda_handler(event, context):
    print(event)
    glue_job = event["jobs"]["etlJob"]
    runId = event["ETL"]["Payload"]["runId"]
    glueResponse = glue.get_job_run(JobName=glue_job, RunId=runId)
    print(glueResponse)

    if glueResponse.get("JobRun").get("JobRunState") == "SUCCEEDED":
        response["ETLComplete"] = True
        return response
    elif glueResponse.get("JobRun").get("JobRunState") == "FAILED":
        response["ETLFailure"] = True
        response["ErrorMessage"] = "Error in ETL.  ETL Status: " + glueResponse.get("JobRun").get("JobRunState")
        return response
    else:
        response["ETLComplete"] = False
        response["runId"] = runId
        return response
