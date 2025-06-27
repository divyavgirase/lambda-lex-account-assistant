import boto3
import json
from botocore.exceptions import ClientError

def get_ec2_client(region):
    """Create and return EC2 client for specified region."""
    return boto3.client('ec2', region_name=region)


def handle_ec2_errors(func):
    """Decorator to handle common EC2 API errors."""
    def wrapper(request):
        try:
            return func(request)
        except ClientError as e:
            return f"Sorry, I couldn't complete the EC2 operation. Reason: {str(e)}"
        except Exception as e:
            return f"An unexpected error occurred during EC2 operation: {e}"
    return wrapper

def validate_instance_id(instance_id):
    if not instance_id:
        return "Missing EC2 instance ID. Please include the resource ID."
    return None

@handle_ec2_errors
def count_ec2_instances(request):
    region = request.get('region', 'us-east-1')
    client = get_ec2_client(region)
    resp = client.describe_instances()
    instances = [
        inst
        for res in resp.get('Reservations', [])
        for inst in res.get('Instances', [])
    ]
    count = len(instances)
    return f"You have {count} EC2 instance{'s' if count != 1 else ''} in region {region}"


@handle_ec2_errors
def list_ec2_instances(request):
    region = request.get('region', 'us-east-1')
    client = get_ec2_client(region)
    resp = client.describe_instances()
    instances = [
        inst
        for res in resp.get('Reservations', [])
        for inst in res.get('Instances', [])
    ]
    if not instances:
        return f"No EC2 instances found in region {region}."
    ids = [inst['InstanceId'] for inst in instances]
    return f"EC2 Instances in {region}: {', '.join(ids)}"

@handle_ec2_errors
def get_ec2_instance_details(request):
    region = request.get('region', 'us-east-1')
    instance_id = request.get('resource')
    error = validate_instance_id(instance_id)
    if error:
        return error
    client = get_ec2_client(region)
    resp = client.describe_instances(InstanceIds=[instance_id])
    reservations = resp.get('Reservations', [])
    if not reservations:
        return f"No EC2 instance found with ID {instance_id}"
    inst = reservations[0]['Instances'][0]
    tags = {t['Key']: t['Value'] for t in inst.get('Tags', [])}
    details = {
        'InstanceId': inst['InstanceId'],
        'InstanceType': inst['InstanceType'],
        'State': inst['State']['Name'],
        'LaunchTime': inst['LaunchTime'].isoformat(),
        'PrivateIp': inst.get('PrivateIpAddress'),
        'PublicIp': inst.get('PublicIpAddress'),
        'Name': tags.get('Name')
    }
    return json.dumps(details, default=str)

@handle_ec2_errors
def list_ec2_instances_by_state(request):
    region = request.get('region', 'us-east-1')
    state = request.get('state', 'running')  # e.g. 'running' or 'stopped'
    client = get_ec2_client(region)
    resp = client.describe_instances(
        Filters=[{'Name': 'instance-state-name', 'Values': [state]}]
    )  # :contentReference[oaicite:1]{index=1}
    instances = [
        inst
        for res in resp.get('Reservations', [])
        for inst in res.get('Instances', [])
    ]
    if not instances:
        return f"No EC2 instances found in state '{state}' in region {region}."
    ids = [inst['InstanceId'] for inst in instances]
    return f"Instances in '{state}' state: {', '.join(ids)} in {region}"