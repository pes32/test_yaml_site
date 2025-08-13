#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import time
import yaml
from flask import Flask, render_template, jsonify, request, send_from_directory
import sys
import platform
from flask_cors import CORS
import logging
from logging.handlers import RotatingFileHandler
import re
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Версия ассетов для busting кэша
app.jinja_env.globals['ASSETS_VERSION'] = int(time.time())

# Настройка логирования в файл с ротацией
def setup_logging():
    log_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'logs')
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, 'app.log')

    # Базовый логгер уровня INFO
    logging.basicConfig(level=logging.INFO)
    formatter = logging.Formatter('%(asctime)s %(levelname)s %(name)s: %(message)s')

    file_handler = RotatingFileHandler(log_file, maxBytes=2 * 1024 * 1024, backupCount=3, encoding='utf-8')
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(formatter)

    # Подключаем к логгерам приложения и werkzeug
    if not any(isinstance(h, RotatingFileHandler) for h in app.logger.handlers):
        app.logger.addHandler(file_handler)
    root_logger = logging.getLogger()
    if not any(isinstance(h, RotatingFileHandler) for h in root_logger.handlers):
        root_logger.addHandler(file_handler)

    return log_file

LOG_FILE_PATH = setup_logging()
logger = logging.getLogger(__name__)

def load_pages_config():
    """Загружает конфигурацию всех страниц из папки pages"""
    pages_config = {}
    
    # Ищем все папки в директории pages
    pages_dir = 'pages'
    if os.path.exists(pages_dir):
        for page_folder in os.listdir(pages_dir):
            page_path = os.path.join(pages_dir, page_folder)
            if os.path.isdir(page_path):
                page_config = load_page_config(page_path, page_folder)
                if page_config:
                    pages_config[page_folder] = page_config
    
    return pages_config

def load_page_config(page_path, page_name):
    """Загружает конфигурацию одной страницы, автоматически определяя тип файлов по содержимому"""
    page_config = {
        'name': page_name,
        'attrs': {},
        'gui': {}
    }
    
    # Загружаем ВСЕ .yaml файлы в папке страницы
    try:
        if os.path.isdir(page_path):
            yaml_files = []
            for fname in os.listdir(page_path):
                if fname.endswith('.yaml') or fname.endswith('.yml'):
                    yaml_files.append(os.path.join(page_path, fname))
            
            # Сортируем файлы для стабильного порядка загрузки
            yaml_files.sort()
            
            for fpath in yaml_files:
                try:
                    with open(fpath, 'r', encoding='utf-8') as f:
                        loaded = yaml.safe_load(f) or {}
                        if not isinstance(loaded, dict):
                            logger.warning(f"Файл {fpath} не содержит словарь, пропущен")
                            continue
                        
                        # Автоматически определяем тип файла по содержимому
                        file_type = determine_file_type(loaded, fpath)
                        
                        if file_type == 'attrs':
                            # Файл с атрибутами - объединяем с существующими
                            page_config['attrs'].update(loaded)
                            logger.info(f"Загружен файл атрибутов: {fpath}")
                        elif file_type == 'gui':
                            # Файл с GUI - объединяем с существующим GUI
                            page_config['gui'].update(loaded)
                            logger.info(f"Загружен файл GUI: {fpath}")
                            
                            # Добавляем метаданные страницы из GUI конфигурации
                            if 'url' in loaded:
                                page_config['url'] = loaded['url']
                            if 'title' in loaded:
                                page_config['title'] = loaded['title']
                            if 'description' in loaded:
                                page_config['description'] = loaded['description']
                        else:
                            logger.warning(f"Не удалось определить тип файла {fpath}, пропущен")
                            
                except Exception as e:
                    logger.error(f"Ошибка загрузки {fpath}: {e}")
                    
    except Exception as e:
        logger.error(f"Ошибка при загрузке файлов в {page_path}: {e}")
    
    return page_config

def determine_file_type(content, filepath):
    """
    Простое определение типа YAML файла по содержимому
    Возвращает: 'attrs', 'gui' или None
    """
    if not isinstance(content, dict):
        return None
    
    # GUI файл - если есть url (это однозначный индикатор)
    if 'url' in content:
        return 'gui'
    
    # Атрибуты - если есть widget (это однозначный индикатор)
    if 'widget' in content:
        return 'attrs'
    
    # Проверяем вложенные значения для атрибутов
    for value in content.values():
        if isinstance(value, dict) and 'widget' in value:
            return 'attrs'
    
    # Если не можем определить, считаем по умолчанию атрибутами
    return 'attrs'



# Загрузка конфигурации
def load_config():
    """Загружает всю конфигурацию системы"""
    config = {
        # Гарантируем наличие раздела legacy, чтобы избежать KeyError
        'legacy': {}
    }
    
    # Загружаем новые страницы
    config['pages'] = load_pages_config()
    
    # Объединяем все атрибуты
    all_attrs = {}
    
    # Добавляем атрибуты из legacy (если есть)
    legacy_attrs = (config.get('legacy') or {}).get('attrs') or {}
    if isinstance(legacy_attrs, dict):
        all_attrs.update(legacy_attrs)
    
    # Добавляем атрибуты из страниц
    for page_name, page_config in config['pages'].items():
        if 'attrs' in page_config:
            all_attrs.update(page_config['attrs'])
    
    config['all_attrs'] = all_attrs
    
    return config

# Глобальная конфигурация
CONFIG = load_config()

# Динамическая регистрация роутов страниц по url из gui.yaml
def _has_rule(path: str) -> bool:
    try:
        for r in app.url_map.iter_rules():
            if str(r) == path:
                return True
    except Exception:
        pass
    return False

def _make_page_view(page_name: str):
    def _view():
        page_config = CONFIG['pages'][page_name]
        if 'name' not in page_config:
            page_config['name'] = page_name
        return render_template('page.html', page_config=page_config, all_attrs=CONFIG['all_attrs'])
    return _view

def register_page_urls_from_config():
    pages = CONFIG.get('pages', {})
    for name, cfg in pages.items():
        path = cfg.get('url')
        if not path:
            continue
        if not path.startswith('/'):
            path = '/' + path
        # Не перерегистрируем существующие
        if _has_rule(path):
            continue
        endpoint = f"page_by_url__{name}"
        try:
            app.add_url_rule(path, endpoint=endpoint, view_func=_make_page_view(name))
            logger.info(f"Зарегистрирован маршрут страницы '{name}' по URL: {path}")
        except Exception as e:
            logger.error(f"Не удалось зарегистрировать маршрут для страницы '{name}' по URL {path}: {e}")

# Регистрируем маршруты один раз при старте
register_page_urls_from_config()

@app.route('/')
def index():
    """Главная страница - страница main"""
    return render_template('page.html', page_config=CONFIG['pages']['main'], all_attrs=CONFIG['all_attrs'])

@app.route('/pages')
def pages_list():
    """Список всех доступных страниц"""
    return render_template('index.html', config=CONFIG)

@app.route('/page/<page_name>')
def page(page_name):
    """Отдельная страница"""
    if page_name in CONFIG['pages']:
        page_config = CONFIG['pages'][page_name]
        # Добавляем имя страницы в конфигурацию
        if 'name' not in page_config:
            page_config['name'] = page_name
        return render_template('page.html', page_config=page_config, all_attrs=CONFIG['all_attrs'])
    else:
        return "Страница не найдена", 404

@app.route('/api/config')
def get_config():
    """API для получения всей конфигурации"""
    return jsonify(CONFIG)

@app.route('/api/pages')
def get_pages():
    """API для получения списка страниц"""
    pages_list = []
    for page_name, page_config in CONFIG['pages'].items():
        pages_list.append({
            'name': page_name,
            'title': page_config.get('title', page_name),
            'description': page_config.get('description', ''),
            'url': page_config.get('url', f'/page/{page_name}')
        })
    return jsonify(pages_list)

@app.route('/api/page/<page_name>')
def get_page_config(page_name):
    """API для получения конфигурации конкретной страницы"""
    if page_name in CONFIG['pages']:
        return jsonify({
            'page': CONFIG['pages'][page_name],
            'all_attrs': CONFIG['all_attrs']
        })
    else:
        return jsonify({'error': 'Страница не найдена'}), 404

@app.route('/api/attrs')
def get_attrs():
    """API для получения всех атрибутов"""
    return jsonify(CONFIG['all_attrs'])

@app.route('/api/reload', methods=['POST'])
def reload_config():
    """API для принудительной перезагрузки конфигурации"""
    global CONFIG
    try:
        CONFIG = load_config()
        # При перезагрузке конфигурации попробуем зарегистрировать новые URL, если появились
        register_page_urls_from_config()
        return jsonify({
            "success": True,
            "message": "Конфигурация перезагружена",
            "pages_count": len(CONFIG['pages'])
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/debug')
def debug_panel():
    """Дебаг-панель"""
    return render_template('debug.html')

@app.route('/api/debug/logs')
def get_logs():
    """API для получения логов"""
    log_file = LOG_FILE_PATH
    parsed_logs = []
    try:
        if os.path.exists(log_file):
            with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()[-300:]  # последние 300 строк
            pattern = re.compile(r'^(?P<ts>[^ ]+ [^ ]+)\s+(?P<level>[A-Z]+)\s+(?P<logger>[^:]+):\s+(?P<msg>.*)$')
            for line in lines:
                line = line.rstrip('\n')
                m = pattern.match(line)
                if m:
                    parsed_logs.append({
                        'timestamp': m.group('ts'),
                        'level': m.group('level'),
                        'message': m.group('msg')
                    })
                else:
                    parsed_logs.append({
                        'timestamp': '',
                        'level': 'INFO',
                        'message': line
                    })
        else:
            # Файла ещё нет — вернём подсказку
            parsed_logs = [{
                'timestamp': datetime.now().isoformat(),
                'level': 'INFO',
                'message': 'Файл лога ещё не создан. Он появится при первом лог-сообщении.'
            }]
    except Exception as e:
        parsed_logs = [{
            'timestamp': datetime.now().isoformat(),
            'level': 'ERROR',
            'message': f'Ошибка чтения лога: {e}'
        }]
    return jsonify({"logs": parsed_logs, "path": log_file})

@app.route('/api/execute', methods=['POST'])
def execute_command():
    """API для выполнения команд"""
    data = request.get_json()
    command = data.get('command')
    params = data.get('params', {})
    
    logger.info(f"Выполнение команды: {command} с параметрами: {params}")
    
    return jsonify({
        "success": True,
        "command": command,
        "result": f"Команда {command} выполнена успешно"
    })

# -------- Debug: структура и модули --------
@app.route('/api/debug/structure')
def get_backend_structure():
    """Возвращает структуру бэкенда: роуты, страницы, счётчики и окружение"""
    # Роуты
    routes = []
    for r in app.url_map.iter_rules():
        # Пропускаем статику
        if r.endpoint == 'static':
            continue
        routes.append({
            'rule': str(r),
            'endpoint': r.endpoint,
            'methods': sorted(list(r.methods or []))
        })

    # Страницы
    pages = []
    for name, cfg in CONFIG.get('pages', {}).items():
        pages.append({
            'name': name,
            'url': cfg.get('url', f'/page/{name}'),
            'title': cfg.get('title', name),
            'description': cfg.get('description', ''),
            'attrs_count': len((cfg or {}).get('attrs', {}))
        })

    structure = {
        'app': {
            'routes': routes
        },
        'pages': pages,
        'counters': {
            'pages_count': len(CONFIG.get('pages', {})),
            'all_attrs_count': len(CONFIG.get('all_attrs', {}))
        },
        'environment': {
            'python_version': sys.version.split('\n')[0],
            'platform': platform.platform(),
        }
    }
    return jsonify(structure)


@app.route('/api/debug/modules')
def get_loaded_modules():
    """Возвращает список загруженных python-модулей"""
    try:
        modules = sorted([m for m in sys.modules.keys()])
        return jsonify({
            'count': len(modules),
            'modules': modules
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Маршрут для статических иконок из templates/icons
@app.route('/templates/icons/<path:filename>')
def serve_icon(filename):
    """Отдает иконки из папки templates/icons"""
    try:
        return send_from_directory('templates/icons', filename, mimetype='image/svg+xml')
    except Exception as e:
        logger.error(f"Ошибка при загрузке иконки {filename}: {e}")
        return f"Ошибка загрузки иконки: {e}", 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8000)
