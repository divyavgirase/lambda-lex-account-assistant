import boto3
from botocore.exceptions import ClientError

def get_rds_client(region):
    """Returns an RDS client for the specified region."""
    return boto3.client('rds', region_name=region)

def handle_rds_errors(func):
    """Decorator to handle common RDS API errors."""
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except ClientError as e:
            return f"Sorry, I couldn't complete the RDS operation. Reason: {str(e)}"
        except Exception as e:
            return f"An error occurred: {str(e)}"
    return wrapper

def validate_instance_identifier(instance_identifier):
    """Validate that the DBInstanceIdentifier is provided."""
    if not instance_identifier:
        return "Missing RDS instance identifier. Please resend the request with resource name."
    return None

@handle_rds_errors
def count_rds_instances(request):
    """Count the number of RDS instances in the specified region."""
    region = request.get('region', 'us-east-1')
    client = get_rds_client(region)
    result = client.describe_db_instances()
    count = len(result.get('DBInstances', []))
    return f"You have {count} RDS instance{'s' if count != 1 else ''} in region {region}"

@handle_rds_errors
def list_rds_instances(request):
    """List all RDS instances in the specified region."""
    region = request.get('region', 'us-east-1')
    client = get_rds_client(region)
    result = client.describe_db_instances()
    instances = result.get('DBInstances', [])
    if not instances:
        return f"You have no RDS instances in the region {region}."
    instance_names = [inst['DBInstanceIdentifier'] for inst in instances]
    return f"Here are your RDS instances: {', '.join(instance_names)} in region {region}"

@handle_rds_errors
def describe_rds_instance(request):
    """Describe a specific RDS instance."""
    region = request.get('region', 'us-east-1')
    instance_identifier = request.get('resource')
    error = validate_instance_identifier(instance_identifier)
    if error:
        return error
    client = get_rds_client(region)
    result = client.describe_db_instances(DBInstanceIdentifier=instance_identifier)
    instance = result['DBInstances'][0]
    details = {
        'DBInstanceIdentifier': instance['DBInstanceIdentifier'],
        'Engine': instance['Engine'],
        'DBInstanceClass': instance['DBInstanceClass'],
        'AllocatedStorage': instance['AllocatedStorage'],
        'DBInstanceStatus': instance['DBInstanceStatus'],
        'Endpoint': instance.get('Endpoint', {}).get('Address', 'N/A'),
        'Port': instance.get('Endpoint', {}).get('Port', 'N/A')
    }
    return json.dumps(details, default=str)

@handle_rds_errors
def identify_stopped_instances(request):
    """Identify RDS instances that are in 'stopped' state."""
    region = request.get('region', 'us-east-1')
    client = get_rds_client(region)
    result = client.describe_db_instances()
    stopped_instances = [
        inst['DBInstanceIdentifier'] for inst in result.get('DBInstances', [])
        if inst['DBInstanceStatus'] == 'stopped'
    ]
    if not stopped_instances:
        return f"No stopped RDS instances found in region {region}."
    return f"Stopped RDS instances: {', '.join(stopped_instances)} in region {region}"
