import { Duration } from 'aws-cdk-lib';
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
import { Construct } from 'constructs';

interface LambdaResourcesProps {
  rawCdrsBucket: IBucket;
  voiceConnectorId: string;
  fileCount: string;
  logLevel: string;
  kinesisStream: CfnDeliveryStream;
}
export class LambdaResources extends Construct {
  constructor(scope: Construct, id: string, props: LambdaResourcesProps) {
    super(scope, id);

    const generateCdrsRole = new Role(this, 'generateCdrsRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        ['stateMachinePolicy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: ['*'],
              resources: ['*'],
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
        VOICECONNECTOR_ID: props.voiceConnectorId,
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
              actions: ['*'],
              resources: ['*'],
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
  }
}
