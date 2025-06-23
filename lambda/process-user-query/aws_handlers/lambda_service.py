import boto3
import json

def list_lambda_functions(response):
    region = response.get('filters', {}).get('region')
    client = boto3.client('lambda', region_name=region)
    result = client.list_functions()
    return {"functions": [f['FunctionName'] for f in result.get('Functions', [])]}

def invoke_lambda_function(response):
    region = response.get('filters', {}).get('region')
    payload = response.get('payload', {})
    function_name = response.get('resource')

    if not function_name:
        return {"error": "Missing Lambda function name."}

    client = boto3.client('lambda', region_name=region)
    result = client.invoke(
        FunctionName=function_name,
        InvocationType='RequestResponse',
        Payload=json.dumps(payload)
    )
    return {
        "status_code": result['StatusCode'],
        "response": result['Payload'].read().decode('utf-8')
    }
