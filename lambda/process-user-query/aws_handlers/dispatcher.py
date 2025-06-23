import boto3

def dispatch_service_response(response):
    service = response.get('service')
    action = response.get('action')

    if not service or not action:
        return {"error": "Invalid bedrock response: Missing service or action."}

    dispatch_table = {
        'S3': {
            'count': s3.count_s3_buckets,
            'list': s3.list_s3_buckets,
            'exists': s3.bucket_exists,
            'locate': s3.get_bucket_location
        },
        'EC2': {
            'count': ec2.count_ec2_instances,
            'list': ec2.list_ec2_instances,
            'exists': ec2.instance_exists
            'describe': ec2.describe_ec2_instances
        },
        'Lambda': {
            'count': lambda_service.count_lambda_functions,
            'list': lambda_service.list_lambda_functions,
            'invoke': lambda_service.invoke_lambda_function
        },
        'RDS': {
            'count': rds.count_rds_instances,
            'list': rds.list_rds_instances,
            'describe': rds.describe_rds_instances
        }
        # Add more services/actions as needed
    }

    service_actions = dispatch_table.get(service)

    if not service_actions:
        return {"error": f"Unsupported service: {service}"}

    action_handler = service_actions.get(action)

    if not action_handler:
        return {"error": f"Unsupported action '{action}' for service '{service}'"}

    return action_handler(response)