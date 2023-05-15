import * as path from 'path';
import { NestedStack, NestedStackProps } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

interface GlueProps extends NestedStackProps {
  processedCDRBucket: s3.Bucket;
  glueScriptBucket: s3.Bucket;
  cdrBucket: s3.IBucket;
  additionalCdrBucket: s3.IBucket;
  dailyWorkers: string;
  fullWorkers: string;
}

export class Glue extends NestedStack {
  public readonly cdrDatabase: glue.CfnDatabase;
  public readonly dailyRawCdrCrawler: glue.CfnCrawler;
  public readonly fullRawCdrCrawler: glue.CfnCrawler;
  public readonly dailyProcessedCdrCrawler: glue.CfnCrawler;
  public readonly fullProcessedCdrCrawler: glue.CfnCrawler;
  public readonly cdrDailyETL: glue.CfnJob;
  public readonly cdrFullETL: glue.CfnJob;

  constructor(scope: Construct, id: string, props: GlueProps) {
    super(scope, id, props);

    const glueRole = new iam.Role(this, 'glueRole', {
      assumedBy: new iam.ServicePrincipal('glue.amazonaws.com'),
      inlinePolicies: {
        ['bucketAccess']: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              resources: [
                `${props.cdrBucket.bucketArn}/*`,
                `${props.cdrBucket.bucketArn}`,
                `${props.processedCDRBucket.bucketArn}/*`,
                `${props.processedCDRBucket.bucketArn}`,
                `${props.additionalCdrBucket.bucketArn}/*`,
                `${props.additionalCdrBucket.bucketArn}`,
                `${props.glueScriptBucket.bucketArn}/*`,
                `${props.glueScriptBucket.bucketArn}`,
              ],
              actions: ['*'],
            }),
          ],
        }),
        ['glueAccess']: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              resources: [
                `arn:aws:glue:${this.region}:${this.account}:catalog`,
                `arn:aws:glue:${this.region}:${this.account}:database`,
              ],
              actions: ['*'],
            }),
          ],
        }),
      },
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSGlueServiceRole',
        ),
      ],
    });

    this.cdrDatabase = new glue.CfnDatabase(this, 'cdrDatabase', {
      catalogId: cdk.Aws.ACCOUNT_ID,
      databaseInput: {
        name: 'cdrs_' + cdk.Names.uniqueId(this).toLowerCase().slice(-8),
      },
    });

    this.dailyRawCdrCrawler = new glue.CfnCrawler(this, 'dailyRawCdrCrawler', {
      role: glueRole.roleArn,
      name: 'dailyRawCdr_' + cdk.Names.uniqueId(this).toLowerCase().slice(-8),
      targets: {
        s3Targets: [
          {
            path:
              's3://' +
              props.cdrBucket.bucketName +
              '/Amazon-Chime-Voice-Connector-CDRs/',
          },
        ],
      },
      databaseName: this.cdrDatabase.ref,
      schemaChangePolicy: {
        deleteBehavior: 'LOG',
        updateBehavior: 'LOG',
      },
      recrawlPolicy: {
        recrawlBehavior: 'CRAWL_NEW_FOLDERS_ONLY',
      },
    });

    this.fullRawCdrCrawler = new glue.CfnCrawler(this, 'fullRawCdrCrawler', {
      role: glueRole.roleArn,
      name: 'fullRawCdr_' + cdk.Names.uniqueId(this).toLowerCase().slice(-8),
      targets: {
        s3Targets: [
          {
            path:
              's3://' +
              props.additionalCdrBucket.bucketName +
              '/Amazon-Chime-Voice-Connector-CDRs/',
          },
        ],
      },
      databaseName: this.cdrDatabase.ref,
      schemaChangePolicy: {
        deleteBehavior: 'LOG',
        updateBehavior: 'LOG',
      },
      recrawlPolicy: {
        recrawlBehavior: 'CRAWL_EVERYTHING',
      },
    });

    this.dailyProcessedCdrCrawler = new glue.CfnCrawler(
      this,
      'dailyProcessedCdrCrawler',
      {
        role: glueRole.roleArn,
        name:
          'dailyProcessedCdr_' +
          cdk.Names.uniqueId(this).toLowerCase().slice(-8),
        targets: {
          s3Targets: [
            {
              path:
                's3://' +
                props.processedCDRBucket.bucketName +
                '/processed_cdrs/',
            },
          ],
        },
        databaseName: this.cdrDatabase.ref,
        schemaChangePolicy: {
          deleteBehavior: 'LOG',
          updateBehavior: 'LOG',
        },
        recrawlPolicy: {
          recrawlBehavior: 'CRAWL_NEW_FOLDERS_ONLY',
        },
      },
    );

    this.fullProcessedCdrCrawler = new glue.CfnCrawler(
      this,
      'fullProcessedCdrCrawler',
      {
        role: glueRole.roleArn,
        name:
          'fullProcessedCdr_' +
          cdk.Names.uniqueId(this).toLowerCase().slice(-8),
        targets: {
          s3Targets: [
            {
              path:
                's3://' +
                props.additionalCdrBucket.bucketName +
                '/processed_cdrs/',
            },
          ],
        },
        databaseName: this.cdrDatabase.ref,
        schemaChangePolicy: {
          deleteBehavior: 'LOG',
          updateBehavior: 'LOG',
        },
        recrawlPolicy: {
          recrawlBehavior: 'CRAWL_EVERYTHING',
        },
      },
    );

    this.cdrDailyETL = new glue.CfnJob(this, 'cdrDailyETL', {
      role: glueRole.roleArn,
      name: 'cdrDailyETL' + cdk.Names.uniqueId(this).toLowerCase().slice(-8),
      glueVersion: '2.0',
      maxCapacity: Number(props.dailyWorkers),
      defaultArguments: {
        '--DEST_BUCKET': props.processedCDRBucket.bucketName,
      },
      command: {
        name: 'glueetl',
        pythonVersion: '3',
        scriptLocation:
          's3://' + props.glueScriptBucket.bucketName + '/cdrDailyETL.py',
      },
    });

    this.cdrFullETL = new glue.CfnJob(this, 'cdrFullETL', {
      role: glueRole.roleArn,
      name: 'cdrFullETL' + cdk.Names.uniqueId(this).toLowerCase().slice(-8),
      glueVersion: '2.0',
      maxCapacity: Number(props.fullWorkers),
      defaultArguments: {
        '--DEST_BUCKET': props.processedCDRBucket.bucketName,
      },
      command: {
        name: 'glueetl',
        pythonVersion: '3',
        scriptLocation:
          's3://' + props.glueScriptBucket.bucketName + '/cdrFullETL.py',
      },
    });

    if (this.node.tryGetContext('crawlFull')) {
      const initialGlueSetupRole = new iam.Role(this, 'initialGlueSetupRole', {
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        inlinePolicies: {
          ['bucketAccess']: new iam.PolicyDocument({
            statements: [
              new iam.PolicyStatement({
                resources: [
                  `${props.cdrBucket.bucketArn}/*`,
                  `${props.cdrBucket.bucketArn}`,
                  `${props.processedCDRBucket.bucketArn}/*`,
                  `${props.processedCDRBucket.bucketArn}`,
                  `${props.additionalCdrBucket.bucketArn}/*`,
                  `${props.additionalCdrBucket.bucketArn}`,
                  `${props.glueScriptBucket.bucketArn}/*`,
                  `${props.glueScriptBucket.bucketArn}`,
                ],
                actions: ['*'],
              }),
            ],
          }),
          ['glueAccess']: new iam.PolicyDocument({
            statements: [
              new iam.PolicyStatement({
                resources: [
                  `arn:aws:glue:${this.region}:${this.account}:crawler/${this.fullRawCdrCrawler.name}`,
                  `arn:aws:glue:${this.region}:${this.account}:crawler/${this.fullProcessedCdrCrawler.name}`,
                ],
                actions: ['glue:StartCrawler'],
              }),
            ],
          }),
        },
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName(
            'service-role/AWSLambdaBasicExecutionRole',
          ),
        ],
      });

      const initialGlueSetup = new lambda.Function(this, 'initialGlueSetup', {
        runtime: lambda.Runtime.PYTHON_3_9,
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../resources/glue-setup'),
        ),
        handler: 'runCrawlers.lambda_handler',
        architecture: lambda.Architecture.ARM_64,
        role: initialGlueSetupRole,
        timeout: cdk.Duration.minutes(1),
        environment: {
          RAW_CDR_CRAWLER: this.fullRawCdrCrawler.ref,
          PROCESSED_CDR_CRAWLER: this.fullProcessedCdrCrawler.ref,
        },
      });

      const glueCustomResourceProvider = new cr.Provider(
        this,
        'glueCustomResourceProvider',
        {
          onEventHandler: initialGlueSetup,
        },
      );

      new cdk.CustomResource(this, 'glueCustomResource', {
        serviceToken: glueCustomResourceProvider.serviceToken,
      });
    }
  }
}
