// -------------------- TOGGLE CHAT --------------------
function toggleChat() {
  const chatBox = document.getElementById("chatBox");
  chatBox.classList.toggle("hidden");
}
window.toggleChat = toggleChat;

// -------------------- GLOBALS --------------------
let CONFIG = {};
let CONFIG_LOADED = false;
let chatRef = null;
let clientId = "client_" + Math.random().toString(36).substring(2, 10);

// Firebase reference (initialized in HTML via <script>)
const db = firebase.database();

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
      console.log("✅ EmailJS Initialized with config:", CONFIG);
    } else {
      console.error("❌ EmailJS config missing", CONFIG);
    }
  } catch (err) {
    console.error("❌ Failed to load /config", err);
  }
}

// Immediately load configuration on startup
(async () => {
  await loadConfig();
})();

// -------------------- DOM ELEMENTS --------------------
const form = document.getElementById("supportForm");
const deptSelect = document.getElementById("supportType");
const chatBody = document.querySelector(".chat-body");
const chatInputBox = document.querySelector(".chat-input input");
const chatSendBtn = document.querySelector(".chat-input button");

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
  appendMessage("user", `👋 ${query}`);

  // Hide form, show chat interface
  form.classList.add("hidden");
  document.querySelector(".chat-body").classList.remove("hidden");
  document.querySelector(".chat-input").classList.remove("hidden");

  // Check for available agent
  const onlineAgent = await getOnlineAgentForDept(dept);

  if (onlineAgent) {
    appendMessage("system", `✅ Connecting to ${onlineAgent.name}...`);

    const chatKey = `${dept}_${clientId}`;
    chatRef = db.ref(`chats/${dept}/${chatKey}/messages`);
    chatRef.push({ sender: "user", text: query, ts: Date.now() });

    // Start listening to agent replies
    listenToAgentMessages(dept, chatKey);
  } else {
    appendMessage("system", "❌ No agent available. Sending email...");

    if (!CONFIG_LOADED) await loadConfig();

    if (
      !CONFIG.EMAILJS_PUBLIC_KEY ||
      !CONFIG.EMAILJS_SERVICE_ID ||
      !CONFIG.EMAILJS_TEMPLATE_ID
    ) {
      appendMessage(
        "system",
        "⚠️ EmailJS config missing. Please check server setup."
      );
      return;
    }

    const templateParams = {
      from_name: name,
      reply_to: email,
      message: query,
      department: dept,
    };

    try {
      const result = await emailjs.send(
        CONFIG.EMAILJS_SERVICE_ID,
        CONFIG.EMAILJS_TEMPLATE_ID,
        templateParams
      );
      console.log("✅ Email sent successfully", result);
      appendMessage("system", "📧 Your query has been emailed successfully!");
    } catch (error) {
      console.error("❌ EmailJS send error:", error);
      appendMessage("system", "⚠️ Failed to send email. Please try later.");
    }
  }

  form.reset();
});

// -------------------- AGENT PRESENCE CHECK --------------------
async function getOnlineAgentForDept(dept) {
  try {
    const snapshot = await db.ref(`presence/${dept}`).get();
    if (snapshot.exists()) {
      const agents = snapshot.val();
      for (const [name, data] of Object.entries(agents)) {
        if (data.online) return { name, email: data.email };
      }
    }
  } catch (err) {
    console.error("❌ Firebase error checking presence:", err);
  }
  return null;
}

// -------------------- LISTEN TO AGENT MESSAGES --------------------
function listenToAgentMessages(dept, chatKey) {
  const chatRef = db.ref(`chats/${dept}/${chatKey}/messages`);
  chatRef.on("child_added", (snap) => {
    const msg = snap.val();
    if (msg.sender === "agent") appendMessage("agent", msg.text);
  });
}

// -------------------- SEND FOLLOW-UP MESSAGE --------------------
chatSendBtn.addEventListener("click", async () => {
  const text = chatInputBox.value.trim();
  if (!text) return;

  appendMessage("user", text);

  if (chatRef) {
    await chatRef.push({ sender: "user", text, ts: Date.now() });
  } else {
    appendMessage(
      "system",
      "⚠️ Chat not connected. Please start a new chat session."
    );
  }

  chatInputBox.value = "";
});

// -------------------- APPEND MESSAGE TO CHAT --------------------
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

