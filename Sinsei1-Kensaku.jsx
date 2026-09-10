import { useEffect, useState } from 'react';
import Sinsei2Etsuran from './Sinsei2-Etsuran.jsx';
import Sinsei3Kakikomi from './Sinsei3-Kakikomi.jsx';

const STATUSES = ['受付', '審査中', '承認', '却下'];
const SEARCH_API_URL = 'https://uupsy9mxb1.execute-api.ap-northeast-3.amazonaws.com/yesyes/applications/kensaku';

function formatDateTime(value) {
  if (!value) return 'ー';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

const styles = `
  * { box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; margin: 0; background: #f2f2f2; }
  header { background: #2c3e50; color: #fff; padding: 16px 24px; }
  header h1 { margin: 0; font-size: 20px; }
  .layout { max-width: 1100px; margin: 24px auto; background: #fff; padding: 24px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
  .search-section { border: 1px solid #ddd; padding: 16px; border-radius: 6px; background: #fafafa; margin-bottom: 20px; }
  .search-section h2 { margin-top: 0; font-size: 16px; border-left: 4px solid #3498db; padding-left: 8px; }
  .form-row { display: flex; gap: 16px; margin-bottom: 12px; }
  .form-row label { width: 120px; font-size: 14px; color: #333; }
  .form-row input, .form-row select { flex: 1; padding: 8px; border-radius: 4px; border: 1px solid #ccc; font-size: 14px; }
  .search-actions { text-align: right; margin-top: 12px; }
  .btn { padding: 8px 16px; border-radius: 4px; border: none; font-size: 14px; cursor: pointer; transition: background-color .15s ease, box-shadow .15s ease, transform .15s ease; }
  .btn-search { background: #3498db; color: #fff; }
  .btn-search:hover { background: #2583c2; box-shadow: 0 2px 6px rgba(52, 152, 219, .25); transform: translateY(-1px); }
  .btn-clear { background: #aaa; color: #fff; margin-right: 8px; }
  .btn-clear:hover { background: #888; box-shadow: 0 2px 6px rgba(0, 0, 0, .18); transform: translateY(-1px); }
  .meta { font-size: 13px; color: #666; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { padding: 10px; border-bottom: 1px solid #eee; font-size: 14px; }
  th { background: #f0f0f0; text-align: left; }
  .sort-button { padding: 2px 0; border: 0; border-bottom: 1px dotted transparent; background: transparent; color: inherit; font: inherit; font-weight: 600; cursor: pointer; }
  .sort-button:hover, .sort-button:focus-visible { border-bottom-color: #8fb8cc; background: #f3f8fb; color: #2f6f91; outline: none; }
  .sort-indicator { display: inline-block; margin-left: 3px; color: #2475a8; font-size: 13px; font-weight: 400; }
  .table-header-cell { position: relative; }
  .resize-handle { position: absolute; top: 0; right: -4px; z-index: 1; width: 8px; height: 100%; cursor: col-resize; }
  .resize-handle:hover, .resize-handle:focus-visible { background: rgba(52, 152, 219, .12); outline: none; }
  .pagination { display: flex; justify-content: center; align-items: center; gap: 4px; margin-top: 16px; flex-wrap: wrap; }
  .page-btn { min-width: 32px; padding: 6px 10px; border-radius: 4px; border: 1px solid #ccc; background: #fff; font-size: 13px; cursor: pointer; transition: background-color .15s ease, box-shadow .15s ease, transform .15s ease; }
  .page-btn:not(:disabled):hover { background: #f0f6fa; box-shadow: 0 2px 5px rgba(0, 0, 0, .12); transform: translateY(-1px); }
  .page-btn.active { background: #3498db; color: #fff; border-color: #3498db; cursor: default; }
  .page-btn:disabled { opacity: .4; cursor: default; }
  .detail-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
  .detail-header h2 { margin: 0; font-size: 22px; }
  .back-btn { background: #fff; color: #2c3e50; border: 1px solid #bcc7d1; }
  .detail-card { border: 1px solid #ddd; border-radius: 6px; overflow: hidden; }
  .detail-row { display: flex; border-bottom: 1px solid #eee; }
  .detail-row:last-child { border-bottom: 0; }
  .detail-label { width: 180px; flex: 0 0 180px; padding: 14px 16px; background: #f7f8f9; font-weight: 600; color: #34495e; }
  .detail-value { flex: 1; padding: 14px 16px; white-space: pre-wrap; }
  .detail-section { margin-top: 24px; }
  .detail-section h3 { font-size: 17px; margin: 0 0 10px; }
  .review-actions { display: flex; justify-content: center; margin-top: 28px; }
  .btn-review { min-width: 240px; padding: 13px 28px; background: #2F4F4F; color: #fff; font-size: 16px; font-weight: 600; }
  .btn-review:hover { background: #63d9a7; box-shadow: 0 3px 8px rgba(21, 83, 61, .2); }
  .btn-review:focus-visible { outline: 3px solid #15533d; outline-offset: 3px; }
  .review-screen-section { margin-top: 28px; }
  .review-screen-section h3 { margin: 0 0 12px; font-size: 18px; }
  .review-reference-section { color: #555; }
  .review-reference-group { margin-top: 18px; }
  .review-reference-group h4 { margin: 0 0 8px; font-size: 15px; color: #66717a; font-weight: 600; }
  .review-reference-list { border-top: 1px solid #e3e6e8; }
  .review-reference-row { display: flex; border-bottom: 1px solid #e3e6e8; font-size: 13px; }
  .review-reference-label { width: 180px; flex: 0 0 180px; padding: 9px 12px; color: #707980; background: #fafbfb; }
  .review-reference-value { flex: 1; padding: 9px 12px; white-space: pre-wrap; }
  .document-grid { display: flex; flex-wrap: wrap; gap: 16px; }
  .document-item { margin: 0; border: 1px solid #dfe3e5; border-radius: 4px; padding: 12px; background: #fafbfb; }
  .document-item figcaption { margin-bottom: 8px; font-weight: 600; color: #66717a; }
  .document-item img { display: block; width: 200px; max-width: 100%; height: auto; object-fit: contain; background: #fff; }
  .document-image-button { display: block; padding: 0; border: 0; cursor: zoom-in; background: #fff; }
  .document-image-button:focus-visible { outline: 3px solid #3498db; outline-offset: 3px; }
  .document-image-modal { position: fixed; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(0, 0, 0, .72); }
  .document-image-modal-content { position: relative; max-width: min(92vw, 1100px); max-height: 92vh; padding: 16px; background: #fff; box-shadow: 0 4px 24px rgba(0, 0, 0, .35); }
  .document-image-modal-content img { display: block; max-width: min(88vw, 1050px); max-height: 82vh; width: auto; height: auto; object-fit: contain; }
  .document-image-modal-content figcaption { margin-top: 10px; color: #34495e; font-weight: 600; text-align: center; }
  .document-image-close { position: absolute; top: 4px; right: 4px; width: 32px; height: 32px; border: 1px solid #bcc7d1; border-radius: 50%; background: #fff; color: #34495e; font-size: 20px; line-height: 1; cursor: pointer; }
  .document-empty { border: 1px solid #eee; background: #fafafa; }
  .review-form { display: grid; gap: 16px; border: 1px solid #cfd6da; border-radius: 4px; padding: 18px; background: #f8fafb; }
  .review-form label { display: grid; gap: 6px; font-size: 14px; font-weight: 600; color: #34495e; }
  .review-form input, .review-form select, .review-form textarea { width: 100%; padding: 9px 10px; border: 1px solid #bbb; border-radius: 4px; font: inherit; font-weight: 400; color: #222; background: #fff; }
  .review-form textarea { resize: vertical; }
  .review-submit-area { display: flex; justify-content: center; margin-top: 20px; }
  .submit-confirmation-modal { position: fixed; inset: 0; z-index: 30; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(0, 0, 0, .45); }
  .submit-confirmation-modal-content { width: min(100%, 560px); max-height: 90vh; overflow-y: auto; padding: 28px 32px; border-radius: 8px; background: #fff; box-shadow: 0 4px 24px rgba(0, 0, 0, .28); }
  .submit-confirmation-modal-content h3 { margin: 0; color: #34495e; font-size: 19px; }
  .submit-confirmation-modal-content p { margin: 12px 0 18px; color: #555; line-height: 1.7; }
  .submit-confirmation-list { border-top: 1px solid #dfe3e5; }
  .submit-confirmation-list > div { display: flex; gap: 16px; padding: 9px 0; border-bottom: 1px solid #dfe3e5; font-size: 14px; }
  .submit-confirmation-list span { flex: 0 0 130px; color: #707980; }
  .submit-confirmation-list strong { flex: 1; min-width: 0; color: #34495e; font-weight: 600; white-space: pre-wrap; overflow-wrap: anywhere; }
  .submit-confirmation-comment { font-weight: 400 !important; }
  .submit-confirmation-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; }
  .submit-cancel-btn { border: 1px solid #bcc7d1; background: #fff; color: #34495e; }
  .submit-confirm-btn { background: #2f4f4f; color: #fff; }
  .submit-confirm-btn:hover { background: #63d9a7; }
  .status { display: inline-block; padding: 3px 10px; border-radius: 12px; background: #e8f4fc; color: #2475a8; font-size: 13px; }
  .file-list, .history-list { margin: 0; padding: 0; list-style: none; }
  .file-list li, .history-list li { padding: 10px 12px; border-bottom: 1px solid #eee; }
  .file-list li:last-child, .history-list li:last-child { border-bottom: 0; }
  .history-list { border: 1px solid #ddd; border-radius: 6px; }
  .history-date { color: #666; margin-right: 16px; }
  .message { padding: 24px; text-align: center; color: #555; }
  .error-message { color: #b42318; background: #fff1f0; border: 1px solid #f2b8b5; border-radius: 6px; }
  .loading-modal { position: fixed; inset: 0; z-index: 10; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.35); }
  .loading-modal-content { min-width: 240px; padding: 28px 32px; border-radius: 8px; background: #fff; box-shadow: 0 4px 18px rgba(0,0,0,.2); text-align: center; }
  .loading-modal-content p { margin: 12px 0 0; color: #34495e; }
  .loading-spinner { width: 28px; height: 28px; margin: 0 auto; border: 3px solid #d9eaf5; border-top-color: #3498db; border-radius: 50%; animation: loading-spin .8s linear infinite; }
  @keyframes loading-spin { to { transform: rotate(360deg); } }
  @media (max-width: 600px) { .layout { margin: 12px; padding: 16px; } .form-row { gap: 8px; } .form-row label { width: 88px; } table { display: block; overflow-x: auto; white-space: nowrap; } }
`;

function SearchForm({ values, onChange, onSubmit, onClear }) {
  return (
    <section className="search-section">
      <h2>検索条件</h2>
      <form onSubmit={onSubmit}>
        <div className="form-row">
          <label htmlFor="keyword">キーワード</label>
          <input id="keyword" type="text" value={values.keyword} onChange={(event) => onChange('keyword', event.target.value)} placeholder="例：申請番号、氏名など" />
        </div>
        <div className="form-row">
          <label htmlFor="status">ステータス</label>
          <select id="status" value={values.status} onChange={(event) => onChange('status', event.target.value)}>
            <option value="">すべて</option>
            {STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label htmlFor="pageSize">表示件数</label>
          <select id="pageSize" value={values.pageSize} onChange={(event) => onChange('pageSize', Number(event.target.value))}>
            {[5, 10, 20].map((size) => <option key={size} value={size}>{size}件</option>)}
          </select>
        </div>
        <div className="search-actions">
          <button type="button" className="btn btn-clear" onClick={onClear}>クリア</button>
          <button type="submit" className="btn btn-search">検索</button>
        </div>
      </form>
    </section>
  );
}

function ResultsTable({ items, hasSearched, onDetail, sortKey, sortDirection, onSort, columnWidths, onResizeStart }) {
  const renderHeader = (label, key) => (
    <th className="table-header-cell" style={{ width: columnWidths[key] }}>
      <button type="button" className="sort-button" onClick={() => onSort(key)}>
        {label}
        {sortKey === key && <span className="sort-indicator" aria-hidden="true">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
      </button>
      <span className="resize-handle" role="separator" tabIndex="0" aria-label={`${label}の列幅を変更`} title="ドラッグして列幅を変更" onPointerDown={(event) => onResizeStart(event, key)} />
    </th>
  );

  return (
    <table>
      <colgroup>
        {['ApplyID', 'UserName', 'ApplicationDate', 'Status', 'KosekiMatched', 'ReviewStatus', 'UpdatedAt'].map((key) => <col key={key} style={{ width: columnWidths[key] }} />)}
        <col style={{ width: columnWidths.actions }} />
      </colgroup>
      <thead><tr>{renderHeader('申請ID', 'ApplyID')}{renderHeader('氏名', 'UserName')}{renderHeader('申請日時', 'ApplicationDate')}{renderHeader('申請状態', 'Status')}{renderHeader('戸籍照合', 'KosekiMatched')}{renderHeader('審査', 'ReviewStatus')}{renderHeader('更新日時', 'UpdatedAt')}<th style={{ width: columnWidths.actions }}>詳細</th></tr></thead>
      <tbody>
        {items.length === 0 && hasSearched ? <tr><td colSpan={8}>該当する結果がありません。</td></tr> : items.map((item) => (
          <tr key={item.ApplyID}>
            <td>{item.ApplyID}</td>
            <td>{item.UserName || 'ー'}</td>
            <td>{formatDateTime(item.ApplicationDate)}</td>
            <td>{item.Status || 'ー'}</td>
            <td>{item.KosekiMatched === true ? '一致' : item.KosekiMatched === false ? '不一致' : 'ー'}</td>
            <td>{item.ReviewStatus || 'ー'}</td>
            <td>{formatDateTime(item.UpdatedAt)}</td>
            <td><button className="btn btn-search" onClick={() => onDetail({ id: item.ApplyID })}>詳細</button></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Pagination({ currentPage, totalPages, onPageChange }) {
  return (
    <nav className="pagination" aria-label="ページング">
      <button className="page-btn" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>前へ</button>
      {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
        <button key={page} className={`page-btn${page === currentPage ? ' active' : ''}`} disabled={page === currentPage} onClick={() => onPageChange(page)}>{page}</button>
      ))}
      <button className="page-btn" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)}>次へ</button>
    </nav>
  );
}

export default function Sinsei1Kensaku() {
  const initialValues = { keyword: '', status: '', pageSize: 10 };
  const [values, setValues] = useState(initialValues);
  const [submitted, setSubmitted] = useState(initialValues);
  const [items, setItems] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [totalCount, setTotalCount] = useState(null);
  const [nextTokens, setNextTokens] = useState([null]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'ApplyID', direction: 'asc' });
  const [columnWidths, setColumnWidths] = useState({
    ApplyID: 110, UserName: 130, ApplicationDate: 170, Status: 130,
    KosekiMatched: 110, ReviewStatus: 120, UpdatedAt: 170, actions: 80,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [applicationNumber, setApplicationNumber] = useState(() => window.location.pathname.match(/^\/applications\/([^/]+)$/)?.[1] || '');
  const [reviewApplicationNumber, setReviewApplicationNumber] = useState(() => window.location.pathname.match(/^\/applications\/([^/]+)\/review$/)?.[1] || '');

  useEffect(() => {
    fetchResults(initialValues, 1, null);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setApplicationNumber(window.location.pathname.match(/^\/applications\/([^/]+)$/)?.[1] || '');
      setReviewApplicationNumber(window.location.pathname.match(/^\/applications\/([^/]+)\/review$/)?.[1] || '');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const totalPages = totalCount === null ? Math.max(1, currentPage + (nextTokens[currentPage] ? 1 : 0)) : Math.max(1, Math.ceil(totalCount / submitted.pageSize));
  const safePage = currentPage;
  const pageItems = [...items].sort((left, right) => {
    if (!sortConfig.key) return 0;
    const leftValue = left[sortConfig.key];
    const rightValue = right[sortConfig.key];
    if (sortConfig.key === 'ApplicationDate' || sortConfig.key === 'UpdatedAt') {
      return (new Date(leftValue || 0).getTime() - new Date(rightValue || 0).getTime()) * (sortConfig.direction === 'asc' ? 1 : -1);
    }
    if (sortConfig.key === 'KosekiMatched') {
      return (Number(Boolean(leftValue)) - Number(Boolean(rightValue))) * (sortConfig.direction === 'asc' ? 1 : -1);
    }
    return String(leftValue ?? '').localeCompare(String(rightValue ?? ''), 'ja') * (sortConfig.direction === 'asc' ? 1 : -1);
  });

  const fetchResults = async (searchValues, page, token) => {
    setHasSearched(true);
    setLoading(true);
    setSearchError('');
    try {
      const response = await fetch(SEARCH_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: searchValues.keyword.trim(),
          status: searchValues.status,
          pageSize: searchValues.pageSize,
          nextToken: token || undefined,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || '検索結果を取得できませんでした。');
      setItems(Array.isArray(result.items) ? result.items : []);
      setTotalCount(typeof result.totalCount === 'number' ? result.totalCount : null);
      setNextTokens((current) => {
        const updated = current.slice(0, page + 1);
        updated[page] = result.nextToken || null;
        return updated;
      });
    } catch (error) {
      setItems([]);
      setSearchError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateValue = (key, value) => setValues((current) => ({ ...current, [key]: value }));
  const handleSubmit = (event) => {
    event.preventDefault();
    const nextValues = { ...values, keyword: values.keyword.trim() };
    setSubmitted(nextValues);
    setNextTokens([null]);
    setCurrentPage(1);
    fetchResults(nextValues, 1, null);
  };
  const handleClear = () => {
    setValues(initialValues);
    setSubmitted(initialValues);
    setNextTokens([null]);
    setCurrentPage(1);
    fetchResults(initialValues, 1, null);
  };

  const handlePageChange = (page) => {
    if (page < 1 || page === currentPage || (page > currentPage && !nextTokens[currentPage])) return;
    const token = page > currentPage ? nextTokens[currentPage] : nextTokens[page - 1];
    setCurrentPage(page);
    fetchResults(submitted, page, token);
  };

  const handleSort = (key) => {
    setSortConfig((current) => current.key === key
      ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: 'asc' });
  };

  const handleResizeStart = (event, key) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = columnWidths[key];
    const handlePointerMove = (moveEvent) => {
      const nextWidth = Math.max(72, startWidth + moveEvent.clientX - startX);
      setColumnWidths((current) => ({ ...current, [key]: nextWidth }));
    };
    const handlePointerUp = () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  const openDetail = (item) => {
    window.history.pushState({}, '', `/applications/${item.id}`);
    setApplicationNumber(String(item.id));
  };
  const returnToSearch = () => {
    window.history.replaceState({}, '', '/');
    setApplicationNumber('');
    setReviewApplicationNumber('');
  };
  const openReview = (request) => {
    const applyId = request.ApplyID;
    window.history.pushState({}, '', `/applications/${applyId}/review`);
    setApplicationNumber('');
    setReviewApplicationNumber(applyId);
  };
  const returnToDetail = (applyId = reviewApplicationNumber) => {
    const normalizedApplyId = String(applyId || '').padStart(6, '0');
    window.history.replaceState({}, '', `/applications/${normalizedApplyId}`);
    setReviewApplicationNumber('');
    setApplicationNumber(normalizedApplyId);
  };

  if (reviewApplicationNumber) {
    return <><style>{styles}</style><header><h1>支援金 電子マネー申請</h1></header><main className="layout"><Sinsei3Kakikomi applicationNumber={reviewApplicationNumber} onBack={returnToDetail} /></main></>;
  }

  if (applicationNumber) {
    return <><style>{styles}</style><header><h1>支援金 電子マネー申請</h1></header><main className="layout"><Sinsei2Etsuran applicationNumber={applicationNumber} onBack={returnToSearch} onReview={openReview} /></main></>;
  }

  return (
    <>
      <style>{styles}</style>
      <header><h1>支援金 電子マネー申請</h1></header>
      <main className="layout">
        <SearchForm values={values} onChange={updateValue} onSubmit={handleSubmit} onClear={handleClear} />
        {searchError && <div className="message error-message" role="alert">{searchError}</div>}
        {loading && <div className="message">検索中...</div>}
        {hasSearched && <div className="meta">検索結果：{totalCount === null ? `${items.length}件` : `${totalCount}件`} / ページ {safePage} / 全{totalPages}ページ</div>}
        <ResultsTable items={pageItems} hasSearched={hasSearched} onDetail={openDetail} sortKey={sortConfig.key} sortDirection={sortConfig.direction} onSort={handleSort} columnWidths={columnWidths} onResizeStart={handleResizeStart} />
        {hasSearched && <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={handlePageChange} />}
      </main>
    </>
  );
}
