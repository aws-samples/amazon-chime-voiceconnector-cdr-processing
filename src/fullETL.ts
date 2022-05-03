import { NestedStack, NestedStackProps, Duration } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';

interface StepFunctionProps extends NestedStackProps {
  runRawCrawler: lambda.Function;
  checkRawCrawler: lambda.Function;
  runETL: lambda.Function;
  checkETL: lambda.Function;
  runProcessedCrawler: lambda.Function;
  checkProcessedCrawler: lambda.Function;
  sendResults: lambda.Function;
  cdrBucket: s3.IBucket;
  fullRawCdrCrawler: glue.CfnCrawler;
  fullProcessedCdrCrawler: glue.CfnCrawler;
  cdrFullETL: glue.CfnJob;
}

export class FullETL extends NestedStack {
  constructor(scope: Construct, id: string, props: StepFunctionProps) {
    super(scope, id, props);

    const crawlerJson = {
      rawCrawler: props.fullRawCdrCrawler.name,
      processedCrawler: props.fullProcessedCdrCrawler.name,
    };

    const jobJson = {
      etlJob: props.cdrFullETL.name,
    };

    const startJob = new sfn.Pass(this, 'startJob', {
      parameters: {
        input: sfn.JsonPath.stringAt('$'),
        crawlers: crawlerJson,
        jobs: jobJson,
      },
    });

    const crawlerWaitStep = new sfn.Wait(this, 'crawlerWaitStep', {
      time: sfn.WaitTime.duration(Duration.minutes(2)),
    });

    const crawlerChoice = new sfn.Choice(this, 'crawlerChoice', {});

    const runFullRawCrawlerStep = new tasks.LambdaInvoke(
      this,
      'runFullRawCrawlerStep',
      {
        lambdaFunction: props.runRawCrawler,
        resultPath: '$.Crawl',
      },
    );

    const checkFullRawCrawlerStep = new tasks.LambdaInvoke(
      this,
      'checkFullCrawlerStep',
      {
        lambdaFunction: props.checkRawCrawler,
        resultPath: '$.Crawl',
        timeout: Duration.seconds(400),
        heartbeat: Duration.seconds(30),
      },
    );

    const etlWaitStep = new sfn.Wait(this, 'etlWaitStep', {
      time: sfn.WaitTime.duration(Duration.seconds(10)),
    });

    const etlChoice = new sfn.Choice(this, 'etlChoice', {});

    const runFullETLStep = new tasks.LambdaInvoke(this, 'runFullETLStep', {
      lambdaFunction: props.runETL,
      resultPath: '$.ETL',
    });

    const checkFullETLStep = new tasks.LambdaInvoke(this, 'checkFullETLStep', {
      lambdaFunction: props.checkETL,
      resultPath: '$.ETL',
      timeout: Duration.seconds(400),
      heartbeat: Duration.seconds(30),
    });

    const runProcessedCrawlerStep = new tasks.LambdaInvoke(
      this,
      'runProcessedCrawlerStep',
      {
        lambdaFunction: props.runProcessedCrawler,
        resultPath: '$.Processed',
      },
    );

    const crawlerProcessedWaitStep = new sfn.Wait(
      this,
      'crawlerProcessedWaitStep',
      {
        time: sfn.WaitTime.duration(Duration.seconds(10)),
      },
    );

    const checkProcessedCrawlerStep = new tasks.LambdaInvoke(
      this,
      'checkProcessedCrawlerStep',
      {
        lambdaFunction: props.checkProcessedCrawler,
        resultPath: '$.Processed',
      },
    );

    const processedCrawlerChoice = new sfn.Choice(
      this,
      'processedCrawlerChoice',
      {},
    );

    const sendResultsStep = new tasks.LambdaInvoke(this, 'sendResultsStep', {
      lambdaFunction: props.sendResults,
      outputPath: '$.Payload',
    });

    const FullProcessDefinition = startJob
      .next(runFullRawCrawlerStep)
      .next(crawlerWaitStep)
      .next(checkFullRawCrawlerStep)
      .next(
        crawlerChoice
          .when(
            sfn.Condition.booleanEquals('$.Crawl.Payload.CrawlerFailure', true),
            sendResultsStep,
          )
          .when(
            sfn.Condition.booleanEquals(
              '$.Crawl.Payload.CrawlerComplete',
              false,
            ),
            crawlerWaitStep,
          )
          .when(
            sfn.Condition.booleanEquals(
              '$.Crawl.Payload.CrawlerComplete',
              true,
            ),
            runFullETLStep
              .next(etlWaitStep)
              .next(checkFullETLStep)
              .next(
                etlChoice
                  .when(
                    sfn.Condition.booleanEquals(
                      '$.ETL.Payload.ETLFailure',
                      true,
                    ),
                    sendResultsStep,
                  )
                  .when(
                    sfn.Condition.booleanEquals(
                      '$.ETL.Payload.ETLComplete',
                      false,
                    ),
                    etlWaitStep,
                  )
                  .when(
                    sfn.Condition.booleanEquals(
                      '$.ETL.Payload.ETLComplete',
                      true,
                    ),
                    runProcessedCrawlerStep
                      .next(crawlerProcessedWaitStep)
                      .next(checkProcessedCrawlerStep)
                      .next(
                        processedCrawlerChoice
                          .when(
                            sfn.Condition.booleanEquals(
                              '$.Processed.Payload.ProcessedCrawlerFailure',
                              true,
                            ),
                            sendResultsStep,
                          )
                          .when(
                            sfn.Condition.booleanEquals(
                              '$.Processed.Payload.ProcessedCrawlerComplete',
                              false,
                            ),
                            crawlerProcessedWaitStep,
                          )
                          .when(
                            sfn.Condition.booleanEquals(
                              '$.Processed.Payload.ProcessedCrawlerComplete',
                              true,
                            ),
                            sendResultsStep,
                          ),
                      ),
                  ),
              ),
          ),
      );

    const processCDRMachineRole = new iam.Role(this, 'processCDRMachineRole', {
      assumedBy: new iam.ServicePrincipal('states.amazonaws.com'),
      inlinePolicies: {
        processCDRs: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              resources: ['*'],
              actions: [
                'logs:CreateLogDelivery',
                'logs:GetLogDelivery',
                'logs:UpdateLogDelivery',
                'logs:DeleteLogDelivery',
                'logs:ListLogDeliveries',
                'logs:PutResourcePolicy',
                'logs:DescribeResourcePolicies',
                'logs:DescribeLogGroups',
              ],
            }),
          ],
        }),
      },
    });

    new sfn.StateMachine(this, 'processFullCDRMachine', {
      definition: FullProcessDefinition,
      timeout: cdk.Duration.hours(8),
      tracingEnabled: true,
      role: processCDRMachineRole,
      logs: {
        level: sfn.LogLevel.ALL,
        destination: new logs.LogGroup(this, 'processCDRMachineLogs', {
          logGroupName: '/aws/vendedlogs/states/' + this.stackName,
          removalPolicy: cdk.RemovalPolicy.DESTROY,
          retention: logs.RetentionDays.THREE_MONTHS,
        }),
      },
    });
  }
}
