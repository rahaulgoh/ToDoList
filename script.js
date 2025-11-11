(() => {
  'use strict';

  /* ===== 1) SELECTORS ===== */
  const els = {
    form: document.getElementById('new-task-form'),
    input: document.getElementById('new-task-input'),
    list: document.getElementById('task-list'),
    filters: document.querySelector('.filters'),
    remaining: document.getElementById('tasks-remaining'),
    completed: document.getElementById('tasks-completed'),
    clearCompleted: document.getElementById('clear-completed'),
    template: document.getElementById('task-item-template'),

    // Pomodoro bits
    pomoRoot: document.getElementById('pomodoro'),
    pomoLabel: document.getElementById('pomo-label'),
    pomoScreen: document.getElementById('timer'),
    pomoStart: document.getElementById('pomo-start'),
    pomoPause: document.getElementById('pomo-pause'),
    pomoReset: document.getElementById('pomo-reset'),
  };

  /* ===== 2) STATE & STORAGE ===== */
  const state = {
    tasks: /** @type {{id:string,title:string,done:boolean}[]} */ ([]),
    filter: /** @type {'all'|'todo'|'done'} */ ('all'),
  };

  const storage = {
    load() {
      try {
        const raw = localStorage.getItem('tasks');
        state.tasks = raw ? JSON.parse(raw) : [];
      } catch {
        state.tasks = [];
      }
    },
    save() {
      localStorage.setItem('tasks', JSON.stringify(state.tasks));
    }
  };

  /* ===== 3) COMPUTED HELPERS ===== */
  const getVisibleTasks = () => {
    if (state.filter === 'todo') return state.tasks.filter(t => !t.done);
    if (state.filter === 'done') return state.tasks.filter(t => t.done);
    return state.tasks;
  };
  const taskById = (id) => state.tasks.find(t => t.id === id);

  /* ===== 4) RENDERING ===== */
  function renderStats() {
    const done = state.tasks.filter(t => t.done).length;
    els.completed.textContent = String(done);
    els.remaining.textContent = String(state.tasks.length - done);
  }

  function renderList() {
    els.list.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (const t of getVisibleTasks()) {
      const li = els.template.content.firstElementChild.cloneNode(true);
      li.dataset.id = t.id;
      li.querySelector('.task-toggle').checked = t.done;
      li.querySelector('.task-title').textContent = t.title;
      if (t.done) li.classList.add('is-done');
      frag.appendChild(li);
    }
    els.list.appendChild(frag);
  }

  function updateClearButton() {
    const hasCompleted = state.tasks.some(t => t.done);
    els.clearCompleted.setAttribute('aria-disabled', String(!hasCompleted));
  }

  function renderAll() {
    renderList();
    renderStats();
    updateClearButton();
  }

  /* ===== 5) ACTIONS (mutate state + save + render) ===== */
  function addTask(title) {
    state.tasks.unshift({ id: crypto.randomUUID(), title, done: false });
    storage.save(); renderAll();
  }

  function toggleTask(id, checked) {
    const t = taskById(id);
    if (!t) return;
    t.done = checked;
    storage.save(); renderAll();
  }

  function deleteTask(id) {
    const before = state.tasks.length;
    state.tasks = state.tasks.filter(t => t.id !== id);
    if (state.tasks.length !== before) {
      storage.save(); renderAll();
    }
  }

  function editTask(id, newTitle) {
    const t = taskById(id);
    if (!t) return;
    t.title = newTitle.trim() || t.title; // keep old title if empty
    storage.save(); renderAll();
  }

  function clearCompleted() {
    const before = state.tasks.length;
    state.tasks = state.tasks.filter(t => !t.done);
    if (state.tasks.length !== before) {
      storage.save(); renderAll();
    }
  }

  function setFilter(f) {
    state.filter = f;
    // Update active button styles
    els.filters.querySelectorAll('.filter').forEach(b => b.classList.toggle('active', b.dataset.filter === f));
    renderAll();
  }

  /* ===== 6) INLINE EDIT (UI helper) ===== */
  function startInlineEdit(li, id) {
    const t = taskById(id);
    if (!t) return;
    const span = li.querySelector('.task-title');
    const input = document.createElement('input');
    input.type = 'text';
    input.value = t.title;
    span.replaceWith(input);
    input.focus(); input.select();

    const commit = () => editTask(id, input.value);
    const cancel = () => renderAll();

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') commit();
      if (ev.key === 'Escape') cancel();
    });
  }

  /* ===== 7) EVENTS (tasks UI) ===== */
  els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = els.input.value.trim();
    if (!title) return;
    addTask(title);
    els.input.value = '';
  });

  els.list.addEventListener('click', (e) => {
    const li = e.target.closest('li.task-item');
    if (!li) return;
    const id = li.dataset.id;

    if (e.target.matches('.task-toggle')) {
      toggleTask(id, e.target.checked);
    } else if (e.target.matches('.task-delete')) {
      deleteTask(id);
    } else if (e.target.matches('.task-edit')) {
      startInlineEdit(li, id);
    } else if (e.target.matches('.task-focus')) {
      const t = taskById(id);
      if (t) focusTask(t);
    }
  });

  els.filters.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter');
    if (!btn) return;
    setFilter(btn.dataset.filter);
  });

  els.clearCompleted.addEventListener('click', clearCompleted);

  /* ===== 8) POMODORO (self-contained) ===== */
  const Pomodoro = (() => {
    if (!els.pomoRoot) return null;

    let seconds = 25 * 60;
    let running = false;
    let tickId = null;
    let mode = 'focus'; // 'focus' | 'break'
    let focusedTaskTitle = '';

    const fmt = (s) => {
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    };

    const paint = () => {
      els.pomoScreen.textContent = fmt(seconds);
      const label = mode === 'focus' ? 'Focus' : 'Break';
      els.pomoLabel.textContent = focusedTaskTitle ? `${label} — ${focusedTaskTitle}` : label;
    };

    const start = () => {
      if (running) return;
      running = true;
      if (tickId) clearInterval(tickId);
      tickId = setInterval(() => {
        if (seconds > 0) {
          seconds -= 1;
          els.pomoScreen.textContent = fmt(seconds);
        } else {
          clearInterval(tickId);
          tickId = null;
          running = false;
          // Auto-switch example (optional): focus <-> break
          mode = (mode === 'focus') ? 'break' : 'focus';
          reset(mode === 'focus' ? 25 : 5);
          // start(); // uncomment to auto-continue
        }
      }, 1000);
    };

    const pause = () => {
      running = false;
      if (tickId) { clearInterval(tickId); tickId = null; }
    };

    const reset = (mins = (mode === 'focus' ? 25 : 5)) => {
      pause();
      seconds = mins * 60;
      paint();
    };

    // wire controls
    els.pomoStart?.addEventListener('click', start);
    els.pomoPause?.addEventListener('click', pause);
    els.pomoReset?.addEventListener('click', () => reset());

    els.pomoRoot.querySelectorAll('[data-min]').forEach(btn => {
      btn.addEventListener('click', () => {
        const mins = parseInt(btn.getAttribute('data-min'), 10) || 25;
        mode = btn.textContent.toLowerCase().includes('break') ? 'break' : 'focus';
        reset(mins);
      });
    });

    // React to a task requesting focus
    window.addEventListener('pomodoro:focus', (e) => {
      focusedTaskTitle = (e.detail && e.detail.title) || '';
      mode = 'focus';
      reset(25);
    });

    paint();
    return { start, pause, reset };
  })();

  /* ===== 9) TASK->POMODORO BRIDGE ===== */
  function focusTask(t) {
    window.dispatchEvent(new CustomEvent('pomodoro:focus', {
      detail: { taskId: t.id, title: t.title }
    }));
  }

  /* ===== 10) INIT ===== */
  storage.load();
  renderAll(); // first paint

  // default filter button already marked active in HTML
})();
