import boto3
import json
from botocore.exceptions import ClientError

s3_client = boto3.client('s3')

def handle_s3_errors(func):
    """Decorator to standardize S3 error handling."""
    def wrapper(request):
        try:
            return func(request)
        except ClientError as e:
            err_code = e.response['Error'].get('Code', 'Unknown')
            return f"Sorry, S3 operation '{func.__name__}' failed: {err_code}"
        except Exception as e:
            return f"An unexpected error occurred in '{func.__name__}': {e}"
    return wrapper

def validate_bucket_name(bucket):
    if not bucket:
        return "Please provide a bucket name."
    return None

@handle_s3_errors
def count_s3_buckets(request):
    response = s3_client.list_buckets()
    count = len(response.get('Buckets', []))
    plural = 's' if count != 1 else ''
    return f"You have {count} S3 bucket{plural} in your account."

def list_s3_buckets(request):
    response = s3_client.list_buckets()
    names = [b['Name'] for b in response.get('Buckets', [])]
    if not names:
        return "You don't have any S3 buckets."
    return f"Your buckets: {', '.join(names)}."

@handle_s3_errors
def list_objects_in_bucket(request):
    bucket = request.get('resource')
    err = validate_bucket_name(bucket)
    if err:
        return err

    resp = s3_client.list_objects_v2(Bucket=bucket)
    keys = [obj['Key'] for obj in resp.get('Contents', [])]
    if not keys:
        return f"The bucket '{bucket}' is empty."
    return f"Objects in '{bucket}': {', '.join(keys)}."


@handle_s3_errors
def get_bucket_location(request):
    bucket = request.get('resource')
    err = validate_bucket_name(bucket)
    if err:
        return err

    resp = s3_client.get_bucket_location(Bucket=bucket)
    region = resp.get('LocationConstraint') or 'us-east-1'
    return f"The bucket '{bucket}' is in region '{region}'."

@handle_s3_errors
def bucket_exists(request):
    bucket = request.get('resource')
    err = validate_bucket_name(bucket)
    if err:
        return err

    try:
        s3_client.head_bucket(Bucket=bucket)
        return f"Yes, the bucket '{bucket}' exists."
    except ClientError:
        return f"No, the bucket '{bucket}' does not exist or is inaccessible."