/**
 * DynamoDB Client for Email Storage
 * 
 * Handles storing and retrieving email subscriptions from DynamoDB.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { getAWSCredentials } from './aws-config';

let dynamoClient: DynamoDBDocumentClient | null = null;

/**
 * Get or create DynamoDB client
 * Uses IAM role on EC2 or credentials from environment variables
 */
export function getDynamoDBClient(): DynamoDBDocumentClient {
  if (dynamoClient) {
    return dynamoClient;
  }

  const credentials = getAWSCredentials();
  const client = new DynamoDBClient({
    region: credentials.region,
    ...(credentials.accessKeyId && credentials.secretAccessKey
      ? {
          credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
          },
        }
      : {}),
    // If no explicit credentials, AWS SDK will use IAM role (on EC2) or default credential chain
  });

  dynamoClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: {
      removeUndefinedValues: true,
    },
  });

  return dynamoClient;
}

/**
 * Get DynamoDB table name for emails
 */
export function getEmailsTableName(): string {
  return process.env.AWS_DYNAMODB_EMAILS_TABLE || 'blendpdf-emails';
}
