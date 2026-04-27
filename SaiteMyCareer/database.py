from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime
import json

db = SQLAlchemy()


class User(UserMixin, db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)  # Номер телефона
    password = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='volunteer')  # admin, volunteer

    # Кодовое слово для восстановления пароля
    secret_word = db.Column(db.String(100), nullable=False, default='')

    # Личная информация (обязательная)
    last_name = db.Column(db.String(100), nullable=False, default='')
    first_name = db.Column(db.String(100), nullable=False, default='')
    middle_name = db.Column(db.String(100), nullable=False, default='')
    phone = db.Column(db.String(20), nullable=False, default='')
    birth_date = db.Column(db.Date)

    # Личная информация (необязательная)
    email = db.Column(db.String(120))
    social_links = db.Column(db.Text)  # JSON строка с ссылками на соцсети
    about = db.Column(db.Text)
    avatar = db.Column(db.String(200), default='default-avatar.jpg')

    # Для волонтеров
    total_hours = db.Column(db.Integer, default=0)
    experience = db.Column(db.Text)  # Опыт волонтерства

    # Временные метки
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Связи с явным указанием foreign_keys для устранения неоднозначности
    event_registrations = db.relationship('EventRegistration', backref='user', lazy=True, cascade='all, delete-orphan')
    volunteer_hours = db.relationship('VolunteerHours',
                                      foreign_keys='VolunteerHours.user_id',
                                      backref='user',
                                      lazy=True,
                                      cascade='all, delete-orphan')
    approved_hours = db.relationship('VolunteerHours',
                                     foreign_keys='VolunteerHours.approved_by',
                                     backref='approver',
                                     lazy=True)
    created_events = db.relationship('Event', backref='creator', lazy=True, foreign_keys='Event.created_by')
    notifications = db.relationship('Notification', backref='user', lazy=True, cascade='all, delete-orphan')

    def __repr__(self):
        return f'<User {self.username} - {self.last_name} {self.first_name}>'

    def get_full_name(self):
        return f"{self.last_name} {self.first_name} {self.middle_name}".strip()

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'role': self.role,
            'last_name': self.last_name,
            'first_name': self.first_name,
            'middle_name': self.middle_name,
            'full_name': self.get_full_name(),
            'phone': self.phone,
            'birth_date': self.birth_date.strftime('%Y-%m-%d') if self.birth_date else None,
            'email': self.email,
            'social_links': self.social_links,
            'about': self.about,
            'avatar': self.avatar,
            'total_hours': self.total_hours,
            'experience': self.experience,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None
        }


class Event(db.Model):
    __tablename__ = 'events'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)

    # Место проведения
    location = db.Column(db.String(200), nullable=False, default='')

    # Фото
    main_photo = db.Column(db.String(200))  # Главное фото
    additional_photos = db.Column(db.Text)  # JSON строка с именами дополнительных фото

    # Даты - теперь период
    registration_start_date = db.Column(db.Date, nullable=False)  # Дата начала регистрации
    registration_end_date = db.Column(db.Date, nullable=False)  # Дата окончания регистрации
    event_start_date = db.Column(db.Date, nullable=False)  # Дата начала мероприятия
    event_end_date = db.Column(db.Date, nullable=False)  # Дата окончания мероприятия

    # Описание и файлы
    description = db.Column(db.Text)
    files = db.Column(db.Text)  # JSON строка с именами прикрепленных файлов (pdf)

    # Настройки регистрации
    registration_type = db.Column(db.String(20), default='both')  # participant, volunteer, both
    use_volunteer_template = db.Column(db.Boolean, default=True)  # Использовать шаблон волонтера
    use_participant_template = db.Column(db.Boolean, default=True)  # Использовать шаблон участника

    # Часы по умолчанию для волонтеров
    default_hours = db.Column(db.Integer, default=0)  # Часы по умолчанию за мероприятие

    # Дополнительные поля (на будущее)
    participant_form_fields = db.Column(db.Text)  # JSON строка с полями для участников (для совместимости)
    volunteer_form_fields = db.Column(db.Text)  # JSON строка с полями для волонтеров (для совместимости)

    # Бюджет и чек-листы
    budget_checklist = db.Column(db.Text)  # JSON строка с чек-листом закупок

    # Статус
    is_active = db.Column(db.Boolean, default=True)
    is_completed = db.Column(db.Boolean, default=False)

    # Временные метки
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Связи
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    registrations = db.relationship('EventRegistration', backref='event', lazy=True, cascade='all, delete-orphan')
    volunteer_hours = db.relationship('VolunteerHours', backref='event', lazy=True, cascade='all, delete-orphan')
    budget_items = db.relationship('BudgetItem', backref='event', lazy=True, cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Event {self.title}>'

    def is_registration_open(self):
        """Проверяет, открыта ли регистрация на текущую дату"""
        today = datetime.now().date()
        return self.registration_start_date <= today <= self.registration_end_date

    def is_event_active(self):
        """Проверяет, идет ли мероприятие сейчас"""
        today = datetime.now().date()
        return self.event_start_date <= today <= self.event_end_date

    def is_event_past(self):
        """Проверяет, завершилось ли мероприятие"""
        return datetime.now().date() > self.event_end_date

    def get_participant_count(self):
        """Возвращает количество участников"""
        return EventRegistration.query.filter_by(event_id=self.id, registration_type='participant').count()

    def get_volunteer_count(self):
        """Возвращает количество волонтеров"""
        return EventRegistration.query.filter_by(event_id=self.id, registration_type='volunteer').count()

    def get_event_dates_string(self):
        """Возвращает строку с датами проведения"""
        if self.event_start_date == self.event_end_date:
            return self.event_start_date.strftime('%d.%m.%Y')
        else:
            return f"{self.event_start_date.strftime('%d.%m.%Y')} - {self.event_end_date.strftime('%d.%m.%Y')}"

    def get_registration_dates_string(self):
        """Возвращает строку с датами регистрации"""
        if self.registration_start_date == self.registration_end_date:
            return self.registration_start_date.strftime('%d.%m.%Y')
        else:
            return f"{self.registration_start_date.strftime('%d.%m.%Y')} - {self.registration_end_date.strftime('%d.%m.%Y')}"

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'location': self.location,
            'main_photo': self.main_photo,
            'additional_photos': json.loads(self.additional_photos) if self.additional_photos else [],
            'registration_start_date': self.registration_start_date.strftime('%Y-%m-%d'),
            'registration_end_date': self.registration_end_date.strftime('%Y-%m-%d'),
            'event_start_date': self.event_start_date.strftime('%Y-%m-%d'),
            'event_end_date': self.event_end_date.strftime('%Y-%m-%d'),
            'description': self.description,
            'files': json.loads(self.files) if self.files else [],
            'registration_type': self.registration_type,
            'use_volunteer_template': self.use_volunteer_template,
            'use_participant_template': self.use_participant_template,
            'default_hours': self.default_hours,
            'is_registration_open': self.is_registration_open(),
            'is_event_past': self.is_event_past(),
            'participant_count': self.get_participant_count(),
            'volunteer_count': self.get_volunteer_count(),
            'is_active': self.is_active,
            'is_completed': self.is_completed,
            'event_dates': self.get_event_dates_string(),
            'registration_dates': self.get_registration_dates_string()
        }


class EventRegistration(db.Model):
    __tablename__ = 'event_registrations'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)  # Изменено на nullable=True
    event_id = db.Column(db.Integer, db.ForeignKey('events.id'), nullable=False)

    registration_type = db.Column(db.String(20), nullable=False)  # participant, volunteer
    form_data = db.Column(db.Text)  # JSON строка с данными формы

    # Согласие с правилами
    agreed_to_rules = db.Column(db.Boolean, default=False)

    # Статус регистрации
    status = db.Column(db.String(20), default='pending')  # pending, approved, rejected, cancelled

    # Временные метки
    registered_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Уникальность (пользователь может зарегистрироваться на мероприятие только один раз)
    __table_args__ = (db.UniqueConstraint('user_id', 'event_id', name='unique_registration'),)

    def __repr__(self):
        return f'<Registration {self.user_id} - {self.event_id} - {self.registration_type}>'

    def to_dict(self):
        return {
            'id': self.id,
            'user': self.user.to_dict() if self.user else None,
            'event_id': self.event_id,
            'registration_type': self.registration_type,
            'form_data': json.loads(self.form_data) if self.form_data else {},
            'agreed_to_rules': self.agreed_to_rules,
            'status': self.status,
            'registered_at': self.registered_at.strftime('%Y-%m-%d %H:%M:%S')
        }


class VolunteerHours(db.Model):
    __tablename__ = 'volunteer_hours'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    event_id = db.Column(db.Integer, db.ForeignKey('events.id'), nullable=False)

    hours = db.Column(db.Integer, default=0)
    fine = db.Column(db.Integer, default=0)  # Штраф в часах
    status = db.Column(db.String(20), default='pending')  # pending, approved, rejected, fine

    # Кто выдал/утвердил
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    approved_at = db.Column(db.DateTime)

    comment = db.Column(db.Text)  # Комментарий (например, причина штрафа)

    # Временные метки
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<VolunteerHours {self.user_id} - {self.event_id} - {self.hours}h>'

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'event_id': self.event_id,
            'hours': self.hours,
            'fine': self.fine,
            'status': self.status,
            'approved_by': self.approved_by,
            'approved_at': self.approved_at.strftime('%Y-%m-%d %H:%M:%S') if self.approved_at else None,
            'comment': self.comment
        }


class Notification(db.Model):
    """Модель для уведомлений пользователей"""
    __tablename__ = 'notifications'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    title = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(50), default='info')  # info, success, warning, danger

    is_read = db.Column(db.Boolean, default=False)

    # Ссылка (куда перейти при клике)
    link = db.Column(db.String(500))

    # Временные метки
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Notification {self.user_id} - {self.title}>'

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'message': self.message,
            'type': self.type,
            'is_read': self.is_read,
            'link': self.link,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S')
        }


class BudgetItem(db.Model):
    """Модель для хранения элементов бюджета мероприятия"""
    __tablename__ = 'budget_items'

    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey('events.id'), nullable=False)

    name = db.Column(db.String(200), nullable=False)  # Наименование
    quantity = db.Column(db.Integer, default=1)  # Количество
    price = db.Column(db.Float, default=0)  # Цена за единицу

    category = db.Column(db.String(100))  # Категория (продукты, материалы и т.д.)

    # Статус закупки
    is_purchased = db.Column(db.Boolean, default=False)
    purchased_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    purchased_at = db.Column(db.DateTime)

    # Временные метки
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Связи
    purchaser = db.relationship('User', foreign_keys=[purchased_by])

    def __repr__(self):
        return f'<BudgetItem {self.name} - {self.quantity} x {self.price}₽>'

    def get_total(self):
        """Возвращает общую стоимость"""
        return self.quantity * self.price

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'quantity': self.quantity,
            'price': self.price,
            'total': self.get_total(),
            'category': self.category,
            'is_purchased': self.is_purchased,
            'purchased_by': self.purchased_by,
            'purchased_at': self.purchased_at.strftime('%Y-%m-%d %H:%M:%S') if self.purchased_at else None
        }


class File(db.Model):
    """Модель для хранения файлов"""
    __tablename__ = 'files'

    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(200), nullable=False)
    original_filename = db.Column(db.String(200), nullable=False)
    file_type = db.Column(db.String(50))  # image, document, etc.
    file_size = db.Column(db.Integer)  # в байтах

    # Связь с мероприятием
    event_id = db.Column(db.Integer, db.ForeignKey('events.id'))

    # Связь с пользователем (для аватарок и т.д.)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))

    # Временные метки
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    uploaded_by = db.Column(db.Integer, db.ForeignKey('users.id'))

    def __repr__(self):
        return f'<File {self.filename}>'