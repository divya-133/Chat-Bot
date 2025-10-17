// ----- Agents & Departments -----
const agents = {
  "Sales": { name: "Shiva", online: true },
  "Support": { name: "Rahul", online: false },
  "Technical": { name: "Ananya", online: true }
};

// ----- DOM Elements -----
const chatBox = document.getElementById("chatBox");
const chatBody = document.querySelector(".chat-body");
const chatInput = document.querySelector(".chat-input input");
const sendBtn = document.querySelector(".chat-input button");
const typingIndicator = document.querySelector(".typing-indicator");
const chatHeaderTitle = document.getElementById("chatHeaderTitle");
const supportForm = document.getElementById("supportForm");
const messageDiv = document.getElementById("message");
const chatInputContainer = document.querySelector(".chat-input");

// ----- Toggle Chat -----
function toggleChat() {
  chatBox.classList.toggle("hidden");
}

// ----- Knowledge Base -----
const knowledgeBase = {
  "Support": [
    { keywords: ["reset password", "forgot password"], responses: ["You can reset your password via Settings → Security → Reset Password.", "Use the 'Forgot Password' link on the login page."] },
    { keywords: ["login error", "cannot login"], responses: ["Please check your credentials and try again.", "Clear browser cache and try again."] }
  ],
  "Sales": [
    { keywords: ["pricing", "plans", "demo", "budget"], responses: ["Our Basic plan starts at ₹499/month, Pro plan at ₹999/month.", "Request a demo and our sales agent will connect with you."] }
  ],
  "Technical": [
    { keywords: ["bug", "error", "crash"], responses: ["Please provide the error message so we can guide you.", "Restart the app and see if the issue persists."] }
  ]
};

let currentDept = "";
let currentUser = "";

// ----- Append Message -----
function appendMessage(sender, text) {
  const msgDiv = document.createElement("div");
  msgDiv.classList.add(sender === "user" ? "user-msg" : "agent-msg");
  msgDiv.textContent = text;
  chatBody.appendChild(msgDiv);
  chatBody.scrollTop = chatBody.scrollHeight;
}

// ----- Get AI Reply -----
function getRandomReply(message, dept) {
  const kb = knowledgeBase[dept];
  if (!kb) return "🤖 Sorry, I’m not trained for that department yet.";
  const msg = message.toLowerCase();
  for (const item of kb) {
    for (const key of item.keywords) {
      if (msg.includes(key)) {
        const responses = item.responses;
        return responses[Math.floor(Math.random() * responses.length)];
      }
    }
  }
  return "🤖 I'm sorry, I can only assist with questions related to our services.";
}

// ----- Support Form Submission -----
supportForm.addEventListener("submit", function (e) {
  e.preventDefault();

  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value;
  const phone = document.getElementById("phone").value;
  const dept = document.getElementById("supportType").value;
  const query = document.getElementById("query").value;

  currentDept = dept;
  currentUser = name;

  if (agents[dept] && agents[dept].online) {
    // ONLINE MODE
    supportForm.classList.add("hidden");
    chatBody.classList.remove("hidden");
    chatInputContainer.classList.remove("hidden");
    chatHeaderTitle.textContent = agents[dept].name;
    appendMessage("agent", `Hi ${name}, I'm ${agents[dept].name}. How can I help you today?`);
  } else {
    // OFFLINE MODE -> send Email
    const templateParams = {
      from_name: name,
      from_email: email,
      mobile_number: phone,
      support_type: dept,
      message: query
    };
    emailjs.send("service_4hnwgkj", "template_flfcfxc", templateParams)
      .then(() => {
        messageDiv.textContent = "✅ Thanks for contacting StaunchDesk! We’ll respond soon.";
        messageDiv.style.color = "green";
        supportForm.reset();
      }, (error) => {
        messageDiv.textContent = "❌ Failed to send. Please try again.";
        messageDiv.style.color = "red";
        console.error("EmailJS error:", error);
      });
  }
});

// ----- Sending Messages -----
sendBtn.addEventListener("click", sendMessage);
chatInput.addEventListener("keypress", e => { if (e.key === "Enter") sendMessage(); });

function sendMessage() {
  const message = chatInput.value.trim();
  if (!message) return;

  appendMessage("user", message);
  chatInput.value = "";
  typingIndicator.classList.remove("hidden");

  setTimeout(() => {
    typingIndicator.classList.add("hidden");
    const reply = getRandomReply(message, currentDept);
    appendMessage("agent", reply);
  }, 800);
}



