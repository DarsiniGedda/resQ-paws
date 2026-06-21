// resQpaws AI Chat Assistant Widget
// Programmatically injects a floating AI chat assistant onto every page and handles local rule-based smart queries.

const GPaichat = {
  chatContainer: null,
  chatBubble: null,
  messagesList: null,

  init: function() {
    this.injectStyles();
    this.injectHTML();
    this.bindEvents();
    this.addWelcomeMessage();
  },

  // 1. Inject Chat Widget Styles programmatically
  injectStyles: function() {
    const style = document.createElement("style");
    style.id = "gp-ai-chat-styles";
    style.innerHTML = `
      /* Chat Floating Bubble */
      .ai-chat-bubble {
        position: fixed;
        bottom: 30px;
        right: 30px;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background-color: var(--primary);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.8rem;
        cursor: pointer;
        box-shadow: 0 4px 20px rgba(22, 163, 74, 0.4);
        z-index: 9999;
        transition: transform 0.3s ease, background-color 0.3s ease;
        animation: chat-bounce 3s infinite;
      }
      .ai-chat-bubble:hover {
        transform: scale(1.1) rotate(5deg);
        background-color: var(--primary-hover);
      }
      
      @keyframes chat-bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-8px); }
      }

      /* Chat Window Panel */
      .ai-chat-window {
        position: fixed;
        bottom: 100px;
        right: 30px;
        width: 380px;
        height: 500px;
        border-radius: 16px;
        background: var(--bg-card);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid var(--border-glass);
        box-shadow: var(--shadow-lg);
        z-index: 9999;
        display: none;
        flex-direction: column;
        overflow: hidden;
        transition: all 0.3s ease;
      }
      @media (max-width: 480px) {
        .ai-chat-window {
          width: calc(100% - 40px);
          height: 80vh;
          bottom: 90px;
          right: 20px;
        }
      }

      /* Chat Header */
      .ai-chat-header {
        background-color: var(--secondary);
        color: white;
        padding: 16px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top-left-radius: 16px;
        border-top-right-radius: 16px;
      }
      .ai-chat-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-family: var(--font-title);
        font-weight: 700;
        font-size: 1.1rem;
      }

      /* Chat Messages List */
      .ai-chat-messages {
        flex-grow: 1;
        overflow-y: auto;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      /* Message bubbles styles */
      .ai-msg {
        max-width: 80%;
        padding: 12px 16px;
        border-radius: 12px;
        font-size: 0.9rem;
        line-height: 1.4;
      }
      .ai-msg-assistant {
        background-color: rgba(22, 163, 74, 0.08);
        border: 1px solid rgba(22, 163, 74, 0.15);
        color: var(--text-main);
        align-self: flex-start;
        border-top-left-radius: 2px;
      }
      .ai-msg-user {
        background-color: var(--primary);
        color: white;
        align-self: flex-end;
        border-top-right-radius: 2px;
      }

      /* Chat Input Form */
      .ai-chat-footer {
        padding: 12px 16px;
        border-top: 1px solid var(--border-glass);
        background-color: rgba(var(--secondary-rgb), 0.02);
      }
      .ai-chat-form {
        display: flex;
        gap: 8px;
      }
      .ai-chat-input {
        flex-grow: 1;
        padding: 10px 14px;
        border-radius: 20px;
        border: 1px solid var(--input-border);
        background-color: var(--input-bg);
        color: var(--text-main);
        outline: none;
        font-family: var(--font-body);
        font-size: 0.9rem;
      }
      .ai-chat-input:focus {
        border-color: var(--primary);
      }
    `;
    document.head.appendChild(style);
  },

  // 2. Inject HTML nodes programmatically
  injectHTML: function() {
    // Bubble
    const bubble = document.createElement("div");
    bubble.className = "ai-chat-bubble";
    bubble.id = "gp-chat-bubble";
    bubble.innerHTML = "🤖";
    document.body.appendChild(bubble);
    this.chatBubble = bubble;

    // Window
    const windowDiv = document.createElement("div");
    windowDiv.className = "ai-chat-window";
    windowDiv.id = "gp-chat-window";
    windowDiv.innerHTML = `
      <div class="ai-chat-header">
        <div class="ai-chat-title">
          <span style="font-size:1.3rem;">🐾</span>
          <span>resQpaws AI Assistant</span>
        </div>
        <button id="gp-chat-close-btn" style="background:none; border:none; color:white; font-size:1.5rem; cursor:pointer;">×</button>
      </div>
      
      <div class="ai-chat-messages" id="gp-chat-messages-list">
        <!-- Messages loaded here -->
      </div>
      
      <div class="ai-chat-footer">
        <form class="ai-chat-form" id="gp-chat-submit-form">
          <input type="text" id="gp-chat-input-field" class="ai-chat-input" placeholder="Ask first-aid or platform tips..." required autocomplete="off">
          <button type="submit" class="btn btn-primary btn-sm" style="padding: 10px 16px; border-radius: 20px;">Send</button>
        </form>
      </div>
    `;
    document.body.appendChild(windowDiv);
    this.chatContainer = windowDiv;
    this.messagesList = document.getElementById("gp-chat-messages-list");
  },

  // 3. Bind Actions
  bindEvents: function() {
    this.chatBubble.addEventListener("click", () => {
      this.toggleWindow();
    });

    const closeBtn = document.getElementById("gp-chat-close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        this.chatContainer.style.display = "none";
      });
    }

    const form = document.getElementById("gp-chat-submit-form");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleUserSubmit();
      });
    }
  },

  toggleWindow: function() {
    const isVisible = this.chatContainer.style.display === "flex";
    this.chatContainer.style.display = isVisible ? "none" : "flex";
    if (!isVisible) {
      this.scrollToBottom();
      document.getElementById("gp-chat-input-field").focus();
    }
  },

  addWelcomeMessage: function() {
    this.addMessage("Hi! I am resQpaws AI, your first-aid and coordination helper. How can I help you or local animals today?", "assistant");
  },

  addMessage: function(text, sender) {
    const msg = document.createElement("div");
    msg.className = `ai-msg ai-msg-${sender}`;
    msg.innerHTML = text;
    this.messagesList.appendChild(msg);
    this.scrollToBottom();
  },

  scrollToBottom: function() {
    if (this.messagesList) {
      this.messagesList.scrollTop = this.messagesList.scrollHeight;
    }
  },

  handleUserSubmit: function() {
    const input = document.getElementById("gp-chat-input-field");
    const userText = input.value.trim();
    if (!userText) return;

    // Add user message
    this.addMessage(userText, "user");
    input.value = "";

    // Show AI writing bubble
    const writingMsg = document.createElement("div");
    writingMsg.className = "ai-msg ai-msg-assistant";
    writingMsg.innerHTML = "<em>Typing...</em>";
    this.messagesList.appendChild(writingMsg);
    this.scrollToBottom();

    // Trigger mock smart response generator
    setTimeout(() => {
      writingMsg.remove();
      const reply = this.getSmartReply(userText);
      this.addMessage(reply, "assistant");
    }, 1000);
  },

  // 4. Client-side rule-based Veterinary first-aid knowledge base & platform guides
  getSmartReply: function(query) {
    const text = query.toLowerCase();
    
    // Welcome/Greetings
    if (text.includes("hi") || text.includes("hello") || text.includes("hey")) {
      return "Hello! I am ready. Try asking about: 'how to treat bleeding', 'first aid for dehydration', 'how to report emergencies', or 'volunteer signup steps'.";
    }

    // Dehydration
    if (text.includes("dehydrated") || text.includes("weak") || text.includes("water") || text.includes("heatstroke")) {
      return "<strong>Dehydration First Aid:</strong><br>1. Move the animal to a cool, shaded area immediately.<br>2. Offer clean, cool water in small quantities (do not force them to drink).<br>3. Wipe their head, paws, or belly with a wet cloth to cool body temperature.<br>4. File a <strong>Medium</strong> severity report on our platform to request shelter feeding assistance.";
    }

    // Bleeding
    if (text.includes("bleed") || text.includes("blood") || text.includes("cut") || text.includes("wound") || text.includes("injury")) {
      return "<strong>Bleeding First Aid:</strong><br>1. Apply gentle, direct pressure to the wound using a clean cloth or sterile bandage.<br>2. Keep the animal calm and immobilized.<br>3. Avoid touching the wound directly without gloves.<br>4. File a <strong>Critical 🔴</strong> or <strong>High 🟠</strong> emergency report immediately to alert nearby NGOs.";
    }

    // Large Animals (Cow / Cattle)
    if (text.includes("cow") || text.includes("bull") || text.includes("cattle") || text.includes("plastic")) {
      return "<strong>Cattle First Aid & Care:</strong><br>1. Keep traffic clear and secure the spot.<br>2. Do not stand directly behind the cow as they kick out of pain/fear.<br>3. Provide water if they are conscious.<br>4. Submit a report on resQpaws immediately so specialized heavy-animal rescue ambulances are dispatched.";
    }

    // How to Report
    if (text.includes("report") || text.includes("submit") || text.includes("how to use") || text.includes("file")) {
      return "<strong>How to Report an Emergency:</strong><br>1. Go to the <a href='report.html' style='font-weight:bold;'>Report Emergency</a> page.<br>2. Select animal type, add description, and type contact phone.<br>3. Select coordinates by clicking on the map pinboard.<br>4. Upload a photo and submit. Simulated AI will evaluate the priority and alert NGOs instantly.";
    }

    // Volunteering
    if (text.includes("volunteer") || text.includes("join") || text.includes("help out")) {
      return "<strong>Become a Volunteer:</strong><br>1. Go to our <a href='volunteer.html' style='font-weight:bold;'>Volunteer</a> page.<br>2. Enter your Name, Email, Phone, and operating City.<br>3. Submit to plot your location. NGO administrators will view your pin on their dashboard and email you details for nearby rescues!";
    }

    // NGO Availability
    if (text.includes("ngo status") || text.includes("busy") || text.includes("offline")) {
      return "<strong>NGO Status Information:</strong><br>NGOs can toggle their statuses to: <em>Available</em>, <em>Busy</em>, or <em>Offline</em>. If an NGO is Busy or Offline, they cannot accept new emergency rescue requests. The dispatch buttons on their panels will be blocked.";
    }

    // Tracking
    if (text.includes("track") || text.includes("status") || text.includes("where is my")) {
      return "<strong>Tracking Rescues:</strong><br>You can input your tracking ID (e.g. <em>GP-2026-001</em>) in the <a href='track.html' style='font-weight:bold;'>Rescue Tracker</a> to watch live timeline steps and Leaflet coordinate travel lines.";
    }

    // Default response
    return "I'm here to help! Try asking about:<br>• <em>'first aid for a bleeding dog'</em><br>• <em>'how to treat dehydration'</em><br>• <em>'how to report an emergency incident'</em><br>• <em>'how to register as a volunteer'</em>";
  }
};

// Start Chat on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => GPaichat.init());
} else {
  GPaichat.init();
}
window.GPaichat = GPaichat;
