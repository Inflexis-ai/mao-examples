/**
 * AIXaaS Demo Video — Shared Animation Engine
 * Provides: mouse cursor movement, typing simulation, click effects,
 *           narration overlay, timeline sequencing
 */

class DemoAnimator {
  constructor() {
    this.cursor = null;
    this.narration = null;
    this.steps = [];
    this.currentStep = 0;
    this.isPlaying = false;
    this._init();
  }

  _init() {
    // Create cursor element
    this.cursor = document.createElement('div');
    this.cursor.className = 'demo-cursor';
    this.cursor.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M5 3l14 8-6.5 2L9 19.5 5 3z" fill="white" stroke="#0a1628" stroke-width="1"/>
      </svg>
      <div class="cursor-ring"></div>
    `;
    this.cursor.style.left = '50%';
    this.cursor.style.top = '50%';
    document.body.appendChild(this.cursor);

    // Create narration overlay
    this.narration = document.createElement('div');
    this.narration.className = 'narration';
    this.narration.innerHTML = `
      <div class="narrator-label">Narrator</div>
      <div class="narrator-text"></div>
      <div class="timestamp"></div>
    `;
    document.body.appendChild(this.narration);

    // Play/pause control
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this.isPlaying ? this.pause() : this.play();
      }
      if (e.code === 'KeyR') {
        this.restart();
      }
    });
  }

  /**
   * Define the animation timeline.
   * Each step: { time, action, ... }
   * Actions: 'moveTo', 'click', 'type', 'narrate', 'show', 'hide', 'addClass', 'removeClass', 'wait', 'custom'
   */
  setTimeline(steps) {
    this.steps = steps.sort((a, b) => a.time - b.time);
  }

  async play() {
    this.isPlaying = true;
    while (this.currentStep < this.steps.length && this.isPlaying) {
      const step = this.steps[this.currentStep];
      const nextStep = this.steps[this.currentStep + 1];

      await this._executeStep(step);

      // Wait until next step time
      if (nextStep && this.isPlaying) {
        const delay = (nextStep.time - step.time) * 1000;
        await this._sleep(Math.max(delay, 100));
      }

      this.currentStep++;
    }
  }

  pause() { this.isPlaying = false; }

  restart() {
    this.isPlaying = false;
    this.currentStep = 0;
    // Reset all elements
    document.querySelectorAll('.fade-in').forEach(el => el.classList.remove('fade-in'));
    document.querySelectorAll('.visible').forEach(el => el.classList.remove('visible'));
    document.querySelectorAll('.active').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.complete').forEach(el => el.classList.remove('complete'));
    document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.highlighted').forEach(el => el.classList.remove('highlighted'));
    // Clear typed text
    document.querySelectorAll('[data-typed]').forEach(el => el.textContent = '');
    this.narration.classList.remove('visible');
    setTimeout(() => this.play(), 500);
  }

  async _executeStep(step) {
    switch (step.action) {
      case 'moveTo':
        await this._moveTo(step.target);
        break;
      case 'click':
        await this._moveTo(step.target);
        await this._sleep(200);
        await this._click(step.target);
        break;
      case 'type':
        await this._typeText(step.target, step.text, step.speed || 40);
        break;
      case 'narrate':
        this._showNarration(step.text, step.timestamp || '');
        break;
      case 'hideNarration':
        this.narration.classList.remove('visible');
        break;
      case 'show':
        this._showElement(step.target, step.className || 'visible');
        break;
      case 'hide':
        this._hideElement(step.target, step.className || 'visible');
        break;
      case 'addClass':
        document.querySelector(step.target)?.classList.add(step.className);
        break;
      case 'removeClass':
        document.querySelector(step.target)?.classList.remove(step.className);
        break;
      case 'streamResponse':
        await this._streamText(step.target, step.html, step.speed || 8);
        break;
      case 'counter':
        await this._animateCounter(step.target, step.from, step.to, step.duration || 1000);
        break;
      case 'progress':
        this._setProgress(step.target, step.value);
        break;
      case 'custom':
        if (typeof step.fn === 'function') await step.fn();
        break;
      case 'wait':
        // Just wait — delay handled by timeline
        break;
    }
  }

  async _moveTo(selector) {
    const el = document.querySelector(selector);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    this.cursor.style.left = x + 'px';
    this.cursor.style.top = y + 'px';
    await this._sleep(800);
  }

  async _click(selector) {
    const el = document.querySelector(selector);
    if (!el) return;
    // Click ring effect
    this.cursor.classList.add('clicking');
    el.classList.add('glow-highlight');
    await this._sleep(300);
    this.cursor.classList.remove('clicking');
    setTimeout(() => el.classList.remove('glow-highlight'), 1000);
  }

  async _typeText(selector, text, speed) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.setAttribute('data-typed', 'true');
    for (let i = 0; i < text.length; i++) {
      if (!this.isPlaying) return;
      el.textContent = text.substring(0, i + 1);
      await this._sleep(speed + Math.random() * 30);
    }
  }

  async _streamText(selector, html, speed) {
    const el = document.querySelector(selector);
    if (!el) return;
    // Stream character by character using innerHTML
    const chars = html.split('');
    let buffer = '';
    let inTag = false;
    for (let i = 0; i < chars.length; i++) {
      if (!this.isPlaying) { el.innerHTML = html; return; }
      buffer += chars[i];
      if (chars[i] === '<') inTag = true;
      if (chars[i] === '>') { inTag = false; el.innerHTML = buffer; continue; }
      if (!inTag) {
        el.innerHTML = buffer;
        await this._sleep(speed);
      }
    }
    el.innerHTML = html;
  }

  async _animateCounter(selector, from, to, duration) {
    const el = document.querySelector(selector);
    if (!el) return;
    const start = performance.now();
    const update = () => {
      const elapsed = performance.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(from + (to - from) * eased);
      el.textContent = current.toLocaleString();
      if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
    await this._sleep(duration);
  }

  _setProgress(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.style.width = value + '%';
  }

  _showElement(selector, className) {
    const el = document.querySelector(selector);
    if (el) el.classList.add(className);
  }

  _hideElement(selector, className) {
    const el = document.querySelector(selector);
    if (el) el.classList.remove(className);
  }

  _showNarration(text, timestamp) {
    this.narration.querySelector('.narrator-text').textContent = text;
    this.narration.querySelector('.timestamp').textContent = timestamp;
    this.narration.classList.add('visible');
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Auto-init and expose globally
window.demo = new DemoAnimator();
