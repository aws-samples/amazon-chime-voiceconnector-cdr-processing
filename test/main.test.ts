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
  fileCount: process.env.FILE_COUNT || '10',
  projectionYearMin: process.env.PROJECTION_YEAR_MIN || '2023',
  projectionYearMax: process.env.PROJECTION_YEAR_MAX || '2026',
  bufferHintSize: process.env.BUFFER_HINT_SIZE || '128',
  bufferHintInterval: process.env.BUFFER_HINT_INTERVAL || '300',
  athenaQuery: process.env.ATHENA_QUERY || 'SELECT voiceconnectorId, SUM(billabledurationseconds) as billabledurationseconds, SUM(billabledurationminutes) as billabledurationminutes FROM %s.%s WHERE year = YEAR(CURRENT_DATE) AND month = MONTH(CURRENT_DATE) - 1 group by voiceconnectorid;',
  cronSetting: process.env.CRON || 'cron(0 0 1 * ? *)',
  email: process.env.EMAIL || '',
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

test('Invalid LOG_LEVEL', () => {
  expect(() => {
    const app = new App();
    new AmazonChimeSdkVoiceConnectorCdrs(app, 'InvalidLogLevel', {
      ...stackProps,
      env: devEnv,
      logLevel: 'INVALID',
    });
  }).toThrow('LOG_LEVEL must be ERROR, WARN, DEBUG, or INFO');
});

test('Valid LOG_LEVEL', () => {
  expect(() => {
    const app = new App();
    new AmazonChimeSdkVoiceConnectorCdrs(app, 'ValidLogLevel', {
      ...stackProps,
      env: devEnv,
      logLevel: 'DEBUG',
    });
  }).not.toThrow();
});

test('Invalid REMOVAL_POLICY', () => {
  expect(() => {
    const app = new App();
    new AmazonChimeSdkVoiceConnectorCdrs(app, 'InvalidRemovalPolicy', {
      ...stackProps,
      env: devEnv,
      removalPolicy: 'INVALID',
    });
  }).toThrow('REMOVAL_POLICY must be DESTROY, SNAPSHOT, or RETAIN');
});

test('Invalid PROJECTION_YEAR_MIN', () => {
  expect(() => {
    const app = new App();
    new AmazonChimeSdkVoiceConnectorCdrs(app, 'InvalidProjectionYearMin', {
      ...stackProps,
      env: devEnv,
      projectionYearMin: 'INVALID',
    });
  }).toThrow('Invalid year format, please provide a valid 4-digit year');
});

test('Invalid BUFFER_HINT_SIZE', () => {
  expect(() => {
    const app = new App();
    new AmazonChimeSdkVoiceConnectorCdrs(app, 'InvalidBufferHintSize', {
      ...stackProps,
      env: devEnv,
      bufferHintSize: 'INVALID',
    });
  }).toThrow('Invalid bufferHintSize format, please provide a valid number');
});

test('Valid Bucket Name', () => {
  expect(() => {
    const app = new App();
    new AmazonChimeSdkVoiceConnectorCdrs(app, 'ValidBucketName', {
      ...stackProps,
      rawCdrsBucketName: 'valid-bucket-name',
    });
  }).not.toThrow();
});

// Test case to cover line 20 (another valid log level)
test('Valid LOG_LEVEL Info', () => {
  expect(() => {
    const app = new App();
    new AmazonChimeSdkVoiceConnectorCdrs(app, 'ValidLogLevelInfo', {
      ...stackProps,
      env: devEnv,
      logLevel: 'INFO',
    });
  }).not.toThrow();
});

// Test case to cover invalid region
test('Invalid Region', () => {
  expect(() => {
    const app = new App();
    new AmazonChimeSdkVoiceConnectorCdrs(app, 'InvalidRegion', {
      ...stackProps,
      env: { ...devEnv, region: 'invalid-region' },
    });
  }).toThrow(
    'Stack region must be one of: us-east-1, us-west-2, ca-central-1, eu-west-1, eu-central-1, eu-west-2, ap-southeast-1, ap-northeast-1, ap-southeast-2, ap-northeast-2',
  );
});

// Test case to cover invalid removal policy
test('Invalid RemovalPolicy', () => {
  expect(() => {
    const app = new App();
    new AmazonChimeSdkVoiceConnectorCdrs(app, 'InvalidRemovalPolicy', {
      ...stackProps,
      env: devEnv,
      removalPolicy: 'INVALID',
    });
  }).toThrow('REMOVAL_POLICY must be DESTROY, SNAPSHOT, or RETAIN');
});

// Test case to cover invalid projection year min and max ranges
test('Invalid PROJECTION_YEAR_MIN Range', () => {
  const currentYear = new Date().getFullYear();
  expect(() => {
    const app = new App();
    new AmazonChimeSdkVoiceConnectorCdrs(app, 'InvalidProjectionYearMinRange', {
      ...stackProps,
      env: devEnv,
      projectionYearMin: (currentYear - 11).toString(),
    });
  }).toThrow(`Year must be within 10 years of ${currentYear}`);
});

test('Invalid PROJECTION_YEAR_MAX Range', () => {
  const currentYear = new Date().getFullYear();
  expect(() => {
    const app = new App();
    new AmazonChimeSdkVoiceConnectorCdrs(app, 'InvalidProjectionYearMaxRange', {
      ...stackProps,
      env: devEnv,
      projectionYearMax: (currentYear + 11).toString(),
    });
  }).toThrow(`Year must be within 10 years of ${currentYear}`);
});

// Test case to cover invalid buffer hint size range
test('Invalid BUFFER_HINT_SIZE Range', () => {
  expect(() => {
    const app = new App();
    new AmazonChimeSdkVoiceConnectorCdrs(app, 'InvalidBufferHintSizeRange', {
      ...stackProps,
      env: devEnv,
      bufferHintSize: '63',
    });
  }).toThrow('bufferHintSize must be between 64 and 128');
});

// Test case to cover invalid buffer hint interval range
test('Invalid BUFFER_HINT_INTERVAL Range', () => {
  expect(() => {
    const app = new App();
    new AmazonChimeSdkVoiceConnectorCdrs(
      app,
      'InvalidBufferHintIntervalRange',
      {
        ...stackProps,
        env: devEnv,
        bufferHintInterval: '59',
      },
    );
  }).toThrow('bufferHintInterval must be between 60 and 900');
});

// Test case to cover line 65 (another valid removal policy)
test('Valid RemovalPolicy Snapshot', () => {
  expect(() => {
    const app = new App();
    new AmazonChimeSdkVoiceConnectorCdrs(app, 'ValidRemovalPolicySnapshot', {
      ...stackProps,
      env: devEnv,
      removalPolicy: 'SNAPSHOT',
    });
  }).not.toThrow();
});

// Test case to cover line 91 (another valid log level)
test('Valid LOG_LEVEL Debug', () => {
  expect(() => {
    const app = new App();
    new AmazonChimeSdkVoiceConnectorCdrs(app, 'ValidLogLevelDebug', {
      ...stackProps,
      env: devEnv,
      logLevel: 'DEBUG',
    });
  }).not.toThrow();
});

test('Invalid PROJECTION_YEAR_MAX', () => {
  expect(() => {
    const app = new App();
    new AmazonChimeSdkVoiceConnectorCdrs(app, 'InvalidProjectionYearMax', {
      ...stackProps,
      env: devEnv,
      projectionYearMax: 'INVALID',
    });
  }).toThrow('Invalid year format, please provide a valid 4-digit year');
});

test('Valid PROJECTION_YEAR_MAX', () => {
  expect(() => {
    const app = new App();
    new AmazonChimeSdkVoiceConnectorCdrs(app, 'ValidProjectionYearMax', {
      ...stackProps,
      env: devEnv,
      projectionYearMax: '2025',
    });
  }).not.toThrow();
});

test('Invalid BUFFER_HINT_INTERVAL', () => {
  expect(() => {
    const app = new App();
    new AmazonChimeSdkVoiceConnectorCdrs(app, 'InvalidBufferHintInterval', {
      ...stackProps,
      env: devEnv,
      bufferHintInterval: 'INVALID',
    });
  }).toThrow(
    'Invalid bufferHintInterval format, please provide a valid number',
  );
});

test('Valid BUFFER_HINT_INTERVAL', () => {
  expect(() => {
    const app = new App();
    new AmazonChimeSdkVoiceConnectorCdrs(app, 'ValidBufferHintInterval', {
      ...stackProps,
      env: devEnv,
      bufferHintInterval: '300',
    });
  }).not.toThrow();
});
