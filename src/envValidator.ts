import { AmazonChimeSdkVoiceConnectorCdrsProps } from './amazon-chime-sdk-voice-connector-cdr-processor';

const currentYear = new Date().getFullYear();
const validRegions = [
  'us-east-1',
  'us-west-2',
  'ca-central-1',
  'eu-west-1',
  'eu-central-1',
  'eu-west-2',
  'ap-southeast-1',
  'ap-northeast-1',
  'ap-southeast-2',
  'ap-northeast-2',
];

export function envValidator(props: AmazonChimeSdkVoiceConnectorCdrsProps) {
  if (props.env && props.env.region) {
    if (!validRegions.includes(props.env.region)) {
      throw new Error(
        `Stack region must be one of: ${validRegions.join(', ')}`,
      );
    }
  }

  if (props.logLevel) {
    if (
      props.logLevel.toLowerCase() !== 'error' &&
      props.logLevel.toLowerCase() !== 'warn' &&
      props.logLevel.toLowerCase() !== 'debug' &&
      props.logLevel.toLowerCase() !== 'info'
    ) {
      throw new Error('LOG_LEVEL must be ERROR, WARN, DEBUG, or INFO');
    }
  }

  if (props.removalPolicy) {
    if (
      props.removalPolicy.toLowerCase() !== 'destroy' &&
      props.removalPolicy.toLowerCase() !== 'retain' &&
      props.removalPolicy.toLocaleLowerCase() !== 'snapshot'
    ) {
      throw new Error('REMOVAL_POLICY must be DESTROY, SNAPSHOT, or RETAIN');
    }
  }

  if (
    isNaN(parseInt(props.projectionYearMin)) ||
    props.projectionYearMin.length !== 4
  ) {
    throw new Error('Invalid year format, please provide a valid 4-digit year');
  }

  if (
    parseInt(props.projectionYearMin) < currentYear - 10 ||
    parseInt(props.projectionYearMin) > currentYear + 10
  ) {
    throw new Error(`Year must be within 10 years of ${currentYear}`);
  }

  if (
    isNaN(parseInt(props.projectionYearMax)) ||
    props.projectionYearMax.length !== 4
  ) {
    throw new Error('Invalid year format, please provide a valid 4-digit year');
  }

  if (
    parseInt(props.projectionYearMax) < currentYear - 10 ||
    parseInt(props.projectionYearMax) > currentYear + 10
  ) {
    throw new Error(`Year must be within 10 years of ${currentYear}`);
  }

  const bufferHintSizeString = props.bufferHintSize;
  const bufferHintSize = parseInt(bufferHintSizeString, 10);

  if (isNaN(bufferHintSize)) {
    throw new Error(
      'Invalid bufferHintSize format, please provide a valid number',
    );
  }

  if (bufferHintSize < 64 || bufferHintSize > 128) {
    throw new Error('bufferHintSize must be between 64 and 128');
  }
  const bufferHintIntervalString = props.bufferHintInterval;
  const bufferHintInterval = parseInt(bufferHintIntervalString, 10);

  if (isNaN(bufferHintInterval)) {
    throw new Error(
      'Invalid bufferHintInterval format, please provide a valid number',
    );
  }

  if (bufferHintInterval < 60 || bufferHintInterval > 900) {
    throw new Error('bufferHintInterval must be between 60 and 900');
  }

  return true;
}
