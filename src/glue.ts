/* eslint-disable import/no-extraneous-dependencies */
import { Database } from '@aws-cdk/aws-glue-alpha';
import { Stack } from 'aws-cdk-lib';
import { CfnTable } from 'aws-cdk-lib/aws-glue';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

interface GlueResourcesProps {
  processedCdrsBucket: Bucket;
}
export class GlueResources extends Construct {
  public cdrDatabase: Database;
  public processedCdrsTable: CfnTable;

  constructor(scope: Construct, id: string, props: GlueResourcesProps) {
    super(scope, id);

    this.cdrDatabase = new Database(this, 'AmazonChimeSdkVoiceConnectorCdrs', {
      databaseName: 'amazon_chime_sdk_voice_connector_cdrs',
    });

    const glueSchema: CfnTable.ColumnProperty[] = [
      { name: 'AwsAccountId', type: 'string' },
      { name: 'TransactionId', type: 'string' },
      { name: 'CallId', type: 'string' },
      { name: 'VoiceConnectorId', type: 'string' },
      { name: 'Status', type: 'string' },
      { name: 'StatusMessage', type: 'string' },
      { name: 'BillableDurationSeconds', type: 'int' },
      { name: 'BillableDurationMinutes', type: 'float' },
      { name: 'SchemaVersion', type: 'string' },
      { name: 'SourcePhoneNumber', type: 'string' },
      { name: 'SourceCountry', type: 'string' },
      { name: 'DestinationPhoneNumber', type: 'string' },
      { name: 'DestinationCountry', type: 'string' },
      { name: 'UsageType', type: 'string' },
      { name: 'ServiceCode', type: 'string' },
      { name: 'Direction', type: 'string' },
      { name: 'StartTimeEpochSeconds', type: 'bigint' },
      { name: 'EndTimeEpochSeconds', type: 'bigint' },
      { name: 'Region', type: 'string' },
      { name: 'Streaming', type: 'boolean' },
      { name: 'IsProxyCall', type: 'boolean' },
    ];

    const partitionKeys: CfnTable.ColumnProperty[] = [
      // { name: 'voiceconnector', type: 'string' },
      {
        name: 'year',
        type: 'int',
      },
      {
        name: 'month',
        type: 'int',
      },
      {
        name: 'day',
        type: 'int',
      },
    ];

    this.processedCdrsTable = new CfnTable(this, 'processedCdrsTable', {
      catalogId: Stack.of(this).account,
      databaseName: this.cdrDatabase.databaseName,
      tableInput: {
        name: 'processed_cdrs',
        tableType: 'EXTERNAL_TABLE',
        owner: 'hadoop',
        storageDescriptor: {
          columns: glueSchema,
          location: `s3://${props.processedCdrsBucket.bucketName}/Amazon-Chime-Voice-Connector-CDRs/`,
          inputFormat:
            'org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat',
          outputFormat:
            'org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat',
          serdeInfo: {
            serializationLibrary:
              'org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe',
            parameters: {
              'serialization.format': '1',
            },
          },
        },
        partitionKeys: partitionKeys,
        parameters: {
          'EXTERNAL': 'TRUE',
          'parquet.compression': 'SNAPPY',
          'projection.year.type': 'integer',
          'projection.year.range': '2023,2026',
          'projection.month.type': 'integer',
          'projection.month.range': '1,12',
          'projection.day.type': 'integer',
          'projection.day.range': '1,31',
          'projection.day.digits': '2',
          'projection.enabled': 'true',
          // 'projection.voiceconnector.type': 'injected',
          'has_encrypted_data': 'false',
          'transient_lastDdlTime': Math.floor(Date.now() / 1000).toString(),
        },
      },
    });
  }
}
