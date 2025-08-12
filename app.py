#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import time
import yaml
from flask import Flask, render_template, jsonify, request
import sys
import platform
from flask_cors import CORS
import logging
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Версия ассетов для busting кэша
app.jinja_env.globals['ASSETS_VERSION'] = int(time.time())

# Настройка логирования
logging.basicConfig(level=logging.INFO)
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
    """Загружает конфигурацию одной страницы"""
    page_config = {
        'name': page_name,
        'attrs': {},
        'gui': {}
    }
    
    # Загружаем attrs.yaml
    attrs_file = os.path.join(page_path, 'attrs.yaml')
    if os.path.exists(attrs_file):
        try:
            with open(attrs_file, 'r', encoding='utf-8') as f:
                page_config['attrs'] = yaml.safe_load(f) or {}
        except Exception as e:
            logger.error(f"Ошибка загрузки {attrs_file}: {e}")
    
    # Загружаем gui.yaml
    gui_file = os.path.join(page_path, 'gui.yaml')
    if os.path.exists(gui_file):
        try:
            with open(gui_file, 'r', encoding='utf-8') as f:
                gui_config = yaml.safe_load(f) or {}
                page_config['gui'] = gui_config
                
                # Добавляем метаданные страницы из GUI конфигурации
                if 'url' in gui_config:
                    page_config['url'] = gui_config['url']
                if 'title' in gui_config:
                    page_config['title'] = gui_config['title']
                if 'description' in gui_config:
                    page_config['description'] = gui_config['description']
        except Exception as e:
            logger.error(f"Ошибка загрузки {gui_file}: {e}")
    
    return page_config



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
    logs = [
        {"timestamp": datetime.now().isoformat(), "level": "INFO", "message": "Система запущена"},
        {"timestamp": datetime.now().isoformat(), "level": "INFO", "message": "Конфигурация загружена"},
        {"timestamp": datetime.now().isoformat(), "level": "INFO", "message": f"Загружено страниц: {len(CONFIG['pages'])}"}
    ]
    return jsonify(logs)

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

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8000)
