/* eslint-disable import/no-extraneous-dependencies */
import { Topic, Subscription, SubscriptionProtocol } from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';


interface SnsResourcesProps {
  email: string;
}

export class SnsResources extends Construct {
  public emailSubscription: Subscription;
  public topic: Topic;

  constructor(scope: Construct, id: string, props: SnsResourcesProps) {
    super(scope, id);

    // Create an SNS topic
    this.topic = new Topic(this, 'CDRReport');

    // Subscribe an email address to the topic
    this.emailSubscription = new Subscription(this, 'EmailSubscription', {
      protocol: SubscriptionProtocol.EMAIL,
      endpoint: props.email,
      topic: this.topic,
    });
  }
}