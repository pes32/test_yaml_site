=============================================================================
СПРАВОЧНИК ПО ATTRS
=============================================================================
-----------------------------------------------------------------------------
1. ОБЩАЯ ФОРМА ATTRS-ВИДЖЕТА
-----------------------------------------------------------------------------
<attr_name>:
  widget: str | text | int | float | list | ip | ip_mask | date | time | datetime | button | split_button | img | table
  label: "Подпись виджета"                                             # Подпись виджета
  sup_text: "Текст под виджетом"                                       # Подпись под виджетом
  width: 350 | "20rem" | "100%"                                        # Ширина поля
  readonly: true                                                       # Только для чтения
  default: ...                                                         # Значение по умолчанию 
  regex: "^выражение$"                                                 # Regex для str/text/int/float/ip/ip_mask
  err_text: "Текст ошибки для regex/валидации"                         # Текст ошибки для regex
  placeholder: "Подсказка внутри поля"                                 # Текст внутри виджета
  rows: число                                                          # Для table/text - число строк
  editable: false                                                      # Для list - выбор только из списка, без поиска.
  multiselect: true                                                    # Для list - множественный выбор
  icon: "file.svg"                                                     # Для button/split_button - Иконка для кнопки
  hint: "Tooltip для icon-only кнопки"                                 # Для img - хинт
  fon: true                                                            # Для button/split_button - фон
  size: 24                                                             # Для button/split_button - размер для иконки
  width: 40 | 500 | "20rem"                                            # ширина виджетов
  source: ["Опция 1", "Опция 2", "Опция 3"]                            # Для list - источник данных
  source: "templates/file.pdf"                                         # Для button/split_button - источник данных
  source: [["a", "b"], ["c", "d"]]                                     # Для table - источник данных в таблицу
  url: "/path" | "https://..."                                         # Для button/split_button - адрес для открытия
  sticky_header: true                                                  # Для table. Включить липкий заголовок по умолчанию
  sort: false                                                          # Для table. Отключить сортировку
  zebra: false                                                         # Для table. Отключить зебру
  line_numbers: true                                                   # Для table. Вкл. нумерацию строк
  table_lazy: true | false                                             # Для table. Вкл. ленивую загрузку
  dialog:                                                              # Для button/split_button - диалог с параметрами
    title: "Заголовок"
    text: "Текст"
    accept: "Да"
    cancel: "Отмена"
table_attrs: |                                                         # Разметка столбцов для таблиц
    attr /Заголовок
    attr2 /Заголовок 2 :150
  command: modal_id -ui                                                # переход к модальным окнам.
  command: "save"                                                     # команды для бэка

split_button notes:
  - dropdown-only control без primary action
  - порядок действий: url -> source -> command
  - malformed строки в multiline DSL пропускаются и дают только console.warn

#####

надо делать для бд:

загрузку в поля
отправку из полей
загрузку по кнопке
отправку по кнопке
автозагрузку при открытии страницы
автосохранение по таймеру/триггеру