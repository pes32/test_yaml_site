export const EXPECTED_ATTRS_BY_TYPE = {
  button: [
    'button_0',
    'button_1',
    'button_2',
    'button_3',
    'button_4',
    'button_5',
    'button_backend_demo',
    'func_1',
    'func_2',
    'func_3',
    'func_4',
    'func_5',
    'modal_button',
    'modal_save_button'
  ],
  date: ['date_widget'],
  datetime: ['demo_datetime'],
  float: ['float_1', 'float_2', 'float_3', 'float_4'],
  img: ['img_1', 'img_2', 'img_3'],
  int: ['int_1', 'int_2', 'int_3', 'int_4', 'table_int_1'],
  ip: ['ip_1', 'ip_2'],
  ip_mask: ['ip_3', 'ip_4', 'table_ip_mask'],
  list: ['list_1', 'list_2', 'list_3', 'list_4', 'list_5', 'table_list', 'table_list_2', 'table_list_3'],
  split_button: ['button_6', 'func_6', 'func_7'],
  str: ['desc_1', 'str_1', 'str_2', 'str_3', 'str_4'],
  table: [
    'big_table',
    'demo_table_1',
    'demo_table_2',
    'demo_table_3',
    'demo_table_4',
    'demo_table_5',
    'demo_table_6',
    'demo_table_7',
    'table_v2_markup'
  ],
  text: ['all_table_yaml', 'attrs_str', 'gui_yaml', 'modal_gui_str', 'modal_str', 'text_1', 'text_2', 'text_3', 'text_4'],
  time: ['table_time', 'time_widget'],
  voc: ['table_voc', 'voc_1', 'voc_3']
} as const;

export const EXPECTED_ATTR_NAMES = Object.values(EXPECTED_ATTRS_BY_TYPE).flat().sort();
