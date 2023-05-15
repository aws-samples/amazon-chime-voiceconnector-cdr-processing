import { App, Stack, StackProps } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { Buckets } from './bucket-setup';
import { DailyETL } from './dailyETL';
import { FullETL } from './fullETL';
import { Glue } from './glue-setup';
import { Lambdas } from './lambdas';
import { Report } from './monthlyReports';

export class CDRProcesing extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const cdrBucketName =
      this.node.tryGetContext('cdrBucketName') || 'invalidbucket';

    const cdrBucket = s3.Bucket.fromBucketName(
      this,
      'rawCDRBucket',
      cdrBucketName,
    );

    var additionalCdrBucket;
    if (this.node.tryGetContext('additionalBucketName')) {
      const additionalCdrBucketName = this.node.tryGetContext(
        'additionalBucketName',
      );
      additionalCdrBucket = s3.Bucket.fromBucketName(
        this,
        'additionalCdrBucket',
        additionalCdrBucketName,
      );
    } else {
      additionalCdrBucket = cdrBucket;
    }

    const dailyWorkers = this.node.tryGetContext('dailyWorkers');
    const fullWorkers = this.node.tryGetContext('fullWorkers');

    const bucketStack = new Buckets(this, 'buckets', {});

    const glueStack = new Glue(this, 'glue', {
      processedCDRBucket: bucketStack.processedCDRBucket,
      glueScriptBucket: bucketStack.glueScriptBucket,
      cdrBucket: cdrBucket,
      additionalCdrBucket: additionalCdrBucket,
      fullWorkers: fullWorkers,
      dailyWorkers: dailyWorkers,
    });

    const lambdas = new Lambdas(this, 'lambdas', {
      cdrBucket: cdrBucket,
      processedCDRBucket: bucketStack.processedCDRBucket,
      resultsBucket: bucketStack.resultsBucket,
      cdrDatabase: glueStack.cdrDatabase,
      dailyRawCdrCrawler: glueStack.dailyRawCdrCrawler,
      dailyProcessedCdrCrawler: glueStack.dailyProcessedCdrCrawler,
      cdrDailyETL: glueStack.cdrDailyETL,
      cdrFullETL: glueStack.cdrFullETL,
      fullProcessedCdrCrawler: glueStack.fullProcessedCdrCrawler,
      fullRawCdrCrawler: glueStack.fullRawCdrCrawler,
    });

    new DailyETL(this, 'dailyETL', {
      dailyRawCdrCrawler: glueStack.dailyRawCdrCrawler,
      dailyProcessedCdrCrawler: glueStack.dailyProcessedCdrCrawler,
      runRawCrawler: lambdas.runRawCrawler,
      checkRawCrawler: lambdas.checkRawCrawler,
      runETL: lambdas.runETL,
      checkETL: lambdas.checkETL,
      runProcessedCrawler: lambdas.runProcessedCrawler,
      checkProcessedCrawler: lambdas.checkProcessedCrawler,
      sendResults: lambdas.sendResults,
      cdrBucket: bucketStack.processedCDRBucket,
      cdrDailyETL: glueStack.cdrDailyETL,
    });

    new FullETL(this, 'fullETL', {
      fullProcessedCdrCrawler: glueStack.fullProcessedCdrCrawler,
      fullRawCdrCrawler: glueStack.fullRawCdrCrawler,
      runRawCrawler: lambdas.runRawCrawler,
      checkRawCrawler: lambdas.checkRawCrawler,
      runETL: lambdas.runETL,
      checkETL: lambdas.checkETL,
      runProcessedCrawler: lambdas.runProcessedCrawler,
      checkProcessedCrawler: lambdas.checkProcessedCrawler,
      sendResults: lambdas.sendResults,
      cdrBucket: bucketStack.processedCDRBucket,
      cdrFullETL: glueStack.cdrFullETL,
    });

    new Report(this, 'report', {
      processedCDRBucket: bucketStack.processedCDRBucket,
      cdrDatabase: glueStack.cdrDatabase,
      resultsBucket: bucketStack.resultsBucket,
      runQuery: lambdas.runQuery,
      checkQuery: lambdas.checkQuery,
      sendReport: lambdas.sendReport,
    });
  }
}

const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

new CDRProcesing(app, 'CDRProcesing', { env: devEnv });

app.synth();
