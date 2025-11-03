import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { 
  getDatabase, ref, set, update, onChildAdded, push 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBsP14amVbh6uVkXUxFEqu6UTX1x5qG5sg",
  authDomain: "sstaunchdesk-chat-f23f7.firebaseapp.com",
  databaseURL: "https://staunchdesk-chat-f23f7-default-rtdb.firebaseio.com/",
  projectId: "sstaunchdesk-chat-f23f7",
  storageBucket: "sstaunchdesk-chat-f23f7.firebasestorage.app",
  messagingSenderId: "634913544469",
  appId: "1:634913544469:web:cfbc044eacd1a124cbf11c",
  measurementId: "G-VV3TNEWSQ3"
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

let agentName = null;
let department = null;
let agentEmail = null;
let presenceRef = null;
let chatRef = null;

// ------------------ FORM SUBMIT ------------------
form.addEventListener("submit", async e => {
  e.preventDefault();

  agentName = document.getElementById("agentName").value.trim();
  department = document.getElementById("department").value.trim();
  agentEmail = document.getElementById("agentEmail").value.trim();

  if (!agentName || !department || !agentEmail) {
    alert("Please fill all fields.");
    return;
  }

  const safeDept = department.charAt(0).toUpperCase() + department.slice(1).toLowerCase();
  const safeAgent = agentName.charAt(0).toUpperCase() + agentName.slice(1).toLowerCase();

  presenceRef = ref(db, `presence/${safeDept}/${safeAgent}`);
  await set(presenceRef, {
    online: true,
    email: agentEmail,
    ts: Date.now(),
  });

  statusText.textContent = `Online (${safeDept})`;
  statusText.classList.replace("offline", "online");
  form.classList.add("hidden");
  chatSection.classList.remove("hidden");
  goOfflineBtn.classList.remove("hidden");

  listenForChats(safeDept);

  window.addEventListener("beforeunload", () => {
    update(presenceRef, { online: false, ts: Date.now() });
  });
});

// ------------------ LISTEN FOR CHATS ------------------
// ------------------ LISTEN FOR CHATS ------------------
function listenForChats(dept) {
  const deptRef = ref(db, `chats/${dept}`);
  onChildAdded(deptRef, snapshot => {
    const chatId = snapshot.key;
    if (!document.getElementById(chatId)) {
      const li = document.createElement("li");
      li.id = chatId;
      li.innerHTML = `
        ${chatId}
        <button class="chat-delete" title="Delete Chat">🗑️</button>
      `;
      li.onclick = (e) => {
        if (!e.target.classList.contains("chat-delete")) {
          openChat(dept, chatId);
        }
      };
      
      // ⚡ DELETE BUTTON EVENT
      li.querySelector(".chat-delete").addEventListener("click", async (e) => {
        e.stopPropagation();
        const confirmDel = confirm(`Delete chat "${chatId}"?`);
        if (confirmDel) {
          try {
            const chatToDeleteRef = ref(db, `chats/${dept}/${chatId}`);
            await set(chatToDeleteRef, null); // delete from DB
            li.classList.add("fade-out");
            setTimeout(() => li.remove(), 300);
            console.log(`✅ Chat "${chatId}" deleted.`);
          } catch (err) {
            console.error("❌ Error deleting chat:", err);
          }
        }
      });

      chatList.appendChild(li);
    }
  });
}

// ------------------ OPEN CHAT ------------------
function openChat(dept, chatId) {
  chatWindow.classList.remove("hidden");
  chatMessages.innerHTML = "";
  chatRef = ref(db, `chats/${dept}/${chatId}/messages`);

  onChildAdded(chatRef, snapshot => {
    const msg = snapshot.val();
    const div = document.createElement("div");
    div.className = msg.sender === "agent" ? "agent-msg" : "user-msg";
    div.textContent = `${msg.sender}: ${msg.text}`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
}

// ------------------ SEND MESSAGE ------------------
sendMsgBtn.addEventListener("click", async () => {
  const text = agentMsgInput.value.trim();
  if (!text || !chatRef) return;

  await push(chatRef, {
    sender: "agent",
    text,
    ts: Date.now(),
  });

  agentMsgInput.value = "";
});

// ------------------ GO OFFLINE ------------------
goOfflineBtn.addEventListener("click", async () => {
  if (presenceRef) {
    await update(presenceRef, { online: false, ts: Date.now() });
    alert("You are now offline.");
    window.location.reload();
  }
});
