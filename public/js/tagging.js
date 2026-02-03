
(function () {
    if (window.TagManager) return;

    class TagManager {
        constructor(inputElement) {
            this.input = inputElement;
            this.suggestions = [];
            this.selectedIndex = 0;
            this.query = '';
            this.startPos = 0;
            this.isShowing = false;

            // Create UI elements
            this.container = document.createElement('div');
            this.container.className = 'tag-suggestions-container hidden absolute bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-64 max-h-60 overflow-y-auto';
            document.body.appendChild(this.container);

            this.init();
        }

        init() {
            this.input.addEventListener('input', (e) => this.onInput(e));
            this.input.addEventListener('keydown', (e) => this.onKeyDown(e));

            // Global click to close
            document.addEventListener('click', (e) => {
                if (!this.container.contains(e.target) && e.target !== this.input) {
                    this.hide();
                }
            });
        }

        hide() {
            this.isShowing = false;
            this.container.classList.add('hidden');
            this.suggestions = [];
        }

        show() {
            this.isShowing = true;
            this.container.classList.remove('hidden');
            this.updatePosition();
        }

        updatePosition() {
            // Basic positioning logic - improves with libraries like floating-ui, but keeping simple dependency-free
            const rect = this.getValidCoords();
            if (rect) {
                this.container.style.top = `${rect.top + 24}px`;
                this.container.style.left = `${rect.left}px`;
            }
        }

        // Helper to find coordinates of the caret
        getValidCoords() {
            // This is tricky in textarea. 
            // Simplified approach: Position near the bottom left of textarea or try to approximate.
            // Ideally we use a library or a mirror div. 
            // For now, let's put it below the textarea aligned left.
            const rect = this.input.getBoundingClientRect();
            return {
                top: rect.bottom + window.scrollY - 20, // slightly overlapping or just below
                left: rect.left + window.scrollX
            };
        }

        async onInput(e) {
            const text = this.input.value;
            const cursorPos = this.input.selectionStart;

            // Look backwards from cursor for @
            const textBeforeCursor = text.slice(0, cursorPos);
            const lastAtPos = textBeforeCursor.lastIndexOf('@');

            if (lastAtPos !== -1) {
                // Check if there are spaces between @ and cursor (allow spaces? usually no for username, maybe yes for company names?)
                // Let's assume no spaces for username start, but query can contain spaces? 
                // User requirements: "@company:abcsd or @username:username"
                // Usually tagging is "@starting"

                const contentAfterAt = textBeforeCursor.slice(lastAtPos + 1);

                // If there's a space immediately after @, maybe ignore? Or allow?
                // Usually spaces break the tag trigger unless it's a known multi-word tag system.
                // Let's allow simple alphanumeric search for now.
                if (!/\s/.test(contentAfterAt)) {
                    this.query = contentAfterAt;
                    this.startPos = lastAtPos;

                    if (this.query.length >= 1) {
                        await this.fetchSuggestions(this.query);
                    } else {
                        this.hide();
                    }
                } else {
                    this.hide();
                }
            } else {
                this.hide();
            }
        }

        async fetchSuggestions(query) {
            try {
                const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
                const data = await res.json();
                this.suggestions = data;

                if (this.suggestions.length > 0) {
                    this.renderSuggestions();
                    this.show();
                } else {
                    this.hide();
                }
            } catch (e) {
                console.error('Error fetching suggestions:', e);
            }
        }

        renderSuggestions() {
            this.container.innerHTML = '';
            this.suggestions.forEach((item, index) => {
                const div = document.createElement('div');
                div.className = `p-2 cursor-pointer hover:bg-gray-100 flex items-center gap-2 ${index === this.selectedIndex ? 'bg-gray-100' : ''}`;

                // Avatar/Icon placeholder
                const icon = item.type === 'user'
                    ? `<div class="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs text-blue-600 font-bold">${item.label[0].toUpperCase()}</div>`
                    : `<div class="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-600 font-bold">C</div>`;

                div.innerHTML = `
            ${icon}
            <div class="flex flex-col">
                <span class="text-sm font-medium text-gray-900">${item.label}</span>
                <span class="text-xs text-gray-500">${item.type === 'user' ? '@' + item.value : 'Company'}</span>
            </div>
          `;

                div.onclick = () => this.selectItem(item);
                this.container.appendChild(div);
            });
        }

        onKeyDown(e) {
            if (!this.isShowing) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.selectedIndex = (this.selectedIndex + 1) % this.suggestions.length;
                this.renderSuggestions();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.selectedIndex = (this.selectedIndex - 1 + this.suggestions.length) % this.suggestions.length;
                this.renderSuggestions();
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                this.selectItem(this.suggestions[this.selectedIndex]);
            } else if (e.key === 'Escape') {
                this.hide();
            }
        }

        selectItem(item) {
            const text = this.input.value;
            const before = text.slice(0, this.startPos);
            const after = text.slice(this.input.selectionStart);

            // Format: @user:username or @company:id[Name]
            let tag = '';
            if (item.type === 'user') {
                tag = `@user:${item.value} `; // Added space
            } else {
                tag = `@company:${item.id}[${item.label}] `; // Added space
            }

            this.input.value = before + tag + after;

            // Move cursor
            const newPos = before.length + tag.length;
            this.input.setSelectionRange(newPos, newPos);
            this.input.focus();

            this.hide();
        }
    }

    window.TagManager = TagManager;
})();
