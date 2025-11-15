import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  get,
  update,
  onChildAdded,
  push,
  remove,
  off,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// Get company ID from script tag
const companyId = document.currentScript?.dataset?.company || "default_company";
console.log("🏢 Agent panel for company:", companyId);

const firebaseConfig = {
  apiKey: "AIzaSyBsP14amVbh6uVkXUxFEqu6UTX1x5qG5sg",
  authDomain: "staunchdesk-chat-f23f7.firebaseapp.com",
  databaseURL: "https://staunchdesk-chat-f23f7-default-rtdb.firebaseio.com/",
  projectId: "staunchdesk-chat-f23f7",
  storageBucket: "staunchdesk-chat-f23f7.appspot.com",
  messagingSenderId: "634913544469",
  appId: "1:634913544469:web:cfbc044eacd1a124cbf11c",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// DOM elements
const form = document.getElementById("agentForm");
const chatSection = document.getElementById("chatSection");
const chatList = document.getElementById("chatList");
const chatWindow = document.getElementById("chatWindow");
const chatMessages = document.getElementById("chatMessages");
const agentMsgInput = document.getElementById("agentMessage");
const sendMsgBtn = document.getElementById("sendMsgBtn");
const goOfflineBtn = document.getElementById("goOfflineBtn");
const statusText = document.getElementById("statusText");

// Notification elements
const notifBell = document.getElementById("notifBell");
const notifPopup = document.getElementById("notifPopup");
const notifList = document.getElementById("notifList");
const notifCount = document.getElementById("notifCount");
const clearAllBtn = document.getElementById("clearAll");

let agentName = null,
  department = null,
  agentEmail = null;
let presenceRef = null,
  chatRef = null;

// ------------------ RESTORE SESSION ------------------
window.addEventListener("load", async () => {
  const saved = JSON.parse(localStorage.getItem("agentSession"));
  if (saved) {
    agentName = saved.name;
    department = saved.dept;
    agentEmail = saved.email;

    presenceRef = ref(db, `presence/${companyId}/${department}/${agentName}`);
    await update(presenceRef, {
      online: true,
      ts: Date.now(),
      email: agentEmail,
    });

    form.classList.add("hidden");
    chatSection.classList.remove("hidden");
    goOfflineBtn.classList.remove("hidden");
    statusText.textContent = `Online (${department})`;
    statusText.classList.replace("offline", "online");

    listenForChats(department);
    listenForNotifications(department);
  }
});

// ------------------ LOGIN ------------------
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  agentName = document.getElementById("agentName").value.trim();
  department = document.getElementById("department").value.trim();
  agentEmail = document.getElementById("agentEmail").value.trim();

  if (!agentName || !department || !agentEmail)
    return alert("Fill all fields!");

  const safeDept =
    department.charAt(0).toUpperCase() +
    department.slice(1).toLowerCase();
  const safeAgent =
    agentName.charAt(0).toUpperCase() +
    agentName.slice(1).toLowerCase();

  presenceRef = ref(db, `presence/${companyId}/${safeDept}/${safeAgent}`);
  await set(presenceRef, {
    online: true,
    email: agentEmail,
    ts: Date.now(),
  });

  localStorage.setItem(
    "agentSession",
    JSON.stringify({ name: safeAgent, email: agentEmail, dept: safeDept })
  );

  form.classList.add("hidden");
  chatSection.classList.remove("hidden");
  goOfflineBtn.classList.remove("hidden");
  statusText.textContent = `Online (${safeDept})`;
  statusText.classList.replace("offline", "online");

  listenForChats(safeDept);
  listenForNotifications(safeDept);
});

// ------------------ NOTIFICATIONS ------------------
function listenForNotifications(dept) {
  const notifRef = ref(db, `notifications/${companyId}/${dept}`);
  let unread = 0;
  const shown = new Set();

  notifBell.addEventListener("click", () => {
    notifPopup.classList.toggle("show");
  });

  document.addEventListener("click", (e) => {
    if (!notifPopup.contains(e.target) && !notifBell.contains(e.target)) {
      notifPopup.classList.remove("show");
    }
  });

  clearAllBtn.addEventListener("click", async () => {
    notifList.innerHTML = "";
    unread = 0;
    notifCount.classList.add("hidden");
    await set(ref(db, `notifications/${companyId}/${dept}`), null);
  });

  onChildAdded(notifRef, (snap) => {
    const notif = snap.val(),
      key = snap.key;
    if (!notif || shown.has(key)) return;
    shown.add(key);

    const li = document.createElement("li");
    li.innerHTML = `
      <div class="notif-icon">💬</div>
      <div class="notif-info">
        <strong>${notif.from}</strong>
        <span>${notif.message}</span>
        <small>${new Date(notif.timestamp).toLocaleString()}</small>
      </div>
    `;
    notifList.prepend(li);

    if (notif.status === "unread") {
      unread++;
      notifCount.textContent = unread;
      notifCount.classList.remove("hidden");
      notifBell.classList.add("shake");

      setTimeout(() => notifBell.classList.remove("shake"), 800);
      const sound = new Audio(
        "https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
      );
      sound.volume = 0.3;
      sound.play();
    }
  });
}

// ------------------ CHATS ------------------
function listenForChats(dept) {
  const deptRef = ref(db, `chats/${companyId}/${dept}`);

  onChildAdded(deptRef, async (snapshot) => {
    const chatId = snapshot.key;

    // ✅ Fetch user info
    const infoRef = ref(db, `chats/${companyId}/${dept}/${chatId}/info`);
    const infoSnap = await get(infoRef);
    let userName = "Unknown User";
    let userEmail = "";
    if (infoSnap.exists()) {
      const data = infoSnap.val();
      userName = data.userName || "Unknown User";
      userEmail = data.userEmail || "";
    }

    // Prevent duplicates
    if (document.getElementById(chatId)) return;

    // ✅ Modern SVG trash icon + real user name
    const li = document.createElement("li");
    li.id = chatId;
    li.innerHTML = `
      <div class="chat-info">
        <div class="chat-meta">
          <strong class="chat-user">${userName}</strong>
        </div>
        <small class="chat-email">${userEmail}</small>
        <button class="chat-delete" title="Delete Chat">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
               stroke-width="2" stroke="currentColor" width="20" height="20"
               class="trash-icon hover:text-red-500 transition">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M6 7h12M9 7V4h6v3m2 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7z" />
          </svg>
        </button>
      </div>
    `;

    // Open chat
    li.onclick = (e) => {
      if (!e.target.closest(".chat-delete")) openChat(dept, chatId);
    };

    // Delete chat
    li.querySelector(".chat-delete").addEventListener("click", async (e) => {
      e.stopPropagation();
      if (confirm(`Delete chat with ${userName}?`)) {
        await set(ref(db, `chats/${companyId}/${dept}/${chatId}`), null);
        li.classList.add("fade-out");
        setTimeout(() => li.remove(), 300);
      }
    });

    chatList.prepend(li);
  });
}

// ------------------ OPEN CHAT ------------------
function openChat(dept, chatId) {
  chatWindow.classList.remove("hidden");
  chatMessages.innerHTML = "";
  if (chatRef) off(chatRef);
  chatRef = ref(db, `chats/${companyId}/${dept}/${chatId}/messages`);

  onChildAdded(chatRef, (snap) => {
    const msg = snap.val();
    if (!msg?.text) return;
    const div = document.createElement("div");
    div.className = msg.sender === "agent" ? "agent-msg" : "user-msg";
    div.textContent = `${msg.text}`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
}

// ------------------ SEND + OFFLINE ------------------
sendMsgBtn.addEventListener("click", async () => {
  const text = agentMsgInput.value.trim();
  if (!text || !chatRef) return;
  await push(chatRef, { sender: "agent", text, ts: Date.now() });
  agentMsgInput.value = "";
});

goOfflineBtn.addEventListener("click", async () => {
  if (presenceRef) await update(presenceRef, { online: false });
  alert("You're offline now.");
  localStorage.removeItem("agentSession");
  window.location.reload();
});
