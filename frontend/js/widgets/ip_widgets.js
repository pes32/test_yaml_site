// Общая логика для IP и IP/CIDR: placeholder как маска (серым),
// ввод — только цифры, авто-разделители, без 'x' в самом значении

function createIpLikeWidget(maskTemplate, validateFn, maxDigits, clampLastOctet = false) {
    const hasSlash = maskTemplate.includes('/');
    return {
        components: { Md3Field: window.Md3Field },
        mixins: [window.widgetMixin],
        props: {
            widgetConfig: { type: Object, required: true },
            widgetName: { type: String, required: true }
        },
        emits: ['input'],
        template: `
            <md3-field
                :widget-config="widgetConfig"
                :has-value="hasValue"
                :label-floats="labelFloats"
                :is-focused="isFocused"
                :wrap-extra="{ error: !!error }"
                :has-supporting="!!(widgetConfig.sup_text || error)">
                <input type="text"
                       class="form-control widget-ip"
                       :disabled="widgetConfig.readonly"
                       :tabindex="widgetConfig.readonly ? -1 : null"
                       :maxlength="maxLength"
                       :placeholder="showPlaceholder ? widgetConfig.placeholder : ''"
                       v-model="inputValue"
                       @input="onInputHandler"
                       @keydown="onKeyDown"
                       @blur="isFocused = false; onBlur()"
                       @focus="isFocused = true">
                <template #supporting>
                    <span v-if="error" class="md3-error" v-text="error"></span>
                    <span v-else v-text="widgetConfig.sup_text"></span>
                </template>
            </md3-field>
        `,
        data() {
            return {
                maskTemplate,
                inputValue: '',
                error: '',
                lastInputLength: 0,
                isFocused: false
            };
        },
        computed: {
            hasValue() { return Boolean(this.inputValue); },
            labelFloats() {
                return this.hasValue || this.isFocused;
            },
            showPlaceholder() {
                return !this.hasValue && this.isFocused && this.widgetConfig.placeholder;
            },
            maxLength() {
                // Макс длина визуальной строки: для IP 15 (xxx.xxx.xxx.xxx), для CIDR 18
                return this.maskTemplate.length;
            }
        },
        methods: {
            formatFromDigits(digits) {
                // Вставляем разделители по позициям: после 3,6,9 и, если CIDR, после 12 — '/'
                let out = '';
                for (let i = 0; i < digits.length; i++) {
                    out += digits[i];
                    if (i === 2 || i === 5 || i === 8) {
                        out += '.';
                    }
                    if (hasSlash && i === 11) {
                        out += '/';
                    }
                }
                return out;
            },
            digitsFromValue(value) {
                return (value || '').replace(/\D/g, '');
            },
            emitValue() {
                this.emitInput(this.inputValue);
            },
            onKeyDown(e) {
                // Обработка Backspace для корректного удаления символов
                if (e.key === 'Backspace') {
                    const currentValue = e.target.value;
                    const currentPos = e.target.selectionStart;
                    
                    // Если курсор находится на разделителе (точке или слеше), 
                    // то при Backspace удаляем символ из предыдущего октета
                    if (currentPos > 0) {
                        const charAtCursor = currentValue[currentPos - 1];
                        if (charAtCursor === '.' || charAtCursor === ',' || charAtCursor === ' ') {
                            // Удаляем разделитель и последний символ из предыдущего октета
                            const newValue = currentValue.slice(0, currentPos - 2) + currentValue.slice(currentPos);
                            this.inputValue = newValue;
                            this.$nextTick(() => {
                                // Устанавливаем курсор на позицию после удаления
                                const newPos = Math.max(0, currentPos - 2);
                                e.target.setSelectionRange(newPos, newPos);
                            });
                            e.preventDefault();
                            this.emitValue();
                            return;
                        }
                    }
                }
                
                // Обработка перехода на следующий октет при нажатии точки, запятой, пробела или слеша
                const octetSeparatorKeys = ['.', ',', ' '];
                if (octetSeparatorKeys.includes(e.key) || e.key === '/') {
                    e.preventDefault();

                    const currentValue = e.target.value;

                    // Точка, запятая, пробел — завершают октет (добавляем точку), но не более 3 точек, не сразу после точки и не когда пусто
                    if (octetSeparatorKeys.includes(e.key)) {
                        const ipPart = hasSlash ? currentValue.split('/')[0] : currentValue;
                        const dotsCount = (ipPart.match(/\./g) || []).length;
                        if (dotsCount >= 3 || ipPart.endsWith('.') || !this.digitsFromValue(ipPart).length) {
                            return;
                        }
                        const newValue = currentValue + '.';
                        this.inputValue = newValue;
                        this.$nextTick(() => {
                            const newPos = newValue.length;
                            e.target.setSelectionRange(newPos, newPos);
                        });
                        this.emitValue();
                        return;
                    }

                    // Слеш — добавляем слеш (только для CIDR/ip_mask)
                    if (e.key === '/' && hasSlash) {
                        const newValue = currentValue + '/';
                        this.inputValue = newValue;
                        this.$nextTick(() => {
                            const newPos = newValue.length;
                            e.target.setSelectionRange(newPos, newPos);
                        });
                        this.emitValue();
                    }
                }
            },
            onInputHandler(e) {
                const raw = e.target.value || '';
                
                // Делим на IP-часть и маску (если присутствует)
                const slashPos = raw.indexOf('/');
                const ipRaw = slashPos >= 0 ? raw.slice(0, slashPos) : raw;
                const maskRaw = slashPos >= 0 ? raw.slice(slashPos + 1) : '';
                
                // Собираем только цифры IP, максимум 12
                const ipDigitsAll = this.digitsFromValue(ipRaw).slice(0, 12);
                
                // Пробегаем по исходной IP-строке, чтобы понять, где пользователь ставил точки
                const octetLengths = []; // длины завершённых октетов (закрытых точкой пользователем или авто)
                let collectedDigits = 0;  // сколько цифр уже учли из ipDigitsAll
                let currentOctetLen = 0;  // длина текущего (незавершённого) октета
                let dotsCount = 0;
                
                for (let i = 0; i < ipRaw.length && collectedDigits < ipDigitsAll.length; i++) {
                    const ch = ipRaw[i];
                    if (/\d/.test(ch)) {
                        // Берём очередную цифру из ipDigitsAll (игнорируем любые нецифровые в сырой строке)
                        currentOctetLen += 1;
                        collectedDigits += 1;
                        // Если октет достиг 3 цифр — авто-завершаем его, но только если впереди ещё есть цифры
                        if (currentOctetLen === 3 && dotsCount < 3) {
                            // Смотрим: если дальше в сыром вводе НЕ стоит точка прямо сейчас,
                            // всё равно считаем октет завершённым (авто-точка)
                            // Завершим его здесь, реальная точка будет добавлена при сборке ниже
                            // но только если далее ещё будут цифры или пользователь явно вводил разделитель
                            // Решение: завершаем сразу, а наличие оставшихся цифр определит визуальное продолжение
                            octetLengths.push(currentOctetLen);
                            currentOctetLen = 0;
                            dotsCount += 1;
                        }
                    } else if ((ch === '.' || ch === ',' || ch === ' ') && dotsCount < 3) {
                        // Пользователь завершил октет точкой, запятой или пробелом
                        if (currentOctetLen > 0) {
                            octetLengths.push(currentOctetLen);
                            currentOctetLen = 0;
                            dotsCount += 1;
                        }
                        // если разделитель подряд или в начале — игнорируем
                    }
                }
                
                // Добавим оставшиеся цифры, которые могли не попасть в цикл (например, если конец ipRaw не охватил все цифры из-за лишних символов)
                while (collectedDigits < ipDigitsAll.length) {
                    currentOctetLen += 1;
                    collectedDigits += 1;
                    if (currentOctetLen === 3 && dotsCount < 3 && collectedDigits < ipDigitsAll.length) {
                        octetLengths.push(currentOctetLen);
                        currentOctetLen = 0;
                        dotsCount += 1;
                    }
                }
                
                // Если текущий октет ровно из 3 цифр и точек меньше 3 — добавим авто-точку (пользователь только что закончил октет)
                if (currentOctetLen === 3 && dotsCount < 3) {
                    octetLengths.push(currentOctetLen);
                    currentOctetLen = 0;
                    dotsCount += 1;
                }
                
                // Сборка форматированной IP-части из ipDigitsAll и octetLengths
                let formattedIp = '';
                let pos = 0;
                for (let k = 0; k < octetLengths.length; k++) {
                    const len = octetLengths[k];
                    formattedIp += ipDigitsAll.slice(pos, pos + len);
                    pos += len;
                    // ставим разделитель после завершённого октета
                    if (k < 3) {
                        formattedIp += '.';
                    }
                }
                // Хвост текущего (незавершённого) октета
                formattedIp += ipDigitsAll.slice(pos);

                // Только ip (не ip_mask): в 4-м октете условие dotsCount < 3 не срабатывает — без обрезки набирается >3 цифр
                if (clampLastOctet && formattedIp) {
                    const parts = formattedIp.split('.');
                    if (parts.length > 0) {
                        const li = parts.length - 1;
                        const digitsOnly = parts[li].replace(/\D/g, '');
                        if (digitsOnly.length > 3) {
                            parts[li] = digitsOnly.slice(0, 3);
                            formattedIp = parts.join('.');
                        }
                    }
                }
                
                // Собираем финальное значение, включая маску, если есть
                let finalValue = formattedIp;
                if (hasSlash && slashPos >= 0) {
                    const maskDigits = (maskRaw || '').replace(/\D/g, '').slice(0, 2);
                    finalValue += '/';
                    finalValue += maskDigits;
                }
                
                this.inputValue = finalValue;
                this.lastInputLength = this.inputValue.length;
                
                // Валидация, когда заполнено
                const ipDigitsCount = this.digitsFromValue(formattedIp).length;
                const totalDigits = ipDigitsCount + (hasSlash && slashPos >= 0 ? ((maskRaw || '').replace(/\D/g, '').length) : 0);
                if ((!hasSlash && ipDigitsCount === 12) || (hasSlash && totalDigits >= 13)) {
                    this.error = validateFn(this.inputValue) ? '' : 'Неверный формат';
                } else {
                    this.error = '';
                }
                this.emitValue();
            },
            onBlur() {
                // Финальная валидация, пустое допускается
                if (this.inputValue === '') {
                    this.error = '';
                    return;
                }
                this.error = validateFn(this.inputValue) ? '' : 'Неверный формат';
            }
        },
        mounted() {
            // Инициализация из default при наличии
            const def = this.widgetConfig.default;
            if (typeof def === 'string' && def.trim().length > 0) {
                let formatted = '';
                if (hasSlash) {
                    const [ipPart = '', maskPart = ''] = def.split('/');
                    const ipDigits = this.digitsFromValue(ipPart).slice(0, 12);
                    const maskDigits = this.digitsFromValue(maskPart).slice(0, 2);
                    formatted = this.formatFromDigits(ipDigits);
                    if (maskDigits) formatted += '/' + maskDigits;
                } else {
                    const digits = this.digitsFromValue(def).slice(0, maxDigits);
                    formatted = this.formatFromDigits(digits);
                }
                this.inputValue = formatted;
                this.lastInputLength = this.inputValue.length;
                this.emitValue();
            }
        }
    };
}

// Валидация IP строго по октетам 0..255, без лидирующих нулей для многозначных
function validateIPv4(ip) {
    if (!ip) return true;
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    return parts.every(p => {
        if (p === '') return false;
        if (!/^\d{1,3}$/.test(p)) return false;
        const n = Number(p);
        if (n < 0 || n > 255) return false;
        // Запрещаем лидирующие нули у многозначных
        return String(n) === p;
    });
}

// Валидация IP/CIDR
function validateIPv4Cidr(s) {
    if (!s) return true;
    const [ip, mask] = s.split('/');
    if (!validateIPv4(ip)) return false;
    if (mask === undefined) return false;
    if (!/^\d{1,2}$/.test(mask)) return false;
    const n = Number(mask);
    return n >= 0 && n <= 32;
}

// Маски
const IP_MASK_TEMPLATE = 'xxx.xxx.xxx.xxx';
const IP_CIDR_TEMPLATE = 'xxx.xxx.xxx.xxx/xx';

// Максимум цифр
const IP_MAX_DIGITS = 12; // 4*3
const CIDR_MAX_DIGITS = 14; // 12 + 2

// Компоненты
const IpWidget = createIpLikeWidget(IP_MASK_TEMPLATE, validateIPv4, IP_MAX_DIGITS, true);
const IpMaskWidget = createIpLikeWidget(IP_CIDR_TEMPLATE, validateIPv4Cidr, CIDR_MAX_DIGITS);

window.IpWidget = IpWidget;
window.IpMaskWidget = IpMaskWidget;
