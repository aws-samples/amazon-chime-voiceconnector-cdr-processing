import { CfnResource, Duration } from 'aws-cdk-lib';
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
  cronSetting: string;
  athenaQuery: string;
  snsTopic: Topic;
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
        ['stateMachinePolicy']: new PolicyDocument({
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
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
        ManagedPolicy.fromAwsManagedPolicyName(
          'AmazonAthenaFullAccess',
        ),
        ManagedPolicy.fromAwsManagedPolicyName(
          'AmazonS3FullAccess',
        ),
      ],
    });

    const generateAthenaQuery = new Function(this, 'generateAthenaQueryLambda', {
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
        ATHENA_QUERY: props.athenaQuery,
      },
    });

    props.s3QueryOutput.grantReadWrite(generateAthenaQuery);

    const schedulerRole = new Role(this, 'schedulerRole', {
      assumedBy: new ServicePrincipal('scheduler.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaRole',
        ),
      ],
    });

    new CfnResource(this, 'recurringSchedule', {
      type: 'AWS::Scheduler::Schedule',
      properties: {
        Name: 'recurringSchedule',
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
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
        ManagedPolicy.fromAwsManagedPolicyName(
          'AmazonSNSFullAccess',
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
    props.rawCdrsBucket.bucketName;
    props.s3QueryOutput.addEventNotification(
      EventType.OBJECT_CREATED,
      new LambdaDestination(sendQueryReport),
      { suffix: '.csv' },
    );
  }
}
