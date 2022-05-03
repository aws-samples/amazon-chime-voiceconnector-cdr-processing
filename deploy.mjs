import { ChimeClient, GetGlobalSettingsCommand } from '@aws-sdk/client-chime';
import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';
import inquirer from 'inquirer';
import * as fs from 'fs';

const chime = new ChimeClient({ region: 'us-east-1' });
const s3 = new S3Client({ region: 'us-east-1' });

async function getCdrBucket() {
  try {
    const {
      VoiceConnector: { CdrBucket },
    } = await chime.send(new GetGlobalSettingsCommand());
    return CdrBucket;
  } catch (error) {
    console.log(
      'Error.  A CDR bucket must be defined for Amazon Chime Voice Connector: ',
      error,
    );
  }
}

async function listS3Buckets() {
  try {
    const { Buckets } = await s3.send(new ListBucketsCommand({}));
    let bucketList = Buckets.map((item) => item.Name);
    return bucketList;
  } catch (error) {
    console.log(error);
  }
}

async function addAdditionalBucket() {
  const answers = await inquirer.prompt({
    type: 'confirm',
    name: 'addBucket',
    message: `Would you like to add an additional CDR bucket with full Crawl/ETL?`,
    default: false,
  });
  if (answers.addBucket) {
    return true;
  } else {
    return false;
  }
}

async function crawlFullBucket() {
  const answers = await inquirer.prompt({
    type: 'confirm',
    name: 'crawlFull',
    message: `Would you like to fully crawl the bucket during deployment`,
    default: false,
  });
  if (answers.crawlFull) {
    return true;
  } else {
    return false;
  }
}

async function selectBucket() {
  const s3Buckets = await listS3Buckets();
  const bucketSelected = await inquirer.prompt({
    type: 'list',
    loop: false,
    name: 'bucketName',
    message: 'Additional bucket with CDRs: ',
    choices: s3Buckets,
  });
  return bucketSelected;
}

async function getWorkers(crawlerType, defaultWorkers) {
  const workersUsed = await inquirer.prompt({
    type: 'input',
    name: 'workers',
    default: defaultWorkers,
    message: `How many workers to deploy for ${crawlerType} Crawler: `,
    validate(value) {
      const valid =
        value > 0 && value <= 250 && Number.isInteger(parseFloat(value));
      return valid || 'Please enter a whole number between 1 and 250';
    },
  });
  return workersUsed;
}

async function main() {
  console.log('Creating Amazon Chime Voice Connector CDK Deployment');
  const cdrBucket = await getCdrBucket();
  console.log(`The CDR Bucket that will be used is: ${cdrBucket}`);
  console.log('If this is not correct, please exit and reconfigure.');

  const dailyWorkers = await getWorkers('daily', 10);
  const fullWorkers = await getWorkers('full', 100);

  const additionalBucket = await addAdditionalBucket();
  let additionalBucketName = {};

  if (additionalBucket) {
    additionalBucketName = await selectBucket();
  }

  const crawlFull = await crawlFullBucket();
  var jsonContext = {
    cdrBucketName: cdrBucket,
    additionalBucketName: additionalBucketName.bucketName || '',
    dailyWorkers: dailyWorkers.workers.toString(),
    fullWorkers: fullWorkers.workers.toString(),
    crawlFull: crawlFull,
  };
  try {
    fs.writeFileSync('cdk.context.json', JSON.stringify(jsonContext), 'utf8');
  } catch (err) {
    console.log(err);
  }
}

await main();
