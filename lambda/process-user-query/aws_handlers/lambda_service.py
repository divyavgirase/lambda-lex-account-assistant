import boto3
import json
from botocore.exceptions import ClientError

def get_lambda_client(region):
    """Create and return Lambda client for specified region"""
    return boto3.client('lambda', region_name=region)

def handle_lambda_errors(func):
    """Decorator to handle common Lambda API errors"""
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except ClientError as e:
            return f"Sorry, I couldn't complete the Lambda operation. Reason: {str(e)}"
        except Exception as e:
            return "An error occurred when performing Lambda operation"
    return wrapper

def validate_function_name(function_name):
    """Validate that function name is provided"""
    if not function_name:
        return "Missing Lambda function name. Please resend your request with resource name"
    return None

@handle_lambda_errors
def count_lambda_functions(request):
    region = request.get('region', 'us-east-1')
    client = get_lambda_client(region)
    result = client.list_functions()
    count = len(result.get('Functions', []))
    return f"You have {count} Lambda function{'s' if count != 1 else ''} in region {region}"

@handle_lambda_errors
def list_lambda_functions(request):
    region = request.get('region', 'us-east-1')
    client = get_lambda_client(region)
    functions = []
    result = client.list_functions()
    function_names = [f['FunctionName'] for f in result.get('Functions', [])]
    if not function_names:
        return f"You have no Lambda functions in the region {region}"
    return f"Here are your Lambda functions: {', '.join(function_names)} in region {region}"

@handle_lambda_errors
def invoke_lambda_function(request):
    region = request.get('region', 'us-east-1')    
    function_name = request.get('resource')
    payload = request.get('payload', {})
    error = validate_function_name(function_name)
    if error:
        return error
    client = get_lambda_client(region)
    result = client.invoke(
        FunctionName=function_name,
        InvocationType='RequestResponse',
        Payload=json.dumps(payload)
    )
    return json.dumps({
        "status_code": result['StatusCode'],
        "response": result['Payload'].read().decode('utf-8')
    })

@handle_lambda_errors
def get_lambda_configuration(request):
    region = request.get('region', 'us-east-1')
    function_name = request.get('resource')
    error = validate_function_name(function_name)
    if error:
        return error
    client = get_lambda_client(region)
    config = client.get_function_configuration(FunctionName=function_name)
    summary = {
        'FunctionName': config.get('FunctionName'),
        'FunctionArn': config.get('FunctionArn'),
        'Runtime': config.get('Runtime'),
        'Handler': config.get('Handler'),
        'CodeSize': config.get('CodeSize'),
        'MemorySize': config.get('MemorySize'),
        'Timeout': config.get('Timeout'),
        'LastModified': config.get('LastModified'),
        'State': config.get('State'),
        'Description': config.get('Description'),
    }
    return json.dumps(summary, default=str)

@handle_lambda_errors
def get_lambda_policy(request):
    region = request.get('region', 'us-east-1')
    function_name = request.get('resource')
    error = validate_function_name(function_name)
    if error:
        return error
    client = get_lambda_client(region)
    params = {'FunctionName': function_name}
    response = client.get_policy(**params)
    policy = response.get('Policy')
    return json.dumps({
        "FunctionName": function_name,
        "Qualifier": qualifier,
        "Policy": json.loads(policy) if policy else {},
        "RevisionId": revision
    }, default=str)