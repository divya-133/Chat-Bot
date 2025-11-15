(function () {
  console.log("SDW: Loader started");

  // Read company ID from embed tag
  const COMPANY_ID =
    (document.currentScript &&
      document.currentScript.dataset &&
      document.currentScript.dataset.company) ||
    "default_company";

  window.sdw_companyId = COMPANY_ID;
  console.log("SDW: company =", COMPANY_ID);

  // Inject CSS (idempotent)
  if (!document.getElementById("sdw-styles")) {
    const style = document.createElement("style");
    style.id = "sdw-styles";
    style.textContent = `
/* sdw widget styles (kept concise) */
.sdw-chat-widget { position: fixed; bottom: 20px; right: 25px; z-index: 2147483647; font-family: 'Poppins', sans-serif; }
.sdw-chat-widget * { box-sizing: border-box; }
.sdw-chat-icon {
  background: #2563eb; color: #fff; font-size: 1.5rem;
  padding: 14px 16px; border-radius: 50%; cursor: pointer;
  box-shadow: 0 4px 12px rgba(37,99,235,0.35);
  transition: transform 0.18s ease;
  display: inline-flex; align-items:center; justify-content:center;
}
.sdw-chat-icon:hover { transform: scale(1.05); }

/* chat box */
.sdw-chat-box {
  width: 360px;
  max-width: calc(100vw - 48px);
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(2,6,23,0.12);
  position: absolute;
  bottom: 64px;
  right: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(15,23,42,0.04);
  min-height: 160px;
}
.sdw-chat-header {
  background: #2563eb;
  color: #fff;
  padding: 12px 14px;
  font-weight: 600;
  display:flex;
  justify-content:space-between;
  align-items:center;
}
.sdw-close-btn { cursor:pointer; font-size:1.2rem; background:transparent; border:none; color:#fff; }

.sdw-chat-form { display:flex; flex-direction:column; padding:12px; gap:8px; }
.sdw-chat-form input, .sdw-chat-form select, .sdw-chat-form textarea {
  padding:8px; border:1px solid #e2e8f0; border-radius:8px; font-size:0.95rem; outline:none;
}
.sdw-start-btn {
  background: linear-gradient(90deg,#2563eb,#1e40af);
  color:white; padding:10px; border:none; border-radius:10px; cursor:pointer; font-weight:600;
}
.sdw-start-btn:hover { transform: translateY(-1px); }

/* chat body */
.sdw-chat-body { display:flex; flex-direction:column; gap:8px; padding:12px; overflow-y:auto; background: linear-gradient(180deg,#fbfdff,#fff); flex:1; min-height:120px; }
.sdw-user-msg, .sdw-agent-msg, .sdw-system-msg {
  padding:8px 12px; border-radius:12px; max-width:78%; word-break:break-word; margin:4px 0;
}
.sdw-user-msg { background:#2563eb; color:#fff; align-self:flex-end; }
.sdw-agent-msg { background:#eff6ff; color:#0f172a; align-self:flex-start; }
.sdw-system-msg { background:transparent; color:#6b7280; font-style:italic; align-self:center; }

/* input area */
.sdw-chat-input { display:flex; padding:10px; border-top:1px solid #eef2f7; gap:8px; align-items:center; }
.sdw-chat-input input { flex:1; padding:10px; border-radius:8px; border:1px solid #e2e8f0; }
.sdw-chat-input button { background:#2563eb; color:#fff; border:none; padding:10px 14px; border-radius:8px; cursor:pointer; }

/* end */
.sdw-end-chat { margin:10px; padding:8px 12px; border-radius:8px; background:#fff5f5; color:#b91c1c; border:1px solid rgba(185,28,28,0.08); cursor:pointer; }

/* utility */
.sdw-hidden { display:none !important; }

@media (max-width:520px) {
  .sdw-chat-box { right:12px; left:12px; bottom:24px; width:auto; height:78vh; max-height:none; }
  .sdw-chat-icon { width:56px; height:56px; font-size:24px; }
}
    `;
    document.head.appendChild(style);
  }

  // Inject DOM once (wrapped properly)
  if (!document.getElementById("sdw-widget-root")) {
    const root = document.createElement("div");
    root.id = "sdw-widget-root";
    // keep container class for correct positioning
    root.className = "sdw-chat-widget";
    root.innerHTML = `
      <div class="sdw-chat-icon" id="sdw-bubble" title="Chat with us">💬</div>

      <div class="sdw-chat-box sdw-hidden" id="sdw-box" role="dialog" aria-label="Chat widget">
        <div class="sdw-chat-header">
          <span id="sdw-header-title">Chat with us now</span>
          <button class="sdw-close-btn" id="sdw-close-btn" aria-label="Close chat">&times;</button>
        </div>

        <form id="sdw-form" class="sdw-chat-form" autocomplete="off">
          <input type="text" id="sdw-name" placeholder="Your name" required />
          <input type="email" id="sdw-email" placeholder="Your email" required />
          <input type="tel" id="sdw-phone" placeholder="Phone (optional)" />
          <select id="sdw-dept" required>
            <option value="">Choose department</option>
            <option value="Sales">Sales</option>
            <option value="Support">Support</option>
            <option value="HR">HR</option>
          </select>
          <textarea id="sdw-query" placeholder="Type your query..." required></textarea>

          <button type="submit" class="sdw-start-btn">Start Chat</button>
          <div id="sdw-form-status" style="font-size:13px;color:#6b7280;margin-top:6px"></div>
        </form>

        <div id="sdw-chat" class="sdw-hidden" style="display:flex;flex-direction:column;height:100%;min-height:200px">
          <div id="sdw-chat-body" class="sdw-chat-body"></div>
          <div class="sdw-chat-input sdw-hidden" id="sdw-input-row">
            <input id="sdw-message" placeholder="Type your message..." />
            <button id="sdw-send" type="button">Send</button>
          </div>
          <button id="sdw-end" class="sdw-end-chat sdw-hidden" type="button">End Chat</button>
        </div>
      </div>
    `;
    document.body.appendChild(root);
  }

  // Load EmailJS (non-blocking)
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return setTimeout(resolve, 50);
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }

  (async function loadEmailJS() {
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js');
      if (window.emailjs) {
        try { emailjs.init('kEnpm3SNxQNY8nPpF'); window.sdw_emailjs_ready = true; }
        catch (e) { console.warn("SDW: emailjs.init failed", e); window.sdw_emailjs_ready = false; }
      } else window.sdw_emailjs_ready = false;
    } catch (err) {
      console.warn("SDW: EmailJS failed to load", err); window.sdw_emailjs_ready = false;
    }
  })();

  // Inject module AFTER DOM insertion and a small tick to ensure elements exist.
  setTimeout(() => {
    const moduleScript = document.createElement("script");
    moduleScript.type = "module";
    // Load widget-core from same host/public (must be served by your node server)
    moduleScript.src = "https://fancy-daifuku-738e0a.netlify.app/widget-core.js";
    moduleScript.onerror = (e) => {
      console.error("SDW: Failed to load module", e);
    };
    document.head.appendChild(moduleScript);
    console.log("SDW: Loader completed — module injected");
  }, 80);

})();
