import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { CDRProcesing } from '../src/chime-voiceconnector-cdr-processing';

test('NoFullBucket', () => {
  const app = new App({
    context: {
      cdrBucketName: 'cdrbucketname',
    },
  });
  new CDRProcesing(app, 'NoFullBucket');
});

test('FullBucket', () => {
  const app = new App({
    context: {
      additionalBucketName: 'additionalbucketname',
      cdrBucketName: 'cdrbucketname',
    },
  });
  const stack = new CDRProcesing(app, 'FullBucket');

  const template = Template.fromStack(stack);
  expect(template.toJSON()).toMatchSnapshot();
});

test('CrawlFull', () => {
  const app = new App({
    context: { crawlFull: true, cdrBucketName: 'cdrbucketname' },
  });
  const stack = new CDRProcesing(app, 'CrawlFull');
  const template = Template.fromStack(stack);
  expect(template.toJSON()).toMatchSnapshot();
});
