import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lex from 'aws-cdk-lib/aws-lex';
import * as iam from 'aws-cdk-lib/aws-iam';

export class LambdaLexAccountAssistantStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Lambda function for processing Lex queries
    const processUserQuery = new lambda.Function(this, 'ProcessUserQueryLambda', {
      runtime: lambda.Runtime.PYTHON_3_13,
      handler: 'index.lambda_handler',
      timeout: cdk.Duration.seconds(300),
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/process-user-query')),
      environment: {
        'MODEL_ID': 'anthropic.claude-v2'
      }
    });
    // IAM Role for Lex bot
    const lexBotRole = new iam.Role(this, 'LexBotServiceRole', {
      assumedBy: new iam.ServicePrincipal('lex.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonLexFullAccess'), // Update this after completion to restrict access
      ],
    });

    // Allow Lex to invoke the Lambda function
    processUserQuery.grantInvoke(lexBotRole);

    // Define the Lex bot
    const bot = new lex.CfnBot(this, 'AWSAccountInsightsBot', {
      name: 'AWSAccountInsightsBot',
      roleArn: lexBotRole.roleArn,
      dataPrivacy: {
       ChildDirected: false,
      },
      idleSessionTtlInSeconds: 300,
      autoBuildBotLocales: true,
      botLocales: [
        {
          localeId: 'en_US',
          nluConfidenceThreshold: 0.4,
          slotTypes: [{
            name: 'AWSServiceType',
            valueSelectionSetting: { resolutionStrategy: 'TOP_RESOLUTION' },
            slotTypeValues: [
              { sampleValue: { value: 'Lambda' } },
              { sampleValue: { value: 'EC2' } },
              { sampleValue: { value: 'S3' } },
              { sampleValue: { value: 'RDS' } }
          ]
          },
          {
            name: 'AWSRegionType',
            slotTypeValues: [
              { sampleValue: { value: 'us-east-1' } },
              { sampleValue: { value: 'us-west-2' } },
              { sampleValue: { value: 'eu-west-1' } },
              { sampleValue: { value: 'ap-southeast-1' } },
              { sampleValue: { value: 'ap-northeast-1' } },
            ],
            valueSelectionSetting: {
              resolutionStrategy: 'TOP_RESOLUTION'
            }
          }],
          intents: [
            {
              name: 'AskAwsAccountInsight',
              fulfillmentCodeHook: { enabled: true },
              dialogCodeHook: { enabled: true },
              sampleUtterances: [
                { utterance: 'How many {Service} do I have?' },
                { utterance: 'Count my {Service} in {Region}' },
                { utterance: 'Number of {Service} functions' },
                { utterance: 'How many {Service} are in {Region}' },
                { utterance: 'List my {Service}' },
                { utterance: 'Show all {Service} in {Region}' },
                { utterance: 'Give me all {Service}' },
                { utterance: 'List all {Service} in {Region}' },
                { utterance: 'List running {Service} in {Region}' },
                { utterance: 'Show stopped {Service}' },
                { utterance: 'Which {Service} are running in {Region}' },
                { utterance: 'Stopped {Service} functions' },
                { utterance: 'Invoke my {Service} in {Region}' },
                { utterance: 'Run {Service} in {Region}' },
                { utterance: 'Trigger a {Service} in {Region}' },
                { utterance: 'Describe my {Service} in {Region}' },
                { utterance: 'Get details of {Service} in {Region}' },
                { utterance: 'What is my {Service} in {Region}' },
                { utterance: 'Does this {Service} exist?' },
                { utterance: 'Is my {Service} available?' },
                { utterance: 'Check {Service} in {Region}' },
                { utterance: 'Where is my {Service}?' },
                { utterance: 'Which region is my {Service} in?' },
                { utterance: 'Locate my {Service}' },
                { utterance: 'Get config for {Service} in {Region}' },
                { utterance: 'Show policy of {Service} in {Region}' },
                { utterance: 'What is the setup of {Service}?' }
              ],
              slots: [{
                name: 'Service',
                slotTypeName: 'AWSServiceType',
                valueElicitationSetting: {
                  slotConstraint: 'Required',
                  promptSpecification: {
                    messageGroupsList: [{ message: { plainTextMessage: { value: 'Which AWS service?' } } }],
                    maxRetries: 2
                  }
                }
              },
              {
                name: 'Region',
                slotTypeName: 'AWSRegionType',
                valueElicitationSetting: {
                  slotConstraint: 'Optional',
                }
              }],
              slotPriorities: [
                { priority: 1, slotName: 'Service' },
                { priority: 2, slotName: 'Region' },
              ],
            },
            {
              name: 'FallbackIntent',
              description: 'Default fallback intent for unmatched utterances',
              fulfillmentCodeHook: {
                enabled: true,
              },
              parentIntentSignature: "AMAZON.FallbackIntent",
            },
          ],
        },
      ],
    });

    const timestamp = Date.now().toString();

    //Lex Bot Version
    const botVersion = new lex.CfnBotVersion(this, `AWSAccountInsightsBotVersion-${timestamp}`, {
      botId: bot.attrId,
      botVersionLocaleSpecification: [
        {
          localeId: 'en_US',
          botVersionLocaleDetails: {
            sourceBotVersion: 'DRAFT',
          },
        },
      ],
    });

    // Lex Bot Alias
    const alias = new lex.CfnBotAlias(this, 'AWSAccountInsightsBotAlias', {
      botId: bot.attrId,
      botAliasName: 'Prod',
      botVersion: botVersion.attrBotVersion,
      botAliasLocaleSettings: [{
        localeId: 'en_US',
        botAliasLocaleSetting: {
          enabled: true,
          codeHookSpecification: {
            lambdaCodeHook: {
              codeHookInterfaceVersion: '1.0',
              lambdaArn: processUserQuery.functionArn,
            },
          },
        },
      }],
    });

    // Allow Lex to invoke Lambda via alias
    processUserQuery.addPermission('AllowLexInvoke', {
      principal: new cdk.aws_iam.ServicePrincipal('lex.amazonaws.com'),
      sourceArn: alias.attrArn
    });

    // IAM policy statement with fine-grained S3 permissions
    const s3Policy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:ListAllMyBuckets',
        's3:ListBucket',
        's3:ListObjectsV2',
        's3:GetBucketLocation',
        's3:HeadBucket'
      ],
      resources: [
        'arn:aws:s3:::*',           // For bucket-level actions
        'arn:aws:s3:::*/*'          // For object-level actions
      ],
    });
    processUserQuery.role?.addToPrincipalPolicy(s3Policy);

    // IAM policy statement with fine-grained Lambda permissions
    const lambdaPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'lambda:ListFunctions',
        'lambda:InvokeFunction',
        'lambda:GetFunctionConfiguration',
        'lambda:GetPolicy',
      ],
      resources: ['*'],  //Required to perform operations on all functions
    });
    processUserQuery.role?.addToPrincipalPolicy(lambdaPolicy);

    // IAM policy statement with fine-grained RDS permissions
    const rdsPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'rds:DescribeDBInstances'
      ],
      resources: ['*'],  
    });
    processUserQuery.role?.addToPrincipalPolicy(rdsPolicy);

    // IAM policy statement with fine-grained EC2 permissions
    const ec2Policy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ec2:DescribeInstances'
      ],
      resources: ['*'],  
    });
    processUserQuery.role?.addToPrincipalPolicy(ec2Policy);

    // IAM policy statement with fine-grained Bedrock permissions
    const bedrockPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel'
      ],
      resources: [`arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-v2`]
    });
    processUserQuery.role?.addToPrincipalPolicy(bedrockPolicy);
  }
}