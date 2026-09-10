import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const dynamoDb = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-northeast-3',
});
const tableName = process.env.MASTER_DB_TABLE_NAME || 'MasterDB';
const signedUrlExpiresIn = Number(process.env.SIGNED_URL_EXPIRES_IN || 900);
const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-northeast-3' });

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

function response(statusCode, body) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(body),
  };
}

function parseBody(event) {
  if (event?.body === undefined || event.body === null || event.body === '') return {};
  const body = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  return typeof body === 'string' ? JSON.parse(body) : body;
}

function getApplyId(event) {
  const method = event?.httpMethod || event?.requestContext?.http?.method;
  if (method === 'GET') {
    return event?.queryStringParameters?.ApplyID || event?.queryStringParameters?.applyId;
  }
  return parseBody(event).ApplyID || parseBody(event).applyId;
}

function validateApplyId(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  const applyId = String(value).trim();
  return /^\d+$/.test(applyId) ? applyId.padStart(6, '0') : '';
}

function unmarshallValue(attribute) {
  if ('S' in attribute) return attribute.S;
  if ('N' in attribute) return Number(attribute.N);
  if ('BOOL' in attribute) return attribute.BOOL;
  if ('NULL' in attribute) return null;
  if ('L' in attribute) return attribute.L.map(unmarshallValue);
  if ('M' in attribute) return unmarshall(attribute.M);
  if ('SS' in attribute) return attribute.SS;
  if ('NS' in attribute) return attribute.NS.map(Number);
  return attribute;
}

function unmarshall(record) {
  return Object.fromEntries(Object.entries(record).map(([key, attribute]) => [key, unmarshallValue(attribute)]));
}

async function findApplication(applyId) {
  const result = await dynamoDb.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: 'ApplyID = :applyId',
    ExpressionAttributeValues: { ':applyId': { S: applyId } },
    Limit: 1,
  }));

  const item = result.Items?.[0];
  if (!item) return null;

  const application = unmarshall(item);
  await addSignedDocumentUrls(application);
  return application.IsDeleted === true ? null : application;
}

async function addSignedDocumentUrls(application) {
  if (!Array.isArray(application.IdentityDocuments)) return;

  await Promise.all(application.IdentityDocuments.map(async (document) => {
    if (!document || typeof document.Bucket !== 'string' || typeof document.Key !== 'string') return;

    document.imageUrl = await getSignedUrl(s3, new GetObjectCommand({
      Bucket: document.Bucket,
      Key: document.Key,
    }), { expiresIn: signedUrlExpiresIn });
  }));
}

export async function handler(event) {
  const method = event?.httpMethod || event?.requestContext?.http?.method
    || (event?.body !== undefined ? 'POST' : 'GET');

  if (method === 'OPTIONS') return response(204, null);
  if (method !== 'GET' && method !== 'POST') {
    return response(405, { message: 'GET、POST、OPTIONSのみ対応しています。' });
  }

  let applyId;
  try {
    applyId = validateApplyId(getApplyId(event));
  } catch {
    return response(400, { message: 'リクエストボディのJSON形式が不正です。' });
  }

  if (!applyId) return response(400, { message: 'ApplyIDを正しい形式で指定してください。' });

  try {
    const application = await findApplication(applyId);
    if (!application) return response(404, { message: '指定された申請情報が見つかりません。' });
    return response(200, application);
  } catch (error) {
    console.error('MasterDB query failed:', error);
    return response(500, { message: '申請情報を取得できませんでした。' });
  }
}
