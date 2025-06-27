import boto3
import json
import ast
from aws_handlers import dispatcher

bedrock_runtime = boto3.client("bedrock-runtime")

def lambda_handler(event, context):
    print("Lex event:", event)
    invocation_source = event.get('invocationSource')
    if invocation_source == 'DialogCodeHook':
        return handle_slot_validation(event)
    
    elif invocation_source == 'FulfillmentCodeHook':
        return handle_fulfillment(event)

    else:
        return {
            "messages": [
                { "contentType": "PlainText", "content": "Unknown invocation source." }
            ],
            "sessionState": {
                "dialogAction": { "type": "Close" },
                "intent": event['sessionState']['intent']
            }
        }

def extract_query_with_bedrock(user_query):
    prompt = f"""Human: Extract AWS service query information from this text: "{user_query}"
    Return a JSON object with these fields:
    - service: The AWS service being queried (e.g. Lambda, EC2, S3, DynamoDB, RDS)
    - action: The action to perform (
        count, 
        list, 
        invoke, 
        describe, 
        resource_policy,
        list_by_state, 
        list_s3_object,
        exists,
        locate,
        unsupported)
    - resource: Specific resource name if mentioned (e.g. bucket name, function name)
    - filters: Any filters mentioned (status, name, type, instance_type, availability_zone)
    - region: Any region mentioned. Ensure to translate verbose region such as Ohio to region name us-east-2
    - limit: Any limit on results (number)
    - payload: Any data to be passed to the resource (for invoke actions)

    Only include fields that are relevent to the query.
    Make sure the 'action' to be in lowercase and matches any of the action examples provided.
    Return 'unsupported' when not able to classify the action.

    Assistant: """

    try:
        response = bedrock_runtime.invoke_model(
            modelId="anthropic.claude-v2",
            contentType="application/json",
            accept="application/json",
            body=json.dumps({
                "prompt": prompt,
                "max_tokens_to_sample": 500,
                "temperature": 0
            })
        )

        response_body = json.loads(response.get('body').read())
        completion = response_body.get('completion', '')

        json_start = completion.find('{')
        json_end = completion.rfind('}') + 1
        if json_start >= 0 and json_end > json_start:
            json_str = completion[json_start:json_end]
            return json.loads(json_str)
        return {}
    except Exception as e:
        return {}

def handle_fulfillment(event):
    slots = event['sessionState']['intent']['slots']
    user_query = event['sessionState']['sessionAttributes']['originalQuery']
    response = extract_query_with_bedrock(user_query)
    print("Response from bedrock: ", response)
    if response:
        action = response.get('action')
        service = response.get('service')
        if action == 'unsupported':
            return {
                "sessionState": {
                    "sessionAttributes": {},
                    "dialogAction": {
                        "type": "Close",
                        "fulfillmentState": "Fulfilled"
                    },
                    "intent": {
                        "name": event['sessionState']['intent']['name'],
                        "slots": slots,
                        "state": "Fulfilled"
                    }
                },
                "messages": [
                    {
                        "contentType": "PlainText",
                        "content": "Your request for {service} is not supported. Please contact support"
                    }
                ]
            }
        service_handler_response = dispatcher.dispatch_service_response(response)
        print(service_handler_response)
        return {
            "sessionState": {
                "sessionAttributes": {},
                "dialogAction": {
                    "type": "Close",
                    "fulfillmentState": "Fulfilled"
                },
                "intent": {
                    "name": event['sessionState']['intent']['name'],
                    "slots": slots,
                    "state": "Fulfilled"
                }
            },
            "messages": [
                {
                    "contentType": "PlainText",
                    "content": service_handler_response
                }
            ]
        }
    else:
        print("Unhandled error from bedrock")
        return {
            "sessionState": {
                "sessionAttributes": {},
                "dialogAction": {
                    "type": "Close",
                    "fulfillmentState": "Fulfilled"
                },
                "intent": {
                    "name": event['sessionState']['intent']['name'],
                    "slots": slots,
                    "state": "Fulfilled"
                }
            },
            "messages": [
                {
                    "contentType": "PlainText",
                    "content": "Your request cannot be handled at this time. Please contact support team."
                }
            ]
        }


def classify_service_with_bedrock(user_input):
    prompt = f"""Human: "{user_input}"
    What AWS service is the user referring to? Reply with the service name like EC2, S3, RDS, Lambda, etc.
    Assistant: """

    response = bedrock_runtime.invoke_model(
        modelId='anthropic.claude-v2',
        contentType='application/json',
        accept='application/json',
        body=json.dumps({
            "prompt": prompt,
            "max_tokens_to_sample": 20,
            "temperature": 0.0,
            "top_k": 3,
        })
    )

    output = json.loads(response['body'].read())
    text = output.get("completion", "").strip()
    return text.upper()    

def handle_slot_validation(event):
    regional_services = {'EC2', 'RDS', 'Lambda'}
    slots = event['sessionState']['intent']['slots']
    service_slot = get_slot_value(slots.get('Service'))
    region_slot = get_slot_value(slots.get('Region'))

    # This is to maintain user transcript from the previous communications
    user_query = event.get('inputTranscript', '')
    unique_transcript = set()
    # Fetch the messages if there are previous communications stored in session state
    if event['sessionState'] and event['sessionState']['sessionAttributes']:
        original_query = ast.literal_eval(event['sessionState']['sessionAttributes']['originalQuery'])
        if original_query:
            unique_transcript.update(original_query)
    # Append the current session transcript to previous session transcript
    unique_transcript.add(user_query)

    # If Amazon Lex resolved the AWS Service
    if service_slot:
        service_resolved = service_slot.get('resolvedValues', [])

    # If Amazon Lex has not resolved the AWS Service, invoke Bedrock
    if not service_slot or not service_resolved:
        interpreted_service = classify_service_with_bedrock(user_query)
        if interpreted_service:
            slots["Service"] = {
                "value": {
                    "originalValue": interpreted_service,
                    "interpretedValue": interpreted_service,
                    "resolvedValues": [interpreted_service]
                }
            }
            service_slot = slots["Service"]

    # Determine if the interpreted service is regional or non-regional
    interpreted_service = get_slot_value(slots.get('Service')).get('interpretedValue')
    needs_region = interpreted_service in regional_services

    # If region is required but not provided
    if needs_region and not region_slot:
        return {
            "sessionState": {
                "sessionAttributes": {
                    "originalQuery": json.dumps(list(unique_transcript))
                },
                "dialogAction": {
                    "type": "ElicitSlot",
                    "slotToElicit": "Region"
                },
                "intent": {
                    "name": event['sessionState']['intent']['name'],
                    "slots": slots,
                    "state": "InProgress"
                }
            },
            "messages": [
                {
                    "contentType": "PlainText",
                    "content": "Which region should I check for that service?"
                }
            ]
        }

    # Continue fulfillment after all needed info is present
    return {
        "sessionState": {
            "sessionAttributes": {
                "originalQuery": json.dumps(list(unique_transcript))
            },
            "dialogAction": {
                "type": "Delegate"
            },
            "intent": {
                "name": event['sessionState']['intent']['name'],
                "slots": slots,
                "state": "ReadyForFulfillment"
            }
        },
        "messages": []
    }

def get_slot_value(slot):
    if slot and isinstance(slot, dict):
        return slot.get('value', {})
    return None