import { useEffect, useState } from 'react';

const APPLICATION_API_URL = 'https://hio143ipmh.execute-api.ap-northeast-3.amazonaws.com/yesyes/apli/sanshou';

const detailGroups = [
  {
    title: '申請情報',
    fields: [
      ['ApplyID', '申請ID'], ['UserID', 'ユーザーID'], ['ApplicationDate', '申請日時'],
      ['ApplicationType', '申請種別'], ['Status', '申請ステータス'], ['Comment', 'コメント'],
    ],
  },
  {
    title: '本人情報',
    fields: [
      ['UserName-L', '姓'], ['UserName-F', '名'], ['UserName-L-Kana', '姓（カナ）'],
      ['UserName-F-Kana', '名（カナ）'], ['BirthDate', '生年月日'], ['Address', '住所'],
      ['PhoneNumber', '電話番号'], ['Email', 'メールアドレス'],
    ],
  },
  {
    title: '同定審査情報',
    fields: [
      ['KosekiMatched', '戸籍照合結果'], ['KosekiCheckDate', '照合日時'],
      ['KosekiErrorCode', '照合エラー'], ['IdentityScore', '同定スコア'],
    ],
  },
  {
    title: '審査情報',
    fields: [
      ['ReviewStatus', '審査ステータス'], ['ReviewerID', '審査担当者ID'],
      ['ReviewDate', '審査日時'], ['ReviewComment', '審査コメント'],
    ],
  },
  {
    title: 'システム管理情報',
    fields: [
      ['CreatedAt', '作成日時'], ['UpdatedAt', '更新日時'],
      ['Version', 'バージョン'], ['IsDeleted', '論理削除'],
    ],
  },
];

function formatDetailValue(value) {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    return 'ー';
  }
  return String(value);
}

function formatDateTime(value) {
  if (!value) return 'ー';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

const dateFields = new Set(['ApplicationDate', 'KosekiCheckDate', 'ReviewDate', 'CreatedAt', 'UpdatedAt']);

export default function Sinsei2Etsuran({ applicationNumber, onBack, onReview }) {
  const [application, setApplication] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let isCurrent = true;
    setApplication(null);
    setError('');
    const applyId = String(applicationNumber).padStart(6, '0');

    fetch(APPLICATION_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ApplyID: applyId }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          throw new Error(result.message || '申請情報を取得できませんでした。');
        }
        return response.json();
      })
      .then((data) => {
        if (isCurrent) setApplication(data);
      })
      .catch((fetchError) => {
        if (isCurrent) setError(fetchError.message);
      });

    return () => { isCurrent = false; };
  }, [applicationNumber]);

  return (
    <>
      <div className="detail-header">
        <button className="btn back-btn" onClick={onBack}>← 検索画面へ戻る</button>
        <h2>申請詳細</h2>
      </div>
      {error && <div className="message error-message" role="alert">{error}</div>}
      {!application && !error && (
        <div className="loading-modal" role="dialog" aria-modal="true" aria-label="データ取得中">
          <div className="loading-modal-content">
            <div className="loading-spinner" aria-hidden="true" />
            <p aria-live="polite">データ取得中...</p>
          </div>
        </div>
      )}
      {application && (
        <>
          {detailGroups.map((group) => (
            <section className="detail-section" key={group.title}>
              <h3>{group.title}</h3>
              <div className="detail-card">
                {group.fields.map(([key, label]) => (
                  <div className="detail-row" key={key}>
                    <div className="detail-label">{label}</div>
                    <div className="detail-value">
                      {(() => {
                        const value = dateFields.has(key)
                          ? formatDateTime(application[key])
                          : formatDetailValue(application[key]);
                        return key === 'Status' || key === 'ReviewStatus'
                          ? value === 'ー' ? value : <span className="status">{value}</span>
                          : value;
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
          {application.KosekiMatched === true && (
            <div className="review-actions">
              <button
                type="button"
                className="btn btn-review"
                onClick={() => onReview({ ApplyID: String(applicationNumber).padStart(6, '0') })}
              >
                審査処理へ進む
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
