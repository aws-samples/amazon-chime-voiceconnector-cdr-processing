import { NestedStack, NestedStackProps } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

interface BucketProps extends NestedStackProps {}

export class Buckets extends NestedStack {
  public readonly processedCDRBucket: s3.Bucket;
  public readonly resultsBucket: s3.Bucket;
  public readonly glueScriptBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: BucketProps) {
    super(scope, id, props);

    this.processedCDRBucket = new s3.Bucket(this, 'processedCDRbucket', {
      publicReadAccess: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    this.resultsBucket = new s3.Bucket(this, 'resultsBucket', {
      publicReadAccess: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    this.glueScriptBucket = new s3.Bucket(this, 'glueScripts', {
      publicReadAccess: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    new s3deploy.BucketDeployment(this, 'deployGlueScripts', {
      sources: [s3deploy.Source.asset('resources/glue-scripts')],
      destinationBucket: this.glueScriptBucket,
    });
  }
}
