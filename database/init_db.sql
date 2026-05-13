\set ON_ERROR_STOP on

BEGIN;

DROP TRIGGER IF EXISTS trg_prevent_last_active_admin_loss ON users;
DROP FUNCTION IF EXISTS prevent_last_active_admin_loss();
DROP FUNCTION IF EXISTS create_user(text, text);
DROP FUNCTION IF EXISTS set_user_password(integer, text);
DROP FUNCTION IF EXISTS edit_user(integer, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS edit_user(integer, jsonb);
DROP FUNCTION IF EXISTS set_user_status(integer, text);

DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

DROP SEQUENCE IF EXISTS user_sessions_session_id_seq CASCADE;
DROP SEQUENCE IF EXISTS users_user_id_seq CASCADE;
DROP SEQUENCE IF EXISTS roles_role_id_seq CASCADE;

CREATE SEQUENCE roles_role_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE users_user_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE user_sessions_session_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE TABLE roles (
    role_id integer PRIMARY KEY DEFAULT nextval('roles_role_id_seq'),
    role_name text UNIQUE NOT NULL
);

CREATE TABLE users (
    user_id integer PRIMARY KEY DEFAULT nextval('users_user_id_seq'),
    role_id integer NOT NULL REFERENCES roles (role_id),
    user_login text NOT NULL,
    user_surname text NULL,
    user_name text NULL,
    user_patronymic text NULL,
    user_email text NULL,
    password_hash text NOT NULL,
    user_status text NOT NULL DEFAULT 'active',
    CONSTRAINT users_user_login_key UNIQUE (user_login)
);

CREATE TABLE user_sessions (
    session_id integer PRIMARY KEY DEFAULT nextval('user_sessions_session_id_seq'),
    user_id integer NOT NULL REFERENCES users (user_id),
    session_token_hash text NOT NULL,
    created_at timestamp NOT NULL DEFAULT now(),
    last_seen_at timestamp NULL,
    revoked_at timestamp NULL,
    ip_address text NULL,
    user_agent text NULL,
    CONSTRAINT user_sessions_session_token_hash_key UNIQUE (session_token_hash)
);

CREATE TABLE test_table (
    col_1 VARCHAR(255),           -- строка до 255 символов
    col_2 TEXT,                   -- текст без ограничения длины
    col_3 INTEGER,                -- целое число
    col_4 DOUBLE PRECISION,       -- число с плавающей точкой (можно заменить на REAL)
    col_5 INET,                   -- IP-адрес (IPv4 / IPv6)
    col_6 CIDR,                   -- сеть: адрес + маска в нотации CIDR (например 192.168.1.0/24)
    col_7 DATE,                   -- дата
    col_8 TIME,                   -- время (без даты)
    col_9 TIMESTAMP               -- дата и время (без часового пояса)
);

INSERT INTO test_table (
    col_1,
    col_2,
    col_3,
    col_4,
    col_5,
    col_6,
    col_7,
    col_8,
    col_9
) VALUES (
    'Короткая строка',                                            -- col_1 VARCHAR(255)
    'Длинный текст без ограничения длины. Можно много абзацев.',  -- col_2 TEXT
    42,                                                           -- col_3 INTEGER
    3.141592,                                                     -- col_4 DOUBLE PRECISION
    '192.168.1.10'::inet,                                         -- col_5 INET
    '10.0.0.0/8'::cidr,                                           -- col_6 CIDR (сеть + маска)
    '2026-05-13',                                                 -- col_7 DATE
    '14:30:00',                                                   -- col_8 TIME
    '2026-05-13 14:30:00'                                         -- col_9 TIMESTAMP
);

CREATE OR REPLACE FUNCTION test_select_1()
RETURNS SETOF test_table
LANGUAGE sql
STABLE
AS $$
    SELECT *
    FROM test_table
    LIMIT 1;
$$;

ALTER SEQUENCE roles_role_id_seq OWNED BY roles.role_id;
ALTER SEQUENCE users_user_id_seq OWNED BY users.user_id;
ALTER SEQUENCE user_sessions_session_id_seq OWNED BY user_sessions.session_id;

ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (user_status IN ('active', 'blocked'));

CREATE INDEX idx_user_sessions_user_active ON user_sessions (user_id) WHERE revoked_at IS NULL;

INSERT INTO roles (role_name)
VALUES ('admin'), ('user')
ON CONFLICT (role_name) DO NOTHING;

CREATE OR REPLACE FUNCTION prevent_last_active_admin_loss()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    active_admin_count integer;
    old_role_name text;
    new_role_name text;
BEGIN
    SELECT role_name INTO old_role_name FROM roles WHERE role_id = OLD.role_id;

    IF TG_OP = 'UPDATE' THEN
        SELECT role_name INTO new_role_name FROM roles WHERE role_id = NEW.role_id;
        IF NOT (old_role_name = 'admin' AND OLD.user_status = 'active') THEN
            RETURN NEW;
        END IF;
        IF new_role_name = 'admin' AND NEW.user_status = 'active' THEN
            RETURN NEW;
        END IF;
    ELSE
        IF NOT (old_role_name = 'admin' AND OLD.user_status = 'active') THEN
            RETURN OLD;
        END IF;
    END IF;

    SELECT count(*)
    INTO active_admin_count
    FROM users u
    JOIN roles r ON r.role_id = u.role_id
    WHERE r.role_name = 'admin'
      AND u.user_status = 'active'
      AND (TG_OP = 'DELETE' OR u.user_id <> OLD.user_id);

    IF active_admin_count = 0 THEN
        RAISE EXCEPTION 'Нельзя потерять последнего активного admin';
    END IF;

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER trg_prevent_last_active_admin_loss
BEFORE UPDATE OF role_id, user_status OR DELETE ON users
FOR EACH ROW
WHEN (OLD.user_status = 'active')
EXECUTE FUNCTION prevent_last_active_admin_loss();

CREATE OR REPLACE FUNCTION create_user(p_login text, p_password_hash text)
RETURNS TABLE(ok boolean, message text)
LANGUAGE plpgsql
AS $$
DECLARE
    v_role_id integer;
BEGIN
    IF trim(coalesce(p_login, '')) = '' THEN
        RETURN QUERY SELECT false, 'Логин не должен быть пустым'::text;
        RETURN;
    END IF;
    IF coalesce(p_password_hash, '') = '' THEN
        RETURN QUERY SELECT false, 'Хеш пароля не задан'::text;
        RETURN;
    END IF;
    SELECT r.role_id INTO v_role_id FROM roles r WHERE r.role_name = 'user';
    IF v_role_id IS NULL THEN
        RETURN QUERY SELECT false, 'Роль user не найдена'::text;
        RETURN;
    END IF;
    INSERT INTO users (role_id, user_login, password_hash, user_status)
    VALUES (v_role_id, trim(p_login), p_password_hash, 'active');
    RETURN QUERY SELECT true, 'ok'::text;
EXCEPTION
    WHEN unique_violation THEN
        RETURN QUERY SELECT false, format('Пользователь с логином %s уже есть в системе.', trim(p_login));
END;
$$;

CREATE OR REPLACE FUNCTION set_user_password(p_user_id integer, p_password_hash text)
RETURNS TABLE(ok boolean, message text)
LANGUAGE plpgsql
AS $$
BEGIN
    IF coalesce(p_password_hash, '') = '' THEN
        RETURN QUERY SELECT false, 'Пароль не должен быть пустым'::text;
        RETURN;
    END IF;
    UPDATE users SET password_hash = p_password_hash WHERE user_id = p_user_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Пользователь не найден'::text;
        RETURN;
    END IF;
    RETURN QUERY SELECT true, 'ok'::text;
END;
$$;

CREATE OR REPLACE FUNCTION edit_user(
    p_user_id integer,
    p_patch jsonb
)
RETURNS TABLE(ok boolean, message text)
LANGUAGE plpgsql
AS $$
DECLARE
    v_patch jsonb := coalesce(p_patch, '{}'::jsonb);
    v_role_id integer;
    v_role_name text;
    v_user_login text;
BEGIN
    IF v_patch ? 'user_login' THEN
        v_user_login := trim(coalesce(v_patch ->> 'user_login', ''));
        IF v_user_login = '' THEN
            RETURN QUERY SELECT false, 'Логин не должен быть пустым'::text;
            RETURN;
        END IF;
    END IF;

    IF v_patch ? 'role_name' THEN
        v_role_name := trim(coalesce(v_patch ->> 'role_name', ''));
        SELECT r.role_id INTO v_role_id FROM roles r WHERE r.role_name = v_role_name;
        IF v_role_id IS NULL THEN
            RETURN QUERY SELECT false, format('Роль не найдена: %s', v_role_name);
            RETURN;
        END IF;
    END IF;

    UPDATE users SET
        role_id = CASE WHEN v_patch ? 'role_name' THEN v_role_id ELSE role_id END,
        user_login = CASE WHEN v_patch ? 'user_login' THEN v_user_login ELSE user_login END,
        user_surname = CASE
            WHEN v_patch ? 'user_surname' THEN nullif(trim(coalesce(v_patch ->> 'user_surname', '')), '')
            ELSE user_surname
        END,
        user_name = CASE
            WHEN v_patch ? 'user_name' THEN nullif(trim(coalesce(v_patch ->> 'user_name', '')), '')
            ELSE user_name
        END,
        user_patronymic = CASE
            WHEN v_patch ? 'user_patronymic' THEN nullif(trim(coalesce(v_patch ->> 'user_patronymic', '')), '')
            ELSE user_patronymic
        END,
        user_email = CASE
            WHEN v_patch ? 'user_email' THEN nullif(trim(coalesce(v_patch ->> 'user_email', '')), '')
            ELSE user_email
        END
    WHERE user_id = p_user_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Пользователь не найден'::text;
        RETURN;
    END IF;
    RETURN QUERY SELECT true, 'ok'::text;
EXCEPTION
    WHEN unique_violation THEN
        RETURN QUERY SELECT false, format('Пользователь с логином %s уже есть в системе.', coalesce(v_user_login, ''));
END;
$$;

CREATE OR REPLACE FUNCTION set_user_status(p_user_id integer, p_user_status text)
RETURNS TABLE(ok boolean, message text)
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_user_status NOT IN ('active', 'blocked') THEN
        RETURN QUERY SELECT false, 'Недопустимый статус пользователя'::text;
        RETURN;
    END IF;
    UPDATE users SET user_status = p_user_status WHERE user_id = p_user_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Пользователь не найден'::text;
        RETURN;
    END IF;
    RETURN QUERY SELECT true, 'ok'::text;
EXCEPTION
    WHEN raise_exception THEN
        RETURN QUERY SELECT false, SQLERRM::text;
    WHEN others THEN
        RETURN QUERY SELECT false, SQLERRM::text;
END;
$$;

-- Пароль по умолчанию для первичной установки: admin / admin (werkzeug pbkdf2:sha256; без hashlib.scrypt)
INSERT INTO users (role_id, user_login, password_hash, user_status)
SELECT r.role_id,
       'admin',
       $pwd$pbkdf2:sha256:1000000$867mFHFRHSkLsICn$a72d4349f152d23508237b59e8e69467d0b1b5689056b3de9fe43cd6d7ab7013$pwd$,
       'active'
FROM roles r
WHERE r.role_name = 'admin'
ON CONFLICT (user_login) DO UPDATE
SET role_id = EXCLUDED.role_id,
    password_hash = EXCLUDED.password_hash,
    user_status = 'active';

-- Тестовый администратор для browser/API smoke: test_admin / test_admin.
INSERT INTO users (role_id, user_login, password_hash, user_status)
SELECT r.role_id,
       'test_admin',
       $pwd$pbkdf2:sha256:1000000$Y6EIcYNlObWZPzWF$e939bcd261473122eab2bb9c542bca4240f045abaf678952f2a3929ed9ae5c5b$pwd$,
       'active'
FROM roles r
WHERE r.role_name = 'admin'
ON CONFLICT (user_login) DO UPDATE
SET role_id = EXCLUDED.role_id,
    password_hash = EXCLUDED.password_hash,
    user_status = 'active';

DROP TABLE IF EXISTS voc_1;

CREATE TABLE voc_1 (
    "code"        VARCHAR(10) NOT NULL PRIMARY KEY,
    "description" TEXT        NOT NULL
);

CREATE OR REPLACE FUNCTION test_voc_1()
RETURNS SETOF voc_1
LANGUAGE sql
AS $$
    SELECT *
    FROM voc_1
    ORDER BY code;
$$;

INSERT INTO voc_1 ("code", "description") VALUES
('01', 'Наличие на дату'),
('10', 'Инвентаризация'),
('11', 'Изготовление/образовение'),
('12', 'перевод из СГУК ЯМ в СГУК РВ и РАО'),
('13', 'Образование РАО при обслуживании и эксплуатации пунктов хранения/ захоронения РАО'),
('14', 'Постановка на учет РАО, образовавшихся из РВ, не подлежащих учету в СГУК РВ и РАО'),
('15', 'Возврат в оборот РВ при переработке ОЗИИИ'),
('16', 'Постановка на учет РАО образовавшихся при проведении работ по выводу из эксплуатации ОИАЭ или при реабилитации загрязненных территорий'),
('17', 'Постановка на учет РВ, ранее не подлежащих учету в СГУК РВ и РАО'),
('18', 'Постановка на учет при изменении характеристик по результатам проведения измерений'),
('21', 'Передача одним обособленным подразделением другому обособленному подразделению того же юридического лица'),
('22', 'Передача в Министерство обороны Российской Федерации'),
('25', 'Передача (возврат) ранее полученного от юридического лица Российской Федерации'),
('26', 'Передача юридическому лицу Российской Федерации с обязательствами по обеспечению безопасности при обращении, вплоть до их передачи национальному оператору'),
('27', 'Передача юридическому лицу Российской Федерации без передачи права собственности'),
('28', 'Передача юридическому лицу Российской Федерации с передачей права собственности'),
('29', 'Прочие операции по передаче'),
('31', 'Получение одним обособленным подразделением от другого обособленного подразделения того же юридического лица'),
('32', 'Получение из Министерства обороны Российской Федерации'),
('35', 'Получение от юридического лица Российской Федерации без перехода права собственности (иного вещного права)'),
('36', 'Получение от юридического лица Российской Федерации с обязательствами по обеспечению безопасности при обращении, вплоть до их передачи национальному оператору'),
('37', 'Получение (возврат) ранее переданного юридическому лицу в Российской Федерации'),
('38', 'Получение учетной единицы и права собственности на нее'),
('39', 'Прочие операции по получению'),
('41', 'Перевод РВ в РАО'),
('42', 'Перевод из СГУК РВ и РАО в СГУК ЯМ'),
('43', 'Снятие учетной единицы по причине естественного распада радионуклидов'),
('44', 'Переработка, кондиционирование'),
('45', 'Снятие с учета РАО при операциях упаковки, переупаковки'),
('46', 'Использование (разукомплектование, расходование) для изготовления, образования учетных единиц, подлежащих учету'),
('47', 'Расходование'),
('48', 'Безвозвратные потери в пределах установленных норм'),
('49', 'Снятие с учета РАО при операциях сортировки'),
('51', 'Изъятие из пункта хранения'),
('52', 'Размещение в пункте хранения'),
('53', 'Зарядка (загрузка)/разрядка (выгрузка) организацией'),
('54', 'Зарядка (загрузка)/разрядка (выгрузка) подрядной организацией'),
('55', 'Приведение в соответствие критериям приемлемости РАО для захоронения'),
('56', 'Образование РАО после переработки'),
('57', 'Постановка на учет РАО при операциях упаковки или переупаковки'),
('58', 'Вторичное образование РВ'),
('59', 'Постановка на учет РАО при операциях сортировки'),
('61', 'Вывоз на другую территорию'),
('62', 'Возврат с другой территории'),
('63', 'Передача права собственности, обязательств по оплате захоронения, иного вещного права без физического перемещения учетной единицы'),
('64', 'Получение права собственности, (иного вещного права), обязательств по передаче РАО на захоронение без физического перемещения учетной единицы'),
('65', 'Перевод из ЗРИ в ОРИ'),
('66', 'Продление НСС ЗРИ/ИОУ'),
('67', 'Перевод в РВ, используемые при проведении работ по использованию атомной энергии в оборонных целях, включая разработку, изготовление, испытание, эксплуатацию и утилизацию ядерного оружия и ядерных энергетических установок военного назначения'),
('68', 'Снятие с учета при изменении  характеристик, сведения о которых получены в результате проведения измерений'),
('71', 'Утеря'),
('72', 'Утрата контроля при известном местоположении'),
('73', 'Обнаружение неучтенного'),
('74', 'Изъятие из незаконного оборота'),
('75', 'Обнаружение утерянного ранее'),
('76', 'Постановка на учет РАО, изымаемых по указанию органов исполнительной власти, надзорных органов'),
('81', 'Экспорт'),
('82', 'Временный вывоз с территории Российской Федерации'),
('83', 'Вывоз (возврат) с территории Российской Федерации временно ввезенного ранее'),
('84', 'Вывоз (возврат) ранее импортированного ЗРИ (ОЗИИИ) за рубеж'),
('85', 'Импорт'),
('86', 'Временный ввоз на территорию Российской Федерации'),
('87', 'Возврат (ввоз) на территорию Российской Федерации временно вывезенного ранее'),
('88', 'Ввоз (возврат) на территорию Российской Федерации, ранее экспортированного ЗРИ (ОЗИИИ)'),
('97', 'Постановка на учет по другим причинам'),
('98', 'Снятие с учета по другим причинам'),
('99', 'Прочие операции');


DROP TABLE IF EXISTS voc_3;

CREATE TABLE voc_3 (
    code        INTEGER NOT NULL PRIMARY KEY,
    description TEXT    NOT NULL
);

INSERT INTO voc_3 (code, description) VALUES
(1,  'Акт'),
(2,  'Ведомость'),
(3,  'Грузовая таможенная декларация'),
(4,  'Журнал'),
(5,  'Карта'),
(6,  'Накладная'),
(7,  'Наряд'),
(8,  'Ордер'),
(9,  'Паспорт'),
(10, 'Приказ'),
(11, 'Протокол'),
(12, 'Распоряжение'),
(13, 'Решение о продлении НСС'),
(14, 'Требование'),
(15, 'Сертификат'),
(19, 'Другой документ (при выборе этого кода в примечании к ячейке формы должно быть приведено наименование документа)');

COMMIT;