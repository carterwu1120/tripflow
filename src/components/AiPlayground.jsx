import { useEffect, useRef, useState } from "react";
import { getAiStatus, testAi } from "../services/aiClient";
import { compressImage } from "../services/compressImage";

// Debug panel for the ChatGPT plan connection. Shown only with ?ai-test in the URL.
export default function AiPlayground() {
  const [status, setStatus] = useState(null);
  const [text, setText] = useState("");
  const [image, setImage] = useState(null);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    getAiStatus()
      .then(setStatus)
      .catch((statusError) => setStatus({ connected: false, error: statusError.message }));
  }, []);

  async function handlePhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) setImage(await compressImage(file));
  }

  async function handleSend(event) {
    event.preventDefault();
    if (!text.trim() && !image) return;
    setBusy(true);
    setError("");
    setOutput("");
    try {
      setOutput(await testAi({ text: text.trim(), image }));
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ai-playground" aria-label="ChatGPT test panel">
      <header>
        <strong>ChatGPT 測試</strong>
        <span className={`ai-status ${status?.connected ? "connected" : ""}`}>
          {!status && "檢查連線中…"}
          {status?.connected && `已連結 · ${status.model}`}
          {status && !status.connected && (status.error ?? "尚未連結,請執行 node scripts/connect-chatgpt.mjs")}
        </span>
      </header>
      <form onSubmit={handleSend}>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="輸入任何問題,或搭配圖片問「這張圖是什麼?」"
          rows={3}
        />
        <div className="ai-playground-actions">
          <button type="button" className="secondary-button compact" onClick={() => fileInputRef.current?.click()}>
            {image ? "換一張圖" : "📎 附圖片"}
          </button>
          {image && (
            <button type="button" className="secondary-button compact" onClick={() => setImage(null)}>
              移除圖片
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handlePhoto} />
          <button type="submit" className="primary-button compact" disabled={busy}>
            {busy ? "等待回覆…" : "送出"}
          </button>
        </div>
        {image && <img className="ai-playground-preview" src={image} alt="Attached" />}
      </form>
      {error && <p className="ai-playground-error">{error}</p>}
      {output && <pre className="ai-playground-output">{output}</pre>}
    </section>
  );
}
