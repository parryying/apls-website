(function () {
  "use strict";

  var knowledge = window.APLS_CHAT_KNOWLEDGE;
  if (!knowledge || !knowledge.entries) return;

  var pendingTopic = null;
  var lastFocused = null;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/[^a-z0-9\s-]/g, " ")
      .replace(/-/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function meaningfulWords(value) {
    var ignored = ["a", "an", "and", "are", "can", "do", "does", "for", "i", "is", "it", "my", "of", "the", "to", "what", "whats", "your"];
    return normalize(value).split(" ").filter(function (word) {
      return word && ignored.indexOf(word) === -1;
    });
  }

  function findById(id) {
    return knowledge.entries.find(function (entry) { return entry.id === id; });
  }

  function matchPending(question) {
    if (!pendingTopic) return null;
    var normalized = normalize(question);
    return knowledge.entries.find(function (entry) {
      return (entry.pendingMatch || []).some(function (pattern) {
        return normalized === normalize(pattern) || normalized.indexOf(normalize(pattern)) !== -1;
      });
    });
  }

  function scorePattern(question, pattern) {
    var normalizedQuestion = normalize(question);
    var normalizedPattern = normalize(pattern);
    if (!normalizedPattern) return 0;
    if (normalizedQuestion === normalizedPattern) return 100;
    if (normalizedQuestion.indexOf(normalizedPattern) !== -1) return 20 + meaningfulWords(pattern).length;

    var questionWords = meaningfulWords(question);
    var patternWords = meaningfulWords(pattern);
    if (!patternWords.length) return 0;
    var matches = patternWords.filter(function (word) { return questionWords.indexOf(word) !== -1; }).length;
    return matches === patternWords.length ? 10 + matches : matches / patternWords.length;
  }

  function findAnswer(question) {
    var pendingAnswer = matchPending(question);
    if (pendingAnswer) return pendingAnswer;

    var best = null;
    var bestScore = 0;
    knowledge.entries.forEach(function (entry) {
      (entry.patterns || []).forEach(function (pattern) {
        var score = scorePattern(question, pattern);
        if (score > bestScore) {
          best = entry;
          bestScore = score;
        }
      });
    });
    return bestScore >= 1 ? best : null;
  }

  function init() {
    var launcher = el("button", "chat-launcher");
    launcher.type = "button";
    launcher.setAttribute("aria-haspopup", "dialog");
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-controls", "apls-chat-panel");
    launcher.setAttribute("aria-label", "Ask APLS");
    launcher.title = "Ask APLS";
    launcher.innerHTML = '<span class="chat-launcher-icon" aria-hidden="true">?</span><span class="chat-launcher-label">Ask APLS</span>';

    var panel = el("section", "chat-panel");
    panel.id = "apls-chat-panel";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-labelledby", "apls-chat-title");

    var header = el("div", "chat-header");
    var headingWrap = el("div", "chat-heading");
    var title = el("h2", null, "Ask APLS");
    title.id = "apls-chat-title";
    headingWrap.appendChild(title);
    headingWrap.appendChild(el("p", null, "Quick answers from our website"));
    var close = el("button", "chat-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Close chat");
    header.appendChild(headingWrap);
    header.appendChild(close);

    var messages = el("div", "chat-messages");
    messages.setAttribute("role", "log");
    messages.setAttribute("aria-live", "polite");
    messages.setAttribute("aria-relevant", "additions");

    var form = el("form", "chat-form");
    var input = document.createElement("input");
    input.type = "text";
    input.name = "question";
    input.autocomplete = "off";
    input.maxLength = 180;
    input.placeholder = "Type your question";
    input.setAttribute("aria-label", "Ask a question about APLS");
    var send = el("button", "chat-send", "Send");
    send.type = "submit";
    form.appendChild(input);
    form.appendChild(send);

    var note = el("p", "chat-note", "Automated website answers · Not live chat");
    panel.appendChild(header);
    panel.appendChild(messages);
    panel.appendChild(form);
    panel.appendChild(note);
    document.body.appendChild(panel);
    document.body.appendChild(launcher);

    var launcherBlockedByHero = false;

    function syncLauncherVisibility() {
      launcher.hidden = !panel.hidden || launcherBlockedByHero;
    }

    var heroActions = document.querySelector(".hero-actions");
    var mobileViewport = window.matchMedia("(max-width: 560px)");
    if (heroActions && "IntersectionObserver" in window) {
      var heroActionsInView = false;
      var updateHeroBlock = function () {
        launcherBlockedByHero = mobileViewport.matches && heroActionsInView;
        if (launcherBlockedByHero) launcher.classList.remove("is-intro");
        syncLauncherVisibility();
      };
      var heroObserver = new IntersectionObserver(function (entries) {
        heroActionsInView = entries[0].isIntersecting;
        updateHeroBlock();
      });
      heroObserver.observe(heroActions);
      if (mobileViewport.addEventListener) {
        mobileViewport.addEventListener("change", updateHeroBlock);
      } else {
        mobileViewport.addListener(updateHeroBlock);
      }
    }

    var introTimer = null;
    try {
      if (window.matchMedia("(max-width: 560px)").matches && !window.localStorage.getItem("apls-chat-launcher-intro-seen")) {
        launcher.classList.add("is-intro");
        window.localStorage.setItem("apls-chat-launcher-intro-seen", "true");
        introTimer = window.setTimeout(function () {
          launcher.classList.remove("is-intro");
        }, 5000);
      }
    } catch (error) {
      launcher.classList.remove("is-intro");
    }

    function addChoices(choices) {
      if (!choices || !choices.length) return;
      var wrap = el("div", "chat-choices");
      choices.forEach(function (choice) {
        var button = el("button", "chat-choice", choice.label);
        button.type = "button";
        button.addEventListener("click", function () {
          addMessage("user", choice.label);
          respond(findById(choice.target));
        });
        wrap.appendChild(button);
      });
      messages.appendChild(wrap);
    }

    function addMessage(sender, text, link) {
      var message = el("div", "chat-message chat-message-" + sender);
      message.appendChild(el("p", null, text));
      if (link) {
        var anchor = el("a", null, link.label);
        anchor.href = link.href;
        message.appendChild(anchor);
      }
      messages.appendChild(message);
      messages.scrollTop = messages.scrollHeight;
    }

    function respond(entry) {
      var response = entry || knowledge.fallback;
      window.setTimeout(function () {
        addMessage("bot", response.answer, response.link);
        addChoices(response.choices);
        pendingTopic = response.pending || null;
        messages.scrollTop = messages.scrollHeight;
      }, 180);
    }

    function openPanel() {
      if (introTimer) window.clearTimeout(introTimer);
      launcher.classList.remove("is-intro");
      lastFocused = document.activeElement;
      panel.hidden = false;
      syncLauncherVisibility();
      launcher.setAttribute("aria-expanded", "true");
      if (!messages.children.length) {
        addMessage("bot", knowledge.welcome);
        addChoices(knowledge.suggestions);
      }
      window.setTimeout(function () { input.focus(); }, 0);
    }

    function closePanel() {
      panel.hidden = true;
      syncLauncherVisibility();
      launcher.setAttribute("aria-expanded", "false");
      (lastFocused && lastFocused.focus ? lastFocused : launcher).focus();
    }

    launcher.addEventListener("click", openPanel);
    close.addEventListener("click", closePanel);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var question = input.value.trim();
      if (!question) return;
      addMessage("user", question);
      input.value = "";
      respond(findAnswer(question));
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !panel.hidden) closePanel();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();