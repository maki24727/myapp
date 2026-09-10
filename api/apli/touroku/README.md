# 審査登録API

`POST /yesyes/applications/touroku` に審査内容を送信すると、MasterDBの更新とDanmenへの断面保存を1トランザクションで実行します。

## リクエスト

```json
{
  "ApplyID": "000001",
  "ReviewStatus": "承認",
  "ReviewerID": "reviewer-001",
  "ReviewDate": "2026-09-10T12:00",
  "ReviewComment": "確認済み"
}
```

## Danmenのキーと断面粒度

- パーティションキー: `UserID-Sqk`（文字列、`UserID` と `Sqk` をハイフン連結）
- ソートキー: `Sqk`（数値）
- 1回の審査登録につき1アイテム
- `ApplicationSnapshot` にMasterDBの登録前スナップショットへ今回の審査情報を反映して保存
- `Sqk` は同じ `UserID` の既存データ件数に1を加えた連番（初回は1）
- 例: `UserID000001` のデータが3件ある場合、次の `Sqk` は4で、`UserID-Sqk` は `UserID000001-4`

## Lambda環境変数

- `AWS_REGION`（未指定時 `ap-northeast-3`）
- `MASTER_DB_TABLE_NAME`（未指定時 `MasterDB`）
- `DANMEN_TABLE_NAME`（未指定時 `Danmen`）

## IAM権限

Lambda実行ロールに、MasterDBへの `dynamodb:Query`、`dynamodb:UpdateItem`、`dynamodb:TransactWriteItems`、Danmenへの `dynamodb:Scan`、`dynamodb:PutItem`、`dynamodb:TransactWriteItems` を付与してください。`dynamodb:Scan` は同じ `UserID` の既存件数から次の `Sqk` を採番するために使用します。API Gatewayからの `POST` と `OPTIONS` をLambdaへルーティングします。
