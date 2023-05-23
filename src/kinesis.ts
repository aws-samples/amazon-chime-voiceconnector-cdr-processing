/* eslint-disable import/no-extraneous-dependencies */
import { Database } from '@aws-cdk/aws-glue-alpha';
import { RemovalPolicy, Stack } from 'aws-cdk-lib';
import { CfnTable } from 'aws-cdk-lib/aws-glue';
import { Role, ServicePrincipal, PolicyDocument, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { CfnDeliveryStream } from 'aws-cdk-lib/aws-kinesisfirehose';
import { LogGroup, LogStream, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

interface GlueResourcesProps {
  processedCdrsBucket: Bucket;
  cdrDatabaseName: Database;
  processedCdrsTable: CfnTable;
  bufferHintInterval: number;
  bufferHintSize: number;
}
export class KinesisResources extends Construct {
  public kinesisStream: CfnDeliveryStream;
  constructor(scope: Construct, id: string, props: GlueResourcesProps) {
    super(scope, id);

    const firehoseRole = new Role(this, 'FirehoseRole', {
      assumedBy: new ServicePrincipal('firehose.amazonaws.com'),
      inlinePolicies: {
        ['gluePolicy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: ['glue:GetTableVersions'],
              resources: [
                props.cdrDatabaseName.catalogArn,
                props.cdrDatabaseName.databaseArn,
                `arn:aws:glue:${Stack.of(this).region}:${
                  Stack.of(this).account
                }:table/${props.cdrDatabaseName.databaseName}/*`,
              ],
            }),
          ],
        }),
      },
    });

    props.processedCdrsBucket.grantWrite(firehoseRole);

    const firehoseLogGroup = new LogGroup(this, 'FirehoseLogGroup', {
      logGroupName: '/aws/firehose/processCdrs',
      retention: RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    new LogStream(this, 'FirehoseLogStream', {
      logGroup: firehoseLogGroup,
      logStreamName: 'processCdrs',
    });

    this.kinesisStream = new CfnDeliveryStream(
      this,
      'cdrProcessDeliveryStream',
      {
        deliveryStreamType: 'DirectPut',
        extendedS3DestinationConfiguration: {
          bucketArn: props.processedCdrsBucket.bucketArn,
          roleArn: firehoseRole.roleArn,
          prefix:
            'Amazon-Chime-Voice-Connector-CDRs/year=!{partitionKeyFromQuery:year}/month=!{partitionKeyFromQuery:month}/day=!{partitionKeyFromQuery:day}/',
          errorOutputPrefix:
            'Amazon-Chime-Voice-Connector-CDRs/error/!{firehose:error-output-type}',
          bufferingHints: {
            intervalInSeconds: props.bufferHintInterval,
            sizeInMBs: props.bufferHintSize,
          },
          cloudWatchLoggingOptions: {
            enabled: true,
            logGroupName: firehoseLogGroup.logGroupName,
            logStreamName: 'processCdrs',
          },
          dataFormatConversionConfiguration: {
            enabled: true,
            inputFormatConfiguration: {
              deserializer: {
                openXJsonSerDe: {},
              },
            },
            outputFormatConfiguration: {
              serializer: {
                parquetSerDe: {},
              },
            },
            schemaConfiguration: {
              databaseName: props.cdrDatabaseName.databaseName,
              tableName: props.processedCdrsTable.ref,
              region: Stack.of(this).region,
              versionId: 'LATEST',
              roleArn: firehoseRole.roleArn,
            },
          },
          dynamicPartitioningConfiguration: {
            enabled: true,
          },
          processingConfiguration: {
            enabled: true,
            processors: [
              {
                type: 'MetadataExtraction',
                parameters: [
                  {
                    parameterName: 'MetadataExtractionQuery',
                    parameterValue:
                      '{year: .EndTimeEpochSeconds| strftime("%Y"), ' +
                      'month: .EndTimeEpochSeconds| strftime("%m"), ' +
                      'day: .EndTimeEpochSeconds| strftime("%d")}',
                  },
                  {
                    parameterName: 'JsonParsingEngine',
                    parameterValue: 'JQ-1.6',
                  },
                ],
              },
            ],
          },
          s3BackupMode: 'Disabled',
        },
      },
    );
  }
}
