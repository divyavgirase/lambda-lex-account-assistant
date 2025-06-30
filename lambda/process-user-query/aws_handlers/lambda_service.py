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
    functions_list = ',\n'.join(function_names)
    return f"Here are your Lambda functions:\n{functions_list}\nIn region {region}"

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
        'FunctionName': config['FunctionName'],
        'Runtime': config['Runtime'],
        'Handler': config['Handler'],
        'Role': config['Role'],
        'Timeout': config['Timeout'],
        'MemorySize': config['MemorySize'],
        'State': config.get('State'),
        'LastModified': config['LastModified'],
        'LogGroup': config.get('LoggingConfig', {}).get('LogGroup'),
    }

    return json.dumps(summary, indent=2, default=str)

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
    pretty_policy = json.dumps(json.loads(policy), indent=2) if policy else "{}"
    return f"FunctionName: {function_name}\nPolicy:\n{pretty_policy}"