// Управление модальными окнами
class ModalManager {
    constructor() {
        this.modals = {};
        this.init();
    }
    
    init() {
        // Закрытие по клику на фон
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeAll();
            }
        });
        
        // Закрытие по ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAll();
            }
        });
    }
    
    open(modalId, data = {}) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            this.modals[modalId] = { element: modal, data };
        }
    }

    close(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            delete this.modals[modalId];
        }
    }

    closeAll() {
        Object.keys(this.modals).forEach(id => this.close(id));
    }
}

// Управление регистрацией на мероприятия
class EventRegistration {
    constructor() {
        this.init();
    }

    init() {
        document.querySelectorAll('.register-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const eventId = btn.dataset.eventId;
                const regType = btn.dataset.regType;
                this.openRegistrationForm(eventId, regType);
            });
        });
    }

    async openRegistrationForm(eventId, regType) {
        try {
            const response = await fetch(`/api/event/${eventId}/registration-data`);
            const data = await response.json();

            if (!data.use_volunteer_template && regType === 'volunteer') {
                this.showNotification('Регистрация волонтеров на это мероприятие недоступна', 'error');
                return;
            }

            if (!data.use_participant_template && regType === 'participant') {
                this.showNotification('Регистрация участников на это мероприятие недоступна', 'error');
                return;
            }

            // Проверка для волонтеров без авторизации
            const isAuthenticated = document.body.dataset.authenticated === 'true';

            if (regType === 'volunteer' && !isAuthenticated) {
                this.showNotification('Для регистрации волонтером необходимо войти в систему', 'error');
                setTimeout(() => {
                    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
                }, 1500);
                return;
            }

            modalManager.open('registration-modal', {
                eventId: eventId,
                regType: regType,
                userData: data.user_data
            });

            // Заполняем форму данными пользователя
            this.fillRegistrationForm(data.user_data, regType, isAuthenticated);

        } catch (error) {
            console.error('Error loading registration data:', error);
            this.showNotification('Ошибка загрузки данных', 'error');
        }
    }

    fillRegistrationForm(userData, regType, isAuthenticated) {
        const container = document.getElementById('form-fields-container');
        if (!container) return;

        let html = '';

        if (regType === 'volunteer') {
            // Для волонтеров (только авторизованные) - данные из профиля, но можно редактировать
            html = `
                <div class="volunteer-note">
                    ⚠️ Проверьте данные, в случае ошибки исправьте их в
                    <a href="/profile" target="_blank">настройках профиля</a>
                </div>
                <div class="form-group">
                    <label for="full_name">ФИО *</label>
                    <input type="text" id="full_name" name="full_name" value="${userData.full_name || ''}" required placeholder="Иванов Иван Иванович" class="form-control">
                </div>
                <div class="form-group">
                    <label for="phone">Телефон *</label>
                    <input type="text" id="phone" name="phone" value="${userData.phone || ''}" required placeholder="+7(999)999-99-99" class="form-control phone-input">
                </div>
                <div class="form-group">
                    <label for="birth_date">Дата рождения *</label>
                    <input type="date" id="birth_date" name="birth_date" value="${userData.birth_date || ''}" required class="form-control">
                </div>
                <div class="form-group">
                    <label for="experience">Опыт волонтерства</label>
                    <textarea id="experience" name="experience" class="form-control" rows="3">${userData.experience || ''}</textarea>
                </div>
                <div class="form-group">
                    <label for="email">Email (необязательно)</label>
                    <input type="email" id="email" name="email" value="${userData.email || ''}" placeholder="email@example.com" class="form-control">
                </div>
            `;
        } else {
            // Для участников (все пользователи) - пустые поля для ввода
            html = `
                <div class="form-group">
                    <label for="full_name">ФИО *</label>
                    <input type="text" id="full_name" name="full_name" value="" required placeholder="Иванов Иван Иванович" class="form-control">
                </div>
                <div class="form-group">
                    <label for="phone">Телефон *</label>
                    <input type="text" id="phone" name="phone" value="" required placeholder="+7(999)999-99-99" class="form-control phone-input">
                </div>
                <div class="form-group">
                    <label for="birth_date">Дата рождения *</label>
                    <input type="date" id="birth_date" name="birth_date" value="" required class="form-control">
                </div>
                <div class="form-group">
                    <label for="email">Email (необязательно)</label>
                    <input type="email" id="email" name="email" value="" placeholder="email@example.com" class="form-control">
                </div>
            `;
        }

        container.innerHTML = html;

        // Добавляем маску для телефона
        const phoneInput = document.getElementById('phone');
        if (phoneInput) {
            phoneInput.addEventListener('input', function(e) {
                let x = e.target.value.replace(/\D/g, '').match(/(\d{0,1})(\d{0,3})(\d{0,3})(\d{0,2})(\d{0,2})/);
                if (x) {
                    e.target.value = !x[2] ? x[1] : '+7(' + x[2] + ')' + (x[3] ? x[3] : '') + (x[4] ? '-' + x[4] : '') + (x[5] ? '-' + x[5] : '');
                }
            });
        }
    }

    async submitRegistration(formData) {
        try {
            console.log('Submitting registration data:', formData);

            const response = await fetch(`/event/${formData.event_id}/register/${formData.reg_type}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();
            console.log('Registration response:', result);

            if (response.ok) {
                this.showNotification('Регистрация успешна!', 'success');
                modalManager.closeAll();
                setTimeout(() => location.reload(), 1500);
            } else {
                this.showNotification(result.error || 'Ошибка регистрации', 'error');
            }
        } catch (error) {
            console.error('Error submitting registration:', error);
            this.showNotification('Ошибка соединения с сервером', 'error');
        }
    }

    showNotification(message, type) {
        // Убираем уведомление от сайта 192.168.43.121
        // Просто показываем alert вместо кастомного уведомления
        if (type === 'success') {
            alert(message);
        } else {
            alert('Ошибка: ' + message);
        }
    }
}

// Управление фильтрацией мероприятий
class EventFilter {
    constructor() {
        this.init();
    }

    init() {
        const filterForm = document.getElementById('event-filter');
        if (filterForm) {
            filterForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.applyFilters();
            });
        }

        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') {
                    this.applyFilters();
                }
            });
        }

        // Добавляем обработчики для фильтров
        const typeFilter = document.getElementById('type-filter');
        if (typeFilter) {
            typeFilter.addEventListener('change', () => this.applyFilters());
        }

        const dateFrom = document.getElementById('date-from');
        if (dateFrom) {
            dateFrom.addEventListener('change', () => this.applyFilters());
        }

        const dateTo = document.getElementById('date-to');
        if (dateTo) {
            dateTo.addEventListener('change', () => this.applyFilters());
        }
    }

    applyFilters() {
        const search = document.getElementById('search-input')?.value.toLowerCase() || '';
        const typeFilter = document.getElementById('type-filter')?.value || 'all';
        const dateFrom = document.getElementById('date-from')?.value;
        const dateTo = document.getElementById('date-to')?.value;

        let visibleCount = 0;

        document.querySelectorAll('.event-card').forEach(card => {
            let show = true;

            if (search) {
                const title = card.dataset.eventTitle || '';
                if (!title.includes(search)) show = false;
            }

            if (show && typeFilter !== 'all') {
                const eventType = card.dataset.eventType;
                if (eventType !== typeFilter) show = false;
            }

            if (show && dateFrom) {
                const eventStart = card.dataset.eventStart;
                if (eventStart < dateFrom) show = false;
            }

            if (show && dateTo) {
                const eventStart = card.dataset.eventStart;
                if (eventStart > dateTo) show = false;
            }

            card.style.display = show ? 'flex' : 'none';
            if (show) visibleCount++;
        });

        const countElement = document.getElementById('count-value');
        if (countElement) {
            countElement.textContent = visibleCount;
        }

        this.updateActiveFilters(search, typeFilter, dateFrom, dateTo);
    }

    updateActiveFilters(search, typeFilter, dateFrom, dateTo) {
        const container = document.getElementById('active-filters');
        if (!container) return;

        let html = '';

        if (search) {
            html += `<span class="filter-tag">
                Поиск: "${search}"
                <button onclick="resetFilters()">×</button>
            </span>`;
        }

        if (typeFilter !== 'all') {
            let typeText = '';
            if (typeFilter === 'participant') typeText = 'Только участники';
            else if (typeFilter === 'volunteer') typeText = 'Только волонтеры';
            else if (typeFilter === 'both') typeText = 'Участники и волонтеры';

            html += `<span class="filter-tag">
                Тип: ${typeText}
                <button onclick="resetFilters()">×</button>
            </span>`;
        }

        if (dateFrom) {
            html += `<span class="filter-tag">
                С: ${dateFrom}
                <button onclick="resetFilters()">×</button>
            </span>`;
        }

        if (dateTo) {
            html += `<span class="filter-tag">
                По: ${dateTo}
                <button onclick="resetFilters()">×</button>
            </span>`;
        }

        container.innerHTML = html;
    }
}

// Инициализация
const modalManager = new ModalManager();
const eventRegistration = new EventRegistration();
const eventFilter = new EventFilter();

// Обработчик отправки формы регистрации
document.addEventListener('submit', (e) => {
    if (e.target.id === 'registration-form') {
        e.preventDefault();

        const agreed = document.getElementById('agree_rules').checked;
        if (!agreed) {
            alert('Необходимо согласиться с правилами');
            return;
        }

        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        // Явно добавляем agreed_to_rules как boolean
        data.agreed_to_rules = agreed;

        const modalData = modalManager.modals['registration-modal']?.data;
        if (!modalData) {
            alert('Ошибка: данные модального окна не найдены');
            return;
        }

        data.event_id = modalData.eventId;
        data.reg_type = modalData.regType;

        console.log('Submitting form data:', data);
        eventRegistration.submitRegistration(data);
    }
});

// Функции для модальных окон регистрации
function openRegistrationModal(eventId, regType) {
    eventRegistration.openRegistrationForm(eventId, regType);
}

function closeRegistrationModal() {
    modalManager.close('registration-modal');
}

function showRules(event, regType) {
    event.preventDefault();

    const rulesModal = document.getElementById('rules-modal');
    const rulesTitle = document.getElementById('rules-title');
    const rulesContent = document.getElementById('rules-content');

    if (regType === 'volunteer') {
        rulesTitle.textContent = 'Правила для волонтеров';
        rulesContent.innerHTML = `
            <h3>1. Общие положения</h3>
            <p>Волонтер обязан соблюдать правила внутреннего распорядка мероприятий.</p>
            <h3>2. Обязанности волонтера</h3>
            <ul>
                <li>Своевременно прибывать на мероприятия</li>
                <li>Выполнять поручения организаторов</li>
                <li>Соблюдать этические нормы поведения</li>
                <li>Бережно относиться к имуществу</li>
            </ul>
            <h3>3. Права волонтера</h3>
            <ul>
                <li>Получать волонтерские часы за участие</li>
                <li>Получать необходимую информацию для выполнения задач</li>
                <li>Вносить предложения по улучшению организации</li>
            </ul>
            <h3>4. Ответственность</h3>
            <p>За нарушение правил волонтер может быть лишен часов или отстранен от участия.</p>
        `;
    } else {
        rulesTitle.textContent = 'Правила для участников';
        rulesContent.innerHTML = `
            <h3>1. Общие положения</h3>
            <p>Участник обязан соблюдать правила поведения на мероприятиях.</p>
            <h3>2. Обязанности участника</h3>
            <ul>
                <li>Своевременно регистрироваться на мероприятия</li>
                <li>Соблюдать расписание мероприятий</li>
                <li>Уважительно относиться к другим участникам и организаторам</li>
            </ul>
            <h3>3. Права участника</h3>
            <ul>
                <li>Получать полную информацию о мероприятии</li>
                <li>Участвовать в программе мероприятия</li>
                <li>Оставлять отзывы и предложения</li>
            </ul>
        `;
    }

    modalManager.open('rules-modal');
}

function closeRulesModal() {
    modalManager.close('rules-modal');
}

function acceptRules() {
    document.getElementById('agree_rules').checked = true;
    closeRulesModal();
}

// Функции для фильтрации
function applyFilters() {
    eventFilter.applyFilters();
}

function resetFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('type-filter').value = 'all';
    document.getElementById('date-from').value = '';
    document.getElementById('date-to').value = '';
    eventFilter.applyFilters();
}

// Функции для просмотра изображений
function openImage(src) {
    const modal = document.getElementById('image-modal');
    const img = document.getElementById('expanded-image');
    img.src = src;
    modal.classList.add('active');
}

function closeImageModal() {
    document.getElementById('image-modal').classList.remove('active');
}

// Загрузка данных при старте
document.addEventListener('DOMContentLoaded', () => {
    const isAuthenticated = document.body.dataset.authenticated === 'true';

    if (isAuthenticated) {
        document.querySelectorAll('.auth-dependent').forEach(el => {
            el.style.display = 'block';
        });
    }

    // Добавляем стили для анимации
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        .volunteer-note {
            background-color: #e7f3ff;
            border-left: 4px solid #3D6596;
            padding: 10px 15px;
            margin-bottom: 20px;
            border-radius: 5px;
            font-size: 0.95rem;
        }

        .volunteer-note a {
            color: #D30067;
            text-decoration: none;
            font-weight: 600;
        }

        .volunteer-note a:hover {
            text-decoration: underline;
        }

        .phone-input {
            font-family: monospace;
        }
    `;
    document.head.appendChild(style);
});