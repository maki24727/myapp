import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';

const dynamoDb = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-northeast-3',
});
const tableName = process.env.MASTER_DB_TABLE_NAME || 'MasterDB';

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

function getRequest(event) {
  const method = event?.httpMethod || event?.requestContext?.http?.method;
  if (method === 'GET') {
    return event?.queryStringParameters || {};
  }
  return parseBody(event);
}

function parsePageSize(value) {
  const pageSize = Number(value || 10);
  if (!Number.isInteger(pageSize) || pageSize < 1) return 10;
  return Math.min(pageSize, 100);
}

function decodeToken(value) {
  if (!value) return undefined;
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function encodeToken(value) {
  return value ? Buffer.from(JSON.stringify(value), 'utf8').toString('base64url') : null;
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

function toSearchItem(item) {
  return {
    ApplyID: item.ApplyID || '',
    UserName: [item['UserName-L'], item['UserName-F']].filter(Boolean).join(' '),
    ApplicationDate: item.ApplicationDate || '',
    Status: item.Status || '',
    KosekiMatched: item.KosekiMatched ?? null,
    ReviewStatus: item.ReviewStatus || '',
    UpdatedAt: item.UpdatedAt || '',
  };
}

function buildScanInput(request, exclusiveStartKey) {
  const keyword = String(request.keyword || request.Keyword || '').trim();
  const status = String(request.status || request.Status || '').trim();
  const applicationType = String(request.applicationType || request.ApplicationType || '').trim();
  const birthDate = String(request.birthDate || request.BirthDate || '').trim();
  const applicationDateFrom = String(request.applicationDateFrom || request.ApplicationDateFrom || '').trim();
  const applicationDateTo = String(request.applicationDateTo || request.ApplicationDateTo || '').trim();
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};
  const filters = ['(attribute_not_exists(#isDeleted) OR #isDeleted = :false)'];

  expressionAttributeNames['#isDeleted'] = 'IsDeleted';
  expressionAttributeValues[':false'] = { BOOL: false };

  if (status) {
    filters.push('#status = :status');
    expressionAttributeNames['#status'] = 'Status';
    expressionAttributeValues[':status'] = { S: status };
  }

  if (applicationType) {
    filters.push('#applicationType = :applicationType');
    expressionAttributeNames['#applicationType'] = 'ApplicationType';
    expressionAttributeValues[':applicationType'] = { S: applicationType };
  }

  const reviewStatus = String(request.reviewStatus || request.ReviewStatus || '').trim();
  if (reviewStatus) {
    filters.push('#reviewStatus = :reviewStatus');
    expressionAttributeNames['#reviewStatus'] = 'ReviewStatus';
    expressionAttributeValues[':reviewStatus'] = { S: reviewStatus };
  }

  if (birthDate) {
    filters.push('#birthDate = :birthDate');
    expressionAttributeNames['#birthDate'] = 'BirthDate';
    expressionAttributeValues[':birthDate'] = { S: birthDate };
  }

  if (applicationDateFrom) {
    filters.push('#applicationDate >= :applicationDateFrom');
    expressionAttributeNames['#applicationDate'] = 'ApplicationDate';
    expressionAttributeValues[':applicationDateFrom'] = { S: applicationDateFrom };
  }

  if (applicationDateTo) {
    filters.push('#applicationDate <= :applicationDateTo');
    expressionAttributeNames['#applicationDate'] = 'ApplicationDate';
    expressionAttributeValues[':applicationDateTo'] = { S: applicationDateTo };
  }

  if (keyword) {
    filters.push('(contains(#applyId, :keyword) OR contains(#userId, :keyword) OR contains(#nameL, :keyword) OR contains(#nameF, :keyword) OR contains(#nameLKana, :keyword) OR contains(#nameFKana, :keyword) OR contains(#address, :keyword) OR contains(#phoneNumber, :keyword) OR contains(#email, :keyword) OR contains(#comment, :keyword) OR contains(#reviewComment, :keyword) OR contains(#reviewerId, :keyword) OR contains(#kosekiErrorCode, :keyword))');
    expressionAttributeNames['#applyId'] = 'ApplyID';
    expressionAttributeNames['#userId'] = 'UserID';
    expressionAttributeNames['#nameL'] = 'UserName-L';
    expressionAttributeNames['#nameF'] = 'UserName-F';
    expressionAttributeNames['#nameLKana'] = 'UserName-L-Kana';
    expressionAttributeNames['#nameFKana'] = 'UserName-F-Kana';
    expressionAttributeNames['#address'] = 'Address';
    expressionAttributeNames['#phoneNumber'] = 'PhoneNumber';
    expressionAttributeNames['#email'] = 'Email';
    expressionAttributeNames['#comment'] = 'Comment';
    expressionAttributeNames['#reviewComment'] = 'ReviewComment';
    expressionAttributeNames['#reviewerId'] = 'ReviewerID';
    expressionAttributeNames['#kosekiErrorCode'] = 'KosekiErrorCode';
    expressionAttributeValues[':keyword'] = { S: keyword };
  }

  return {
    TableName: tableName,
    FilterExpression: filters.join(' AND '),
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ExclusiveStartKey: exclusiveStartKey,
  };
}

async function searchApplications(request) {
  const pageSize = parsePageSize(request.pageSize || request.PageSize);
  const token = decodeToken(request.nextToken || request.NextToken);
  if (token === null) throw new Error('nextToken の形式が不正です。');

  const items = [];
  let lastEvaluatedKey = token;
  do {
    const result = await dynamoDb.send(new ScanCommand(buildScanInput(request, lastEvaluatedKey)));
    items.push(...(result.Items || []).map(unmarshall));
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (items.length < pageSize && lastEvaluatedKey);

  return {
    items: items.slice(0, pageSize).map(toSearchItem),
    nextToken: encodeToken(lastEvaluatedKey),
  };
}

export async function handler(event) {
  const method = event?.httpMethod || event?.requestContext?.http?.method
    || (event?.body !== undefined ? 'POST' : 'GET');

  if (method === 'OPTIONS') return response(204, null);
  if (method !== 'GET' && method !== 'POST') {
    return response(405, { message: 'GET、POST、OPTIONSのみ対応しています。' });
  }

  try {
    const result = await searchApplications(getRequest(event));
    return response(200, result);
  } catch (error) {
    console.error('MasterDB search failed:', error);
    const statusCode = error.message === 'nextToken の形式が不正です。' ? 400 : 500;
    return response(statusCode, { message: statusCode === 400 ? error.message : '申請情報を検索できませんでした。' });
  }
}
