# backend/database.py
"""Модуль для работы с PostgreSQL базой данных."""
from __future__ import annotations

import os
import logging
import psycopg2
import psycopg2.extras
import yaml
from typing import Dict, Any, List, Tuple, Optional
from contextlib import contextmanager

logger = logging.getLogger(__name__)

# Корневая директория проекта
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))


def load_db_settings() -> Dict[str, Any]:
    """Загружает настройки базы данных из db_settings.yaml."""
    db_settings_path = os.path.join(ROOT_DIR, "db_settings.yaml")
    
    try:
        with open(db_settings_path, "r", encoding="utf-8") as f:
            settings = yaml.safe_load(f) or {}
            
        # Валидация обязательных полей
        required_fields = ["address", "port", "db_name", "user", "password"]
        for field in required_fields:
            if field not in settings:
                raise ValueError(f"Отсутствует обязательное поле: {field}")
                
        return settings
    except FileNotFoundError:
        logger.error("Файл db_settings.yaml не найден")
        raise
    except yaml.YAMLError as e:
        logger.error("Ошибка парсинга db_settings.yaml: %s", e)
        raise
    except Exception as e:
        logger.error("Ошибка загрузки настроек БД: %s", e)
        raise


class DatabaseManager:
    """Менеджер для работы с PostgreSQL базой данных."""
    
    def __init__(self):
        """Инициализация менеджера БД."""
        self.settings = load_db_settings()
        self._connection_params = {
            "host": self.settings["address"],
            "port": self.settings["port"],
            "database": self.settings["db_name"],
            "user": self.settings["user"],
            "password": self.settings["password"],
        }
        logger.info("DatabaseManager инициализирован для БД %s@%s:%s", 
                   self.settings["db_name"], self.settings["address"], self.settings["port"])
    
    @contextmanager
    def get_connection(self):
        """Контекстный менеджер для получения соединения с БД."""
        conn = None
        try:
            conn = psycopg2.connect(**self._connection_params)
            yield conn
        except psycopg2.Error as e:
            logger.error("Ошибка подключения к БД: %s", e)
            if conn:
                conn.rollback()
            raise
        finally:
            if conn:
                conn.close()
    
    def test_connection(self) -> Dict[str, Any]:
        """Тестирует подключение к базе данных."""
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("SELECT version();")
                    version = cursor.fetchone()[0]
                    return {
                        "success": True,
                        "message": "Подключение успешно",
                        "version": version,
                        "database": self.settings["db_name"],
                        "host": self.settings["address"],
                        "port": self.settings["port"]
                    }
        except Exception as e:
            logger.error("Ошибка тестирования подключения: %s", e)
            return {
                "success": False,
                "error": str(e),
                "database": self.settings["db_name"],
                "host": self.settings["address"],
                "port": self.settings["port"]
            }
    
    def execute_query(self, query: str) -> Dict[str, Any]:
        """Выполняет SQL запрос и возвращает результат."""
        try:
            query = query.strip()
            if not query:
                return {
                    "success": False,
                    "error": "Пустой запрос"
                }
            
            with self.get_connection() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                    # Логируем запрос
                    logger.info("Выполнение SQL: %s", query[:200] + "..." if len(query) > 200 else query)
                    
                    cursor.execute(query)
                    
                    # Определяем тип запроса
                    query_lower = query.lower().strip()
                    
                    if query_lower.startswith(('select', 'with', 'show')):
                        # Запросы, возвращающие данные
                        rows = cursor.fetchall()
                        columns = [desc[0] for desc in cursor.description] if cursor.description else []
                        
                        # Конвертируем RealDictRow в обычные словари
                        data = [dict(row) for row in rows]
                        
                        return {
                            "success": True,
                            "data": data,
                            "columns": columns,
                            "row_count": len(data),
                            "query": query
                        }
                    
                    elif query_lower.startswith(('insert', 'update', 'delete')):
                        # Запросы, изменяющие данные
                        conn.commit()
                        affected_rows = cursor.rowcount
                        
                        return {
                            "success": True,
                            "affected_rows": affected_rows,
                            "message": f"Запрос выполнен успешно. Затронуто строк: {affected_rows}",
                            "query": query
                        }
                    
                    elif query_lower.startswith(('create', 'drop', 'alter', 'truncate')):
                        # DDL запросы
                        conn.commit()
                        
                        return {
                            "success": True,
                            "message": "DDL команда выполнена успешно",
                            "query": query
                        }
                    
                    else:
                        # Другие запросы
                        conn.commit()
                        return {
                            "success": True,
                            "message": "Запрос выполнен",
                            "query": query
                        }
                        
        except psycopg2.Error as e:
            error_msg = str(e).strip()
            logger.error("Ошибка выполнения SQL: %s", error_msg)
            return {
                "success": False,
                "error": error_msg,
                "query": query
            }
        except Exception as e:
            error_msg = str(e)
            logger.error("Неожиданная ошибка при выполнении SQL: %s", error_msg)
            return {
                "success": False,
                "error": f"Неожиданная ошибка: {error_msg}",
                "query": query
            }


# Глобальный экземпляр менеджера БД
db_manager = DatabaseManager()
