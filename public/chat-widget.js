(function () {
  "use strict";
  const LOG = (...a) => console.log("SDW:", ...a);

  LOG("Loader started");

  // Company id read from embed script tag
  const COMPANY_ID =
    (document.currentScript && document.currentScript.dataset && document.currentScript.dataset.company) ||
    (document.querySelector('script[data-company]') && document.querySelector('script[data-company]').dataset.company) ||
    "default_company";
  window.sdw_companyId = COMPANY_ID;
  LOG("company =", COMPANY_ID);

  // ----------------------- Styles (idempotent) -----------------------
if (!document.getElementById("sdw-styles")) {
    const style = document.createElement("style");
    style.id = "sdw-styles";
    style.textContent = `
/* ============================
   MODERN INTERCOM STYLE (FIXED)
=============================== */

:root {
  --sdw-accent: #2563eb;
  --sdw-accent-dark: #1e40af;
  --sdw-bg: #ffffff;
  --sdw-text: #0f172a;
  --sdw-muted: #64748b;
}

/* widget */
.sdw-chat-widget {
  position: fixed;
  bottom: 24px;
  right: 26px;
  z-index: 2147483647;
  font-family: 'Inter','Poppins',sans-serif;
}

/* bubble trigger */
.sdw-chat-icon {
  background: linear-gradient(135deg,var(--sdw-accent),var(--sdw-accent-dark));
  color:#fff;
  padding:18px;
  border-radius:50%;
  cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  box-shadow:0 8px 26px rgba(37,99,235,.28);
  transition: transform .2s ease;
}

.sdw-chat-icon:hover { transform: scale(1.05); }

/* chat box */
.sdw-chat-box {
  width:360px;
  background:#fff;
  border-radius:14px;
  position:absolute;
  bottom:80px; right:0;
  display:flex; flex-direction:column;
  box-shadow:0 10px 30px rgba(0,0,0,.15);
  overflow:hidden;
}

/* header */
.sdw-chat-header {
  background:linear-gradient(90deg,var(--sdw-accent),var(--sdw-accent-dark));
  color:#fff;
  padding:14px;
  font-weight:600;
  display:flex; justify-content:space-between; align-items:center;
}

.sdw-close-btn {
  background:none;
  border:none;
  color:white;
  font-size:1.4rem;
  cursor:pointer;
}

/* form */
.sdw-chat-form {
  padding:14px;
  display:flex;
  gap:10px;
  flex-direction:column;
}

.sdw-chat-form input,
.sdw-chat-form select,
.sdw-chat-form textarea {
  padding:10px;
  border-radius:10px;
  border:1px solid #e6eef9;
}

.sdw-start-btn {
  background:linear-gradient(90deg,var(--sdw-accent),var(--sdw-accent-dark));
  color:white;
  padding:10px;
  border:none;
  border-radius:10px;
  cursor:pointer;
}

/* chat body */
.sdw-chat-body {
  padding:14px;
  flex:1;
  display:flex;
  flex-direction:column;
  gap:10px;
  overflow-y:auto;
}

/* messages */
.sdw-user-msg,
.sdw-agent-msg {
  padding:10px 14px;
  border-radius:14px;
  max-width:75%;
  word-break:break-word;
}

.sdw-user-msg {
  background: var(--sdw-accent);
  color: #ffffff !important;
  font-weight: 500;
  opacity: 1 !important;
  align-self: flex-end;
  border-bottom-right-radius: 6px;
}

.sdw-agent-msg {
  background:#eef2ff;
  color:#0f172a;
  align-self:flex-start;
}

.sdw-system-msg {
  color:#64748b;
  text-align:center;
  font-size:.85rem;
}

/* input row */
.sdw-chat-input {
  display:flex;
  gap:10px;
  padding:12px;
  border-top:1px solid #eee;
}

.sdw-chat-input input {
  flex:1;
  padding:10px;
  border-radius:10px;
  border:1px solid #ddd;
}

.sdw-chat-input button {
  background:var(--sdw-accent);
  color:white;
  border:none;
  padding:10px 16px;
  border-radius:10px;
  cursor:pointer;
}

.sdw-end-chat {
  margin:12px;
  background:#fff5f5;
  padding:10px;
  border-radius:10px;
  text-align:center;
  cursor:pointer;
  color:#b91c1c;
}

.sdw-hidden { display:none !important; }
`;
    document.head.appendChild(style); 
}

// ----------------------- DOM injection -----------------------
if (!document.getElementById("sdw-widget-root")) {
    const root = document.createElement("div");
    root.id = "sdw-widget-root";
    root.className = "sdw-chat-widget";

    root.innerHTML = `
      <div class="sdw-chat-icon" id="sdw-bubble">💬</div>

      <div class="sdw-chat-box sdw-hidden" id="sdw-box">
        
        <div class="sdw-chat-header">
          <span>Chat with us</span>
          <button id="sdw-close-btn" class="sdw-close-btn">×</button>
        </div>

        <form id="sdw-form" class="sdw-chat-form">
          <input id="sdw-name" placeholder="Your name" required>
          <input id="sdw-email" placeholder="Your email" type="email" required>
          <input id="sdw-phone" placeholder="Phone (optional)">
          <select id="sdw-dept" required>
            <option value="">Choose department</option>
            <option value="Sales">Sales</option>
            <option value="Support">Support</option>
            <option value="HR">HR</option>
          </select>
          <textarea id="sdw-query" placeholder="Your message..." required></textarea>
          <button class="sdw-start-btn">Start Chat</button>
          <div id="sdw-form-status"></div>
        </form>

        <div id="sdw-chat" class="sdw-hidden">
          <div id="sdw-chat-body" class="sdw-chat-body"></div>

          <div id="sdw-input-row" class="sdw-chat-input sdw-hidden">
            <input id="sdw-message" placeholder="Type a message...">
            <button id="sdw-send">Send</button>
          </div>

          <button id="sdw-end" class="sdw-end-chat sdw-hidden">End Chat</button>
        </div>

      </div>
    `;
    document.body.appendChild(root);
}

  // ----------------------- Script loader helper -----------------------
  function loadScript(src, attrs = {}) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return setTimeout(resolve, 50);
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      for (const k in attrs) s.setAttribute(k, attrs[k]);
      s.onload = () => resolve();
      s.onerror = (e) => reject(new Error("Failed to load " + src));
      document.head.appendChild(s);
    });
  }

  // ----------------------- Load Firebase compat + EmailJS -----------------------
  const firebaseAppCompat = "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js";
  const firebaseDatabaseCompat = "https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js";
  const emailJsSrc = "https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js";

  (async function bootstrap() {
    try {
      // load firebase compat libs
      await loadScript(firebaseAppCompat);
      await loadScript(firebaseDatabaseCompat);
      LOG("Firebase compat loaded");
    } catch (e) {
      console.error("SDW: Firebase scripts failed to load", e);
      return;
    }

    // initialize firebase (compat syntax)
    try {
      const firebaseConfig = {
        apiKey: "AIzaSyBsP14amVbh6uVkXUxFEqu6UTX1x5qG5sg",
        authDomain: "staunchdesk-chat-f23f7.firebaseapp.com",
        databaseURL: "https://staunchdesk-chat-f23f7-default-rtdb.firebaseio.com/",
        projectId: "staunchdesk-chat-f23f7",
        storageBucket: "staunchdesk-chat-f23f7.appspot.com",
        messagingSenderId: "634913544469",
        appId: "1:634913544469:web:cfbc044eacd1a124cbf11c"
      };
      if (!window.firebase || !window.firebase.apps) {
        console.warn("SDW: firebase object missing; make sure compat scripts loaded");
      }
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      window.sdw_db = firebase.database();
      LOG("Firebase initialized");
    } catch (err) {
      console.error("SDW: Firebase init error", err);
      return;
    }

    // load EmailJS optionally (non-blocking)
    try {
      await loadScript(emailJsSrc);
      if (window.emailjs && typeof emailjs.init === "function") {
        try { emailjs.init("kEnpm3SNxQNY8nPpF"); window.sdw_emailjs_ready = true; LOG("EmailJS ready"); } catch (e) { window.sdw_emailjs_ready = false; LOG("EmailJS init failed", e); }
      } else {
        window.sdw_emailjs_ready = false;
        LOG("EmailJS not available");
      }
    } catch (e) {
      window.sdw_emailjs_ready = false;
      LOG("EmailJS load failed (allowed)", e);
    }
    initWidget();
  })();

  // ----------------------- Main widget logic -----------------------
  function initWidget() {
    LOG("Widget logic starting...");

    // DOM refs
    const bubble = document.getElementById("sdw-bubble");
    const box = document.getElementById("sdw-box");
    const closeBtn = document.getElementById("sdw-close-btn");

    const form = document.getElementById("sdw-form");
    const nameInput = document.getElementById("sdw-name");
    const emailInput = document.getElementById("sdw-email");
    const phoneInput = document.getElementById("sdw-phone");
    const deptSelect = document.getElementById("sdw-dept");
    const queryInput = document.getElementById("sdw-query");
    const formStatus = document.getElementById("sdw-form-status");

    const chatWrap = document.getElementById("sdw-chat");
    const chatBody = document.getElementById("sdw-chat-body");
    const inputRow = document.getElementById("sdw-input-row");
    const messageInput = document.getElementById("sdw-message");
    const sendBtn = document.getElementById("sdw-send");
    const endBtn = document.getElementById("sdw-end");

    // session
    let activeChatRef = null;
    let clientId = localStorage.getItem("sdw_client_id");
    if (!clientId) {
      clientId = "client_" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem("sdw_client_id", clientId);
    }

    function saveSession(obj) { localStorage.setItem("sdw_chat_session", JSON.stringify(obj)); }
    function getSession() { try { return JSON.parse(localStorage.getItem("sdw_chat_session")); } catch { return null; } }
    function clearSession() { localStorage.removeItem("sdw_chat_session"); }

    function appendMsgUI(sender, text) {
      if (!chatBody) return;
      const el = document.createElement("div");
      if (sender === "user") el.className = "sdw-user-msg";
      else if (sender === "agent") el.className = "sdw-agent-msg";
      else el.className = "sdw-system-msg";
      el.textContent = text;
      chatBody.appendChild(el);
      chatBody.scrollTop = chatBody.scrollHeight;
    }

    // open/close handlers
    function openBox() {
      if (!box) return;
      box.classList.remove("sdw-hidden");
      box.setAttribute("aria-hidden", "false");
      setTimeout(() => tryRestoreSession(), 60);
    }
    function closeBox() {
      if (!box) return;
      box.classList.add("sdw-hidden");
      box.setAttribute("aria-hidden", "true");
    }

    bubble.addEventListener("click", openBox);
    closeBtn.addEventListener("click", closeBox);

    // Firebase helpers (compat)
    const db = window.sdw_db;
    if (!db) {
      console.error("SDW: Firebase DB not available — widget cannot work");
      appendMsgUI("system", "Chat currently unavailable (config error).");
      return;
    }

    async function getOnlineAgent(dept) {
      try {
        const snap = await db.ref(`presence/${COMPANY_ID}/${dept}`).get();
        if (!snap.exists()) return null;
        const agents = snap.val();
        for (const [name, info] of Object.entries(agents)) {
          if (info && info.online) return { name, email: info.email || "" };
        }
        return null;
      } catch (e) {
        console.warn("SDW: getOnlineAgent err", e);
        return null;
      }
    }

    // Listen to messages for a chat
    const listeningRefs = { ref: null, listener: null };
    function listenMessages(dept, chatKey) {
      try {
        if (listeningRefs.ref && listeningRefs.listener) {
          listeningRefs.ref.off("child_added", listeningRefs.listener);
        }
      } catch (e) {}
      const messagesPath = `chats/${COMPANY_ID}/${dept}/${chatKey}/messages`;
      const refObj = db.ref(messagesPath);
      listeningRefs.ref = refObj;
      listeningRefs.listener = refObj.on("child_added", (snap) => {
        const msg = snap.val();
        if (!msg || !msg.text) return;
        appendMsgUI(msg.sender, msg.text);
      });
      activeChatRef = refObj;
    }

    // Form submit — start chat
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const name = (nameInput.value || "").trim();
      const email = (emailInput.value || "").trim();
      const phone = (phoneInput.value || "").trim();
      const dept = (deptSelect.value || "").trim();
      const query = (queryInput.value || "").trim();

      if (!name || !email || !dept || !query) {
        formStatus.textContent = "Please fill all fields.";
        return;
      }
      formStatus.textContent = "";

      const deptNorm = dept.charAt(0).toUpperCase() + dept.slice(1).toLowerCase();
      const chatKey = `${deptNorm}_${clientId}`;

      const infoRef = db.ref(`chats/${COMPANY_ID}/${deptNorm}/${chatKey}/info`);
      const msgRef = db.ref(`chats/${COMPANY_ID}/${deptNorm}/${chatKey}/messages`);

      try {
        await infoRef.set({
          userName: name,
          userEmail: email,
          phone: phone || "",
          department: deptNorm,
          startedAt: Date.now(),
          firstMessage: query,
        });

        // Save locally
        saveSession({ dept: deptNorm, chatKey, clientId });

        // UI switch
        form.classList.add("sdw-hidden");
        chatWrap.classList.remove("sdw-hidden");
        inputRow.classList.remove("sdw-hidden");
        endBtn.classList.remove("sdw-hidden");

        appendMsgUI("user", query);

        // Check agent presence
        const agent = await getOnlineAgent(deptNorm);
        if (agent) {
          appendMsgUI("system", `Connecting to ${agent.name}...`);
          try { await msgRef.push({ sender: "user", text: query, ts: Date.now() }); } catch (e) { console.warn("SDW: push failed", e); }
          listenMessages(deptNorm, chatKey);
        } else {
          appendMsgUI("system", "Agent offline. Sending notification & email...");

          // Email fallback if available
          if (window.sdw_emailjs_ready && window.emailjs && typeof emailjs.send === "function") {
            try {
              await emailjs.send("service_hyp528n", "template_md28m0i", {
                from_name: name,
                reply_to: email,
                message: query,
                department: deptNorm,
              });
              appendMsgUI("system", "📧 Email sent successfully.");
            } catch (e) {
              console.warn("SDW: email send failed", e);
              appendMsgUI("system", "Email failed; notification saved.");
            }
          } else {
            appendMsgUI("system", "Email fallback not available.");
          }

          // Push notification record for agent dashboard
          try {
            await db.ref(`notifications/${COMPANY_ID}/${deptNorm}`).push({
              from: name, email, message: query, dept: deptNorm, timestamp: Date.now(), status: "unread"
            });
          } catch (e) { console.warn("SDW: notif push failed", e); }

          listenMessages(deptNorm, chatKey);
        }

        form.reset();
      } catch (err) {
        console.error("SDW: error starting chat", err);
        formStatus.textContent = "Could not start chat — try again.";
      }
    });

    // Send message from user while chat open
    sendBtn.addEventListener("click", async () => {
      const text = (messageInput.value || "").trim();
      if (!text) return;
      if (!activeChatRef) {
        appendMsgUI("system", "No active chat. Start a chat first.");
        return;
      }
      try {
        await activeChatRef.push({ sender: "user", text, ts: Date.now() });
        messageInput.value = "";
      } catch (e) {
        console.warn("SDW: send failed", e);
        appendMsgUI("system", "Message failed to send.");
      }
    });

    // Enter to send
    messageInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        sendBtn.click();
      }
    });

    // End chat
    endBtn.addEventListener("click", () => {
      try {
        if (listeningRefs.ref && listeningRefs.listener) {
          listeningRefs.ref.off("child_added", listeningRefs.listener);
        }
      } catch (e) {}
      clearSession();
      chatBody.innerHTML = "";
      messageInput.value = "";
      chatWrap.classList.add("sdw-hidden");
      inputRow.classList.add("sdw-hidden");
      endBtn.classList.add("sdw-hidden");
      form.classList.remove("sdw-hidden");
    });

    // Restore session if exists
    async function tryRestoreSession() {
      const s = getSession();
      if (!s || !s.dept || !s.chatKey) return;
      const { dept, chatKey } = s;
      form.classList.add("sdw-hidden");
      chatWrap.classList.remove("sdw-hidden");
      inputRow.classList.remove("sdw-hidden");
      endBtn.classList.remove("sdw-hidden");
      chatBody.innerHTML = "";

      const messagesRef = db.ref(`chats/${COMPANY_ID}/${dept}/${chatKey}/messages`);
      try {
        const snap = await messagesRef.get();
        if (snap && snap.exists()) {
          const obj = snap.val();
          const arr = Object.values(obj).sort((a,b) => (a.ts||0)-(b.ts||0));
          arr.forEach(m => { if (m && m.text) appendMsgUI(m.sender, m.text); });
          chatBody.scrollTop = chatBody.scrollHeight;
        }
      } catch (e) { console.warn("SDW: restore history err", e); }

      listenMessages(dept, chatKey);
    }

    // expose small debug helper
    window.sdw_tryRestoreSession = tryRestoreSession;

    // attempt immediate restore
    tryRestoreSession().catch(() => {});

    LOG("Widget logic loaded");
  }

  LOG("Loader completed");
})();
