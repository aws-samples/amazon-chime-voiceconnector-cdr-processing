/* eslint-disable import/no-extraneous-dependencies */
import { App, Stack, StackProps } from 'aws-cdk-lib';
import { IBucket, Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { config } from 'dotenv';
import {
  LambdaResources,
  GlueResources,
  S3ResourcesProcessed,
  S3QueryOutput,
  S3ResourcesRaw,
  KinesisResources,
} from './';
import { envValidator } from './envValidator';

config();

export interface AmazonChimeSdkVoiceConnectorCdrsProps extends StackProps {
  logLevel: string;
  removalPolicy: string;
  rawCdrsBucketName: string;
  fileCount: string;
  bufferHintSize: string;
  bufferHintInterval: string;
  projectionYearMin: string;
  projectionYearMax: string;
  cronSetting: string;
  athenaQuery: string;
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
      bufferHintSize: Number(props.bufferHintSize),
      bufferHintInterval: Number(props.bufferHintInterval),
    });

    const s3QueryOutput = new S3QueryOutput(
      this,
      'S3QueryOutput',
      {
        removalPolicy: props.removalPolicy,
      },
    );

    new LambdaResources(this, 'LambdaResources', {
      logLevel: props.logLevel,
      fileCount: props.fileCount,
      rawCdrsBucket: rawCdrsBucket,
      s3QueryOutput: s3QueryOutput.athenaQueryOutput,
      kinesisStream: kinesisResources.kinesisStream,
      cronSetting: props.cronSetting,
      athenaQuery: props.athenaQuery,
    });
  }
}

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

// istanbul ignore next
const stackProps = {
  logLevel: process.env.LOG_LEVEL || 'INFO',
  removalPolicy: process.env.REMOVAL_POLICY || 'DESTROY',
  rawCdrsBucketName: process.env.RAW_CDRS_BUCKET || '',
  fileCount: process.env.FILE_COUNT || '10',
  projectionYearMin: process.env.PROJECTION_YEAR_MIN || '2023',
  projectionYearMax: process.env.PROJECTION_YEAR_MAX || '2026',
  bufferHintSize: process.env.BUFFER_HINT_SIZE || '128',
  bufferHintInterval: process.env.BUFFER_HINT_INTERVAL || '300',
  athenaQuery: process.env.ATHENA_QUERY || 'SELECT voiceconnectorId, SUM(billabledurationseconds) as billabledurationseconds, SUM(billabledurationminutes) as billabledurationminutes FROM %s.%s WHERE year = YEAR(CURRENT_DATE) AND month = MONTH(CURRENT_DATE) - 1 group by voiceconnectorid;',
  cronSetting: process.env.CRON || 'cron(0 0 1 * ? *)',
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
