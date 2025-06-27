import boto3
from . import s3, ec2, lambda_service, rds

def dispatch_service_response(response):
    service = response.get('service')
    action = response.get('action')

    if not service or not action:
        return {"error": "Invalid bedrock response: Missing service or action."}

    dispatch_table = {
        'S3': {
            'count': s3.count_s3_buckets,
            'list': s3.list_s3_buckets,
            'list_s3_object': s3.list_objects_in_bucket,
            'exists': s3.bucket_exists,
            'locate': s3.get_bucket_location
        },
        'EC2': {
            'count': ec2.count_ec2_instances,
            'list': ec2.list_ec2_instances,
            'describe': ec2.get_ec2_instance_details,
            'list_by_state': ec2.list_ec2_instances_by_state
        },
        'Lambda': {
            'count': lambda_service.count_lambda_functions,
            'list': lambda_service.list_lambda_functions,
            'invoke': lambda_service.invoke_lambda_function,
            'describe': lambda_service.get_lambda_configuration,
            'resource_policy': lambda_service.get_lambda_policy
        },
        'RDS': {
            'count': rds.count_rds_instances,
            'list': rds.list_rds_instances,
            'describe': rds.describe_rds_instance,
            'list_by_state': rds.identify_stopped_instances

        }
        # We can add more services/actions as needed
    }

    service_actions = dispatch_table.get(service)

    if not service_actions:
        return {"error": f"Unsupported service: {service}"}

    action_handler = service_actions.get(action)

    if not action_handler:
        return {"error": f"Unsupported action '{action}' for service '{service}'"}

    return action_handler(response)