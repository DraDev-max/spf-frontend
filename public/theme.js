(() => {
  const apply = (theme) => {
    document.body.dataset.theme = theme;
    button.textContent = theme === 'light' ? '🌙' : '☀️';
  };
  const button = document.createElement('button');
  button.className = 'theme-toggle';
  button.type = 'button';
  button.title = 'Cambiar tema';
  button.addEventListener('click', () => {
    const next = document.body.dataset.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', next);
    apply(next);
  });
  document.body.appendChild(button);
  apply(localStorage.getItem('theme') || 'dark');

  const enhanceSelects = () => document.querySelectorAll('select:not([data-customized])').forEach((select) => {
    select.dataset.customized = 'true';
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select shared-custom-select';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.textContent = select.options[select.selectedIndex]?.text || '';
    const menu = document.createElement('div');
    menu.className = 'custom-select-menu';
    [...select.options].forEach((option) => {
      const item = document.createElement('div');
      item.className = 'custom-select-option';
      item.textContent = option.text;
      item.addEventListener('click', () => {
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        trigger.textContent = option.text;
        wrapper.classList.remove('open');
      });
      menu.appendChild(item);
    });
    trigger.addEventListener('click', () => wrapper.classList.toggle('open'));
    select.parentNode.insertBefore(wrapper, select);
    wrapper.append(trigger, menu);
    select.style.display = 'none';
  });
  enhanceSelects();
  new MutationObserver(enhanceSelects).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.shared-custom-select')) {
      document.querySelectorAll('.shared-custom-select.open').forEach((item) => item.classList.remove('open'));
    }
  });
})();
