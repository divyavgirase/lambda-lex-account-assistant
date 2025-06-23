intent_name = None
slots = None
service_slot = None
region_slot = None
service_original = None
service_resolved = None

def lambda_handler(event, context):
    global intent_name, slots, service_slot, region_slot, service_original, service_resolved
    print("Lex event:", event)

    intent_name = event['sessionState']['intent']['name']
    slots = event['sessionState']['intent']['slots']

    service_slot = get_slot_value(slots.get('Service'))
    region_slot = get_slot_value(slots.get('Region'))

    service_original = service_slot.get('originalValue')
    service_resolved = service_slot.get('resolvedValues', [])

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
    - action: The action to perform (count, list, describe, status, size, invoke, metrics, logs, versions)
    - resource: Specific resource name if mentioned (e.g. bucket name, function name)
    - filters: Any filters mentioned (region, status, name, type, instance_type, availability_zone)
    - limit: Any limit on results (number)
    - payload: Any data to be passed to the resource (for invoke actions)

    Only include fields that are relevent to the query.

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

def handle_fulfillment(event):
    user_query = event['inputTranscript']
    response = extract_query_with_bedrock(user_query)
    print("Response from bedrock: ", response)
    return {
        "sessionState": {
            "dialogAction": {
                "type": "Close",
                "fulfillmentState": "Fulfilled"
            },
            "intent": {
                "name": intent_name,
                "slots": slots,
                "state": "Fulfilled"
            }
        },
        "messages": [
            {
                "contentType": "PlainText",
                "content": "This will be your response from bedrock"
            }
        ]
    }

def classify_service_with_bedrock(user_input):
    prompt = f"""
    User asked: "{user_input}"
    What AWS service is the user referring to? Reply with the service name like EC2, S3, RDS, Lambda, etc.
    """

    response = bedrock_runtime.invoke_model(
        modelId='anthropic.claude-v2',  # Or your preferred model
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
    
    # Optionally validate output
    # valid_services = {"S3", "EC2", "RDS", "Lambda"}
    # if text.upper() in valid_services:
    return text.upper()
    
    #return None        

def handle_slot_validation(event):
    # Service mentioned but not resolved by Lex
    if service_original and not service_resolved:
        interpreted_service = classify_service_with_bedrock(service_original)
        if interpreted_service:
            slots["Service"] = {
                "value": {
                    "originalValue": service_original,
                    "interpretedValue": interpreted_service,
                    "resolvedValues": [interpreted_service]
                }
            }

    # List of regional services
    regional_services = {'EC2', 'RDS', 'S3', 'Lambda'}

    # # If Service slot is missing or ambiguous, call Bedrock to clarify
    # if not service_slot:
    #     bedrock_response = invoke_bedrock_for_service_clarification(event['inputTranscript'])

    #     clarification_msg = bedrock_response or "Sorry, I didn't understand the service. Could you please specify?"


    # Determine if we need to ask for Region
    interpreted_service = get_slot_value(slots.get('Service')).get('interpretedValue')
    needs_region = service_slot in regional_services

    # If region is required but not provided
    if needs_region and not region_slot:
        return {
            "sessionState": {
                "dialogAction": {
                    "type": "ElicitSlot",
                    "slotToElicit": "Region"
                },
                "intent": {
                    "name": intent_name,
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

        # If service is non-regional and region is filled, optionally clear it
        # if not needs_region and region_slot:
        #     slots["Region"] = None  # Clear it to avoid confusion

    # Continue fulfillment after all needed info is present
    return {
        "sessionState": {
            "dialogAction": {
                "type": "Delegate"
            },
            "intent": {
                "name": intent_name,
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