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
                            sampleUtterances: [
                                { utterance: 'How many {Service} do I have?' },
                                { utterance: 'List my {Service} in {Region}' },
                                { utterance: 'Check {Service} usage' },
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
    }
}
exports.LambdaLexAccountAssistantStack = LambdaLexAccountAssistantStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFtYmRhLWxleC1hY2NvdW50LWFzc2lzdGFudC1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImxhbWJkYS1sZXgtYWNjb3VudC1hc3Npc3RhbnQtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFFbkMsMkNBQTZCO0FBQzdCLCtEQUFpRDtBQUNqRCx5REFBMkM7QUFDM0MseURBQTJDO0FBRTNDLE1BQWEsOEJBQStCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDM0QsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4Qiw2Q0FBNkM7UUFDN0MsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLHdCQUF3QixFQUFFO1lBQzNFLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsT0FBTyxFQUFFLHNCQUFzQjtZQUMvQixJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsOEJBQThCLENBQUMsQ0FBQztTQUNsRixDQUFDLENBQUM7UUFFSCx1QkFBdUI7UUFDdkIsTUFBTSxVQUFVLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRTtZQUN6RCxTQUFTLEVBQUUsSUFBSSxHQUFHLENBQUMsZ0JBQWdCLENBQUMsbUJBQW1CLENBQUM7WUFDeEQsZUFBZSxFQUFFO2dCQUNmLEdBQUcsQ0FBQyxhQUFhLENBQUMsd0JBQXdCLENBQUMscUJBQXFCLENBQUMsRUFBRSxrREFBa0Q7YUFDdEg7U0FDRixDQUFDLENBQUM7UUFFSCwwQ0FBMEM7UUFDMUMsZ0JBQWdCLENBQUMsV0FBVyxDQUFDLFVB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QUNoRSxTQUFTLEVBQUUsS0FBSyxDQUFDLE9BQU87U0FDekIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBL0lELHdFQStJQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBsZXggZnJvbSAnYXdzLWNkay1saWIvYXdzLWxleCc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5cbmV4cG9ydCBjbGFzcyBMYW1iZGFMZXhBY2NvdW50QXNzaXN0YW50U3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyBMYW1iZGEgZnVuY3Rpb24gZm9yIHByb2Nlc3NpbmcgTGV4IHF1ZXJpZXNcbiAgICBjb25zdCBwcm9jZXNzVXNlclF1ZXJ5ID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnUHJvY2Vzc1VzZXJRdWVyeUxhbWJkYScsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzEzLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmxhbWJkYV9oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vbGFtYmRhL3Byb2Nlc3MtdXNlci1xdWVyeScpKSxcbiAgICB9KTtcblxuICAgIC8vIElBTSBSb2xlIGZvciBMZXggYm90XG4gICAgY29uc3QgbGV4Qm90Um9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnTGV4Qm90U2VydmljZVJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnbGV4LmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ0FtYXpvbkxleEZ1bGxBY2Nlc3MnKSwgLy8gVXBkYXRlIHRoaXMgYWZ0ZXIgY29tcGxldGlvbiB0byByZXN0cmljdCBhY2Nlc3NcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBBbGxvdyBMZXggdG8gaW52b2tlIHRoZSBMYW1iZGEgZnVuY3Rpb25cbiAgICBwcm9jZXNzVXNlclF1ZXJ5LmdyYW50SW52b2tlKGxleEJvdFJvbGUpO1xuXG4gICAgLy8gRGVmaW5lIHRoZSBMZXggYm90XG4gICAgY29uc3QgYm90ID0gbmV3IGxleC5DZm5Cb3QodGhpcywgJ0FXU0FjY291bnRJbnNpZ2h0c0JvdCcsIHtcbiAgICAgIG5hbWU6ICdBV1NBY2NvdW50SW5zaWdodHNCb3QnLFxuICAgICAgcm9sZUFybjogbGV4Qm90Um9sZS5yb2xlQXJuLFxuICAgICAgZGF0YVByaXZhY3k6IHtcbiAgICAgICBDaGlsZERpcmVjdGVkOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICBpZGxlU2Vzc2lvblR0bEluU2Vjb25kczogMzAwLFxuICAgICAgYXV0b0J1aWxkQm90TG9jYWxlczogdHJ1ZSxcbiAgICAgIGJvdExvY2FsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGxvY2FsZUlkOiAnZW5fVVMnLFxuICAgICAgICAgIG5sdUNvbmZpZGVuY2VUaHJlc2hvbGQ6IDAuNCxcbiAgICAgICAgICBzbG90VHlwZXM6IFt7XG4gICAgICAgICAgICBuYW1lOiAnQVdTU2VydmljZVR5cGUnLFxuICAgICAgICAgICAgdmFsdWVTZWxlY3Rpb25TZXR0aW5nOiB7IHJlc29sdXRpb25TdHJhdGVneTogJ1RPUF9SRVNPTFVUSU9OJyB9LFxuICAgICAgICAgICAgc2xvdFR5cGVWYWx1ZXM6IFtcbiAgICAgICAgICAgICAgeyBzYW1wbGVWYWx1ZTogeyB2YWx1ZTogJ0xhbWJkYScgfSB9LFxuICAgICAgICAgICAgICB7IHNhbXBsZVZhbHVlOiB7IHZhbHVlOiAnRUMyJyB9IH0sXG4gICAgICAgICAgICAgIHsgc2FtcGxlVmFsdWU6IHsgdmFsdWU6ICdTMycgfSB9LFxuICAgICAgICAgICAgICB7IHNhbXBsZVZhbHVlOiB7IHZhbHVlOiAnUkRTJyB9IH1cbiAgICAgICAgICBdXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnQVdTUmVnaW9uVHlwZScsXG4gICAgICAgICAgICBzbG90VHlwZVZhbHVlczogW1xuICAgICAgICAgICAgICB7IHNhbXBsZVZhbHVlOiB7IHZhbHVlOiAndXMtZWFzdC0xJyB9IH0sXG4gICAgICAgICAgICAgIHsgc2FtcGxlVmFsdWU6IHsgdmFsdWU6ICd1cy13ZXN0LTInIH0gfSxcbiAgICAgICAgICAgICAgeyBzYW1wbGVWYWx1ZTogeyB2YWx1ZTogJ2V1LXdlc3QtMScgfSB9LFxuICAgICAgICAgICAgICB7IHNhbXBsZVZhbHVlOiB7IHZhbHVlOiAnYXAtc291dGhlYXN0LTEnIH0gfSxcbiAgICAgICAgICAgICAgeyBzYW1wbGVWYWx1ZTogeyB2YWx1ZTogJ2FwLW5vcnRoZWFzdC0xJyB9IH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgdmFsdWVTZWxlY3Rpb25TZXR0aW5nOiB7XG4gICAgICAgICAgICAgIHJlc29sdXRpb25TdHJhdGVneTogJ1RPUF9SRVNPTFVUSU9OJ1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1dLFxuICAgICAgICAgIGludGVudHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgbmFtZTogJ0Fza0F3c0FjY291bnRJbnNpZ2h0JyxcbiAgICAgICAgICAgICAgZnVsZmlsbG1lbnRDb2RlSG9vazogeyBlbmFibGVkOiB0cnVlIH0sXG4gICAgICAgICAgICAgIHNhbXBsZVV0dGVyYW5jZXM6IFtcbiAgICAgICAgICAgICAgICB7IHV0dGVyYW5jZTogJ0hvdyBtYW55IHtTZXJ2aWNlfSBkbyBJIGhhdmU/JyB9LFxuICAgICAgICAgICAgICAgIHsgdXR0ZXJhbmNlOiAnTGlzdCBteSB7U2VydmljZX0gaW4ge1JlZ2lvbn0nIH0sXG4gICAgICAgICAgICAgICAgeyB1dHRlcmFuY2U6ICdDaGVjayB7U2VydmljZX0gdXNhZ2UnIH0sXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIHNsb3RzOiBbe1xuICAgICAgICAgICAgICAgIG5hbWU6ICdTZXJ2aWNlJyxcbiAgICAgICAgICAgICAgICBzbG90VHlwZU5hbWU6ICdBV1NTZXJ2aWNlVHlwZScsXG4gICAgICAgICAgICAgICAgdmFsdWVFbGljaXRhdGlvblNldHRpbmc6IHtcbiAgICAgICAgICAgICAgICAgIHNsb3RDb25zdHJhaW50OiAnUmVxdWlyZWQnLFxuICAgICAgICAgICAgICAgICAgcHJvbXB0U3BlY2lmaWNhdGlvbjoge1xuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlR3JvdXBzTGlzdDogW3sgbWVzc2FnZTogeyBwbGFpblRleHRNZXNzYWdlOiB7IHZhbHVlOiAnV2hpY2ggQVdTIHNlcnZpY2U/JyB9IH0gfV0sXG4gICAgICAgICAgICAgICAgICAgIG1heFJldHJpZXM6IDJcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnUmVnaW9uJyxcbiAgICAgICAgICAgICAgICBzbG90VHlwZU5hbWU6ICdBV1NSZWdpb25UeXBlJyxcbiAgICAgICAgICAgICAgICB2YWx1ZUVsaWNpdGF0aW9uU2V0dGluZzoge1xuICAgICAgICAgICAgICAgICAgc2xvdENvbnN0cmFpbnQ6ICdPcHRpb25hbCcsXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XSxcbiAgICAgICAgICAgICAgc2xvdFByaW9yaXRpZXM6IFtcbiAgICAgICAgICAgICAgICB7IHByaW9yaXR5OiAxLCBzbG90TmFtZTogJ1NlcnZpY2UnIH0sXG4gICAgICAgICAgICAgICAgeyBwcmlvcml0eTogMiwgc2xvdE5hbWU6ICdSZWdpb24nIH0sXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBuYW1lOiAnRmFsbGJhY2tJbnRlbnQnLFxuICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0RlZmF1bHQgZmFsbGJhY2sgaW50ZW50IGZvciB1bm1hdGNoZWQgdXR0ZXJhbmNlcycsXG4gICAgICAgICAgICAgIGZ1bGZpbGxtZW50Q29kZUhvb2s6IHtcbiAgICAgICAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBwYXJlbnRJbnRlbnRTaWduYXR1cmU6IFwiQU1BWk9OLkZhbGxiYWNrSW50ZW50XCIsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgY29uc3QgdGltZXN0YW1wID0gRGF0ZS5ub3coKS50b1N0cmluZygpO1xuXG4gICAgLy9MZXggQm90IFZlcnNpb25cbiAgICBjb25zdCBib3RWZXJzaW9uID0gbmV3IGxleC5DZm5Cb3RWZXJzaW9uKHRoaXMsIGBBV1NBY2NvdW50SW5zaWdodHNCb3RWZXJzaW9uLSR7dGltZXN0YW1wfWAsIHtcbiAgICAgIGJvdElkOiBib3QuYXR0cklkLFxuICAgICAgYm90VmVyc2lvbkxvY2FsZVNwZWNpZmljYXRpb246IFtcbiAgICAgICAge1xuICAgICAgICAgIGxvY2FsZUlkOiAnZW5fVVMnLFxuICAgICAgICAgIGJvdFZlcnNpb25Mb2NhbGVEZXRhaWxzOiB7XG4gICAgICAgICAgICBzb3VyY2VCb3RWZXJzaW9uOiAnRFJBRlQnLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gTGV4IEJvdCBBbGlhc1xuICAgIGNvbnN0IGFsaWFzID0gbmV3IGxleC5DZm5Cb3RBbGlhcyh0aGlzLCAnQVdTQWNjb3VudEluc2lnaHRzQm90QWxpYXMnLCB7XG4gICAgICBib3RJZDogYm90LmF0dHJJZCxcbiAgICAgIGJvdEFsaWFzTmFtZTogJ1Byb2QnLFxuICAgICAgYm90VmVyc2lvbjogYm90VmVyc2lvbi5hdHRyQm90VmVyc2lvbixcbiAgICAgIGJvdEFsaWFzTG9jYWxlU2V0dGluZ3M6IFt7XG4gICAgICAgIGxvY2FsZUlkOiAnZW5fVVMnLFxuICAgICAgICBib3RBbGlhc0xvY2FsZVNldHRpbmc6IHtcbiAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgIGNvZGVIb29rU3BlY2lmaWNhdGlvbjoge1xuICAgICAgICAgICAgbGFtYmRhQ29kZUhvb2s6IHtcbiAgICAgICAgICAgICAgY29kZUhvb2tJbnRlcmZhY2VWZXJzaW9uOiAnMS4wJyxcbiAgICAgICAgICAgICAgbGFtYmRhQXJuOiBwcm9jZXNzVXNlclF1ZXJ5LmZ1bmN0aW9uQXJuLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfV0sXG4gICAgfSk7XG5cbiAgICAvLyBBbGxvdyBMZXggdG8gaW52b2tlIExhbWJkYSB2aWEgYWxpYXNcbiAgICBwcm9jZXNzVXNlclF1ZXJ5LmFkZFBlcm1pc3Npb24oJ0FsbG93TGV4SW52b2tlJywge1xuICAgICAgcHJpbmNpcGFsOiBuZXcgY2RrLmF3c19pYW0uU2VydmljZVByaW5jaXBhbCgnbGV4LmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIHNvdXJjZUFybjogYWxpYXMuYXR0ckFyblxuICAgIH0pO1xuICB9XG59Il19