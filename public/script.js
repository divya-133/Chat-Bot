import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  onChildAdded,
  push,
  off
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// -------------------- COMPANY ID --------------------
const currentScript = document.currentScript || 
  (document.querySelector('script[data-company]') ?? {});
const companyId = currentScript.dataset?.company || "default_company";
console.log("🏢 Loaded company:", companyId);


// -------------------- FIREBASE CONFIG --------------------
const firebaseConfig = {
  apiKey: "AIzaSyBsP14amVbh6uVkXUxFEqu6UTX1x5qG5sg",
  authDomain: "sstaunchdesk-chat-f23f7.firebaseapp.com",
  databaseURL: "https://staunchdesk-chat-f23f7-default-rtdb.firebaseio.com/",
  projectId: "sstaunchdesk-chat-f23f7",
  storageBucket: "sstaunchdesk-chat-f23f7.firebasestorage.app",
  messagingSenderId: "634913544469",
  appId: "1:634913544469:web:cfbc044eacd1a124cbf11c",
  measurementId: "G-VV3TNEWSQ3",
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// -------------------- GLOBALS --------------------
let CONFIG = {};
let CONFIG_LOADED = false;
let chatRef = null;

let clientId =
  localStorage.getItem("clientId") ||
  "client_" + Math.random().toString(36).substring(2, 10);
localStorage.setItem("clientId", clientId);

// -------------------- EMAIL MAP --------------------
const DEPARTMENT_EMAILS = {
  Sales: "sales@yourcompany.com",
  Support: "support@yourcompany.com",
  HR: "hr@yourcompany.com",
};

// -------------------- LOAD CONFIG --------------------
async function loadConfig() {
  try {
    const res = await fetch("/config");
    CONFIG = await res.json();
    if (
      CONFIG.EMAILJS_PUBLIC_KEY &&
      CONFIG.EMAILJS_SERVICE_ID &&
      CONFIG.EMAILJS_TEMPLATE_ID
    ) {
      emailjs.init(CONFIG.EMAILJS_PUBLIC_KEY);
      CONFIG_LOADED = true;
      console.log("✅ EmailJS initialized");
    }
  } catch {
    console.warn("⚠️ Skipping EmailJS config (local mode)");
  }
}

// -------------------- SESSION HELPERS --------------------
function saveSession(data) {
  localStorage.setItem("chatSession", JSON.stringify(data));
}
function getSession() {
  const data = localStorage.getItem("chatSession");
  return data ? JSON.parse(data) : null;
}
function clearSession() {
  localStorage.removeItem("chatSession");
  localStorage.removeItem("clientId");
}

// -------------------- APP INIT --------------------
window.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 Chat widget initializing...");
  await loadConfig();

  const form = document.getElementById("supportForm");
  const deptSelect = document.getElementById("supportType");
  const chatBody = document.querySelector(".chat-body");
  const chatInputBox = document.querySelector(".chat-input input");
  const chatSendBtn = document.querySelector(".chat-input button");

  chatBody.style.maxHeight = "350px";
  chatBody.style.overflowY = "auto";

  const endChatBtn = document.createElement("button");
  endChatBtn.textContent = "End Chat";
  endChatBtn.className = "start-chat-btn hidden";
  endChatBtn.style.margin = "10px";
  document.querySelector(".custom-chat-box").appendChild(endChatBtn);

  // -------------------- FORM SUBMIT --------------------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const deptRaw = deptSelect.value.trim();
    const query = document.getElementById("query").value.trim();

    if (!name || !email || !deptRaw || !query) {
      alert("Please fill all fields.");
      return;
    }

    const dept = deptRaw.charAt(0).toUpperCase() + deptRaw.slice(1).toLowerCase();
    console.log("🧭 Selected department:", dept);

    appendMessage("user", `👋 ${query}`);

    // Show chat UI
    form.classList.add("hidden");
    chatBody.classList.remove("hidden");
    document.querySelector(".chat-input").classList.remove("hidden");
    endChatBtn.classList.remove("hidden");

    const chatKey = `${dept}_${clientId}`;
    chatRef = ref(db, `chats/${companyId}/${dept}/${chatKey}/messages`);
    const infoRef = ref(db, `chats/${companyId}/${dept}/${chatKey}/info`);

    // ✅ Save user info FIRST and confirm it exists
    await set(infoRef, {
      userName: name,
      userEmail: email,
      department: dept,
      startedAt: Date.now(),
    });

    // 🕒 Retry until info is readable (up to 5x)
    let retries = 0;
    while (retries < 5) {
      const snap = await get(infoRef);
      if (snap.exists()) break;
      await new Promise((res) => setTimeout(res, 500));
      retries++;
    }

    saveSession({ dept, chatKey, clientId });

    // Check for online agent
    const onlineAgent = await getOnlineAgentForDept(dept);

    if (onlineAgent) {
      appendMessage("system", `✅ Connecting to ${onlineAgent.name}...`);
      await push(chatRef, { sender: "user", text: query, ts: Date.now() });
      listenToChatMessages(dept, chatKey);
    } else {
      appendMessage("system", "❌ Agent offline. Sending email & notifying...");

      if (!CONFIG_LOADED) await loadConfig();
      const deptEmail = DEPARTMENT_EMAILS[dept] || "default@yourcompany.com";

      try {
        await emailjs.send(
          CONFIG.EMAILJS_SERVICE_ID,
          CONFIG.EMAILJS_TEMPLATE_ID,
          {
            from_name: name,
            reply_to: email,
            message: query,
            department: dept,
            to_email: deptEmail,
          }
        );
        appendMessage("system", "📧 Your query has been emailed successfully!");
      } catch (error) {
        console.warn("⚠️ EmailJS send failed:", error);
        appendMessage("system", "⚠️ Email delivery failed — notifying agent manually.");
      }

      const notifRef = ref(db, `notifications/${companyId}/${dept}`);
      await push(notifRef, {
        from: name,
        email,
        message: query,
        dept,
        timestamp: Date.now(),
        status: "unread",
      });

      appendMessage("system", "📨 Agent will be notified once online.");
    }

    form.reset();
  });

  // -------------------- RESTORE SESSION --------------------
  const session = getSession();
  if (session && session.chatKey && session.dept) {
    console.log("💬 Restoring chat session:", session.chatKey);
    restoreChat(session);
  }

  // -------------------- SEND MESSAGE --------------------
  chatSendBtn.addEventListener("click", async () => {
    const text = chatInputBox.value.trim();
    if (!text || !chatRef) return;
    await push(chatRef, { sender: "user", text, ts: Date.now() });
    chatInputBox.value = "";
  });

  // -------------------- END CHAT --------------------
  endChatBtn.addEventListener("click", () => {
    console.log("🛑 Chat ended by user");
    clearSession();
    chatBody.innerHTML = "";
    chatBody.classList.add("hidden");
    document.querySelector(".chat-input").classList.add("hidden");
    endChatBtn.classList.add("hidden");
    form.classList.remove("hidden");
    setTimeout(() => window.location.reload(), 200);
  });

  // -------------------- HELPERS --------------------
  async function getOnlineAgentForDept(dept) {
    try {
      const snapshot = await get(ref(db, `presence/${companyId}/${dept}`));

      if (!snapshot.exists()) {
        console.warn(`⚠️ No presence found for ${dept} department`);
        return null;
      }

      const agents = snapshot.val();
      let found = null;

      for (const [name, data] of Object.entries(agents)) {
        if (data && data.online === true) {
          found = { name, email: data.email };
          break;
        }
      }

      const active = Object.values(agents).some(a => a && a.online === true);
      if (!active) {
        console.warn(`🛑 All ${dept} agents are offline.`);
        return null;
      }

      if (!found) {
        console.warn(`❌ No online agents for ${dept}`);
        return null;
      }

      console.log(`✅ Found online agent for ${dept}:`, found.name);
      return found;
    } catch (err) {
      console.error(`🔥 Error checking online agents for ${dept}:`, err);
      return null;
    }
  }

  function listenToChatMessages(dept, chatKey) {
    const chatPath = ref(db, `chats/${companyId}/${dept}/${chatKey}/messages`);
    off(chatPath);
    const rendered = new Set();
    onChildAdded(chatPath, (snap) => {
      const msg = snap.val();
      const key = snap.key;
      if (!msg?.text || rendered.has(key)) return;
      rendered.add(key);
      appendMessage(msg.sender, msg.text);
    });
  }

  async function restoreChat(session) {
    const { dept, chatKey, clientId: savedId } = session;
    clientId = savedId;
    chatRef = ref(db, `chats/${companyId}/${dept}/${chatKey}/messages`);
    form.classList.add("hidden");
    chatBody.classList.remove("hidden");
    document.querySelector(".chat-input").classList.remove("hidden");
    endChatBtn.classList.remove("hidden");
    chatBody.innerHTML = "";
    const renderedKeys = new Set();
    const snapshot = await get(chatRef);
    if (snapshot.exists()) {
      const messages = Object.entries(snapshot.val()).sort(
        (a, b) => (a[1].ts || 0) - (b[1].ts || 0)
      );
      messages.forEach(([key, msg]) => {
        if (!msg?.text) return;
        renderedKeys.add(key);
        appendMessage(msg.sender, msg.text);
      });
    }
    off(chatRef);
    onChildAdded(chatRef, (snap) => {
      const msg = snap.val();
      const key = snap.key;
      if (!msg?.text || renderedKeys.has(key)) return;
      renderedKeys.add(key);
      appendMessage(msg.sender, msg.text);
    });
  }

  function appendMessage(sender, text) {
    const msg = document.createElement("div");
    msg.classList.add(
      sender === "user"
        ? "user-msg"
        : sender === "agent"
        ? "agent-msg"
        : "system-msg"
    );
    msg.textContent = text;
    chatBody.appendChild(msg);
    chatBody.scrollTop = chatBody.scrollHeight;
  }
});

// -------------------- TOGGLE CHAT --------------------
window.addEventListener("DOMContentLoaded", () => {
  const chatToggleBtn = document.getElementById("chatToggleBtn");
  const chatBox = document.getElementById("chatBox");
  if (!chatBox) return;
  window.toggleChat = () => chatBox.classList.toggle("hidden");
  chatBox.style.transition = "all 0.3s ease-in-out";
  if (chatToggleBtn) chatToggleBtn.addEventListener("click", toggleChat);
});

