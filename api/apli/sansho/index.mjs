import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';

const dynamoDb = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-northeast-3',
});
const masterTableName = process.env.MASTER_DB_TABLE_NAME || 'MasterDB';

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

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  response.end(JSON.stringify(body));
}

const lambdaHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

function lambdaResponse(statusCode, body) {
  return {
    statusCode,
    headers: lambdaHeaders,
    body: JSON.stringify(body),
  };
}

function getApplyIdFromBody(body) {
  if (body === null || body === undefined || body === '') return '';

  const parsedBody = typeof body === 'string' ? JSON.parse(body) : body;
  if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) return '';
  return parsedBody.ApplyID ?? parsedBody.applyId ?? parsedBody.applicationNumber ?? '';
}

function validateApplyId(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  const applyId = String(value).trim();
  if (!applyId || !/^\d+$/.test(applyId)) return '';
  return applyId.padStart(6, '0');
}

async function findApplication(applyId) {
  const result = await dynamoDb.send(new QueryCommand({
    TableName: masterTableName,
    KeyConditionExpression: 'ApplyID = :applyId',
    ExpressionAttributeValues: {
      ':applyId': { S: applyId },
    },
    Limit: 1,
  }));

  const record = result.Items?.[0];
  if (!record) return null;

  const application = unmarshall(record);
  if (application.IsDeleted === true) return null;
  return application;
}

export async function handler(event) {
  const method = event?.httpMethod || event?.requestContext?.http?.method
    || (event?.body !== undefined ? 'POST' : 'GET');

  if (method === 'OPTIONS') return lambdaResponse(204, null);
  if (method !== 'GET' && method !== 'POST') {
    return lambdaResponse(405, { message: 'GET、POST、OPTIONSのみ対応しています。' });
  }

  let rawApplyId;
  if (method === 'GET') {
    rawApplyId = event?.queryStringParameters?.ApplyID
      || event?.queryStringParameters?.applyId
      || event?.pathParameters?.ApplyID
      || event?.pathParameters?.applyId;
  } else {
    try {
      const body = event?.isBase64Encoded
        ? Buffer.from(event.body || '', 'base64').toString('utf8')
        : event?.body;
      rawApplyId = getApplyIdFromBody(body);
    } catch {
      return lambdaResponse(400, { message: 'リクエストボディのJSON形式が不正です。' });
    }
  }

  const applyId = validateApplyId(rawApplyId);
  if (!applyId) {
    return lambdaResponse(400, { message: 'ApplyIDを正しい形式で指定してください。' });
  }

  let application;
  try {
    application = await findApplication(applyId);
  } catch (error) {
    console.error('MasterDB query failed:', error);
    return lambdaResponse(500, { message: '申請情報を取得できませんでした。' });
  }
  if (!application) return lambdaResponse(404, { message: '指定された申請情報が見つかりません。' });

  return lambdaResponse(200, application);
}

export async function handleApplicationReference(requestPath, response) {
  const applicationMatch = requestPath.match(/^\/api\/applications\/([^/]+)$/);
  if (!applicationMatch) return false;

  const applyId = decodeURIComponent(applicationMatch[1]);
  let application;
  try {
    application = await findApplication(applyId);
  } catch {
    sendJson(response, 500, { message: '申請情報を取得できませんでした。' });
    return true;
  }
  if (!application) {
    sendJson(response, 404, { message: '指定された申請情報が見つかりません。' });
    return true;
  }

  sendJson(response, 200, application);
  return true;
}
