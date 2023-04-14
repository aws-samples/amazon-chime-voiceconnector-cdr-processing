/* eslint-disable import/no-extraneous-dependencies */
import { App, Stack, StackProps } from 'aws-cdk-lib';
import { IBucket, Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { config } from 'dotenv';
import {
  LambdaResources,
  GlueResources,
  S3ResourcesProcessed,
  S3ResourcesRaw,
  KinesisResources,
} from './';
import { envValidator } from './envValidator';

config();

export interface AmazonChimeSdkVoiceConnectorCdrsProps extends StackProps {
  logLevel: string;
  removalPolicy: string;
  rawCdrsBucketName: string;
  voiceConnectorId: string;
  fileCount: string;
  bufferHintSize: string;
  bufferHintInterval: string;
  projectionYearMin: string;
  projectionYearMax: string;
}

export class AmazonChimeSdkVoiceConnectorCdrs extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: AmazonChimeSdkVoiceConnectorCdrsProps,
  ) {
    super(scope, id, props);

    envValidator(props);
    let rawCdrsBucket: IBucket;

    if (props.rawCdrsBucketName === '') {
      const s3Resources = new S3ResourcesRaw(this, 'S3ResourcesRaw', {
        removalPolicy: props.removalPolicy,
      });
      rawCdrsBucket = s3Resources.rawCdrs;
    } else {
      // istanbul ignore next
      rawCdrsBucket = Bucket.fromBucketName(
        this,
        'RawCdrsBucket',
        props.rawCdrsBucketName,
      );
    }

    const s3ResourcesProcessed = new S3ResourcesProcessed(
      this,
      'S3ResourcesProcessed',
      {
        removalPolicy: props.removalPolicy,
      },
    );

    const glueResources = new GlueResources(this, 'GlueResources', {
      processedCdrsBucket: s3ResourcesProcessed.processedCdrs,
      projectionYearMax: props.projectionYearMax,
      projectionYearMin: props.projectionYearMin,
    });

    const kinesisResources = new KinesisResources(this, 'KinesisResources', {
      cdrDatabaseName: glueResources.cdrDatabase,
      processedCdrsBucket: s3ResourcesProcessed.processedCdrs,
      processedCdrsTable: glueResources.processedCdrsTable,
      voiceConnectorId: props.voiceConnectorId,
      bufferHintSize: Number(props.bufferHintSize),
      bufferHintInterval: Number(props.bufferHintInterval),
    });

    new LambdaResources(this, 'LambdaResources', {
      logLevel: props.logLevel,
      voiceConnectorId: props.voiceConnectorId,
      fileCount: props.fileCount,
      rawCdrsBucket: rawCdrsBucket,
      kinesisStream: kinesisResources.kinesisStream,
    });
  }
}

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

const stackProps = {
  logLevel: process.env.LOG_LEVEL || 'INFO',
  removalPolicy: process.env.REMOVAL_POLICY || 'DESTROY',
  rawCdrsBucketName: process.env.RAW_CDRS_BUCKET || '',
  voiceConnectorId:
    process.env.VOICE_CONNECTOR_ID ||
    Array(12)
      .fill(null)
      .map(() => Math.random().toString(36)[2])
      .join(''),
  fileCount: process.env.FILE_COUNT || '10',
  projectionYearMin: process.env.PROJECTION_YEAR_MIN || '2023',
  projectionYearMax: process.env.PROJECTION_YEAR_MAX || '2026',
  bufferHintSize: process.env.BUFFER_HINT_SIZE || '128',
  bufferHintInterval: process.env.BUFFER_HINT_INTERVAL || '300',
};

new AmazonChimeSdkVoiceConnectorCdrs(
  app,
  'amazon-chime-sdk-voice-connector-cdr-processor',
  {
    ...stackProps,
    env: devEnv,
  },
);

app.synth();
