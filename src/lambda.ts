import { Database } from '@aws-cdk/aws-glue-alpha';
import { Duration, Stack, CfnResource } from 'aws-cdk-lib';
import { CfnTable } from 'aws-cdk-lib/aws-glue';
import {
  ManagedPolicy,
  Role,
  ServicePrincipal,
  PolicyDocument,
  PolicyStatement,
} from 'aws-cdk-lib/aws-iam';
import { CfnDeliveryStream } from 'aws-cdk-lib/aws-kinesisfirehose';
import { Runtime, Code, Function } from 'aws-cdk-lib/aws-lambda';
import { IBucket, EventType } from 'aws-cdk-lib/aws-s3';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

interface LambdaResourcesProps {
  rawCdrsBucket: IBucket;
  s3QueryOutput: IBucket;
  fileCount: string;
  logLevel: string;
  kinesisStream: CfnDeliveryStream;
  processedCdrsTable: CfnTable;
  cdrDatabaseName: Database;
  cronSetting: string;
  athenaQuery: string;
  snsTopic: Topic;
  outputPrefix: string;
}
export class LambdaResources extends Construct {
  constructor(scope: Construct, id: string, props: LambdaResourcesProps) {
    super(scope, id);

    const generateCdrsRole = new Role(this, 'generateCdrsRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    });

    const generateCdrs = new Function(this, 'generateCdrsLambda', {
      code: Code.fromAsset('src/resources/generateCdrs'),
      runtime: Runtime.PYTHON_3_9,
      handler: 'index.handler',
      memorySize: 10240,
      timeout: Duration.minutes(15),
      role: generateCdrsRole,
      environment: {
        LOG_LEVEL: props.logLevel,
        TARGET_BUCKET: props.rawCdrsBucket.bucketName,
        FILE_COUNT: props.fileCount,
      },
    });

    props.rawCdrsBucket.grantWrite(generateCdrs);

    const processCdrsRole = new Role(this, 'processCdrsRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        ['firehosePolicy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: ['firehose:PutRecord'],
              resources: [props.kinesisStream.attrArn],
            }),
          ],
        }),
      },
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    });

    const processCdrs = new Function(this, 'processCdrsLambda', {
      code: Code.fromAsset('src/resources/processCdrs'),
      runtime: Runtime.PYTHON_3_9,
      handler: 'index.handler',
      role: processCdrsRole,
      timeout: Duration.seconds(15),
      environment: {
        LOG_LEVEL: props.logLevel,
        KINESIS_STREAM: props.kinesisStream.ref,
      },
    });

    props.rawCdrsBucket.addEventNotification(
      EventType.OBJECT_CREATED,
      new LambdaDestination(processCdrs),
      { prefix: 'Amazon-Chime-Voice-Connector-CDRs' },
    );

    props.rawCdrsBucket.grantReadWrite(processCdrs);

    const generateAthenaQueryRole = new Role(this, 'generateAthenaQueryRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        ['athenaPolicy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: [
                'athena:StartQueryExecution',
                'athena:GetQueryExecution',
              ],
              resources: ['*'],
            }),
          ],
        }),
        ['gluePolicy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: ['glue:GetTable'],
              resources: [
                `arn:aws:glue:${Stack.of(this).region}:${
                  Stack.of(this).account
                }:table/${props.cdrDatabaseName.databaseName}/${
                  props.processedCdrsTable.ref
                }`,
                props.cdrDatabaseName.catalogArn,
                props.cdrDatabaseName.databaseArn,
              ],
            }),
          ],
        }),
        ['s3Policy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: [
                's3:GetBucketLocation',
                's3:GetObject',
                's3:ListBucket',
                's3:ListBucketMultipartUploads',
                's3:AbortMultipartUpload',
                's3:PutObject',
                's3:ListMultipartUploadParts',
              ],
              resources: [
                props.s3QueryOutput.bucketArn,
                `${props.s3QueryOutput.bucketArn}/*`,
              ],
            }),
            new PolicyStatement({
              actions: [
                's3:ListBucket',
                's3:GetBucketLocation',
                's3:ListAllMyBuckets',
              ],
              resources: ['*'],
            }),
            new PolicyStatement({
              actions: ['s3:GetObject', 's3:ListBucket'],
              resources: ['arn:aws:s3:::athena-examples*'],
            }),
          ],
        }),
      },

      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    });

    const generateAthenaQuery = new Function(
      this,
      'generateAthenaQueryLambda',
      {
        code: Code.fromAsset('src/resources/generateAthenaQuery'),
        runtime: Runtime.PYTHON_3_9,
        handler: 'index.handler',
        role: generateAthenaQueryRole,
        timeout: Duration.seconds(15),
        environment: {
          LOG_LEVEL: props.logLevel,
          DATABASE: 'amazon_chime_sdk_voice_connector_cdrs',
          TABLE: 'processed_cdrs',
          TARGET_BUCKET: props.s3QueryOutput.bucketName,
          OUTPUT_PREFIX: props.outputPrefix,
          ATHENA_QUERY: props.athenaQuery,
        },
      },
    );

    const schedulerRole = new Role(this, 'schedulerRole', {
      assumedBy: new ServicePrincipal('scheduler.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
        // ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaRole'),
      ],
    });

    new CfnResource(this, 'recurringSchedule', {
      type: 'AWS::Scheduler::Schedule',
      properties: {
        Name: 'CDRReportSchedule',
        Description: 'Runs a schedule for every x minutes',
        FlexibleTimeWindow: { Mode: 'OFF' },
        ScheduleExpression: props.cronSetting,
        Target: {
          Arn: generateAthenaQuery.functionArn,
          RoleArn: schedulerRole.roleArn,
        },
      },
    });

    const sendQueryReportRole = new Role(this, 'sendQueryReportRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        ['snsPolicy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: ['sns:Publish'],
              resources: [props.snsTopic.topicArn],
            }),
          ],
        }),
      },
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    });

    const sendQueryReport = new Function(this, 'sendQueryReportLambda', {
      code: Code.fromAsset('src/resources/sendQueryReport'),
      runtime: Runtime.PYTHON_3_9,
      handler: 'index.handler',
      role: sendQueryReportRole,
      timeout: Duration.seconds(15),
      environment: {
        LOG_LEVEL: props.logLevel,
        TOPIC_ARN: props.snsTopic.topicArn,
      },
    });

    props.s3QueryOutput.grantReadWrite(sendQueryReport);
    props.s3QueryOutput.addEventNotification(
      EventType.OBJECT_CREATED,
      new LambdaDestination(sendQueryReport),
      { suffix: '.csv', prefix: `${props.outputPrefix}/` },
    );
  }
}
