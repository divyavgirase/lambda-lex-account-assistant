import boto3
from botocore.exceptions import ClientError

client = boto3.client('s3')

def count_s3_buckets(response):
    try:
        buckets = client.list_buckets()
        count = len(buckets.get('Buckets', []))
        return f"You have {count} S3 bucket{'s' if count != 1 else ''} in your account."
    except ClientError as e:
        return f"Sorry, I couldn't retrieve your S3 bucket count. Reason: {str(e)}"

def list_s3_buckets(response):
    try:
        buckets = client.list_buckets()
        bucket_names = [b['Name'] for b in buckets.get('Buckets', [])]
        if not bucket_names:
            return "You don't have any S3 buckets in your account."
        return f"Here are your S3 buckets: {', '.join(bucket_names)}"
    except ClientError as e:
        return f"Sorry, I couldn't list your S3 buckets. Reason: {str(e)}"

def list_objects_in_bucket(response):
    bucket = response.get("resource")
    if not bucket:
        return "Please provide a bucket name to list its objects."

    try:
        objects = client.list_objects_v2(Bucket=bucket)
        object_list = [obj["Key"] for obj in objects.get("Contents", [])]
        if not object_list:
            return f"The bucket '{bucket}' is empty."
        return f"The bucket '{bucket}' contains the following objects: {', '.join(object_list)}"
    except ClientError as e:
        return f"Sorry, I couldn't list objects in the bucket '{bucket}'. Reason: {str(e)}"

def get_bucket_location(response):
    bucket = response.get("resource")
    if not bucket:
        return "Please specify a bucket name to find its region."

    try:
        loc = client.get_bucket_location(Bucket=bucket)
        region = loc.get('LocationConstraint') or 'us-east-1'
        return f"The bucket '{bucket}' is located in the '{region}' region."
    except ClientError as e:
        return f"Sorry, I couldn't get the location of the bucket '{bucket}'. Reason: {str(e)}"

def bucket_exists(response):
    bucket = response.get("resource")
    if not bucket:
        return "Please specify a bucket name to check."
    try:
        client.head_bucket(Bucket=bucket)
        return f"Yes, the bucket '{bucket}' exists in your account."
    except ClientError:
        return f"No, the bucket '{bucket}' does not exist or you don't have access to it."