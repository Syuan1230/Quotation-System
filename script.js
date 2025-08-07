document.addEventListener('DOMContentLoaded', function () {
    // =================================================================
    // 1. STATE MANAGEMENT & CONFIGURATION
    // =================================================================

    let priceStore = {};
    let currentPackageId = null;
    let allPackages = {};
    let comparisonList = [];

    const dom = {
        appContainer: document.getElementById('app-container'),
        priceSettingsModal: document.getElementById('price-settings-modal'),
        quoteSummary: document.getElementById('quote-summary'),
        grandTotalEl: document.getElementById('grand-total'),
        monthlyAverageEl: document.getElementById('monthly-average'),
        taxCheckbox: document.getElementById('include-tax-checkbox'),
        showPackageDealCheckbox: document.getElementById('show-package-deal-checkbox'),
        showTotalOnlyCheckbox: document.getElementById('show-total-only-checkbox'),
        taxTotalContainer: document.getElementById('tax-total-container'),
        grandTotalTaxedEl: document.getElementById('grand-total-taxed'),
        comparisonSection: document.getElementById('comparison-section'),
        comparisonTbody: document.getElementById('comparison-tbody'),
        packagesContainer: document.getElementById('packages-container'),
        priceSettingsContainer: document.getElementById('price-settings-container'),
        additionalServicesContainer: document.getElementById('additional-services'),
    };

    const serviceCalculators = {
        'inner-page-design': c => (priceStore['inner-page-design']?.price ?? 20000) * (parseInt(c.querySelector('.inner-page-count').value) || 0),
        'language-add': c => ((priceStore['language-add']?.price ?? 8000) * (parseInt(c.querySelector('.language-count').value) || 0)) + ((priceStore['language-add-special']?.price ?? 10000) * (parseInt(c.querySelector('.special-language-count').value) || 0)),
        'blog-writing': c => ((priceStore['blog-writing']?.price ?? 15000) * (parseInt(c.querySelector('.chinese-blog-count').value) || 0)) + ((priceStore['blog-writing-en']?.price ?? 15000) * (parseInt(c.querySelector('.english-blog-count').value) || 0)),
        'mailcloud': c => (c.querySelector('.mailcloud-setup-check').checked ? (priceStore['mailcloud-setup']?.price ?? 1000) : 0) + ((parseInt(c.querySelector('.mailcloud-quantity').value) || 0) * (parseInt(c.querySelector('.mailcloud-years').value) || 0) * (priceStore['mailcloud-account']?.price ?? 1200)),
        'custom-dev': () => priceStore['custom-dev']?.price || 0
    };
    
    // =================================================================
    // 2. INITIALIZATION
    // =================================================================

    function initialize() {
        loadPriceStore();
        populatePriceSettings();
        loadCustomPackages();
        setupEventListeners();
        loadState();
        generateQuoteInfo();
        updateQuote();
        document.querySelector('.nav-link[data-tab="combo-packages"]')?.click();
    }

    function loadPriceStore() {
        const savedPrices = JSON.parse(localStorage.getItem('customPriceStore') || '{}');
        document.querySelectorAll('div[data-service-id]').forEach(el => {
            const id = el.dataset.serviceId;
            if (!id) return;
            if (!priceStore[id]) priceStore[id] = {};
            const main = el.querySelector('.service-checkbox');
            if (main) {
                const price = parseFloat(main.dataset.price) || 0;
                priceStore[id].price = price;
                priceStore[id].basePrice = price; // Default basePrice
            }
            const renewal = el.querySelector('.renewal-checkbox');
            if (renewal) {
                const renewalPrice = parseFloat(renewal.dataset.renewalPrice) || 0;
                priceStore[id].renewal = renewalPrice;
                priceStore[id].baseRenewal = renewalPrice; // Default baseRenewal
            }
        });
        const defaults = { 'language-add': { price: 8000, basePrice: 8000 }, 'language-add-special': { price: 10000, basePrice: 10000 }, 'blog-writing': { price: 15000, basePrice: 15000 }, 'blog-writing-en': { price: 15000, basePrice: 15000 }, 'mailcloud-setup': { price: 1000, basePrice: 1000 }, 'mailcloud-account': { price: 1200, basePrice: 1200 } };
        Object.assign(priceStore, defaults);

        for (const id in savedPrices) {
            if (!priceStore[id]) priceStore[id] = {};
            Object.assign(priceStore[id], savedPrices[id]);
        }
    }
    
    function populatePriceSettings() {
        dom.priceSettingsContainer.innerHTML = ''; 
        document.querySelectorAll('.border[data-service-id]').forEach(el => {
            const id = el.dataset.serviceId, name = el.querySelector('h3').textContent;
            if (!id) return;
            if (priceStore[id]?.price !== undefined) addPriceSettingRow(id, name, 'price', priceStore[id].price, priceStore[id].basePrice);
            if (priceStore[id]?.renewal !== undefined) addPriceSettingRow(id, `${name} - 續約`, 'renewal', priceStore[id].renewal, priceStore[id].baseRenewal);
        });
        const calcItems = [ {id: 'language-add', name: '新增語系 (一般)'}, {id: 'language-add-special', name: '新增語系 (特殊)'}, {id: 'blog-writing', name: '部落格文案撰寫 (中文)'}, {id: 'blog-writing-en', name: '部落格文案撰寫 (英文)'}, {id: 'mailcloud-setup', name: 'MailCloud 首次設定費'}, {id: 'mailcloud-account', name: 'MailCloud 帳號費用/年'} ];
        calcItems.forEach(item => { if (priceStore[item.id]?.price !== undefined) addPriceSettingRow(item.id, item.name, 'price', priceStore[item.id].price, priceStore[item.id].basePrice); });
    }
    
    function addPriceSettingRow(id, name, type, price, basePrice) {
        const row = document.createElement('div');
        row.className = 'grid grid-cols-[1fr_auto_auto] gap-x-2 items-center py-2 border-b';
        row.innerHTML = `
            <label for="price-edit-${type}-${id}" class="text-sm">${name}</label>
            <div class="flex flex-col"><label class="text-xs text-gray-500 text-center">售價</label><input type="number" id="price-edit-${type}-${id}" data-target-id="${id}" data-price-type="${type}" class="form-input w-24 highlight-input px-3 py-2 border border-gray-300 rounded-md" value="${price}"></div>
            <div class="flex flex-col"><label class="text-xs text-gray-500 text-center">底價</label><input type="number" id="base-price-edit-${type}-${id}" data-target-id="${id}" data-price-type="base${type.charAt(0).toUpperCase() + type.slice(1)}" class="form-input w-24 highlight-input px-3 py-2 border border-gray-300 rounded-md" value="${basePrice ?? price}"></div>
        `;
        dom.priceSettingsContainer.appendChild(row);
    }

    function generateQuoteInfo() {
        const quoteNumInput = document.getElementById('cust-quote-num');
        if (quoteNumInput.value) return;
        const now = new Date(), p = (n) => n.toString().padStart(2, '0');
        quoteNumInput.value = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}${p(now.getHours())}${p(now.getMinutes())}`;
        document.getElementById('cust-date').value = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
    }

    // =================================================================
    // 3. EVENT HANDLING
    // =================================================================
    
    function setupEventListeners() {
        dom.appContainer.addEventListener('click', handleAppClick);
        dom.appContainer.addEventListener('input', handleAppInput);
        dom.appContainer.addEventListener('change', handleAppChange);
        dom.appContainer.addEventListener('blur', (e) => { if (e.target.matches('[contenteditable="true"]')) saveState(); }, true);
        document.getElementById('open-price-settings').addEventListener('click', () => dom.priceSettingsModal.classList.remove('hidden'));
        document.getElementById('close-price-settings').addEventListener('click', () => dom.priceSettingsModal.classList.add('hidden'));
        document.getElementById('add-custom-item').addEventListener('click', addCustomItem);
        dom.priceSettingsContainer.addEventListener('input', handlePriceSettingChange);
    }

    function handleAppClick(e) {
        const target = e.target, card = target.closest('.package-card');
        if (target.matches('.nav-link')) { e.preventDefault(); handleTabClick(target); }
        else if (target.matches('.stepper-btn')) { handleStepperClick(target); }
        else if (target.matches('.select-package-btn') && card) { selectPackage(card.dataset.packageId); }
        else if (target.closest('.delete-custom-package-btn') && card) { if (confirm(`確定要刪除自訂方案 "${allPackages[card.dataset.packageId].name}" 嗎？`)) deleteCustomPackage(card.dataset.packageId); }
        else if (target.closest('.compare-btn') && card) { toggleCompare(card.dataset.packageId, target.closest('.compare-btn')); }
        else if (target.id === 'clear-quote') { if (confirm('確定要清空所有已選的服務項目嗎？客戶資料將會保留。')) clearQuoteData(); }
        else if (target.id === 'print-quote') { printQuote(); }
        else if (target.id === 'clear-customer-info') { clearCustomerInfo(); }
        else if (target.id === 'save-as-package') { saveCurrentSelectionAsPackage(); }
        else if (target.id === 'clear-comparison') { clearComparison(); }
        else if (target.matches('.remove-from-compare')) {
            const id = target.dataset.id, btn = document.querySelector(`.package-card[data-package-id="${id}"] .compare-btn`);
            toggleCompare(id, btn);
        }
    }
    
    function handleAppInput(e) { if (e.target.matches('.description-input, .number-input, #customer-info-form input, header input, #payment-method-notes')) { updateQuote(); saveState(); } }
    function handleAppChange(e) { if (e.target.matches('.service-checkbox, .renewal-checkbox, .mailcloud-setup-check, #include-tax-checkbox, #show-package-deal-checkbox, #show-total-only-checkbox')) { if (e.target.matches('.service-checkbox, .renewal-checkbox')) { currentPackageId = null; document.querySelectorAll('.package-card').forEach(c => c.classList.remove('ring-4', 'ring-offset-2', 'ring-blue-500')); } updateQuote(); saveState(); } }
    function handleTabClick(link) { document.querySelectorAll('.nav-link').forEach(i => i.classList.remove('active')); link.classList.add('active'); document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('hidden', c.id !== link.dataset.tab)); }
    function handleStepperClick(btn) { const input = btn.closest('.flex.items-center').querySelector('.number-input'), step = parseFloat(btn.dataset.step) || 1, min = parseFloat(input.min) ?? 0; let val = parseFloat(input.value) || 0; val += (btn.classList.contains('plus') ? step : -step); if (val < min) val = min; input.value = step < 1 ? val.toFixed(2) : val; input.dispatchEvent(new Event('input', { bubbles: true })); }
    function handlePriceSettingChange(e) { if (e.target.matches('.highlight-input')) { const { targetId, priceType } = e.target.dataset, val = parseFloat(e.target.value) || 0; if (!priceStore[targetId]) priceStore[targetId] = {}; priceStore[targetId][priceType] = val; updatePriceDisplays(targetId, priceType, val); savePriceStore(); updateQuote(); } }

    // =================================================================
    // 4. CALCULATION LOGIC & UI
    // =================================================================

    function updateQuote() {
        const { html, totalCost, maxYears, totalOriginalCost } = getQuoteDetails(false);
        const monthly = totalCost > 0 ? Math.round(totalCost / (maxYears * 12)) : 0;
        
        if (dom.showPackageDealCheckbox.checked && totalCost < totalOriginalCost) {
            dom.grandTotalEl.innerHTML = `<span class="text-base text-gray-500 line-through mr-2">NT$ ${Math.round(totalOriginalCost).toLocaleString()}</span><span class="font-bold text-2xl text-blue-600">NT$ ${Math.round(totalCost).toLocaleString()}</span>`;
        } else {
            dom.grandTotalEl.innerHTML = `<span class="font-bold text-2xl text-blue-600">NT$ ${Math.round(totalCost).toLocaleString()}</span>`;
        }

        dom.monthlyAverageEl.textContent = `NT$ ${monthly.toLocaleString()}`;
        
        if (dom.taxCheckbox.checked) {
            const taxedTotal = totalCost * 1.05;
            const taxedOriginalTotal = totalOriginalCost * 1.05;
            if (dom.showPackageDealCheckbox.checked && totalCost < totalOriginalCost) {
                dom.grandTotalTaxedEl.innerHTML = `<span class="text-base text-gray-500 line-through mr-2">NT$ ${Math.round(taxedOriginalTotal).toLocaleString()}</span><span class="font-bold text-2xl text-red-600">NT$ ${Math.round(taxedTotal).toLocaleString()}</span>`;
            } else {
                dom.grandTotalTaxedEl.innerHTML = `<span class="font-bold text-2xl text-red-600">NT$ ${Math.round(taxedTotal).toLocaleString()}</span>`;
            }
            dom.taxTotalContainer.classList.remove('hidden');
        } else {
            dom.taxTotalContainer.classList.add('hidden');
        }
        
        dom.quoteSummary.innerHTML = html || '<p id="empty-quote" class="text-center text-gray-500 pt-12">尚未選擇任何服務項目。</p>';
        updateDynamicServicePrices();
    }
    
    function getQuoteDetails(isForPrint = false, showDealOverride = null) {
        let html = '', totalCost = 0, totalOriginalCost = 0, maxYears = 1;
        document.querySelectorAll('div[data-service-id]').forEach(c => {
            const id = c.dataset.serviceId, main = c.querySelector('.service-checkbox'), renewal = c.querySelector('.renewal-checkbox');
            if (!main || (!main.checked && !(renewal && renewal.checked))) return;
            
            const calc = serviceCalculators[id];
            let mainCost = 0, renewalCost = 0, mainOriginal = 0, renewalOriginal = 0, years = 1;

            if (main.checked) {
                const basePrice = calc ? calc(c) / (parseFloat(c.querySelector('.first-year-discount')?.value) || 1) : (priceStore[id]?.price || 0);
                mainOriginal = basePrice;
                const discount = parseFloat(c.querySelector('.first-year-discount')?.value) || 1;
                mainCost = mainOriginal * discount;
            }

            if (renewal && renewal.checked) {
                const rYears = parseInt(c.querySelector('.renewal-years')?.value) || 1;
                const rDiscount = parseFloat(c.querySelector('.renewal-discount')?.value) || 1;
                renewalOriginal = (priceStore[id]?.renewal || 0) * rYears;
                renewalCost = renewalOriginal * rDiscount;
                years = 1 + rYears;
            }

            totalCost += mainCost + renewalCost;
            totalOriginalCost += mainOriginal + renewalOriginal;
            maxYears = Math.max(maxYears, years);
            
            const itemHtml = generateItemHTML(c, mainCost, renewalCost, isForPrint, showDealOverride);
            if (itemHtml) html += `<div class="py-2 border-b border-gray-100 break-inside-avoid">${itemHtml}</div>`;
        });
        return { html, totalCost, maxYears, totalOriginalCost };
    }

    function calculatePackagePrice(id) { const pkg = allPackages[id]; if (!pkg) return { totalPrice: 0, totalYears: 1 }; let total = 0, maxYears = 1; pkg.items.forEach(item => { let itemTotal = 0, itemYears = 1; const serviceId = item.id; if (item.mainChecked) itemTotal += (priceStore[serviceId]?.price || 0) * (parseFloat(item.inputs['first-year-discount']) || 1); if (item.renewalChecked) { const years = parseInt(item.inputs['renewal-years']) || 1; itemTotal += (priceStore[serviceId]?.renewal || 0) * years * (parseFloat(item.inputs['renewal-discount']) || 1); itemYears = 1 + years; } total += itemTotal; maxYears = Math.max(maxYears, itemYears); }); return { totalPrice: total, totalYears: maxYears }; }
    function updateDynamicServicePrices() { document.querySelectorAll('[data-service-id]').forEach(c => { const id = c.dataset.serviceId, calc = serviceCalculators[id]; if (calc) { const price = calc(c), el = c.querySelector('.language-total, .blog-total, .mailcloud-total, .inner-page-total'), p = c.querySelector('.language-cost-p, .blog-cost-p, .mailcloud-cost-p'); if (el) el.textContent = `NT$ ${price.toLocaleString()}`; if (p) p.classList.toggle('hidden', price === 0); } }); }
    
    function generateItemHTML(c, mainCost, renewalCost, isForPrint, showDealOverride = null) {
        const main = c.querySelector('.service-checkbox'), renewal = c.querySelector('.renewal-checkbox');
        if (!main.checked && !renewal?.checked) return '';
        
        const id = c.dataset.serviceId, name = main.dataset.name, note = c.querySelector('.description-input')?.value.trim() || '';
        const hidePricesInPrint = isForPrint && dom.showTotalOnlyCheckbox.checked;
        let mainHTML = '', renewalHTML = '';

        const calc = serviceCalculators[id];
        const basePrice = calc ? calc(c) : (priceStore[id]?.basePrice ?? priceStore[id]?.price ?? 0);
        const baseRenewal = priceStore[id]?.baseRenewal ?? priceStore[id]?.renewal ?? 0;
        
        const generatePriceHTML = (discountedPrice, originalPrice, priceTextPrefix = 'NT$ ') => {
            const showDeal = (showDealOverride !== null) ? showDealOverride : dom.showPackageDealCheckbox.checked;
            let text = `${priceTextPrefix}${Math.round(discountedPrice).toLocaleString()}`;
            if (id === 'custom-dev' && discountedPrice === 0) text = '依工程師估價';
            else if (discountedPrice === 0 && originalPrice > 0) text = `<span class="text-green-600 font-semibold">特別優惠</span>`;

            if (showDeal && discountedPrice < originalPrice && originalPrice > 0) {
                return `<span class="text-xs text-gray-500 line-through mr-2">NT$ ${Math.round(originalPrice).toLocaleString()}</span><span class="text-red-600">${text}</span>`;
            }
            return `<span>${text}</span>`;
        };

        if (main.checked) {
            const discount = parseFloat(c.querySelector('.first-year-discount')?.value) || 1;
            const priceDisplayHTML = hidePricesInPrint ? '' : generatePriceHTML(mainCost, basePrice);
            const discountText = (discount !== 1 && basePrice > 0) ? `<div class="text-xs text-green-600">首年 ${Math.round(discount*100)} 折</div>` : '';
            const priceColHTML = hidePricesInPrint ? '' : `
                <div class="text-right flex-shrink-0 price-col">
                    <div class="text-sm font-semibold">${priceDisplayHTML}</div>
                    ${discountText}
                </div>`;

            if (isForPrint) {
                const descHTML = c.querySelector('p[contenteditable="true"]')?.innerHTML || '';
                const featuresHTML = c.querySelector('ul[contenteditable="true"]')?.innerHTML || '';
                mainHTML = `<div class="flex justify-between items-start">
                                <div class="flex-1 pr-2"><span class="text-sm text-gray-800 font-bold">${getDisplayName(c)}</span></div>
                                ${priceColHTML}
                            </div>
                            ${descHTML ? `<p class="text-xs text-gray-500 mt-1">${descHTML}</p>` : ''}
                            ${featuresHTML ? `<div class="text-xs text-gray-600 mt-2 pl-2 features-list"><ul>${featuresHTML}</ul></div>` : ''}
                            ${note ? `<p class="text-xs text-gray-500 mt-2 pl-2 border-l-2 border-gray-200">${note}</p>` : ''}`;
            } else {
                mainHTML = `<div class="flex justify-between items-start">
                                <div class="flex-1 pr-2"><span class="text-sm text-gray-800 font-bold">${getDisplayName(c)}</span></div>
                                ${priceColHTML}
                            </div>
                            ${note ? `<p class="text-xs text-gray-500 mt-2 pl-2 border-l-2 border-gray-200">${note}</p>` : ''}`;
            }
        }

        if (renewal && renewal.checked) {
            const years = parseInt(c.querySelector('.renewal-years').value) || 1;
            const discount = parseFloat(c.querySelector('.renewal-discount').value) || 1;
            const originalRenewalTotal = baseRenewal * years;
            const priceDisplayHTML = hidePricesInPrint ? '' : generatePriceHTML(renewalCost, originalRenewalTotal);
            const discountText = (discount !== 1) ? `<div class="text-xs text-green-600">${Math.round(discount*100)} 折</div>` : '';
            const priceColHTML = hidePricesInPrint ? '' : `
                <div class="text-right price-col">
                    <div class="text-sm font-semibold">${priceDisplayHTML}</div>
                    ${discountText}
                </div>`;
            
            let content = `<div class="flex justify-between items-center ${main.checked ? 'pl-4 mt-1' : ''}">
                            <span class="text-sm text-gray-700">${renewal.dataset.name} (${years}年)</span>
                            ${priceColHTML}
                           </div>`;

            if (isForPrint && !main.checked) {
                const descHTML = c.querySelector('p[contenteditable="true"]')?.innerHTML || '';
                const featuresHTML = c.querySelector('ul[contenteditable="true"]')?.innerHTML || '';
                content = `<div class="flex justify-between items-start">
                               <div class="flex-1 pr-2"><span class="text-sm text-gray-800 font-bold">${name}</span></div>
                           </div>
                           ${descHTML ? `<p class="text-xs text-gray-500 mt-1">${descHTML}</p>` : ''}
                           ${featuresHTML ? `<div class="text-xs text-gray-600 mt-2 pl-2 features-list"><ul>${featuresHTML}</ul></div>` : ''}
                           <div class="mt-2 pt-2 border-t border-gray-200"></div>
                           ${content}`;
            }
            renewalHTML = content;
        }

        return mainHTML + renewalHTML;
    }


    function getDisplayName(c) { const id = c.dataset.serviceId; let name = c.querySelector('.service-checkbox').dataset.name; const details = []; switch (id) { case 'inner-page-design': details.push(`共 ${c.querySelector('.inner-page-count').value || 0} 頁`); break; case 'language-add': const totalLang = (parseInt(c.querySelector('.language-count').value) || 0) + (parseInt(c.querySelector('.special-language-count').value) || 0); if (totalLang > 0) details.push(`共 ${totalLang} 組`); break; case 'blog-writing': const totalBlog = (parseInt(c.querySelector('.chinese-blog-count').value) || 0) + (parseInt(c.querySelector('.english-blog-count').value) || 0); if (totalBlog > 0) details.push(`共 ${totalBlog} 篇`); break; case 'mailcloud': const q = parseInt(c.querySelector('.mailcloud-quantity').value) || 0, y = parseInt(c.querySelector('.mailcloud-years').value) || 0; if (q > 0) details.push(`${q} 組`); if (y > 0) details.push(`${y} 年`); break; } return details.length > 0 ? `${name} (${details.join(', ')})` : name; }
    function updatePriceDisplays(id, type, val) { const fVal = `NT$ ${val.toLocaleString()}`; if (type === 'price') { const el = document.querySelector(`.price-display[data-price-id="${id}"]`); if (el) el.textContent = (id === 'custom-dev' && val === 0) ? '依工程師估價' : fVal; } else if (type === 'renewal') { const el = document.querySelector(`.renewal-price-display[data-renewal-price-id="${id}"]`); if (el) el.textContent = `${fVal} /年`; } }
    function updateComparisonTable() { if (comparisonList.length === 0) { dom.comparisonSection.classList.add('hidden'); return; } dom.comparisonSection.classList.remove('hidden'); dom.comparisonTbody.innerHTML = ''; const details = comparisonList.map(id => { const d = calculatePackagePrice(id); const avg = d.totalPrice > 0 && d.totalYears > 0 ? d.totalPrice / d.totalYears : 0; return { id, name: allPackages[id].name, averageCost: avg }; }); if (details.length === 0) return; const maxAvg = Math.max(...details.map(p => p.averageCost)); details.forEach(d => { const savings = maxAvg - d.averageCost; const row = document.createElement('tr'); row.className = 'border-b'; row.innerHTML = `<td class="p-2 font-semibold">${d.name}</td><td class="p-2">NT$ ${Math.round(d.averageCost).toLocaleString()} /年</td><td class="p-2 text-green-600">${savings > 0 ? `省 ${Math.round(savings).toLocaleString()}` : '-'}</td><td class="p-2"><button class="text-red-500 hover:text-red-700 remove-from-compare" data-id="${d.id}">&times;</button></td>`; dom.comparisonTbody.appendChild(row); }); }

    // =================================================================
    // 6. CORE FUNCTIONALITY & ACTIONS
    // =================================================================

    function clearQuoteData() {
        clearQuoteSelections();
        const savedState = localStorage.getItem('quoteAppState');
        if (savedState) {
            const state = JSON.parse(savedState);
            state.services = {}; // Clear only services
            localStorage.setItem('quoteAppState', JSON.stringify(state));
        }
    }

    function clearQuoteSelections() {
        document.querySelectorAll('input[type="checkbox"]').forEach(c => {
            if (!c.id.includes('show-package-deal') && !c.id.includes('show-total-only') && !c.id.includes('include-tax')) {
                c.checked = false;
            }
        });
        document.querySelectorAll('.renewal-years, .inner-page-count').forEach(i => i.value = '1');
        document.querySelectorAll('.renewal-discount, .first-year-discount').forEach(i => i.value = '1');
        document.querySelectorAll('.language-count, .special-language-count, .chinese-blog-count, .english-blog-count, .mailcloud-quantity, .mailcloud-years').forEach(i => i.value = '0');
        document.querySelectorAll('.package-card').forEach(c => c.classList.remove('ring-4', 'ring-offset-2', 'ring-blue-500'));
        currentPackageId = null;
        updateQuote();
    }

    function clearCustomerInfo() {
        document.getElementById('customer-info-form').querySelectorAll('input:not([readonly])').forEach(i => i.value = '');
        document.getElementById('payment-method-notes').value = '';
        generateQuoteInfo();
        saveState();
    }

    function selectPackage(id) { clearQuoteSelections(); const pkg = allPackages[id]; if (!pkg) return; currentPackageId = id; document.querySelector(`.package-card[data-package-id="${id}"]`)?.classList.add('ring-4', 'ring-offset-2', 'ring-blue-500'); pkg.items.forEach(item => { const c = document.querySelector(`div[data-service-id="${item.id}"]`); if (!c) return; const main = c.querySelector('.service-checkbox'); if (main) main.checked = item.mainChecked; const renewal = c.querySelector('.renewal-checkbox'); if (renewal) renewal.checked = item.renewalChecked; for (const key in item.inputs) { const el = c.querySelector(`.${key}, #${key}`); if (el) el.type === 'checkbox' ? (el.checked = item.inputs[key]) : (el.value = item.inputs[key]); } }); updateQuote(); saveState(); }
    function toggleCompare(id, btn) { const i = comparisonList.indexOf(id); if (i > -1) { comparisonList.splice(i, 1); btn.classList.remove('bg-yellow-500', 'text-white'); btn.innerHTML = `<i class="fas fa-balance-scale-right mr-2"></i>加入比較`; } else { comparisonList.push(id); btn.classList.add('bg-yellow-500', 'text-white'); btn.innerHTML = `<i class="fas fa-check mr-2"></i>已加入比較`; } updateComparisonTable(); }
    function clearComparison() { comparisonList = []; document.querySelectorAll('.compare-btn').forEach(b => { b.classList.remove('bg-yellow-500', 'text-white'); b.innerHTML = `<i class="fas fa-balance-scale-right mr-2"></i>加入比較`; }); updateComparisonTable(); }

    // =================================================================
    // 7. LOCALSTORAGE & CUSTOM ITEMS
    // =================================================================
    
    function savePriceStore() { localStorage.setItem('customPriceStore', JSON.stringify(priceStore)); }
    function saveState() { const state = { services: {}, customerInfo: {}, projectManagerInfo: {}, taxChecked: dom.taxCheckbox.checked, showPackageDeal: dom.showPackageDealCheckbox.checked, showTotalOnly: dom.showTotalOnlyCheckbox.checked, paymentNotes: document.getElementById('payment-method-notes').value }; document.querySelectorAll('div[data-service-id]').forEach(c => { const id = c.dataset.serviceId; if (!id) return; const sState = { inputs: {}, checkboxes: {}, descriptions: {} }; c.querySelectorAll('input, textarea').forEach(i => { const key = i.id || i.classList[0]; if (i.type === 'checkbox') sState.checkboxes[key] = i.checked; else sState.inputs[key] = i.value; }); const p = c.querySelector('p[contenteditable="true"]'); if (p) sState.descriptions.p = p.innerHTML; const ul = c.querySelector('ul[contenteditable="true"]'); if (ul) sState.descriptions.ul = ul.innerHTML; state.services[id] = sState; }); document.querySelectorAll('#customer-info-form input').forEach(i => { if (i.id) state.customerInfo[i.id] = i.value; }); document.querySelectorAll('header input').forEach(i => { if (i.id) state.projectManagerInfo[i.id] = i.value; }); localStorage.setItem('quoteAppState', JSON.stringify(state)); }
    function loadState() { const saved = localStorage.getItem('quoteAppState'); if (!saved) return; const state = JSON.parse(saved); if (state.services) { for (const id in state.services) { const c = document.querySelector(`div[data-service-id="${id}"]`); if (!c) continue; const s = state.services[id]; for (const key in s.inputs) { const i = c.querySelector(`#${key}, .${key}`); if (i) i.value = s.inputs[key]; } for (const key in s.checkboxes) { const cb = c.querySelector(`#${key}, .${key}`); if (cb) cb.checked = s.checkboxes[key]; } if (s.descriptions.p) { const p = c.querySelector('p[contenteditable="true"]'); if (p) p.innerHTML = s.descriptions.p; } if (s.descriptions.ul) { const ul = c.querySelector('ul[contenteditable="true"]'); if (ul) ul.innerHTML = s.descriptions.ul; } } } if (state.customerInfo) { for (const id in state.customerInfo) { const i = document.getElementById(id); if (i) i.value = state.customerInfo[id]; } } if (state.projectManagerInfo) { for (const id in state.projectManagerInfo) { const i = document.getElementById(id); if (i) i.value = state.projectManagerInfo[id]; } } document.getElementById('payment-method-notes').value = state.paymentNotes || ''; dom.taxCheckbox.checked = state.taxChecked || false; dom.showPackageDealCheckbox.checked = state.showPackageDeal === undefined ? true : state.showPackageDeal; dom.showTotalOnlyCheckbox.checked = state.showTotalOnly || false; }
    function saveCurrentSelectionAsPackage() { const nameInput = document.getElementById('new-package-name'), name = nameInput.value.trim(); if (!name) { alert('請為您的組合方案命名。'); nameInput.focus(); return; } const items = []; document.querySelectorAll('div[data-service-id]').forEach(c => { const main = c.querySelector('.service-checkbox'), renewal = c.querySelector('.renewal-checkbox'); if ((main && main.checked) || (renewal && renewal.checked)) { const item = { id: c.dataset.serviceId, mainChecked: main ? main.checked : false, renewalChecked: renewal ? renewal.checked : false, inputs: {} }; c.querySelectorAll('.first-year-discount, .renewal-years, .renewal-discount, .inner-page-count, .language-count, .special-language-count, .chinese-blog-count, .english-blog-count, .mailcloud-quantity, .mailcloud-years, .description-input, .mailcloud-setup-check').forEach(i => { const key = i.classList[0] || i.id; item.inputs[key] = i.type === 'checkbox' ? i.checked : i.value; }); items.push(item); } }); if (items.length === 0) { alert("沒有選擇任何項目，無法儲存。"); return; } const id = 'custom-' + Date.now(); allPackages[id] = { id, name, items, isCustom: true }; localStorage.setItem('customQuotePackages', JSON.stringify(allPackages)); renderCustomPackage(allPackages[id]); nameInput.value = ''; alert(`組合方案 "${name}" 已儲存！`); }
    function loadCustomPackages() { const saved = JSON.parse(localStorage.getItem('customQuotePackages') || '{}'); Object.values(saved).forEach(pkg => { if (pkg.isCustom) { allPackages[pkg.id] = pkg; renderCustomPackage(pkg); } }); }
    function renderCustomPackage(pkg) { const card = document.createElement('div'); card.className = 'package-card border border-gray-200 rounded-lg p-5 hover:shadow-lg transition-all duration-300 relative flex flex-col'; card.dataset.packageId = pkg.id; const itemsHTML = pkg.items.map(item => { const c = document.querySelector(`[data-service-id="${item.id}"]`); if (!c) return ''; let html = ''; if (item.mainChecked) html += `<li>${c.querySelector('.service-checkbox').dataset.name}</li>`; if (item.renewalChecked) html += `<li>${c.querySelector('.renewal-checkbox').dataset.name} (${item.inputs['renewal-years'] || 1}年)</li>`; return html; }).join(''); card.innerHTML = `<button class="delete-custom-package-btn absolute top-3 left-3 text-gray-400 hover:text-red-500 transition-colors z-10"><i class="fas fa-trash-alt"></i></button><div class="absolute top-4 right-4 bg-gray-500 text-white text-xs font-bold px-2 py-1 rounded-full">自訂方案</div><h3 class="text-xl font-bold text-gray-700">${pkg.name}</h3><ul class="list-disc list-inside mt-4 text-gray-600 space-y-2 text-sm flex-grow">${itemsHTML}</ul><div class="mt-auto pt-4 text-right"><button class="mt-2 w-full bg-yellow-400 text-yellow-800 px-4 py-1.5 rounded-lg hover:bg-yellow-500 transition-colors text-sm font-bold compare-btn"><i class="fas fa-balance-scale-right mr-2"></i>加入比較</button><button class="mt-3 bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 w-full select-package-btn">選擇此方案</button></div>`; dom.packagesContainer.appendChild(card); }
    function deleteCustomPackage(id) { document.querySelector(`[data-package-id="${id}"]`)?.remove(); delete allPackages[id]; localStorage.setItem('customQuotePackages', JSON.stringify(allPackages)); updateQuote(); }
    function addCustomItem() { const nameInput = document.getElementById('custom-item-name'), priceInput = document.getElementById('custom-item-price'), name = nameInput.value.trim(), price = parseFloat(priceInput.value); if (!name || isNaN(price)) { alert('請輸入有效的項目名稱和價格。'); return; } const id = 'custom-' + Date.now(); const html = `<div class="border border-gray-200 rounded-lg p-5 hover:shadow-lg transition-shadow duration-300" data-service-id="${id}"><div class="flex items-start justify-between"><div class="flex-1"><h3 class="text-xl font-bold text-gray-700">${name}</h3><p contenteditable="true" class="text-gray-500 mt-1 p-1 rounded hover:bg-gray-100 focus:bg-blue-50 focus:ring-1 focus:ring-blue-300 outline-none transition-colors">請在此輸入服務描述...</p></div><input type="checkbox" class="service-checkbox h-6 w-6 rounded border-gray-400 text-gray-600 focus:ring-gray-500 cursor-pointer ml-4" data-name="${name}" data-price="${price}"></div><ul contenteditable="true" class="list-disc list-inside mt-4 text-gray-600 space-y-2 p-1 rounded hover:bg-gray-100 focus:bg-blue-50 focus:ring-1 focus:ring-blue-300 outline-none transition-colors"><li>請在此編輯功能項目...</li></ul><div class="mt-2"><textarea maxlength="30" class="description-input text-sm px-3 py-2 border border-gray-300 rounded-md w-full" placeholder="備註說明 (最多30字)"></textarea></div><div class="mt-4 flex justify-end items-baseline gap-6"><p class="text-gray-500">一次性費用</p><p class="text-gray-800">費用: <span class="font-bold text-2xl text-gray-600 price-display" data-price-id="${id}">NT$ ${price.toLocaleString()}</span></p></div></div>`; dom.additionalServicesContainer.insertAdjacentHTML('beforeend', html); priceStore[id] = { price: price, basePrice: price }; savePriceStore(); addPriceSettingRow(id, name, 'price', price, price); nameInput.value = ''; priceInput.value = ''; handleTabClick(document.querySelector('[data-tab="additional-services"]')); }

    // =================================================================
    // 8. PRINT FUNCTIONALITY
    // =================================================================

    function printQuote() { 
        if (document.querySelectorAll('.service-checkbox:checked, .renewal-checkbox:checked').length === 0) { 
            alert('請至少選擇一個報價項目後再列印。'); 
            return; 
        }
        const { totalCost, totalOriginalCost } = getQuoteDetails(true, dom.showPackageDealCheckbox.checked);

        const data = { 
            pmName: document.getElementById('project-manager-name').value, 
            pmPhone: document.getElementById('project-manager-phone').value, 
            pmEmail: document.getElementById('project-manager-email').value, 
            custQuoteNum: document.getElementById('cust-quote-num').value || 'N/A', 
            custDate: document.getElementById('cust-date').value ? new Date(document.getElementById('cust-date').value).toLocaleDateString('zh-TW') : 'N/A', 
            custName: document.getElementById('cust-name').value || 'N/A', 
            custContact: document.getElementById('cust-contact').value || 'N/A', 
            custTel: document.getElementById('cust-tel').value || 'N/A', 
            custEmail: document.getElementById('cust-email').value || 'N/A', 
            custTaxId: document.getElementById('cust-tax-id').value || 'N/A', 
            custAddress: document.getElementById('cust-address').value || 'N/A', 
            monthlyAverageText: dom.monthlyAverageEl.textContent,
            includeTax: dom.taxCheckbox.checked, 
            showTotalOnly: dom.showTotalOnlyCheckbox.checked,
            showPackageDeal: dom.showPackageDealCheckbox.checked,
            paymentNotes: document.getElementById('payment-method-notes').value, 
            itemsHTML: getQuoteDetails(true, dom.showPackageDealCheckbox.checked).html,
            comparisonTableHTML: dom.comparisonSection.classList.contains('hidden') ? '' : dom.comparisonSection.outerHTML,
            totalCost: totalCost,
            totalOriginalCost: totalOriginalCost
        }; 
        const printWindow = window.open('', '_blank'); 
        printWindow.document.write(generatePrintHTML(data)); 
        printWindow.document.close(); 
        setTimeout(() => { 
            printWindow.print(); 
            printWindow.close(); 
        }, 250); 
    }
    
    function generatePrintHTML(data) {
        let totalHTML = '';
        let taxedTotalHTML = '';

        if (data.showPackageDeal && data.totalCost < data.totalOriginalCost) {
            totalHTML = `<span class="text-base text-gray-500 line-through mr-2">NT$ ${Math.round(data.totalOriginalCost).toLocaleString()}</span><span class="font-bold text-2xl text-blue-600">NT$ ${Math.round(data.totalCost).toLocaleString()}</span>`;
        } else {
            totalHTML = `<span class="font-bold text-2xl text-blue-600">NT$ ${Math.round(data.totalCost).toLocaleString()}</span>`;
        }

        if (data.includeTax) {
            const taxedTotal = data.totalCost * 1.05;
            const taxedOriginalTotal = data.totalOriginalCost * 1.05;
             if (data.showPackageDeal && data.totalCost < data.totalOriginalCost) {
                taxedTotalHTML = `<div class="flex justify-between items-center mt-2 text-right"><span class="text-lg font-bold">方案總價 (含稅)</span><span><span class="text-base text-gray-500 line-through mr-2">NT$ ${Math.round(taxedOriginalTotal).toLocaleString()}</span><span class="font-bold text-2xl text-red-600">NT$ ${Math.round(taxedTotal).toLocaleString()}</span></span></div>`;
            } else {
                taxedTotalHTML = `<div class="flex justify-between items-center mt-2 text-right"><span class="text-lg font-bold">方案總價 (含稅)</span><span class="font-bold text-2xl text-red-600">NT$ ${Math.round(taxedTotal).toLocaleString()}</span></div>`;
            }
        }
    
        const printHeaderHTML = `
        <header class="mb-8 flex justify-between items-start">
            <div>
                <div class="flex items-center gap-4 mb-2">
                     <img src="https://www.winho.com.tw/uploadfiles/338/images-new/winho-logo5.png" alt="崴浤科技 LOGO" class="h-12">
                     <h1 class="text-2xl font-bold text-gray-800">崴浤科技股份有限公司</h1>
                </div>
                <p class="text-gray-500 text-sm">網站設計 & SEO 優化方案報價單</p>
            </div>
            <div class="text-sm text-gray-700 text-right">
                <div class="grid grid-cols-[auto_1fr] gap-x-2 text-left">
                    <strong class="font-semibold">專案人員:</strong> <span>${data.pmName}</span>
                    <strong class="font-semibold">電話:</strong> <span>${data.pmPhone}</span>
                    <strong class="font-semibold">Email:</strong> <span>${data.pmEmail}</span>
                </div>
            </div>
        </header>`;

        const bodyClass = data.showTotalOnly ? 'print-hide-price' : '';

        return `<html><head><title>崴浤科技股份有限公司 - 報價單</title><script src="https://cdn.tailwindcss.com"><\/script><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap" rel="stylesheet"><style>body { font-family: 'Noto Sans TC', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; } @page { size: A4; margin: 1.5cm; } .break-inside-avoid { break-inside: avoid; } .features-list ul { list-style-type: disc; list-style-position: inside; padding-left: 0.5rem; } .features-list li { margin-top: 0.25rem; } #comparison-section { display: block !important; } .delete-custom-package-btn, .remove-from-compare, .select-package-btn, .compare-btn { display: none !important; } .price-col { display: block; } .print-hide-price .price-col { display: none !important; }</style></head><body class="p-4 ${bodyClass}">${printHeaderHTML}<div class="mb-8 p-4 border rounded-lg bg-gray-50"><h2 class="text-lg font-bold mb-3">報價資訊</h2><div class="grid grid-cols-[auto_1fr_auto_1fr] gap-x-4 gap-y-2 text-sm items-baseline"><strong>報價單號：</strong> <p>${data.custQuoteNum}</p><strong>公司名稱：</strong> <p>${data.custName}</p><strong>報價日期：</strong> <p>${data.custDate}</p><strong>聯絡人：</strong> <p>${data.custContact}</p><strong>電話：</strong> <p>${data.custTel}</p><strong>Email：</strong> <p>${data.custEmail}</p><strong>統一編號：</strong> <p>${data.custTaxId}</p><strong>地址：</strong> <p>${data.custAddress}</p></div></div><div class="mb-8"><h2 class="text-lg font-bold mb-3">報價項目</h2><div class="border rounded-lg p-4">${data.itemsHTML}</div></div><div class="mb-8 break-inside-avoid"><h2 class="text-lg font-bold mb-3">付款方式及備註</h2><div class="border rounded-lg p-4 text-sm whitespace-pre-wrap">${data.paymentNotes || '無'}</div></div><footer class="flex justify-end break-inside-avoid"><div class="w-full md:w-2/3 lg:w-1/2 p-6 bg-gray-50 rounded-lg">${data.comparisonTableHTML}<div class="space-y-2 mb-4 border-t border-gray-200 pt-4 mt-4"><div class="flex justify-between items-center text-gray-600"><span>平均每月金額</span><span class="font-semibold text-lg">${data.monthlyAverageText}</span></div></div><div class="border-t border-gray-200 pt-4 space-y-2"><div class="flex justify-between items-center text-right"><span class="text-xl font-bold">方案總價 (未稅)</span><span>${totalHTML}</span></div>${taxedTotalHTML}</div></div></footer></body></html>`;
    }

    // --- Run Application ---
    initialize();
});
