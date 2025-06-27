"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LambdaLexAccountAssistantStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const path = __importStar(require("path"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const lex = __importStar(require("aws-cdk-lib/aws-lex"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const aws_cdk_lib_1 = require("aws-cdk-lib");
class LambdaLexAccountAssistantStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Lambda function for processing Lex queries
        const processUserQuery = new lambda.Function(this, 'ProcessUserQueryLambda', {
            runtime: lambda.Runtime.PYTHON_3_13,
            handler: 'index.lambda_handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/process-user-query')),
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
                                { utterance: 'List my {Service} in {Region}' },
                                { utterance: 'Invoke my {Service} with name in {Region}' },
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
                'arn:aws:s3:::*', // For bucket-level actions
                'arn:aws:s3:::*/*' // For object-level actions
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
            resources: ['*'], //Required to perform operations on all functions
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
                'rds:DescribeInstances'
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
        new aws_cdk_lib_1.custom_resources.AwsCustomResource(this, 'LexSlackChannelCustomResource', {
            onCreate: {
                service: 'LexModelsV2',
                action: 'createBotChannel',
                parameters: {
                    botId: bot.ref,
                    botAliasId: alias.attrBotAliasId,
                    localeId: 'en_US',
                    channelName: 'SlackChannel',
                    channelType: 'Slack',
                    slack: {
                        clientId: "9108205891619.9100983847863",
                        clientSecret: "a58334cedf9b9d632360c27e17eb8f4d",
                        verificationToken: "4ZE8CcJrSvpjTgMqpRVlGzWY"
                    }
                },
                physicalResourceId: aws_cdk_lib_1.custom_resources.PhysicalResourceId.of('SlackChannelIntegration')
            },
            onDelete: {
                service: 'LexModelsV2',
                action: 'deleteBotChannel',
                parameters: {
                    botId: bot.ref,
                    botAliasId: alias.attrBotAliasId,
                    channelName: 'SlackChannel',
                }
            },
            policy: aws_cdk_lib_1.custom_resources.AwsCustomResourcePolicy.fromSdkCalls({
                resources: aws_cdk_lib_1.custom_resources.AwsCustomResourcePolicy.ANY_RESOURCE,
            }),
            installLatestAwsSdk: true
        });
    }
}
exports.LambdaLexAccountAssistantStack = LambdaLexAccountAssistantStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFtYmRhLWxleC1hY2NvdW50LWFzc2lzdGFudC1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImxhbWJkYS1sZXgtYWNjb3VudC1hc3Npc3RhbnQtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFFbkMsMkNBQTZCO0FBQzdCLCtEQUFpRDtBQUNqRCx5REFBMkM7QUFDM0MseURBQTJDO0FBQzNDLDZDQUErQztBQUUvQyxNQUFhLDhCQUErQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzNELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsNkNBQTZDO1FBQzdDLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSx3QkFBd0IsRUFBRTtZQUMzRSxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLE9BQU8sRUFBRSxzQkFBc0I7WUFDL0IsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLDhCQUE4QixDQUFDLENBQUM7U0FDbEYsQ0FBQyxDQUFDO1FBRUgsdUJBQXVCO1FBQ3ZCLE1BQU0sVUFBVSxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLEVBQUU7WUFDekQsU0FBUyxFQUFFLElBQUksR0FBRyxDQUFDLGdCQUFnQixDQUFDLG1CQUFtQixDQUFDO1lBQ3hELGVBQWUsRUFBRTtnQkFDZixHQUFHLENBQUMsYUFBYSxDQUFDLHdCQUF3QixDQUFDLHFCQUFxQixDQUFDLEVBQUUsa0RBQWtEO2FBQ3RIO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsMENBQTBDO1FBQzFDLGdCQUFnQixDQUFD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QUM5QztpQkFDRjtnQkFDRCxrQkFBa0IsRUFBRSw4QkFBZ0IsQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFLENBQUMseUJBQXlCLENBQUM7YUFDdEY7WUFDRCxRQUFRLEVBQUU7Z0JBQ1IsT0FBTyxFQUFFLGFBQWE7Z0JBQ3RCLE1BQU0sRUFBRSxrQkFBa0I7Z0JBQzFCLFVBQVUsRUFBRTtvQkFDVixLQUFLLEVBQUUsR0FBRyxDQUFDLEdBQUc7b0JBQ2QsVUFBVSxFQUFFLEtBQUssQ0FBQyxjQUFjO29CQUNoQyxXQUFXLEVBQUUsY0FBYztpQkFDNUI7YUFDRjtZQUNELE1BQU0sRUFBRSw4QkFBZ0IsQ0FBQyx1QkFBdUIsQ0FBQyxZQUFZLENBQUM7Z0JBQzVELFNBQVMsRUFBRSw4QkFBZ0IsQ0FBQyx1QkFBdUIsQ0FBQyxZQUFZO2FBQ2pFLENBQUM7WUFDRixtQkFBbUIsRUFBRSxJQUFJO1NBQzFCLENBQUMsQ0FBQTtJQUNKLENBQUM7Q0FDRjtBQTdPRCx3RUE2T0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgbGV4IGZyb20gJ2F3cy1jZGstbGliL2F3cy1sZXgnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0IHsgY3VzdG9tX3Jlc291cmNlcyB9IGZyb20gJ2F3cy1jZGstbGliJztcblxuZXhwb3J0IGNsYXNzIExhbWJkYUxleEFjY291bnRBc3Npc3RhbnRTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIExhbWJkYSBmdW5jdGlvbiBmb3IgcHJvY2Vzc2luZyBMZXggcXVlcmllc1xuICAgIGNvbnN0IHByb2Nlc3NVc2VyUXVlcnkgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdQcm9jZXNzVXNlclF1ZXJ5TGFtYmRhJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTMsXG4gICAgICBoYW5kbGVyOiAnaW5kZXgubGFtYmRhX2hhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi9sYW1iZGEvcHJvY2Vzcy11c2VyLXF1ZXJ5JykpLFxuICAgIH0pO1xuXG4gICAgLy8gSUFNIFJvbGUgZm9yIExleCBib3RcbiAgICBjb25zdCBsZXhCb3RSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdMZXhCb3RTZXJ2aWNlUm9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsZXguYW1hem9uYXdzLmNvbScpLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnQW1hem9uTGV4RnVsbEFjY2VzcycpLCAvLyBVcGRhdGUgdGhpcyBhZnRlciBjb21wbGV0aW9uIHRvIHJlc3RyaWN0IGFjY2Vzc1xuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIEFsbG93IExleCB0byBpbnZva2UgdGhlIExhbWJkYSBmdW5jdGlvblxuICAgIHByb2Nlc3NVc2VyUXVlcnkuZ3JhbnRJbnZva2UobGV4Qm90Um9sZSk7XG5cbiAgICAvLyBEZWZpbmUgdGhlIExleCBib3RcbiAgICBjb25zdCBib3QgPSBuZXcgbGV4LkNmbkJvdCh0aGlzLCAnQVdTQWNjb3VudEluc2lnaHRzQm90Jywge1xuICAgICAgbmFtZTogJ0FXU0FjY291bnRJbnNpZ2h0c0JvdCcsXG4gICAgICByb2xlQXJuOiBsZXhCb3RSb2xlLnJvbGVBcm4sXG4gICAgICBkYXRhUHJpdmFjeToge1xuICAgICAgIENoaWxkRGlyZWN0ZWQ6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIGlkbGVTZXNzaW9uVHRsSW5TZWNvbmRzOiAzMDAsXG4gICAgICBhdXRvQnVpbGRCb3RMb2NhbGVzOiB0cnVlLFxuICAgICAgYm90TG9jYWxlczogW1xuICAgICAgICB7XG4gICAgICAgICAgbG9jYWxlSWQ6ICdlbl9VUycsXG4gICAgICAgICAgbmx1Q29uZmlkZW5jZVRocmVzaG9sZDogMC40LFxuICAgICAgICAgIHNsb3RUeXBlczogW3tcbiAgICAgICAgICAgIG5hbWU6ICdBV1NTZXJ2aWNlVHlwZScsXG4gICAgICAgICAgICB2YWx1ZVNlbGVjdGlvblNldHRpbmc6IHsgcmVzb2x1dGlvblN0cmF0ZWd5OiAnVE9QX1JFU09MVVRJT04nIH0sXG4gICAgICAgICAgICBzbG90VHlwZVZhbHVlczogW1xuICAgICAgICAgICAgICB7IHNhbXBsZVZhbHVlOiB7IHZhbHVlOiAnTGFtYmRhJyB9IH0sXG4gICAgICAgICAgICAgIHsgc2FtcGxlVmFsdWU6IHsgdmFsdWU6ICdFQzInIH0gfSxcbiAgICAgICAgICAgICAgeyBzYW1wbGVWYWx1ZTogeyB2YWx1ZTogJ1MzJyB9IH0sXG4gICAgICAgICAgICAgIHsgc2FtcGxlVmFsdWU6IHsgdmFsdWU6ICdSRFMnIH0gfVxuICAgICAgICAgIF1cbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdBV1NSZWdpb25UeXBlJyxcbiAgICAgICAgICAgIHNsb3RUeXBlVmFsdWVzOiBbXG4gICAgICAgICAgICAgIHsgc2FtcGxlVmFsdWU6IHsgdmFsdWU6ICd1cy1lYXN0LTEnIH0gfSxcbiAgICAgICAgICAgICAgeyBzYW1wbGVWYWx1ZTogeyB2YWx1ZTogJ3VzLXdlc3QtMicgfSB9LFxuICAgICAgICAgICAgICB7IHNhbXBsZVZhbHVlOiB7IHZhbHVlOiAnZXUtd2VzdC0xJyB9IH0sXG4gICAgICAgICAgICAgIHsgc2FtcGxlVmFsdWU6IHsgdmFsdWU6ICdhcC1zb3V0aGVhc3QtMScgfSB9LFxuICAgICAgICAgICAgICB7IHNhbXBsZVZhbHVlOiB7IHZhbHVlOiAnYXAtbm9ydGhlYXN0LTEnIH0gfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB2YWx1ZVNlbGVjdGlvblNldHRpbmc6IHtcbiAgICAgICAgICAgICAgcmVzb2x1dGlvblN0cmF0ZWd5OiAnVE9QX1JFU09MVVRJT04nXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfV0sXG4gICAgICAgICAgaW50ZW50czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBuYW1lOiAnQXNrQXdzQWNjb3VudEluc2lnaHQnLFxuICAgICAgICAgICAgICBmdWxmaWxsbWVudENvZGVIb29rOiB7IGVuYWJsZWQ6IHRydWUgfSxcbiAgICAgICAgICAgICAgZGlhbG9nQ29kZUhvb2s6IHsgZW5hYmxlZDogdHJ1ZSB9LFxuICAgICAgICAgICAgICBzYW1wbGVVdHRlcmFuY2VzOiBbXG4gICAgICAgICAgICAgICAgeyB1dHRlcmFuY2U6ICdIb3cgbWFueSB7U2VydmljZX0gZG8gSSBoYXZlPycgfSxcbiAgICAgICAgICAgICAgICB7IHV0dGVyYW5jZTogJ0xpc3QgbXkge1NlcnZpY2V9IGluIHtSZWdpb259JyB9LFxuICAgICAgICAgICAgICAgIHsgdXR0ZXJhbmNlOiAnSW52b2tlIG15IHtTZXJ2aWNlfSB3aXRoIG5hbWUgaW4ge1JlZ2lvbn0nIH0sXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIHNsb3RzOiBbe1xuICAgICAgICAgICAgICAgIG5hbWU6ICdTZXJ2aWNlJyxcbiAgICAgICAgICAgICAgICBzbG90VHlwZU5hbWU6ICdBV1NTZXJ2aWNlVHlwZScsXG4gICAgICAgICAgICAgICAgdmFsdWVFbGljaXRhdGlvblNldHRpbmc6IHtcbiAgICAgICAgICAgICAgICAgIHNsb3RDb25zdHJhaW50OiAnUmVxdWlyZWQnLFxuICAgICAgICAgICAgICAgICAgcHJvbXB0U3BlY2lmaWNhdGlvbjoge1xuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlR3JvdXBzTGlzdDogW3sgbWVzc2FnZTogeyBwbGFpblRleHRNZXNzYWdlOiB7IHZhbHVlOiAnV2hpY2ggQVdTIHNlcnZpY2U/JyB9IH0gfV0sXG4gICAgICAgICAgICAgICAgICAgIG1heFJldHJpZXM6IDJcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnUmVnaW9uJyxcbiAgICAgICAgICAgICAgICBzbG90VHlwZU5hbWU6ICdBV1NSZWdpb25UeXBlJyxcbiAgICAgICAgICAgICAgICB2YWx1ZUVsaWNpdGF0aW9uU2V0dGluZzoge1xuICAgICAgICAgICAgICAgICAgc2xvdENvbnN0cmFpbnQ6ICdPcHRpb25hbCcsXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XSxcbiAgICAgICAgICAgICAgc2xvdFByaW9yaXRpZXM6IFtcbiAgICAgICAgICAgICAgICB7IHByaW9yaXR5OiAxLCBzbG90TmFtZTogJ1NlcnZpY2UnIH0sXG4gICAgICAgICAgICAgICAgeyBwcmlvcml0eTogMiwgc2xvdE5hbWU6ICdSZWdpb24nIH0sXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBuYW1lOiAnRmFsbGJhY2tJbnRlbnQnLFxuICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0RlZmF1bHQgZmFsbGJhY2sgaW50ZW50IGZvciB1bm1hdGNoZWQgdXR0ZXJhbmNlcycsXG4gICAgICAgICAgICAgIGZ1bGZpbGxtZW50Q29kZUhvb2s6IHtcbiAgICAgICAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBwYXJlbnRJbnRlbnRTaWduYXR1cmU6IFwiQU1BWk9OLkZhbGxiYWNrSW50ZW50XCIsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgY29uc3QgdGltZXN0YW1wID0gRGF0ZS5ub3coKS50b1N0cmluZygpO1xuXG4gICAgLy9MZXggQm90IFZlcnNpb25cbiAgICBjb25zdCBib3RWZXJzaW9uID0gbmV3IGxleC5DZm5Cb3RWZXJzaW9uKHRoaXMsIGBBV1NBY2NvdW50SW5zaWdodHNCb3RWZXJzaW9uLSR7dGltZXN0YW1wfWAsIHtcbiAgICAgIGJvdElkOiBib3QuYXR0cklkLFxuICAgICAgYm90VmVyc2lvbkxvY2FsZVNwZWNpZmljYXRpb246IFtcbiAgICAgICAge1xuICAgICAgICAgIGxvY2FsZUlkOiAnZW5fVVMnLFxuICAgICAgICAgIGJvdFZlcnNpb25Mb2NhbGVEZXRhaWxzOiB7XG4gICAgICAgICAgICBzb3VyY2VCb3RWZXJzaW9uOiAnRFJBRlQnLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gTGV4IEJvdCBBbGlhc1xuICAgIGNvbnN0IGFsaWFzID0gbmV3IGxleC5DZm5Cb3RBbGlhcyh0aGlzLCAnQVdTQWNjb3VudEluc2lnaHRzQm90QWxpYXMnLCB7XG4gICAgICBib3RJZDogYm90LmF0dHJJZCxcbiAgICAgIGJvdEFsaWFzTmFtZTogJ1Byb2QnLFxuICAgICAgYm90VmVyc2lvbjogYm90VmVyc2lvbi5hdHRyQm90VmVyc2lvbixcbiAgICAgIGJvdEFsaWFzTG9jYWxlU2V0dGluZ3M6IFt7XG4gICAgICAgIGxvY2FsZUlkOiAnZW5fVVMnLFxuICAgICAgICBib3RBbGlhc0xvY2FsZVNldHRpbmc6IHtcbiAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgIGNvZGVIb29rU3BlY2lmaWNhdGlvbjoge1xuICAgICAgICAgICAgbGFtYmRhQ29kZUhvb2s6IHtcbiAgICAgICAgICAgICAgY29kZUhvb2tJbnRlcmZhY2VWZXJzaW9uOiAnMS4wJyxcbiAgICAgICAgICAgICAgbGFtYmRhQXJuOiBwcm9jZXNzVXNlclF1ZXJ5LmZ1bmN0aW9uQXJuLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfV0sXG4gICAgfSk7XG5cbiAgICAvLyBBbGxvdyBMZXggdG8gaW52b2tlIExhbWJkYSB2aWEgYWxpYXNcbiAgICBwcm9jZXNzVXNlclF1ZXJ5LmFkZFBlcm1pc3Npb24oJ0FsbG93TGV4SW52b2tlJywge1xuICAgICAgcHJpbmNpcGFsOiBuZXcgY2RrLmF3c19pYW0uU2VydmljZVByaW5jaXBhbCgnbGV4LmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIHNvdXJjZUFybjogYWxpYXMuYXR0ckFyblxuICAgIH0pO1xuXG4gICAgLy8gSUFNIHBvbGljeSBzdGF0ZW1lbnQgd2l0aCBmaW5lLWdyYWluZWQgUzMgcGVybWlzc2lvbnNcbiAgICBjb25zdCBzM1BvbGljeSA9IG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ3MzOkxpc3RBbGxNeUJ1Y2tldHMnLFxuICAgICAgICAnczM6TGlzdEJ1Y2tldCcsXG4gICAgICAgICdzMzpMaXN0T2JqZWN0c1YyJyxcbiAgICAgICAgJ3MzOkdldEJ1Y2tldExvY2F0aW9uJyxcbiAgICAgICAgJ3MzOkhlYWRCdWNrZXQnXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICdhcm46YXdzOnMzOjo6KicsICAgICAgICAgICAvLyBGb3IgYnVja2V0LWxldmVsIGFjdGlvbnNcbiAgICAgICAgJ2Fybjphd3M6czM6OjoqLyonICAgICAgICAgIC8vIEZvciBvYmplY3QtbGV2ZWwgYWN0aW9uc1xuICAgICAgXSxcbiAgICB9KTtcbiAgICBwcm9jZXNzVXNlclF1ZXJ5LnJvbGU/LmFkZFRvUHJpbmNpcGFsUG9saWN5KHMzUG9saWN5KTtcblxuICAgIC8vIElBTSBwb2xpY3kgc3RhdGVtZW50IHdpdGggZmluZS1ncmFpbmVkIExhbWJkYSBwZXJtaXNzaW9uc1xuICAgIGNvbnN0IGxhbWJkYVBvbGljeSA9IG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2xhbWJkYTpMaXN0RnVuY3Rpb25zJyxcbiAgICAgICAgJ2xhbWJkYTpJbnZva2VGdW5jdGlvbicsXG4gICAgICAgICdsYW1iZGE6R2V0RnVuY3Rpb25Db25maWd1cmF0aW9uJyxcbiAgICAgICAgJ2xhbWJkYTpHZXRQb2xpY3knLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogWycqJ10sICAvL1JlcXVpcmVkIHRvIHBlcmZvcm0gb3BlcmF0aW9ucyBvbiBhbGwgZnVuY3Rpb25zXG4gICAgfSk7XG4gICAgcHJvY2Vzc1VzZXJRdWVyeS5yb2xlPy5hZGRUb1ByaW5jaXBhbFBvbGljeShsYW1iZGFQb2xpY3kpO1xuXG4gICAgLy8gSUFNIHBvbGljeSBzdGF0ZW1lbnQgd2l0aCBmaW5lLWdyYWluZWQgUkRTIHBlcm1pc3Npb25zXG4gICAgY29uc3QgcmRzUG9saWN5ID0gbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAncmRzOkRlc2NyaWJlREJJbnN0YW5jZXMnXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXSwgIFxuICAgIH0pO1xuICAgIHByb2Nlc3NVc2VyUXVlcnkucm9sZT8uYWRkVG9QcmluY2lwYWxQb2xpY3kocmRzUG9saWN5KTtcblxuICAgIC8vIElBTSBwb2xpY3kgc3RhdGVtZW50IHdpdGggZmluZS1ncmFpbmVkIEVDMiBwZXJtaXNzaW9uc1xuICAgIGNvbnN0IGVjMlBvbGljeSA9IG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ3JkczpEZXNjcmliZUluc3RhbmNlcydcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFsnKiddLCAgXG4gICAgfSk7XG4gICAgcHJvY2Vzc1VzZXJRdWVyeS5yb2xlPy5hZGRUb1ByaW5jaXBhbFBvbGljeShlYzJQb2xpY3kpO1xuXG4gICAgLy8gSUFNIHBvbGljeSBzdGF0ZW1lbnQgd2l0aCBmaW5lLWdyYWluZWQgQmVkcm9jayBwZXJtaXNzaW9uc1xuICAgIGNvbnN0IGJlZHJvY2tQb2xpY3kgPSBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdiZWRyb2NrOkludm9rZU1vZGVsJ1xuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogW2Bhcm46YXdzOmJlZHJvY2s6JHt0aGlzLnJlZ2lvbn06OmZvdW5kYXRpb24tbW9kZWwvYW50aHJvcGljLmNsYXVkZS12MmBdXG4gICAgfSk7XG4gICAgcHJvY2Vzc1VzZXJRdWVyeS5yb2xlPy5hZGRUb1ByaW5jaXBhbFBvbGljeShiZWRyb2NrUG9saWN5KTtcblxuICAgIG5ldyBjdXN0b21fcmVzb3VyY2VzLkF3c0N1c3RvbVJlc291cmNlKHRoaXMsICdMZXhTbGFja0NoYW5uZWxDdXN0b21SZXNvdXJjZScsIHtcbiAgICAgIG9uQ3JlYXRlOiB7XG4gICAgICAgIHNlcnZpY2U6ICdMZXhNb2RlbHNWMicsXG4gICAgICAgIGFjdGlvbjogJ2NyZWF0ZUJvdENoYW5uZWwnLFxuICAgICAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgYm90SWQ6IGJvdC5yZWYsXG4gICAgICAgICAgYm90QWxpYXNJZDogYWxpYXMuYXR0ckJvdEFsaWFzSWQsXG4gICAgICAgICAgbG9jYWxlSWQ6ICdlbl9VUycsXG4gICAgICAgICAgY2hhbm5lbE5hbWU6ICdTbGFja0NoYW5uZWwnLFxuICAgICAgICAgIGNoYW5uZWxUeXBlOiAnU2xhY2snLFxuICAgICAgICAgIHNsYWNrOiB7XG4gICAgICAgICAgICBjbGllbnRJZDogXCI5MTA4MjA1ODkxNjE5LjkxMDA5ODM4NDc4NjNcIixcbiAgICAgICAgICAgIGNsaWVudFNlY3JldDogXCJhNTgzMzRjZWRmOWI5ZDYzMjM2MGMyN2UxN2ViOGY0ZFwiLFxuICAgICAgICAgICAgdmVyaWZpY2F0aW9uVG9rZW46IFwiNFpFOENjSnJTdnBqVGdNcXBSVmxHeldZXCJcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHBoeXNpY2FsUmVzb3VyY2VJZDogY3VzdG9tX3Jlc291cmNlcy5QaHlzaWNhbFJlc291cmNlSWQub2YoJ1NsYWNrQ2hhbm5lbEludGVncmF0aW9uJylcbiAgICAgIH0sXG4gICAgICBvbkRlbGV0ZToge1xuICAgICAgICBzZXJ2aWNlOiAnTGV4TW9kZWxzVjInLFxuICAgICAgICBhY3Rpb246ICdkZWxldGVCb3RDaGFubmVsJyxcbiAgICAgICAgcGFyYW1ldGVyczoge1xuICAgICAgICAgIGJvdElkOiBib3QucmVmLFxuICAgICAgICAgIGJvdEFsaWFzSWQ6IGFsaWFzLmF0dHJCb3RBbGlhc0lkLFxuICAgICAgICAgIGNoYW5uZWxOYW1lOiAnU2xhY2tDaGFubmVsJyxcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIHBvbGljeTogY3VzdG9tX3Jlc291cmNlcy5Bd3NDdXN0b21SZXNvdXJjZVBvbGljeS5mcm9tU2RrQ2FsbHMoe1xuICAgICAgICByZXNvdXJjZXM6IGN1c3RvbV9yZXNvdXJjZXMuQXdzQ3VzdG9tUmVzb3VyY2VQb2xpY3kuQU5ZX1JFU09VUkNFLFxuICAgICAgfSksXG4gICAgICBpbnN0YWxsTGF0ZXN0QXdzU2RrOiB0cnVlXG4gICAgfSlcbiAgfVxufSJdfQ==