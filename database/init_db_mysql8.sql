-- MySQL 8 adaptation of init_db.sql
-- PostgreSQL-specific objects were replaced where possible:
--   * SEQUENCE -> AUTO_INCREMENT
--   * text/jsonb/plpgsql routines -> MySQL tables/procedures/triggers
--   * INET/CIDR -> VARCHAR
--   * partial index WHERE revoked_at IS NULL -> composite index (user_id, revoked_at)
--   * RETURNS TABLE / RETURNS SETOF functions -> procedures callable as CALL name();
-- Run inside the target database/schema selected by the hosting panel or by `USE db_name;`.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TRIGGER IF EXISTS trg_prevent_last_active_admin_loss_update;
DROP TRIGGER IF EXISTS trg_prevent_last_active_admin_loss_delete;

DROP PROCEDURE IF EXISTS test_select_1;
DROP PROCEDURE IF EXISTS test_voc_1;
DROP PROCEDURE IF EXISTS create_user;
DROP PROCEDURE IF EXISTS set_user_password;
DROP PROCEDURE IF EXISTS edit_user;
DROP PROCEDURE IF EXISTS set_user_status;

DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS test_table;
DROP TABLE IF EXISTS voc_1;
DROP TABLE IF EXISTS voc_3;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE roles (
    role_id INT NOT NULL AUTO_INCREMENT,
    role_name VARCHAR(64) COLLATE utf8mb4_bin NOT NULL,
    PRIMARY KEY (role_id),
    UNIQUE KEY roles_role_name_key (role_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
    user_id INT NOT NULL AUTO_INCREMENT,
    role_id INT NOT NULL,
    user_login VARCHAR(255) COLLATE utf8mb4_bin NOT NULL,
    user_surname VARCHAR(255) NULL,
    user_name VARCHAR(255) NULL,
    user_patronymic VARCHAR(255) NULL,
    user_email VARCHAR(255) NULL,
    password_hash VARCHAR(512) NOT NULL,
    user_status ENUM('active', 'blocked') NOT NULL DEFAULT 'active',
    PRIMARY KEY (user_id),
    UNIQUE KEY users_user_login_key (user_login),
    KEY idx_users_role_id (role_id),
    CONSTRAINT fk_users_role_id
        FOREIGN KEY (role_id) REFERENCES roles (role_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_sessions (
    session_id INT NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    session_token_hash VARCHAR(255) COLLATE utf8mb4_bin NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP NULL,
    revoked_at TIMESTAMP NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    PRIMARY KEY (session_id),
    UNIQUE KEY user_sessions_session_token_hash_key (session_token_hash),
    KEY idx_user_sessions_user_active (user_id, revoked_at),
    CONSTRAINT fk_user_sessions_user_id
        FOREIGN KEY (user_id) REFERENCES users (user_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE test_table (
    col_1 VARCHAR(255),          -- строка до 255 символов
    col_2 TEXT,                  -- текст без ограничения длины
    col_3 INT,                   -- целое число
    col_4 DOUBLE,                -- число с плавающей точкой
    col_5 VARCHAR(45),           -- PostgreSQL INET заменён на строку IPv4/IPv6
    col_6 VARCHAR(50),           -- PostgreSQL CIDR заменён на строку сети/маски
    col_7 DATE,                  -- дата
    col_8 TIME,                  -- время без даты
    col_9 TIMESTAMP NULL         -- дата и время
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    'Короткая строка',
    'Длинный текст без ограничения длины. Можно много абзацев.',
    42,
    3.141592,
    '192.168.1.10',
    '10.0.0.0/8',
    '2026-05-13',
    '14:30:00',
    '2026-05-13 14:30:00'
);

INSERT IGNORE INTO roles (role_name)
VALUES ('admin'), ('user');

-- Пароль по умолчанию для первичной установки: admin / admin (werkzeug pbkdf2:sha256; без hashlib.scrypt)
INSERT INTO users (role_id, user_login, password_hash, user_status)
SELECT r.role_id,
       'admin',
       'pbkdf2:sha256:1000000$867mFHFRHSkLsICn$a72d4349f152d23508237b59e8e69467d0b1b5689056b3de9fe43cd6d7ab7013',
       'active'
FROM roles r
WHERE r.role_name = 'admin'
ON DUPLICATE KEY UPDATE
    role_id = VALUES(role_id),
    password_hash = VALUES(password_hash),
    user_status = 'active';

-- Тестовый администратор для browser/API smoke: test_admin / test_admin.
INSERT INTO users (role_id, user_login, password_hash, user_status)
SELECT r.role_id,
       'test_admin',
       'pbkdf2:sha256:1000000$Y6EIcYNlObWZPzWF$e939bcd261473122eab2bb9c542bca4240f045abaf678952f2a3929ed9ae5c5b',
       'active'
FROM roles r
WHERE r.role_name = 'admin'
ON DUPLICATE KEY UPDATE
    role_id = VALUES(role_id),
    password_hash = VALUES(password_hash),
    user_status = 'active';

CREATE TABLE voc_1 (
    `code` VARCHAR(10) NOT NULL,
    `description` TEXT NOT NULL,
    PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO voc_1 (`code`, `description`) VALUES
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

CREATE TABLE voc_3 (
    code INT NOT NULL,
    description TEXT NOT NULL,
    PRIMARY KEY (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

DELIMITER $$

CREATE TRIGGER trg_prevent_last_active_admin_loss_update
BEFORE UPDATE ON users
FOR EACH ROW
BEGIN
    DECLARE active_admin_count INT DEFAULT 0;
    DECLARE old_role_name VARCHAR(64);
    DECLARE new_role_name VARCHAR(64);

    SELECT role_name INTO old_role_name FROM roles WHERE role_id = OLD.role_id;
    SELECT role_name INTO new_role_name FROM roles WHERE role_id = NEW.role_id;

    IF old_role_name = 'admin'
       AND OLD.user_status = 'active'
       AND NOT (new_role_name = 'admin' AND NEW.user_status = 'active') THEN
        SELECT COUNT(*)
          INTO active_admin_count
          FROM users u
          JOIN roles r ON r.role_id = u.role_id
         WHERE r.role_name = 'admin'
           AND u.user_status = 'active'
           AND u.user_id <> OLD.user_id;

        IF active_admin_count = 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Нельзя потерять последнего активного admin';
        END IF;
    END IF;
END$$

CREATE TRIGGER trg_prevent_last_active_admin_loss_delete
BEFORE DELETE ON users
FOR EACH ROW
BEGIN
    DECLARE active_admin_count INT DEFAULT 0;
    DECLARE old_role_name VARCHAR(64);

    SELECT role_name INTO old_role_name FROM roles WHERE role_id = OLD.role_id;

    IF old_role_name = 'admin' AND OLD.user_status = 'active' THEN
        SELECT COUNT(*)
          INTO active_admin_count
          FROM users u
          JOIN roles r ON r.role_id = u.role_id
         WHERE r.role_name = 'admin'
           AND u.user_status = 'active'
           AND u.user_id <> OLD.user_id;

        IF active_admin_count = 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Нельзя потерять последнего активного admin';
        END IF;
    END IF;
END$$

CREATE PROCEDURE test_select_1()
BEGIN
    SELECT *
      FROM test_table
     LIMIT 1;
END$$

CREATE PROCEDURE test_voc_1()
BEGIN
    SELECT *
      FROM voc_1
     ORDER BY `code`;
END$$

CREATE PROCEDURE create_user(
    IN p_login VARCHAR(255),
    IN p_password_hash VARCHAR(512)
)
proc: BEGIN
    DECLARE v_role_id INT DEFAULT NULL;
    DECLARE v_login VARCHAR(255) DEFAULT '';
    DECLARE v_error_message TEXT DEFAULT 'Ошибка SQL';

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        GET DIAGNOSTICS CONDITION 1 v_error_message = MESSAGE_TEXT;
        SELECT FALSE AS ok, COALESCE(v_error_message, 'Ошибка SQL') AS message;
    END;

    SET v_login = TRIM(COALESCE(p_login, ''));

    IF v_login = '' THEN
        SELECT FALSE AS ok, 'Логин не должен быть пустым' AS message;
        LEAVE proc;
    END IF;

    IF COALESCE(p_password_hash, '') = '' THEN
        SELECT FALSE AS ok, 'Хеш пароля не задан' AS message;
        LEAVE proc;
    END IF;

    SELECT r.role_id INTO v_role_id
      FROM roles r
     WHERE r.role_name = 'user'
     LIMIT 1;

    IF v_role_id IS NULL THEN
        SELECT FALSE AS ok, 'Роль user не найдена' AS message;
        LEAVE proc;
    END IF;

    IF EXISTS (SELECT 1 FROM users WHERE user_login = v_login) THEN
        SELECT FALSE AS ok, CONCAT('Пользователь с логином ', v_login, ' уже есть в системе.') AS message;
        LEAVE proc;
    END IF;

    INSERT INTO users (role_id, user_login, password_hash, user_status)
    VALUES (v_role_id, v_login, p_password_hash, 'active');

    SELECT TRUE AS ok, 'ok' AS message;
END$$

CREATE PROCEDURE set_user_password(
    IN p_user_id INT,
    IN p_password_hash VARCHAR(512)
)
proc: BEGIN
    DECLARE v_error_message TEXT DEFAULT 'Ошибка SQL';

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        GET DIAGNOSTICS CONDITION 1 v_error_message = MESSAGE_TEXT;
        SELECT FALSE AS ok, COALESCE(v_error_message, 'Ошибка SQL') AS message;
    END;

    IF COALESCE(p_password_hash, '') = '' THEN
        SELECT FALSE AS ok, 'Пароль не должен быть пустым' AS message;
        LEAVE proc;
    END IF;

    IF p_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM users WHERE user_id = p_user_id) THEN
        SELECT FALSE AS ok, 'Пользователь не найден' AS message;
        LEAVE proc;
    END IF;

    UPDATE users
       SET password_hash = p_password_hash
     WHERE user_id = p_user_id;

    SELECT TRUE AS ok, 'ok' AS message;
END$$

CREATE PROCEDURE edit_user(
    IN p_user_id INT,
    IN p_patch LONGTEXT
)
proc: BEGIN
    DECLARE v_patch LONGTEXT DEFAULT '{}';
    DECLARE v_role_id INT DEFAULT NULL;
    DECLARE v_role_name VARCHAR(64) DEFAULT NULL;
    DECLARE v_user_login VARCHAR(255) DEFAULT NULL;
    DECLARE v_error_message TEXT DEFAULT 'Ошибка SQL';

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        GET DIAGNOSTICS CONDITION 1 v_error_message = MESSAGE_TEXT;
        SELECT FALSE AS ok, COALESCE(v_error_message, 'Ошибка SQL') AS message;
    END;

    SET v_patch = COALESCE(NULLIF(TRIM(p_patch), ''), '{}');

    IF JSON_VALID(v_patch) = 0 THEN
        SELECT FALSE AS ok, 'Некорректный JSON patch' AS message;
        LEAVE proc;
    END IF;

    IF p_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM users WHERE user_id = p_user_id) THEN
        SELECT FALSE AS ok, 'Пользователь не найден' AS message;
        LEAVE proc;
    END IF;

    IF JSON_CONTAINS_PATH(v_patch, 'one', '$.user_login') THEN
        SET v_user_login = TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(v_patch, '$.user_login')), ''));
        IF v_user_login = '' THEN
            SELECT FALSE AS ok, 'Логин не должен быть пустым' AS message;
            LEAVE proc;
        END IF;
        IF EXISTS (SELECT 1 FROM users WHERE user_login = v_user_login AND user_id <> p_user_id) THEN
            SELECT FALSE AS ok, CONCAT('Пользователь с логином ', v_user_login, ' уже есть в системе.') AS message;
            LEAVE proc;
        END IF;
    END IF;

    IF JSON_CONTAINS_PATH(v_patch, 'one', '$.role_name') THEN
        SET v_role_name = TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(v_patch, '$.role_name')), ''));
        SELECT r.role_id INTO v_role_id
          FROM roles r
         WHERE r.role_name = v_role_name
         LIMIT 1;
        IF v_role_id IS NULL THEN
            SELECT FALSE AS ok, CONCAT('Роль не найдена: ', v_role_name) AS message;
            LEAVE proc;
        END IF;
    END IF;

    UPDATE users
       SET role_id = IF(JSON_CONTAINS_PATH(v_patch, 'one', '$.role_name'), v_role_id, role_id),
           user_login = IF(JSON_CONTAINS_PATH(v_patch, 'one', '$.user_login'), v_user_login, user_login),
           user_surname = IF(
               JSON_CONTAINS_PATH(v_patch, 'one', '$.user_surname'),
               NULLIF(TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(v_patch, '$.user_surname')), '')), ''),
               user_surname
           ),
           user_name = IF(
               JSON_CONTAINS_PATH(v_patch, 'one', '$.user_name'),
               NULLIF(TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(v_patch, '$.user_name')), '')), ''),
               user_name
           ),
           user_patronymic = IF(
               JSON_CONTAINS_PATH(v_patch, 'one', '$.user_patronymic'),
               NULLIF(TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(v_patch, '$.user_patronymic')), '')), ''),
               user_patronymic
           ),
           user_email = IF(
               JSON_CONTAINS_PATH(v_patch, 'one', '$.user_email'),
               NULLIF(TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(v_patch, '$.user_email')), '')), ''),
               user_email
           )
     WHERE user_id = p_user_id;

    SELECT TRUE AS ok, 'ok' AS message;
END$$

CREATE PROCEDURE set_user_status(
    IN p_user_id INT,
    IN p_user_status VARCHAR(32)
)
proc: BEGIN
    DECLARE v_error_message TEXT DEFAULT 'Ошибка SQL';

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        GET DIAGNOSTICS CONDITION 1 v_error_message = MESSAGE_TEXT;
        SELECT FALSE AS ok, COALESCE(v_error_message, 'Ошибка SQL') AS message;
    END;

    IF p_user_status IS NULL OR p_user_status NOT IN ('active', 'blocked') THEN
        SELECT FALSE AS ok, 'Недопустимый статус пользователя' AS message;
        LEAVE proc;
    END IF;

    IF p_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM users WHERE user_id = p_user_id) THEN
        SELECT FALSE AS ok, 'Пользователь не найден' AS message;
        LEAVE proc;
    END IF;

    UPDATE users
       SET user_status = p_user_status
     WHERE user_id = p_user_id;

    SELECT TRUE AS ok, 'ok' AS message;
END$$

DELIMITER ;
