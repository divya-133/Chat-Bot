import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getDatabase,
  ref,
  get,
  set,
  push,
  onChildAdded,
  off,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// FIREBASE CONFIG (keep as-is for your project)
const firebaseConfig = {
  apiKey: "AIzaSyBsP14amVbh6uVkXUxFEqu6UTX1x5qG5sg",
  authDomain: "staunchdesk-chat-f23f7.firebaseapp.com",
  databaseURL: "https://staunchdesk-chat-f23f7-default-rtdb.firebaseio.com/",
  projectId: "staunchdesk-chat-f23f7",
  storageBucket: "staunchdesk-chat-f23f7.appspot.com",
  messagingSenderId: "634913544469",
  appId: "1:634913544469:web:cfbc044eacd1a124cbf11c",
};

console.log("SDW-module: initializing Firebase...");
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
console.log("SDW-module: firebase initialized");

// Helper that waits for DOM elements to exist (poll)
async function waitFor(selector, timeout = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = document.querySelector(selector);
    if (el) return el;
    await new Promise(r => setTimeout(r, 50));
  }
  return null;
}

async function initWidget() {
  // read company id from global set by loader
  const COMPANY_ID = window.sdw_companyId || (document.currentScript && document.currentScript.dataset && document.currentScript.dataset.company) || "default_company";
  console.log("SDW-module: companyId =", COMPANY_ID);

  // ensure required elements are present (loader injected them)
  const bubble = await waitFor('#sdw-bubble', 2000);
  const box = await waitFor('#sdw-box', 2000);
  const closeBtn = await waitFor('#sdw-close-btn', 2000);

  const form = await waitFor('#sdw-form', 2000);
  const nameInput = await waitFor('#sdw-name', 2000);
  const emailInput = await waitFor('#sdw-email', 2000);
  const phoneInput = await waitFor('#sdw-phone', 2000);
  const deptSelect = await waitFor('#sdw-dept', 2000);
  const queryInput = await waitFor('#sdw-query', 2000);
  const formStatus = await waitFor('#sdw-form-status', 2000);

  const chatWrap = await waitFor('#sdw-chat', 2000);
  const chatBody = await waitFor('#sdw-chat-body', 2000);
  const inputRow = await waitFor('#sdw-input-row', 2000);
  const messageInput = await waitFor('#sdw-message', 2000);
  const sendBtn = await waitFor('#sdw-send', 2000);
  const endBtn = await waitFor('#sdw-end', 2000);

  if (!bubble || !box || !form || !chatBody) {
    console.error("SDW-module: missing DOM elements — aborting init");
    return;
  }

  // session & client id
  let clientId = localStorage.getItem('sdw_client_id');
  if (!clientId) { clientId = 'client_' + Math.random().toString(36).substring(2,10); localStorage.setItem('sdw_client_id', clientId); }

  function saveSession(obj) { localStorage.setItem('sdw_chat_session', JSON.stringify(obj)); }
  function getSession() { try { return JSON.parse(localStorage.getItem('sdw_chat_session')); } catch { return null; } }
  function clearSession() { localStorage.removeItem('sdw_chat_session'); }

  function appendMessageUI(sender, text) {
    const el = document.createElement('div');
    if (sender === 'user') el.className = 'sdw-user-msg';
    else if (sender === 'agent') el.className = 'sdw-agent-msg';
    else el.className = 'sdw-system-msg';
    el.textContent = text;
    chatBody.appendChild(el);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  // open/close
  function openBox() { box.classList.remove('sdw-hidden'); }
  function closeBox() { box.classList.add('sdw-hidden'); }

  bubble.addEventListener('click', () => { openBox(); setTimeout(() => tryRestoreSession(), 80); });
  closeBtn.addEventListener('click', closeBox);

  // firebase: check an online agent for dept
  async function getOnlineAgentForDept(dept) {
    try {
      const snap = await get(ref(db, `presence/${COMPANY_ID}/${dept}`));
      if (!snap.exists()) return null;
      const agents = snap.val();
      for (const [name, data] of Object.entries(agents)) {
        if (data && data.online === true) return { name, email: data.email || '' };
      }
      return null;
    } catch (err) {
      console.warn('SDW-module: getOnlineAgentForDept err', err);
      return null;
    }
  }

  // listen to messages
  let activeChatRef = null;
  let renderedKeys = new Set();
  function listenToMessages(dept, chatKey) {
    if (!db) return;
    try { if (activeChatRef) off(activeChatRef); } catch(e){/* ignore */ }

    activeChatRef = ref(db, `chats/${COMPANY_ID}/${dept}/${chatKey}/messages`);
    renderedKeys = new Set();

    // load history
    get(activeChatRef).then(snap => {
      if (!snap.exists()) return;
      const obj = snap.val();
      const ordered = Object.entries(obj).sort((a,b)=> (a[1].ts||0)-(b[1].ts||0));
      ordered.forEach(([k,msg]) => {
        if (!msg || !msg.text) return;
        if (!renderedKeys.has(k)) {
          renderedKeys.add(k);
          appendMessageUI(msg.sender, msg.text);
        }
      });
    }).catch(e => console.warn('SDW-module: history err', e));

    onChildAdded(activeChatRef, (snap) => {
      const key = snap.key; const msg = snap.val();
      if (!msg) return;
      if (renderedKeys.has(key)) return;
      renderedKeys.add(key);

      // typing events optional
      if (msg.typing === true) {
        const t = document.createElement('div'); t.className = 'sdw-system-msg'; t.style.fontStyle='italic'; t.textContent = 'Agent is typing...'; t.dataset.sdwTyping = '1';
        chatBody.appendChild(t); chatBody.scrollTop = chatBody.scrollHeight; return;
      }
      if (msg.typing === false) {
        const els = chatBody.querySelectorAll('[data-sdw-typing="1"]'); els.forEach(e=>e.remove()); return;
      }

      appendMessageUI(msg.sender, msg.text);
    });
  }

  // form submit -> create chat and route
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const name = (nameInput.value || '').trim();
    const email = (emailInput.value || '').trim();
    const phone = (phoneInput.value || '').trim();
    const deptRaw = (deptSelect.value || '').trim();
    const query = (queryInput.value || '').trim();

    if (!name || !email || !deptRaw || !query) {
      if (formStatus) formStatus.textContent = 'Please fill all fields.';
      return;
    }
    if (formStatus) formStatus.textContent = '';

    const dept = deptRaw.charAt(0).toUpperCase() + deptRaw.slice(1).toLowerCase();
    const chatKey = `${dept}_${clientId}`;
    const infoRef = ref(db, `chats/${COMPANY_ID}/${dept}/${chatKey}/info`);
    const messagesRef = ref(db, `chats/${COMPANY_ID}/${dept}/${chatKey}/messages`);

    // save info (retry check)
    try {
      await set(infoRef, { userName: name, userEmail: email, phone: phone||'', department: dept, startedAt: Date.now(), firstMessage: query });
      // wait until readable (small retry)
      let ok=false;
      for (let i=0;i<6;i++){
        try { const s = await get(infoRef); if (s.exists()) { ok=true; break; } } catch {}
        await new Promise(r=>setTimeout(r,200));
      }
      if (!ok) { if (formStatus) formStatus.textContent='Error starting chat. Try again.'; return; }
    } catch (err) {
      console.warn('SDW-module: info save failed', err); if (formStatus) formStatus.textContent='Error starting chat.'; return;
    }

    saveSession({ dept, chatKey, clientId });

    // switch UI to chat
    form.classList.add('sdw-hidden');
    chatWrap.classList.remove('sdw-hidden');
    inputRow.classList.remove('sdw-hidden');
    endBtn.classList.remove('sdw-hidden');

    appendMessageUI('user', query);

    // check agent presence
    const agent = await getOnlineAgentForDept(dept);
    if (agent) {
      appendMessageUI('system', `✅ Connecting to ${agent.name}...`);
      try { await push(messagesRef, { sender:'user', text: query, ts: Date.now() }); } catch(e){ console.warn('SDW-module: push err', e); }
      listenToMessages(dept, chatKey);
    } else {
      appendMessageUI('system', '❌ Agent offline. Sending email & notifying...');

      // Email fallback if available
      try {
        if (window.emailjs && typeof window.emailjs.send === 'function') {
          // these template/service ids should be configured server-side in /config; if not, this will likely fail and is caught.
          await window.emailjs.send('service_hyp528n','template_md28m0i', {
            from_name: name,
            reply_to: email,
            message: query,
            department: dept
          });
          appendMessageUI('system','📧 Your query has been emailed successfully!');
        } else {
          appendMessageUI('system','⚠️ EmailJS not available — notification saved.');
        }
      } catch (err) {
        console.warn('SDW-module: email send failed', err);
        appendMessageUI('system','⚠️ Email failed — notifying agent via dashboard.');
      }

      // push notification record for agents
      try {
        await push(ref(db, `notifications/${COMPANY_ID}/${dept}`), {
          from: name, email, message: query, dept, timestamp: Date.now(), status: 'unread'
        });
      } catch (err) { console.warn('SDW-module: notif push failed', err); }

      // still start listening so agent can reply when they come online
      listenToMessages(dept, chatKey);
    }

    form.reset();
  }); // end form submit

  // send message handler
  sendBtn.addEventListener('click', async () => {
    const text = (messageInput.value || '').trim();
    if (!text || !activeChatRef) return;
    try { await push(activeChatRef, { sender:'user', text, ts: Date.now() }); } catch(e){ console.warn('SDW-module: send push failed', e); }
    messageInput.value = '';
  });
  messageInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') { e.preventDefault(); sendBtn.click(); } else {
      if (activeChatRef) try { await push(activeChatRef, { sender:'user', typing:true, ts: Date.now() }); } catch {}
    }
  });
  messageInput.addEventListener('keyup', async () => {
    if (!activeChatRef) return;
    if ((messageInput.value || '').trim() === '') try { await push(activeChatRef, { sender:'user', typing:false, ts: Date.now() }); } catch {}
  });

  // end chat
  endBtn.addEventListener('click', () => {
    try { if (activeChatRef) off(activeChatRef); } catch(e){/*ignore*/ }
    clearSession();
    chatBody.innerHTML = '';
    messageInput.value = '';
    chatWrap.classList.add('sdw-hidden');
    inputRow.classList.add('sdw-hidden');
    endBtn.classList.add('sdw-hidden');
    form.classList.remove('sdw-hidden');
  });

  // restore previous session
  async function tryRestoreSession() {
    const s = getSession();
    if (!s || !s.dept || !s.chatKey) return;
    const dept = s.dept; const chatKey = s.chatKey;
    form.classList.add('sdw-hidden');
    chatWrap.classList.remove('sdw-hidden');
    inputRow.classList.remove('sdw-hidden');
    endBtn.classList.remove('sdw-hidden');
    chatBody.innerHTML = '';
    activeChatRef = ref(db, `chats/${COMPANY_ID}/${dept}/${chatKey}/messages`);
    try {
      const snap = await get(activeChatRef);
      if (snap && snap.exists()) {
        const obj = snap.val();
        const ordered = Object.entries(obj).sort((a,b)=> (a[1].ts||0)-(b[1].ts||0));
        ordered.forEach(([k,msg]) => { if (!msg || !msg.text) return; appendMessageUI(msg.sender, msg.text); });
        chatBody.scrollTop = chatBody.scrollHeight;
      }
    } catch (err) { console.warn('SDW-module: restore history err', err); }
    listenToMessages(dept, chatKey);
  }

  // attach to window for debugging
  window.sdw_tryRestoreSession = tryRestoreSession;

  // auto-restore if session exists
  tryRestoreSession().catch(()=>{});

  console.log('SDW-module: widget logic loaded.');
} // initWidget

// run init (module executed after loader appended DOM)
initWidget().catch(e => console.error('SDW-module init failed', e));
