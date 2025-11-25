// ==UserScript==
// @name         Gemini UX Architect (Pure DOM + Settings) - improved
// @namespace    http://tampermonkey.net/
// @version      7.1
// @description  Настройка ширины, сворачивание кода по умолчанию, запоминание настроек. Работает через Tampermonkey/Grease.
// @author       Full-Stack Optimizer
// @match        https://gemini.google.com/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // --- НАСТРОЙКИ И ХРАНИЛИЩЕ ---
    const KEY_PREFIX = 'gemini_v7_';
    const DEFAULTS = { width: 900, top: '100px', left: '20px', panelCollapsed: false };

    const SETTINGS = {
        get width() {
            const v = GM_getValue(KEY_PREFIX + 'width', DEFAULTS.width);
            const n = parseInt(v, 10);
            return Number.isNaN(n) ? DEFAULTS.width : n;
        },
        set width(v) { GM_setValue(KEY_PREFIX + 'width', Number(v)); },

        get top() { return GM_getValue(KEY_PREFIX + 'top', DEFAULTS.top); },
        set top(v) { GM_setValue(KEY_PREFIX + 'top', String(v)); },

        get left() { return GM_getValue(KEY_PREFIX + 'left', DEFAULTS.left); },
        set left(v) { GM_setValue(KEY_PREFIX + 'left', String(v)); },

        get panelCollapsed() {
            const v = GM_getValue(KEY_PREFIX + 'panel_collapsed', DEFAULTS.panelCollapsed);
            return v === true || v === 'true';
        },
        set panelCollapsed(v) { GM_setValue(KEY_PREFIX + 'panel_collapsed', !!v); }
    };

    // --- ГЛОБАЛЬНЫЕ СТИЛИ ---
    GM_addStyle(`
        :root { --dm-width: ${SETTINGS.width >= 3000 ? '100%' : SETTINGS.width + 'px'}; }

        .conversation-container,
        .text-input-field,
        app-conversation-container,
        .bottom-content,
        .infinite-scroller,
        .chat-container {
            max-width: var(--dm-width) !important;
            width: 100% !important;
            margin-left: auto !important;
            margin-right: auto !important;
        }

        .dm-arrow-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 20px;
            height: 20px;
            margin-right: 8px;
            cursor: pointer;
            font-size: 12px;
            color: #8ab4f8;
            user-select: none;
            transition: transform 0.2s;
        }

        .code-block-decoration {
            cursor: pointer;
            transition: background 0.2s;
        }
        .code-block-decoration:hover {
            background: rgba(255,255,255,0.06);
        }

        /* Минимальная стилизация панели */
        #dm-ux-panel {
            font-family: Roboto, "Helvetica Neue", Arial, sans-serif;
        }
    `);

    // Обновление CSS переменной ширины в реальном времени
    function setChatWidth(px) {
        const val = (typeof px === 'number' && px >= 3000) ? '100%' : (typeof px === 'string' && px === '100%') ? '100%' : `${px}px`;
        document.documentElement.style.setProperty('--dm-width', val);
    }

    // --- DOM HELPER ---
    function el(tag, styles = {}, props = {}, children = []) {
        const element = document.createElement(tag);
        Object.assign(element.style, styles);
        Object.assign(element, props);
        children.forEach(child => {
            if (child == null) return;
            if (typeof child === 'string') element.textContent = child;
            else element.appendChild(child);
        });
        return element;
    }

    // --- СОЗДАНИЕ ПАНЕЛИ УПРАВЛЕНИЯ ---
    function createPanel() {
        if (document.getElementById('dm-ux-panel')) return;

        const panel = el('div', {
            position: 'fixed',
            top: SETTINGS.top,
            left: SETTINGS.left,
            zIndex: '9999999',
            backgroundColor: '#131314',
            border: '1px solid #555',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.7)',
            color: '#e3e3e3',
            width: SETTINGS.panelCollapsed ? 'auto' : '240px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            userSelect: 'none'
        }, { id: 'dm-ux-panel' });

        const header = el('div', {
            padding: '10px 14px',
            background: '#2d2e31',
            borderBottom: SETTINGS.panelCollapsed ? 'none' : '1px solid #444',
            cursor: 'grab',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontWeight: '600',
            fontSize: '13px'
        }, {}, ['🛠️ Config']);

        const toggleBtn = el('span', {
            cursor: 'pointer',
            padding: '2px 6px',
            color: '#8ab4f8',
            fontWeight: 'bold',
            fontSize: '16px'
        }, {
            textContent: SETTINGS.panelCollapsed ? '+' : '–',
            title: 'Свернуть/Развернуть'
        });

        header.appendChild(toggleBtn);
        panel.appendChild(header);

        const body = el('div', {
            padding: '12px 14px',
            display: SETTINGS.panelCollapsed ? 'none' : 'block'
        });

        const infoRow = el('div', { display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }, {}, [
            el('span', { color: '#aaa' }, {}, ['Ширина чата:']),
            el('span', { color: '#8ab4f8', fontFamily: 'monospace' }, { id: 'dm-width-display' }, [SETTINGS.width >= 3000 ? 'Full' : SETTINGS.width + 'px'])
        ]);

        const slider = el('input', { width: '100%', cursor: 'pointer', marginTop: '5px' }, {
            type: 'range',
            min: '600',
            max: '3000',
            step: '50',
            value: SETTINGS.width
        });

        // Дебаунс для ползунка
        let sliderTimer = null;
        slider.addEventListener('input', (e) => {
            const v = parseInt(e.target.value, 10) || DEFAULTS.width;
            document.getElementById('dm-width-display').textContent = v >= 3000 ? 'Full' : v + 'px';
            setChatWidth(v);
            if (sliderTimer) clearTimeout(sliderTimer);
            sliderTimer = setTimeout(() => {
                SETTINGS.width = v;
            }, 300);
        });

        // Кнопка сброса
        const resetBtn = el('button', {
            marginTop: '12px',
            width: '100%',
            padding: '8px',
            background: 'transparent',
            border: '1px solid #555',
            borderRadius: '6px',
            color: '#ccc',
            cursor: 'pointer',
            fontSize: '12px'
        }, { textContent: 'Сбросить настройки' });

        resetBtn.onclick = () => {
            slider.value = DEFAULTS.width;
            document.getElementById('dm-width-display').textContent = DEFAULTS.width + 'px';
            setChatWidth(DEFAULTS.width);
            SETTINGS.width = DEFAULTS.width;
            panel.style.top = DEFAULTS.top;
            panel.style.left = DEFAULTS.left;
            SETTINGS.top = DEFAULTS.top;
            SETTINGS.left = DEFAULTS.left;
            SETTINGS.panelCollapsed = DEFAULTS.panelCollapsed;
            if (body) body.style.display = DEFAULTS.panelCollapsed ? 'none' : 'block';
            header.style.borderBottom = DEFAULTS.panelCollapsed ? 'none' : '1px solid #444';
            toggleBtn.textContent = DEFAULTS.panelCollapsed ? '+' : '–';
        };

        body.appendChild(infoRow);
        body.appendChild(slider);
        body.appendChild(resetBtn);
        panel.appendChild(body);
        document.body.appendChild(panel);

        // --- ПЕРЕТАСКИВАНИЕ (pointer events) ---
        let isDragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;
        header.addEventListener('pointerdown', (e) => {
            if (e.target === toggleBtn) return;
            isDragging = true;
            header.setPointerCapture(e.pointerId);
            header.style.cursor = 'grabbing';
            startX = e.clientX;
            startY = e.clientY;
            const rect = panel.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
            e.preventDefault();
        });

        document.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            panel.style.left = (startLeft + dx) + 'px';
            panel.style.top = (startTop + dy) + 'px';
        });

        document.addEventListener('pointerup', (e) => {
            if (!isDragging) return;
            isDragging = false;
            header.style.cursor = 'grab';
            SETTINGS.left = panel.style.left || DEFAULTS.left;
            SETTINGS.top = panel.style.top || DEFAULTS.top;
            try { header.releasePointerCapture && header.releasePointerCapture(e.pointerId); } catch (err) {}
        });

        // --- ЛОГИКА СВОРАЧИВАНИЯ ---
        toggleBtn.onclick = () => {
            const isHidden = body.style.display === 'none';
            if (isHidden) {
                body.style.display = 'block';
                panel.style.width = '240px';
                header.style.borderBottom = '1px solid #444';
                toggleBtn.textContent = '–';
                SETTINGS.panelCollapsed = false;
            } else {
                body.style.display = 'none';
                panel.style.width = 'auto';
                header.style.borderBottom = 'none';
                toggleBtn.textContent = '+';
                SETTINGS.panelCollapsed = true;
            }
        };
    }

    // --- СВорачивание КОДА ---
    function processCodeBlocks(root = document) {
        // Поддерживаем разные варианты: .code-block + .code-block-decoration встречаются в Gemini
        const blocks = root.querySelectorAll('.code-block');

        blocks.forEach(block => {
            if (!block) return;
            const header = block.querySelector('.code-block-decoration') || block.querySelector('[role="heading"], .heading');
            const content = block.querySelector('div[class*="internal-container"]') || block.querySelector('pre') || block.querySelector('code') || block.querySelector('textarea');

            if (!header || !content) return;
            if (header.dataset.dmReady) return;
            header.dataset.dmReady = 'true';

            // Сохраняем начальное состояние свернутого блока
            let isCollapsed = true;

            // Скрываем контент по умолчанию
            content.style.display = 'none';
            header.style.borderBottom = 'none';

            const arrow = el('span', {}, { className: 'dm-arrow-btn', textContent: '▶', title: 'Показать/Скрыть код' });

            if (header.firstChild) header.insertBefore(arrow, header.firstChild);
            else header.appendChild(arrow);

            header.addEventListener('click', (e) => {
                // Игнорируем клики по кнопкам (копирование и т.п.)
                if (e.target.closest('button') || e.target.tagName === 'BUTTON') return;

                isCollapsed = !isCollapsed;
                if (isCollapsed) {
                    content.style.display = 'none';
                    header.style.borderBottom = 'none';
                    arrow.textContent = '▶';
                } else {
                    content.style.display = '';
                    header.style.borderBottom = '1px solid #444';
                    arrow.textContent = '▼';
                }
            });

            header.addEventListener('mousedown', (e) => {
                if (!e.target.closest('button')) e.preventDefault();
            });
        });
    }

    // --- Наблюдатель за DOM (замена setInterval) ---
    let observer = null;
    function startObserver() {
        if (observer) return;
        observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.addedNodes && m.addedNodes.length) {
                    m.addedNodes.forEach(node => {
                        if (!(node instanceof HTMLElement)) return;
                        // Если добавлен контейнер чата — применяем ширину и панель
                        if (node.querySelector && (node.querySelector('.conversation-container') || node.matches('.conversation-container') )) {
                            setChatWidth(SETTINGS.width);
                            createPanel();
                        }
                        // Обрабатываем потенциальные блоки кода внутри добавленного узла
                        processCodeBlocks(node);
                    });
                }
            }
        });

        observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
    }

    // --- СТАРТ ---
    function start() {
        setChatWidth(SETTINGS.width);
        createPanel();
        processCodeBlocks(document);
        startObserver();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }

})();
