// --- selectors (grab elements from the DOM)
const els = {
  form: document.getElementById('new-task-form'),
  input: document.getElementById('new-task-input'),
  list: document.getElementById('task-list'),
  filters: document.querySelector('.filters'),
  remaining: document.getElementById('tasks-remaining'),
  completed: document.getElementById('tasks-completed'),
  clearCompleted: document.getElementById('clear-completed'),
  template: document.getElementById('task-item-template'),
};

// --- in-memory state
let tasks = [];            // array of { id, title, done }
let currentFilter = 'all'; // 'all' | 'todo' | 'done'

console.log('JS loaded, elements:', els);

function visibleTasks() {
  if (currentFilter === 'todo') return tasks.filter(t => !t.done);
  if (currentFilter === 'done') return tasks.filter(t => t.done);
  return tasks;
}

function updateStats() {
  const done = tasks.filter(t => t.done).length;
  els.completed.textContent = String(done);
  els.remaining.textContent = String(tasks.length - done);
}

function render() {
  els.list.innerHTML = '';
  const fr = document.createDocumentFragment();
  for (const t of visibleTasks()) {
    const li = els.template.content.firstElementChild.cloneNode(true);
    li.dataset.id = t.id;
    li.querySelector('.task-toggle').checked = t.done;
    li.querySelector('.task-title').textContent = t.title;
    if (t.done) li.classList.add('is-done'); // optional style hook
    fr.appendChild(li);
  }
  els.list.appendChild(fr);
  updateStats();
}

els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = els.input.value.trim();
  if (!title) return; // ignore empty
  const task = {
    id: crypto.randomUUID(), // unique id built into the browser
    title,
    done: false
  };
  tasks.unshift(task);       // add to the top
  els.input.value = '';      // clear input
  render();                  // redraw the list + stats
});

els.list.addEventListener('click', (e) => {
  const li = e.target.closest('li.task-item');
  if (!li) return;
  const id = li.dataset.id;

  if (e.target.matches('.task-toggle')) {
    const t = tasks.find(t => t.id === id);
    if (!t) return;
    t.done = e.target.checked;
    render();
  }

  if (e.target.matches('.task-delete')) {
    tasks = tasks.filter(t => t.id !== id);
    render();
  }

  if (e.target.matches('.task-edit')) {
    inlineEdit(li, id);
  }

  if (e.target.matches('.task-focus')) {
    // we'll wire this to the pomodoro later
    const t = tasks.find(t => t.id === id);
    if (t) console.log('Focus requested for:', t.title);
  }
});

function inlineEdit(li, id) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  const span = li.querySelector('.task-title');
  const input = document.createElement('input');
  input.type = 'text';
  input.value = t.title;

  span.replaceWith(input);
  input.focus(); input.select();

  const commit = () => { t.title = input.value.trim() || t.title; render(); };
  const cancel = () => render();

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') commit();
    if (ev.key === 'Escape') cancel();
  });
}

function save() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}
function load() {
  try {
    const raw = localStorage.getItem('tasks');
    tasks = raw ? JSON.parse(raw) : [];
  } catch {
    tasks = [];
  }
}

// load on startup:
load();
render();

// save after any mutating action:
const _render = render;
render = function () { _render(); save(); }; // wrap render to auto-save

function focusTask(t) {
  window.dispatchEvent(new CustomEvent('pomodoro:focus', {
    detail: { taskId: t.id, title: t.title }
  }));
}

els.filters.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter');
    if (!btn) return; // clicked somewhere else
        // 1) Update the active button styles
    els.filters.querySelectorAll('.filter').forEach(b => {
        b.classList.remove('active');
    })
    btn.classList.add('active');
        // 2) Update the filter state
    currentFilter = btn.dataset.filter; // 'all' | 'todo' | 'done'
        // 3_ Re-render with the new filter applied
    render();
})