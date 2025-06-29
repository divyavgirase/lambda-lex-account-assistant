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
              { sampleValue:{value:'us-east-1'},    synonyms:[{value:'USE1'},{value:'N. Virginia'},{value:'Virginia'}]},
              { sampleValue:{value:'us-east-2'},    synonyms:[{value:'USE2'},{value:'Ohio'}]},
              { sampleValue:{value:'us-west-1'},    synonyms:[{value:'USW1'},{value:'N. California'},{value:'Northern California'}]},
              { sampleValue:{value:'us-west-2'},    synonyms:[{value:'USW2'},{value:'Oregon'}]},
              { sampleValue:{value:'ca-central-1'}, synonyms:[{value:'CAC1'},{value:'Canada Central'},{value:'Central Canada'}]},
              { sampleValue:{value:'ca-west-1'},    synonyms:[{value:'CAW1'},{value:'Canada West'},{value:'Calgary'}]},
              { sampleValue:{value:'sa-east-1'},    synonyms:[{value:'SAE1'},{value:'São Paulo'},{value:'Sao Paulo'}]},
              { sampleValue:{value:'eu-central-1'}, synonyms:[{value:'EUC1'},{value:'Frankfurt'}]},
              { sampleValue:{value:'eu-west-1'},    synonyms:[{value:'EUW1'},{value:'Ireland'}]},
              { sampleValue:{value:'eu-west-2'},    synonyms:[{value:'EUW2'},{value:'London'}]},
              { sampleValue:{value:'eu-west-3'},    synonyms:[{value:'EUW3'},{value:'Paris'}]},
              { sampleValue:{value:'eu-north-1'},   synonyms:[{value:'EUN1'},{value:'Stockholm'}]},
              { sampleValue:{value:'eu-central-2'}, synonyms:[{value:'EUC2'},{value:'Zurich'}]},
              { sampleValue:{value:'eu-south-1'},   synonyms:[{value:'EUS1'},{value:'Milan'}]},
              { sampleValue:{value:'eu-south-2'},   synonyms:[{value:'EUS2'},{value:'Spain'}]},
              { sampleValue:{value:'af-south-1'},   synonyms:[{value:'AFS1'},{value:'Cape Town'},{value:'South Africa'}]},
              { sampleValue:{value:'me-south-1'},   synonyms:[{value:'MES1'},{value:'Bahrain'},{value:'Middle East Bahrain'}]},
              { sampleValue:{value:'me-central-1'}, synonyms:[{value:'MEC1'},{value:'UAE'},{value:'Dubai'}]},
              { sampleValue:{value:'ap-east-1'},    synonyms:[{value:'APE1'},{value:'Hong Kong'},{value:'HK'}]},
              { sampleValue:{value:'ap-south-1'},   synonyms:[{value:'APS1'},{value:'Mumbai'},{value:'India'}]},
              { sampleValue:{value:'ap-south-2'},   synonyms:[{value:'APS2'},{value:'Hyderabad'}]},
              { sampleValue:{value:'ap-northeast-1'},synonyms:[{value:'APNE1'},{value:'Tokyo'},{value:'Japan'}]},
              { sampleValue:{value:'ap-northeast-2'},synonyms:[{value:'APNE2'},{value:'Seoul'},{value:'South Korea'}]},
              { sampleValue:{value:'ap-northeast-3'},synonyms:[{value:'APNE3'},{value:'Osaka'}]},
              { sampleValue:{value:'ap-southeast-1'},synonyms:[{value:'APSE1'},{value:'Singapore'},{value:'SG'}]},
              { sampleValue:{value:'ap-southeast-2'},synonyms:[{value:'APSE2'},{value:'Sydney'},{value:'Australia'}]},
              { sampleValue:{value:'ap-southeast-3'},synonyms:[{value:'APSE3'},{value:'Jakarta'}]},
              { sampleValue:{value:'ap-southeast-4'},synonyms:[{value:'APSE4'},{value:'Melbourne'}]},
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
                { utterance: 'Number of {Service}' },
                { utterance: 'How many {Service} are in {Region}' },
                { utterance: 'List my {Service}' },
                { utterance: 'Does {Service} exists' },
                { utterance: 'Where is {Service} in my account' },
                { utterance: 'List items in my {Service}' },
                { utterance: 'List running {Service} in {Region}' },
                { utterance: 'Show stopped {Service}' },
                { utterance: 'Invoke my {Service} in {Region}' },
                { utterance: 'Run {Service} in {Region}' },
                { utterance: 'Trigger a {Service} in {Region}' },
                { utterance: 'Describe my {Service} in {Region}' },
                { utterance: 'Get configuration for my {Service} in {Region}' },
                { utterance: 'Get details of {Service} in {Region}' },
                { utterance: 'Get resource policy of {Service} in {Region}' },
                { utterance: 'Get policy of {Service} in {Region}' },
                { utterance: 'What is the setup of {Service}' }
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
              intentClosingSetting: {
                closingResponse: {
                    messageGroupsList: [
                    {
                       message: {
                        plainTextMessage: {
                          value: "Sorry, I didn't understand that. Could you rephrase your question?",
                        }
                       }
                    }
                  ],
                allowInterrupt: true,
                }
              }
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