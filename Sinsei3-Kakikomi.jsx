import { useEffect, useState } from 'react';

const APPLICATION_API_URL = 'https://uupsy9mxb1.execute-api.ap-northeast-3.amazonaws.com/yesyes/sansho-B';
const REGISTER_API_URL = 'https://uupsy9mxb1.execute-api.ap-northeast-3.amazonaws.com/yesyes/applications/touroku';

const referenceGroups = [
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
];

const reviewFields = [
  ['ReviewStatus', '審査ステータス'],
  ['ReviewerID', '審査担当者ID'],
  ['ReviewDate', '審査日時'],
  ['ReviewComment', '審査コメント'],
];

function displayValue(value) {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) return 'ー';
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

function formatDateTimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const dateFields = new Set(['ApplicationDate', 'KosekiCheckDate']);

function unwrapDynamoValue(value) {
  if (!value || typeof value !== 'object') return value;
  if ('S' in value) return value.S;
  if ('L' in value) return value.L.map(unwrapDynamoValue);
  if ('M' in value) return Object.fromEntries(Object.entries(value.M).map(([key, item]) => [key, unwrapDynamoValue(item)]));
  return value;
}

function getImageUrls(application) {
  const documents = unwrapDynamoValue(application?.IdentityDocuments);
  return (Array.isArray(documents) ? documents : [])
    .map((document, index) => ({
      label: document.Type || `本人確認書類 ${index + 1}`,
      url: document.imageUrl || '',
    }))
    .filter(({ url }) => url);
}

export default function Sinsei3Kakikomi({ applicationNumber, onBack }) {
  const [application, setApplication] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showSubmitWarning, setShowSubmitWarning] = useState(false);
  const [submitState, setSubmitState] = useState(null); // null | 'submitting' | 'success' | 'error'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    let isCurrent = true;
    const applyId = String(applicationNumber).padStart(6, '0');
    setApplication(null);
    setError('');
    setSelectedDocument(null);

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
        if (!isCurrent) return;
        setApplication(data);
        setForm(Object.fromEntries(reviewFields.map(([key]) => [key, key === 'ReviewDate' ? formatDateTimeLocal(new Date()) : data[key] ?? ''])));
      })
      .catch((fetchError) => {
        if (isCurrent) setError(fetchError.message);
      });

    return () => { isCurrent = false; };
  }, [applicationNumber]);

  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const imageUrls = getImageUrls(application);

  const closeSubmitModal = () => {
    setShowSubmitWarning(false);
    setSubmitState(null);
    setSubmitError('');
    onBack(application?.ApplyID || applicationNumber);
  };

  const submitReview = async () => {
    if (!application) return;
    setIsSubmitting(true);
    setSubmitError('');
    setSubmitState('submitting');
    try {
      const response = await fetch(REGISTER_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ApplyID: application.ApplyID, ...form }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.message || '審査内容を登録できませんでした。');
      }
      setSubmitState('success');
      setSubmitError('');
    } catch (submitFetchError) {
      setSubmitState('error');
      setSubmitError(submitFetchError.message || '審査内容を登録できませんでした。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="detail-header">
        <button type="button" className="btn back-btn" onClick={() => onBack(applicationNumber)}>← 詳細画面へ戻る</button>
        <h2>審査処理入力</h2>
      </div>
      {error && <div className="message error-message" role="alert">{error}</div>}
      {!application && !error && (
        <div className="loading-modal" role="dialog" aria-modal="true" aria-label="データ取得中">
          <div className="loading-modal-content">
            <div className="loading-spinner" aria-hidden="true" />
            <p aria-live="polite">申請情報を取得しています...</p>
          </div>
        </div>
      )}
      {application && (
        <>
          <section className="review-screen-section review-reference-section">
            <h3>参照情報</h3>
            {referenceGroups.map((group) => (
              <div className="review-reference-group" key={group.title}>
                <h4>{group.title}</h4>
                <div className="review-reference-list">
                  {group.fields.map(([key, label]) => (
                    <div className="review-reference-row" key={key}>
                      <div className="review-reference-label">{label}</div>
                      <div className="review-reference-value">{dateFields.has(key) ? formatDateTime(application[key]) : displayValue(application[key])}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section className="review-screen-section review-document-section">
            <h3>本人確認書類</h3>
            {imageUrls.length === 0 ? (
              <div className="message document-empty">本人確認書類の画像はありません。</div>
            ) : (
              <div className="document-grid">
                {imageUrls.map(({ label, url }) => (
                  <figure className="document-item" key={`${label}-${url}`}>
                    <figcaption>{label}</figcaption>
                    <button type="button" className="document-image-button" onClick={() => setSelectedDocument({ label, url })} aria-label={`${label}を拡大表示`}>
                      <img src={url} alt={label} referrerPolicy="no-referrer" />
                    </button>
                  </figure>
                ))}
              </div>
            )}
          </section>

          <section className="review-screen-section review-edit-section">
            <h3>審査情報</h3>
            <div className="review-form">
              <label>
                審査ステータス
                <select value={form.ReviewStatus ?? ''} onChange={(event) => updateForm('ReviewStatus', event.target.value)}>
                  <option value="">選択してください</option>
                  <option value="承認">承認</option>
                  <option value="却下">却下</option>
                  <option value="差戻し">差戻し</option>
                </select>
              </label>
              <label>
                審査担当者ID
                <input type="text" value={form.ReviewerID ?? ''} onChange={(event) => updateForm('ReviewerID', event.target.value)} />
              </label>
              <label>
                審査日時
                <input type="datetime-local" value={form.ReviewDate ?? ''} onChange={(event) => updateForm('ReviewDate', event.target.value)} />
              </label>
              <label>
                審査コメント
                <textarea rows="6" value={form.ReviewComment ?? ''} onChange={(event) => updateForm('ReviewComment', event.target.value)} />
              </label>
            </div>
            <div className="review-submit-area">
              <button type="button" className="btn btn-review" onClick={() => setShowSubmitWarning(true)}>審査内容を登録</button>
            </div>
          </section>
        </>
      )}
      {showSubmitWarning && (
        <div className="submit-confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="submit-confirmation-title">
          <div className="submit-confirmation-modal-content">
            {submitState === 'submitting' ? (
              <>
                <div className="submit-status-header">
                  <div className="loading-spinner" aria-hidden="true" />
                  <h3 id="submit-confirmation-title">登録中...</h3>
                </div>
                <p>申請内容を送信しています。しばらくお待ちください。</p>
              </>
            ) : submitState === 'success' ? (
              <>
                <div className="submit-status-header success">
                  <div className="submit-status-icon" aria-hidden="true">✓</div>
                  <h3 id="submit-confirmation-title">登録しました</h3>
                </div>
                <p>審査内容の登録が完了しました。</p>
                <div className="submit-confirmation-actions single-button">
                  <button type="button" className="btn submit-confirm-btn" onClick={closeSubmitModal}>閉じる</button>
                </div>
              </>
            ) : submitState === 'error' ? (
              <>
                <div className="submit-status-header error">
                  <h3 id="submit-confirmation-title">登録に失敗しました</h3>
                </div>
                <p>{submitError || '審査内容を登録できませんでした。'}</p>
                <div className="submit-confirmation-actions single-button">
                  <button type="button" className="btn submit-confirm-btn" onClick={closeSubmitModal}>閉じる</button>
                </div>
              </>
            ) : (
              <>
                <h3 id="submit-confirmation-title">登録内容の確認</h3>
                <p>以下の内容で審査を登録します。</p>
                <div className="submit-confirmation-list">
                  <div><span>申請ID</span><strong>{displayValue(application.ApplyID)}</strong></div>
                  <div><span>申請種別</span><strong>{displayValue(application.ApplicationType)}</strong></div>
                  <div><span>申請者</span><strong>{displayValue(`${application['UserName-L'] ?? ''} ${application['UserName-F'] ?? ''}`.trim())}</strong></div>
                  <div><span>申請日時</span><strong>{formatDateTime(application.ApplicationDate)}</strong></div>
                  <div><span>審査ステータス</span><strong>{displayValue(form.ReviewStatus)}</strong></div>
                  <div><span>審査担当者ID</span><strong>{displayValue(form.ReviewerID)}</strong></div>
                  <div><span>審査日時</span><strong>{form.ReviewDate ? formatDateTime(form.ReviewDate) : 'ー'}</strong></div>
                  <div><span>審査コメント</span><strong className="submit-confirmation-comment">{displayValue(form.ReviewComment)}</strong></div>
                </div>
                {submitError && <div className="message error-message" role="alert">{submitError}</div>}
                <div className="submit-confirmation-actions">
                  <button type="button" className="btn submit-cancel-btn" onClick={() => setShowSubmitWarning(false)} disabled={isSubmitting}>戻る</button>
                  <button type="button" className="btn submit-confirm-btn" onClick={submitReview} disabled={isSubmitting}>{isSubmitting ? '登録中...' : 'この内容で登録する'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {selectedDocument && (
        <div className="document-image-modal" role="dialog" aria-modal="true" aria-label={`${selectedDocument.label}の拡大表示`} onClick={() => setSelectedDocument(null)}>
          <figure className="document-image-modal-content" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="document-image-close" onClick={() => setSelectedDocument(null)} aria-label="拡大表示を閉じる">×</button>
            <img src={selectedDocument.url} alt={selectedDocument.label} referrerPolicy="no-referrer" />
            <figcaption>{selectedDocument.label}</figcaption>
          </figure>
        </div>
      )}
    </>
  );
}
