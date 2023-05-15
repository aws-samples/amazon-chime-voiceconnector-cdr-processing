import { RemovalPolicy } from 'aws-cdk-lib';
import { Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

interface S3ResourcesProps {
  removalPolicy: string;
}
export class S3ResourcesRaw extends Construct {
  public rawCdrs: Bucket;

  constructor(scope: Construct, id: string, props: S3ResourcesProps) {
    super(scope, id);

    let removalPolicy: RemovalPolicy;
    let autoDelete: boolean = false;
    // istanbul ignore next
    switch (props.removalPolicy.toLowerCase()) {
      case 'retain':
        removalPolicy = RemovalPolicy.RETAIN;
        break;
      case 'destroy':
        removalPolicy = RemovalPolicy.DESTROY;
        autoDelete = true;
        break;
      case 'snapshot':
        removalPolicy = RemovalPolicy.SNAPSHOT;
        break;
      default:
        removalPolicy = RemovalPolicy.DESTROY;
    }

    this.rawCdrs = new Bucket(this, 'rawCdrs', {
      publicReadAccess: false,
      removalPolicy: removalPolicy,
      autoDeleteObjects: autoDelete,
      encryption: BucketEncryption.S3_MANAGED,
      eventBridgeEnabled: true,
    });
  }
}

export class S3ResourcesProcessed extends Construct {
  public processedCdrs: Bucket;

  constructor(scope: Construct, id: string, props: S3ResourcesProps) {
    super(scope, id);

    let removalPolicy: RemovalPolicy;
    let autoDelete: boolean = false;
    // istanbul ignore next
    switch (props.removalPolicy.toLowerCase()) {
      case 'retain':
        removalPolicy = RemovalPolicy.RETAIN;
        break;
      case 'destroy':
        removalPolicy = RemovalPolicy.DESTROY;
        autoDelete = true;
        break;
      case 'snapshot':
        removalPolicy = RemovalPolicy.SNAPSHOT;
        break;
      default:
        removalPolicy = RemovalPolicy.DESTROY;
    }

    this.processedCdrs = new Bucket(this, 'processedCdrs', {
      publicReadAccess: false,
      removalPolicy: removalPolicy,
      autoDeleteObjects: autoDelete,
      encryption: BucketEncryption.S3_MANAGED,
      eventBridgeEnabled: true,
    });
  }
}
