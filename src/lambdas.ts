import { NestedStack, NestedStackProps, Duration } from 'aws-cdk-lib';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

interface StepFunctionProps extends NestedStackProps {
  cdrBucket: s3.IBucket;
  processedCDRBucket: s3.Bucket;
  resultsBucket: s3.Bucket;
  cdrDatabase: glue.CfnDatabase;
  dailyRawCdrCrawler: glue.CfnCrawler;
  dailyProcessedCdrCrawler: glue.CfnCrawler;
  cdrDailyETL: glue.CfnJob;
  fullRawCdrCrawler: glue.CfnCrawler;
  fullProcessedCdrCrawler: glue.CfnCrawler;
  cdrFullETL: glue.CfnJob;
}

export class Lambdas extends NestedStack {
  public resultsSNS: sns.Topic;
  public sendResults: lambda.Function;
  public runRawCrawler: lambda.Function;
  public checkRawCrawler: lambda.Function;
  public runETL: lambda.Function;
  public checkETL: lambda.Function;
  public runProcessedCrawler: lambda.Function;
  public checkProcessedCrawler: lambda.Function;
  public runQuery: lambda.Function;
  public checkQuery: lambda.Function;
  public sendReport: lambda.Function;

  constructor(scope: Construct, id: string, props: StepFunctionProps) {
    super(scope, id, props);

    this.resultsSNS = new sns.Topic(this, 'resultsTopic');

    const gluePolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          resources: [
            `arn:aws:glue:${this.region}:${this.account}:crawler/${props.dailyRawCdrCrawler.name}`,
            `arn:aws:glue:${this.region}:${this.account}:crawler/${props.dailyProcessedCdrCrawler.name}`,
            `arn:aws:glue:${this.region}:${this.account}:job/${props.cdrDailyETL.name}`,
            `arn:aws:glue:${this.region}:${this.account}:crawler/${props.fullRawCdrCrawler.name}`,
            `arn:aws:glue:${this.region}:${this.account}:crawler/${props.fullProcessedCdrCrawler.name}`,
            `arn:aws:glue:${this.region}:${this.account}:job/${props.cdrFullETL.name}`,
            `arn:aws:glue:${this.region}:${this.account}:catalog`,
            `arn:aws:glue:${this.region}:${this.account}:database/${props.cdrDatabase.ref}`,
            `arn:aws:glue:${this.region}:${this.account}:table/${props.cdrDatabase.ref}/processed_cdrs`,
          ],
          actions: [
            'glue:GetCrawler',
            'glue:GetJobRun',
            'glue:StartCrawler',
            'glue:StartJobRun',
            'glue:GetTable',
            'glue:GetTables',
            'glue:GetPartition',
            'glue:GetPartitions',
            'glue:GetTableVersion',
            'glue:GetTableVersions',
          ],
        }),
      ],
    });

    const s3Policy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          resources: [
            `${props.resultsBucket.bucketArn}`,
            `${props.resultsBucket.bucketArn}/*`,
            `${props.processedCDRBucket.bucketArn}/*`,
            `${props.processedCDRBucket.bucketArn}`,
          ],
          actions: ['*'],
        }),
      ],
    });

    const athenaPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          resources: ['*'],
          actions: [
            'athena:StartQueryExecution',
            'athena:GetQueryResults',
            'athena:GetQueryExecution',
          ],
        }),
      ],
    });

    const glueLambdaRole = new iam.Role(this, 'glueLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        ['gluePolicy']: gluePolicy,
        ['s3Policy']: s3Policy,
      },
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    });

    const athenaLambdaRole = new iam.Role(this, 'athenaLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        ['athenaPolicy']: athenaPolicy,
        ['gluePolicy']: gluePolicy,
        ['s3Policy']: s3Policy,
      },
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    });

    this.runRawCrawler = new lambda.Function(this, 'runRawCrawler', {
      code: lambda.Code.fromAsset(
        './resources/step-function-lambdas/runRawCrawler',
      ),
      handler: 'runRawCrawler.lambda_handler',
      runtime: lambda.Runtime.PYTHON_3_9,
      role: glueLambdaRole,
      timeout: Duration.seconds(60),
    });

    this.checkRawCrawler = new lambda.Function(this, 'checkRawCrawler', {
      code: lambda.Code.fromAsset(
        './resources/step-function-lambdas/checkRawCrawler',
      ),
      handler: 'checkRawCrawler.lambda_handler',
      runtime: lambda.Runtime.PYTHON_3_9,
      role: glueLambdaRole,
      timeout: Duration.seconds(60),
    });

    this.runETL = new lambda.Function(this, 'runETL', {
      code: lambda.Code.fromAsset('./resources/step-function-lambdas/runETL'),
      handler: 'runETL.lambda_handler',
      runtime: lambda.Runtime.PYTHON_3_9,
      role: glueLambdaRole,
      environment: {
        DATABASE: props.cdrDatabase.ref,
        TABLE: 'amazon_chime_voice_connector_cdrs',
        DEST_BUCKET: props.processedCDRBucket.bucketName,
      },
      timeout: Duration.seconds(60),
    });

    this.checkETL = new lambda.Function(this, 'checkETL', {
      code: lambda.Code.fromAsset('./resources/step-function-lambdas/checkETL'),
      handler: 'checkETL.lambda_handler',
      runtime: lambda.Runtime.PYTHON_3_9,
      role: glueLambdaRole,
      timeout: Duration.seconds(60),
    });

    this.runProcessedCrawler = new lambda.Function(
      this,
      'runProcessedCrawler',
      {
        code: lambda.Code.fromAsset(
          './resources/step-function-lambdas/runProcessedCrawler',
        ),
        handler: 'runProcessedCrawler.lambda_handler',
        runtime: lambda.Runtime.PYTHON_3_9,
        role: glueLambdaRole,
        timeout: Duration.seconds(60),
      },
    );

    this.checkProcessedCrawler = new lambda.Function(
      this,
      'checkProcessedCrawler',
      {
        code: lambda.Code.fromAsset(
          './resources/step-function-lambdas/checkProcessedCrawler',
        ),
        handler: 'checkProcessedCrawler.lambda_handler',
        runtime: lambda.Runtime.PYTHON_3_9,
        role: glueLambdaRole,
        timeout: Duration.seconds(60),
      },
    );

    this.sendResults = new lambda.Function(this, 'sendResults', {
      code: lambda.Code.fromAsset(
        './resources/step-function-lambdas/sendResults',
      ),
      handler: 'sendResults.lambda_handler',
      runtime: lambda.Runtime.PYTHON_3_9,
      timeout: Duration.seconds(60),
      environment: {
        SNS_ARN: this.resultsSNS.topicArn,
      },
    });
    this.resultsSNS.grantPublish(this.sendResults);

    this.runQuery = new lambda.Function(this, 'runQuery', {
      code: lambda.Code.fromAsset('resources/step-function-lambdas/runQuery'),
      handler: 'runQuery.lambda_handler',
      runtime: lambda.Runtime.PYTHON_3_9,
      role: athenaLambdaRole,
      environment: {
        DATABASE: props.cdrDatabase.ref,
        RESULTS_BUCKET: props.resultsBucket.bucketName,
      },
      timeout: Duration.seconds(60),
    });

    this.checkQuery = new lambda.Function(this, 'checkQuery', {
      code: lambda.Code.fromAsset('resources/step-function-lambdas/checkQuery'),
      handler: 'checkQuery.lambda_handler',
      runtime: lambda.Runtime.PYTHON_3_9,
      role: athenaLambdaRole,
      environment: {
        RESULTS_BUCKET: props.resultsBucket.bucketName,
      },
      timeout: Duration.seconds(60),
    });

    this.sendReport = new lambda.Function(this, 'sendReport', {
      code: lambda.Code.fromAsset('resources/step-function-lambdas/sendReport'),
      handler: 'sendReport.lambda_handler',
      runtime: lambda.Runtime.PYTHON_3_9,
      role: athenaLambdaRole,
      environment: {
        RESULTS_BUCKET: props.resultsBucket.bucketName,
        SNS_ARN: this.resultsSNS.topicArn,
      },
      timeout: Duration.seconds(60),
    });

    this.resultsSNS.grantPublish(this.sendReport);
  }
}
