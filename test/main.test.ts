/* eslint-disable import/no-extraneous-dependencies */
import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { config } from 'dotenv';
import { AmazonChimeSdkVoiceConnectorCdrs } from '../src/amazon-chime-sdk-voice-connector-cdr-processor';

config();

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
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'us-east-1',
};

test('Snapshot', () => {
  const app = new App();
  const stack = new AmazonChimeSdkVoiceConnectorCdrs(app, 'test', {
    ...stackProps,
    env: devEnv,
  });

  const template = Template.fromStack(stack);
  expect(template.toJSON()).toMatchSnapshot();
});
