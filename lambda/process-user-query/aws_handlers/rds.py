import boto3
from botocore.exceptions import ClientError

def count_rds_instances(response):
    region = response.get("filters", {}).get("region", "us-east-1")
    rds = boto3.client('rds', region_name=region)
    try:
        instances = rds.describe_db_instances()
        count = len(instances.get("DBInstances", []))
        return f"You have {count} RDS instance{'s' if count != 1 else ''} in the '{region}' region."
    except ClientError as e:
        return f"Sorry, I couldn't count RDS instances in '{region}'. Reason: {str(e)}"

def list_rds_instances(response):
    region = response.get("filters", {}).get("region", "us-east-1")
    rds = boto3.client('rds', region_name=region)
    try:
        instances = rds.describe_db_instances()
        names = [db["DBInstanceIdentifier"] for db in instances.get("DBInstances", [])]
        if not names:
            return f"You don't have any RDS instances in the '{region}' region."
        return f"Your RDS instances in '{region}' are: {', '.join(names)}"
    except ClientError as e:
        return f"Sorry, I couldn't list RDS instances. Reason: {str(e)}"

def get_rds_instance_status(response):
    instance_id = response.get("resource")
    region = response.get("filters", {}).get("region", "us-east-1")

    if not instance_id:
        return "Please provide a your query and the RDS instance identifier."

    rds = boto3.client('rds', region_name=region)
    try:
        resp = rds.describe_db_instances(DBInstanceIdentifier=instance_id)
        db = resp["DBInstances"][0]
        status = db["DBInstanceStatus"]
        return f"The RDS instance '{instance_id}' is currently in '{status}' status in the '{region}' region."
    except ClientError as e:
        return f"Sorry, I couldn't get the status of RDS instance '{instance_id}'. Reason: {str(e)}"

def instance_exists(response):
    instance_id = response.get("resource")
    region = response.get("filters", {}).get("region", "us-east-1")

    if not instance_id:
        return "Please provide a your query and the RDS instance identifier."

    rds = boto3.client('rds', region_name=region)
    try:
        rds.describe_db_instances(DBInstanceIdentifier=instance_id)
        return f"Yes, the RDS instance '{instance_id}' exists in your account in the '{region}' region."
    except ClientError:
        return f"The RDS instance '{instance_id}' does not exist or you don't have access to it in the '{region}' region."
