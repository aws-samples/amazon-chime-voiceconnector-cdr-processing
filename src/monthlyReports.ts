import { NestedStack, NestedStackProps, Duration } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { SfnStateMachine } from 'aws-cdk-lib/aws-events-targets';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';

interface StepFunctionProps extends NestedStackProps {
  resultsBucket: s3.Bucket;
  cdrDatabase: glue.CfnDatabase;
  processedCDRBucket: s3.Bucket;
  runQuery: lambda.Function;
  checkQuery: lambda.Function;
  sendReport: lambda.Function;
}

export class Report extends NestedStack {
  constructor(scope: Construct, id: string, props: StepFunctionProps) {
    super(scope, id, props);

    const runQueryStep = new tasks.LambdaInvoke(this, 'runQueryStep', {
      lambdaFunction: props.runQuery,
      outputPath: '$.Payload',
    });

    const queryWaitStep = new sfn.Wait(this, 'queryWaitStep', {
      time: sfn.WaitTime.duration(Duration.seconds(5)),
    });

    const checkQueryStep = new tasks.LambdaInvoke(this, 'checkQueryStep', {
      lambdaFunction: props.checkQuery,
      outputPath: '$.Payload',
    });

    const queryChoice = new sfn.Choice(this, 'queryChoice', {});

    const sendReportStep = new tasks.LambdaInvoke(this, 'sendReportStep', {
      lambdaFunction: props.sendReport,
      outputPath: '$.Payload',
    });

    const createReportRole = new iam.Role(this, 'createReportRole', {
      assumedBy: new iam.ServicePrincipal('states.amazonaws.com'),
      inlinePolicies: {
        processCDRs: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              resources: ['*'],
              actions: [
                'logs:CreateLogDelivery',
                'logs:GetLogDelivery',
                'logs:UpdateLogDelivery',
                'logs:DeleteLogDelivery',
                'logs:ListLogDeliveries',
                'logs:PutResourcePolicy',
                'logs:DescribeResourcePolicies',
                'logs:DescribeLogGroups',
              ],
            }),
          ],
        }),
      },
    });

    const definition = runQueryStep
      .next(queryWaitStep)
      .next(checkQueryStep)
      .next(
        queryChoice
          .when(
            sfn.Condition.booleanEquals('$.AthenaFailure', true),
            sendReportStep,
          )
          .when(
            sfn.Condition.booleanEquals('$.AthenaComplete', false),
            queryWaitStep,
          )
          .when(
            sfn.Condition.booleanEquals('$.AthenaComplete', true),
            sendReportStep,
          ),
      );

    const createReportMachine = new sfn.StateMachine(
      this,
      'createReportMachine',
      {
        definition: definition,
        timeout: cdk.Duration.hours(3),
        tracingEnabled: true,
        role: createReportRole,
        logs: {
          level: sfn.LogLevel.ALL,
          destination: new logs.LogGroup(this, 'createReportsLog', {
            logGroupName: '/aws/vendedlogs/states/' + this.stackName,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            retention: logs.RetentionDays.THREE_MONTHS,
          }),
        },
      },
    );

    new Rule(this, 'eventBridgeRule', {
      schedule: Schedule.expression('cron(0 12 2 * ? *)'),
      targets: [new SfnStateMachine(createReportMachine)],
    });
  }
}
