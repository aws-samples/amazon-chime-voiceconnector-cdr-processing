const { awscdk } = require('projen');
const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.21.1',
  license: 'MIT-0',
  author: 'Court Schuett',
  description:
    'Starter project for processing Amazon Chime Voice Connector CDRs',
  copyrightOwner: 'Amazon.com, Inc.',
  authorAddress: 'https://aws.amazon.com',
  defaultReleaseBranch: 'main',
  name: 'amazon-chime-voiceconnector-cdr-processing',
  appEntrypoint: 'chime-voiceconnector-cdr-processing.ts',
  depsUpgradeOptions: {
    ignoreProjen: false,
    workflowOptions: {
      labels: ['auto-approve', 'auto-merge'],
    },
  },
  autoApproveOptions: {
    secret: 'GITHUB_TOKEN',
    allowedUsernames: ['schuettc', 'cdklabs-automation'],
  },
  autoApproveUpgrades: true,
  eslintOptions: {
    ignorePatterns: ['*.mjs'],
  },
  devDeps: ['@aws-sdk/client-chime', '@aws-sdk/client-s3', 'inquirer'],
});
project.addTask('launch', {
  exec: 'yarn && yarn projen build && yarn cdk bootstrap && yarn cdk deploy',
});

project.addTask('configure', {
  exec: 'node deploy.mjs',
});

const common_exclude = [
  'cdk.out',
  'cdk.context.json',
  'yarn-error.log',
  'dependabot.yml',
  '.DS_Store',
];

project.gitignore.exclude(...common_exclude);

project.synth();
