import boto3
from botocore.exceptions import ClientError

def count_ec2_instances(response):
    region = response.get("filters", {}).get("region", "us-east-1")
    ec2 = boto3.client("ec2", region_name=region)

    try:
        instances = ec2.describe_instances()
        count = sum(len(res["Instances"]) for res in instances["Reservations"])
        return f"You have {count} EC2 instance{'s' if count != 1 else ''} in the '{region}' region."
    except ClientError as e:
        return f"Sorry, I couldn't count EC2 instances in '{region}'. Reason: {str(e)}"

def list_ec2_instances(response):
    region = response.get("filters", {}).get("region", "us-east-1")
    ec2 = boto3.client("ec2", region_name=region)

    try:
        instances = ec2.describe_instances()
        names = []

        for res in instances["Reservations"]:
            for inst in res["Instances"]:
                name = next((tag["Value"] for tag in inst.get("Tags", []) if tag["Key"] == "Name"), inst["InstanceId"])
                names.append(name)

        if not names:
            return f"There are no EC2 instances running in the '{region}' region."
        return f"Your EC2 instances in '{region}' are: {', '.join(names)}"
    except ClientError as e:
        return f"Sorry, I couldn't list EC2 instances. Reason: {str(e)}"

def get_ec2_instance_status(response):
    instance_id = response.get("resource")
    region = response.get("filters", {}).get("region", "us-east-1")

    if not instance_id:
        return "Please provide a your query and the EC2 instance ID."

    ec2 = boto3.client("ec2", region_name=region)
    try:
        result = ec2.describe_instance_status(InstanceIds=[instance_id])
        statuses = result.get("InstanceStatuses", [])
        if not statuses:
            return f"No status found for EC2 instance '{instance_id}' — it might be stopped or terminated."
        state = statuses[0]["InstanceState"]["Name"]
        return f"The EC2 instance '{instance_id}' is currently '{state}' in the '{region}' region."
    except ClientError as e:
        return f"Sorry, I couldn't retrieve the status of EC2 instance '{instance_id}'. Reason: {str(e)}"

def instance_exists(response):
    instance_id = response.get("resource")
    region = response.get("filters", {}).get("region", "us-east-1")

    if not instance_id:
        return "Please provide a your query and the EC2 instance ID."

    ec2 = boto3.client("ec2", region_name=region)
    try:
        result = ec2.describe_instances(InstanceIds=[instance_id])
        instances = [i for r in result["Reservations"] for i in r["Instances"]]
        if instances:
            return f"The EC2 instance '{instance_id}' exists in the '{region}' region."
        return f"No EC2 instance found with ID '{instance_id}' in the '{region}' region."
    except ClientError:
        return f"The EC2 instance '{instance_id}' does not exist or you don't have access to it in '{region}'."

def describe_ec2_instances(response):
    instance_ids = None
    filters = None

    resource = response.get('resource')
    if resource:
        if isinstance(resource, list):
            instance_ids = resource
        else:
            # Assuming resource is a single instance ID string
            instance_ids = [resource]

    filters_dict = response.get('filters')
    if filters_dict:
        # Convert filters dict to AWS EC2 filters list format
        filters = [{'Name': k, 'Values': [v]} for k, v in filters_dict.items()]

    try:
        if instance_ids:
            response = ec2_client.describe_instances(InstanceIds=instance_ids)
        elif filters:
            response = ec2_client.describe_instances(Filters=filters)
        else:
            response = ec2_client.describe_instances()


        instances = []
        for reservation in response.get('Reservations', []):
            for instance in reservation.get('Instances', []):
                instance_id = instance.get('InstanceId')
                instance_type = instance.get('InstanceType')
                state = instance.get('State', {}).get('Name')
                launch_time = instance.get('LaunchTime')
                instances.append((instance_id, instance_type, state, launch_time))

        if not instances:
            return "No EC2 instances found for the specified criteria."


        message_lines = ["Here are the EC2 instances I found:"]
        for i_id, i_type, i_state, i_launch in instances:
            message_lines.append(f"- Instance ID: {i_id}, Type: {i_type}, State: {i_state}, Launched at: {i_launch}")

        return "\n".join(message_lines)

    except ClientError as e:
        return f"Failed to describe EC2 instances: {e.response['Error']['Message']}"
    except Exception as e:
        return f"An error occurred: {str(e)}"
