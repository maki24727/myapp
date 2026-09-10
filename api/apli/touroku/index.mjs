import {
  DynamoDBClient,
  QueryCommand,
  ScanCommand,
  TransactWriteItemsCommand,
} from '@aws-sdk/client-dynamodb';

const dynamoDb = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-northeast-3',
});
const masterTableName = process.env.MASTER_DB_TABLE_NAME || 'MasterDB';
const danmenTableName = process.env.DANMEN_TABLE_NAME || 'Danmen';

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

function response(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function parseBody(event) {
  const rawBody = event?.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : event?.body;
  if (!rawBody) return {};
  const body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid-body');
  return body;
}

function requiredText(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${label}は必須です。`);
  return text;
}

function optionalText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function marshallValue(value) {
  if (value === null || value === undefined) return { NULL: true };
  if (typeof value === 'boolean') return { BOOL: value };
  if (typeof value === 'number' && Number.isFinite(value)) return { N: String(value) };
  if (typeof value === 'string') return value ? { S: value } : { NULL: true };
  if (Array.isArray(value)) return { L: value.map(marshallValue) };
  if (typeof value === 'object') return { M: Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, marshallValue(item)]),
  ) };
  return { S: String(value) };
}

function marshall(record) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, marshallValue(value)]),
  );
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
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, unmarshallValue(value)]));
}

async function findApplication(applyId) {
  const result = await dynamoDb.send(new QueryCommand({
    TableName: masterTableName,
    KeyConditionExpression: 'ApplyID = :applyId',
    ExpressionAttributeValues: { ':applyId': { S: applyId } },
    Limit: 1,
  }));
  const item = result.Items?.[0];
  if (!item) return null;

  return {
    application: unmarshall(item),
    key: {
      ApplyID: item.ApplyID,
      UserID: item.UserID,
    },
  };
}

async function getNextSqk(userId) {
  let exclusiveStartKey;
  let count = 0;

  do {
    const result = await dynamoDb.send(new ScanCommand({
      TableName: danmenTableName,
      Select: 'COUNT',
      FilterExpression: '#userId = :userId',
      ExpressionAttributeNames: { '#userId': 'UserID' },
      ExpressionAttributeValues: { ':userId': { S: userId } },
      ExclusiveStartKey: exclusiveStartKey,
    }));
    count += result.Count || 0;
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return count + 1;
}

function buildRequest(body) {
  const applyId = requiredText(body.ApplyID ?? body.applyId, 'ApplyID');
  if (!/^\d+$/.test(applyId)) throw new Error('ApplyIDを正しい形式で指定してください。');

  const reviewStatus = requiredText(body.ReviewStatus, 'ReviewStatus');
  if (!['承認', '却下', '差戻し'].includes(reviewStatus)) {
    throw new Error('ReviewStatusの値が不正です。');
  }

  return {
    applyId: applyId.padStart(6, '0'),
    reviewStatus,
    reviewerId: requiredText(body.ReviewerID, 'ReviewerID'),
    reviewDate: requiredText(body.ReviewDate, 'ReviewDate'),
    reviewComment: optionalText(body.ReviewComment),
  };
}

async function registerReview(request, application, applicationKey) {
  const userId = requiredText(application.UserID, 'MasterDBのUserID');
  const now = new Date().toISOString();
  const sqk = await getNextSqk(userId);
  const danmenId = `${userId}-${sqk}`;
  const nextVersion = Number(application.Version || 0) + 1;
  const updatedMaster = {
    ReviewStatus: request.reviewStatus,
    ReviewerID: request.reviewerId,
    ReviewDate: request.reviewDate,
    ReviewComment: request.reviewComment,
    UpdatedAt: now,
    Version: nextVersion,
  };
  const snapshot = {
    ...application,
    ...updatedMaster,
    SnapshotAt: now,
  };

  await dynamoDb.send(new TransactWriteItemsCommand({
    TransactItems: [
      {
        Update: {
          TableName: masterTableName,
          Key: applicationKey,
          UpdateExpression: 'SET #reviewStatus = :reviewStatus, #reviewerId = :reviewerId, #reviewDate = :reviewDate, #reviewComment = :reviewComment, #updatedAt = :updatedAt, #version = :version',
          ExpressionAttributeNames: {
            '#reviewStatus': 'ReviewStatus',
            '#reviewerId': 'ReviewerID',
            '#reviewDate': 'ReviewDate',
            '#reviewComment': 'ReviewComment',
            '#updatedAt': 'UpdatedAt',
            '#version': 'Version',
          },
          ExpressionAttributeValues: {
            ':reviewStatus': marshallValue(request.reviewStatus),
            ':reviewerId': marshallValue(request.reviewerId),
            ':reviewDate': marshallValue(request.reviewDate),
            ':reviewComment': marshallValue(request.reviewComment),
            ':updatedAt': marshallValue(now),
            ':version': marshallValue(nextVersion),
            ':notDeleted': marshallValue(false),
          },
          ConditionExpression: 'attribute_exists(ApplyID) AND (attribute_not_exists(IsDeleted) OR IsDeleted = :notDeleted)',
        },
      },
      {
        Put: {
          TableName: danmenTableName,
          Item: marshall({
            'UserID-Sqk': danmenId,
            Sqk: sqk,
            ApplyID: request.applyId,
            UserID: userId,
            SnapshotType: 'REVIEW',
            SnapshotAt: now,
            ApplicationSnapshot: snapshot,
          }),
          ConditionExpression: 'attribute_not_exists(#danmenId)',
          ExpressionAttributeNames: { '#danmenId': 'UserID-Sqk' },
        },
      },
    ],
  }));

  return { ApplyID: request.applyId, 'UserID-Sqk': danmenId, Sqk: sqk, UpdatedAt: now };
}

export async function handler(event) {
  const method = event?.httpMethod || event?.requestContext?.http?.method || 'POST';
  if (method === 'OPTIONS') return response(204, null);
  if (method !== 'POST') return response(405, { message: 'POST、OPTIONSのみ対応しています。' });

  let request;
  try {
    request = buildRequest(parseBody(event));
  } catch (error) {
    const message = error.message === 'invalid-body'
      ? 'リクエストボディのJSON形式が不正です。'
      : error.message;
    return response(400, { message });
  }

  try {
    const found = await findApplication(request.applyId);
    if (!found || found.application.IsDeleted === true) {
      return response(404, { message: '指定された申請情報が見つかりません。' });
    }
    const result = await registerReview(request, found.application, found.key);
    return response(200, { message: '審査内容を登録しました。', ...result });
  } catch (error) {
    console.error('Review registration failed:', error);
    if (error.name === 'TransactionCanceledException') {
      return response(409, { message: '申請情報が更新されたため登録できませんでした。画面を再読み込みしてください。' });
    }
    return response(500, { message: '審査内容を登録できませんでした。' });
  }
}
