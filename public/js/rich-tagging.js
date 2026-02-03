
(function () {
    if (window.RichTagManager) return;

    class RichTagManager {
        constructor(editorElement, hiddenInputElement) {
            this.editor = editorElement;
            this.hiddenInput = hiddenInputElement;
            this.suggestions = [];
            this.selectedIndex = 0;
            this.query = '';
            this.isShowing = false;

            // State for tracking the @ trigger
            this.mentionStartNode = null;
            this.mentionStartOffset = 0;

            // Create UI elements
            this.container = document.createElement('div');
            this.container.className = 'tag-suggestions-container hidden absolute bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-64 max-h-60 overflow-y-auto';
            document.body.appendChild(this.container);

            this.init();
        }

        init() {
            this.editor.addEventListener('input', (e) => this.onInput(e));
            this.editor.addEventListener('keydown', (e) => this.onKeyDown(e));
            this.editor.addEventListener('blur', () => this.syncValue());

            // Global click to close
            document.addEventListener('click', (e) => {
                if (!this.container.contains(e.target) && e.target !== this.editor) {
                    this.hide();
                }
            });

            // Initial sync
            this.syncValue();

            // Handle paste to strip formatting if needed (advanced)
            this.editor.addEventListener('paste', (e) => {
                e.preventDefault();
                const text = (e.originalEvent || e).clipboardData.getData('text/plain');
                document.execCommand('insertText', false, text);
            });
        }

        syncValue() {
            if (this.hiddenInput) {
                this.hiddenInput.value = this.getValue();
            }
        }

        getValue() {
            // Traverse DOM to build backend string: "Hello @user:123 World"
            let value = '';

            const traverse = (node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    value += node.textContent;
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.hasAttribute('data-tag')) {
                        value += node.getAttribute('data-tag');
                    } else if (node.tagName === 'BR') {
                        value += '\n'; // Handle line breaks
                    } else if (node.tagName === 'DIV' || node.tagName === 'P') {
                        // Recursively handle block elements
                        if (value && value.slice(-1) !== '\n') value += '\n';
                        node.childNodes.forEach(traverse);
                    } else {
                        // Recursively handle other nodes (e.g. spans)
                        node.childNodes.forEach(traverse);
                    }
                }
            };

            this.editor.childNodes.forEach(traverse);
            return value.trim();
        }

        hide() {
            this.isShowing = false;
            this.container.classList.add('hidden');
            this.suggestions = [];
            this.selectedIndex = 0;
        }

        show() {
            this.isShowing = true;
            this.container.classList.remove('hidden');
            this.updatePosition();
        }

        updatePosition() {
            const rect = this.getCarretCoordinates();
            if (rect) {
                this.container.style.top = `${rect.top + 20}px`;
                this.container.style.left = `${rect.left}px`;
            }
        }

        getCarretCoordinates() {
            const sel = window.getSelection();
            if (!sel.rangeCount) return null;
            const range = sel.getRangeAt(0).cloneRange();

            // If we have a stored start position for the mention, use that
            if (this.mentionStartNode) {
                try {
                    range.setStart(this.mentionStartNode, this.mentionStartOffset);
                    range.collapse(true);
                } catch (e) {
                    // Fallback
                }
            }

            const rect = range.getBoundingClientRect();
            // If rect is all zeros (e.g. hidden), don't show
            if (rect.width === 0 && rect.height === 0 && rect.x === 0 && rect.y === 0) {
                // Fallback to editor position
                const editorRect = this.editor.getBoundingClientRect();
                return {
                    top: editorRect.bottom + window.scrollY,
                    left: editorRect.left + window.scrollX
                };
            }

            return {
                top: rect.bottom + window.scrollY,
                left: rect.left + window.scrollX
            };
        }

        async onInput(e) {
            this.syncValue();

            const sel = window.getSelection();
            if (!sel.rangeCount) return;

            const range = sel.getRangeAt(0);
            const node = range.startContainer;
            const offset = range.startOffset;

            // Only trigger in text nodes
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent;
                const textBeforeCaret = text.slice(0, offset);

                // Find last '@'
                const lastAtPos = textBeforeCaret.lastIndexOf('@');

                if (lastAtPos !== -1) {
                    // Check if it's a valid trigger (start of line or preceded by space)
                    // and no spaces within the query (strict single word/token)
                    if (lastAtPos === 0 || /\s/.test(textBeforeCaret[lastAtPos - 1])) {
                        const query = textBeforeCaret.slice(lastAtPos + 1);

                        if (!/\s/.test(query)) {
                            this.query = query;
                            this.mentionStartNode = node;
                            this.mentionStartOffset = lastAtPos;

                            if (this.query.length >= 1) {
                                await this.fetchSuggestions(this.query);
                            } else {
                                this.hide();
                            }
                            return;
                        }
                    }
                }
            }

            this.hide();
        }

        async fetchSuggestions(query) {
            try {
                // Use the search API
                const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
                const data = await res.json();

                console.log('API Response:', data);
                console.log('data.results:', data.results);
                console.log('data.users:', data.users);

                // Handle different response formats { users: [] } or { results: [] } or just [] or { error }
                if (data.error) {
                    this.suggestions = [];
                } else {
                    // Prefer 'results' (new format with both users and companies), fallback to 'users' (old format)
                    this.suggestions = data.results || data.users || data || [];
                }

                console.log('Suggestions set to:', this.suggestions);
                console.log('Suggestions length:', this.suggestions.length);
                console.log('Suggestions types:', this.suggestions.map(s => ({ type: s.type, hasUsername: !!s.username, name: s.name || s.username })));

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
            console.log('renderSuggestions called with', this.suggestions.length, 'items');
            this.container.innerHTML = '';
            this.suggestions.forEach((item, index) => {
                const div = document.createElement('div');
                div.className = `p-2 cursor-pointer hover:bg-gray-100 flex items-center gap-2 ${index === this.selectedIndex ? 'bg-gray-100' : ''}`;

                // Determine type: check for explicit type field or infer from properties
                const type = item.type || (item.username ? 'user' : 'company');
                console.log(`Item ${index}:`, { type, item });
                const label = type === 'user'
                    ? (item.displayName || item.name || item.username)
                    : (item.name || item.displayName);
                const subLabel = type === 'user'
                    ? '@' + item.username
                    : `MC: ${item.mc || 'N/A'}`;

                // Avatar/Icon placeholder
                const icon = type === 'user'
                    ? `<div class="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs text-blue-600 font-bold">${(label && label[0] ? label[0] : '?').toUpperCase()}</div>`
                    : `<div class="w-6 h-6 rounded bg-green-100 flex items-center justify-center text-xs text-green-600 font-bold">C</div>`;

                div.innerHTML = `
            ${icon}
            <div class="flex flex-col">
                <span class="text-sm font-medium text-gray-900">${label}</span>
                <span class="text-xs text-gray-500">${subLabel}</span>
            </div>
          `;

                div.onmousedown = (e) => {
                    e.preventDefault(); // Prevent focus loss
                    this.selectItem(item);
                };
                this.container.appendChild(div);
            });
        }

        onKeyDown(e) {
            if (e.key === 'Enter') {
                // Prevent default enter behavior only if menu is showing
                if (this.isShowing) {
                    e.preventDefault();
                    this.selectItem(this.suggestions[this.selectedIndex]);
                }
                // Else let standard newline happen (div contenteditable handles it)
            } else if (!this.isShowing) {
                return;
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.selectedIndex = (this.selectedIndex + 1) % this.suggestions.length;
                this.renderSuggestions();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.selectedIndex = (this.selectedIndex - 1 + this.suggestions.length) % this.suggestions.length;
                this.renderSuggestions();
            } else if (e.key === 'Tab') {
                e.preventDefault();
                this.selectItem(this.suggestions[this.selectedIndex]);
            } else if (e.key === 'Escape') {
                this.hide();
            }
        }

        selectItem(item) {
            // Determine type: check for explicit type field or infer from properties
            const type = item.type || (item.username ? 'user' : 'company');
            const label = type === 'user'
                ? (item.displayName || item.name || item.username)
                : (item.name || item.displayName);

            // For users: use username
            // For companies: use clickableLink (slug)
            const value = type === 'user'
                ? item.username
                : (item.clickableLink || item.slug || item.id);

            // Backend tag syntax
            // User: @user:username
            // Company: @company:clickable-link-slug[Name]
            const dataTag = type === 'user'
                ? `@user:${value}`
                : `@company:${value}[${label}]`;

            // Create the rich tag element
            const tagNode = document.createElement('a');
            tagNode.href = type === 'user' ? `/user/${value}` : `/company/${value}`;
            tagNode.target = '_blank';
            tagNode.className = 'text-blue-500 font-bold hover:underline cursor-pointer';
            tagNode.contentEditable = 'false';
            tagNode.setAttribute('data-tag', dataTag);
            tagNode.textContent = '@' + label;

            // Add click listener to ensure it opens (contenteditable sometimes captures clicks)
            tagNode.addEventListener('click', (e) => {
                window.open(tagNode.href, '_blank');
                e.stopPropagation();
            });

            // Space after
            const spaceNode = document.createTextNode('\u00A0'); // nbsp

            const sel = window.getSelection();
            if (sel.rangeCount) {
                const range = sel.getRangeAt(0);

                // We need to delete the text that the user typed ("@query")
                // using mentionStartNode and mentionStartOffset
                if (this.mentionStartNode) {
                    // Need to verify the node is still valid and connected
                    // For simplicity, we assume it is since we just typed it
                    const currentOffset = range.endOffset;
                    range.setStart(this.mentionStartNode, this.mentionStartOffset);
                    // End is current caret position
                    range.deleteContents();
                }

                range.insertNode(spaceNode);
                range.insertNode(tagNode);

                // Move cursor after space
                range.setStartAfter(spaceNode);
                range.collapse(true);

                sel.removeAllRanges();
                sel.addRange(range);
            }

            this.hide();
            this.syncValue();

            // Reset trigger state
            this.mentionStartNode = null;
            this.mentionStartOffset = 0;

            // Refocus editor just in case
            this.editor.focus();
        }
    }

    window.RichTagManager = RichTagManager;
})();
