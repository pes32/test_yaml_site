<template>
  <md3-field
    :widget-config="widgetConfig"
    :has-value="hasValue"
    :label-floats="labelFloats"
    :is-focused="isFocused"
    :wrap-extra="{ error: !!displayError }"
    :has-supporting="!!(widgetConfig.sup_text || displayError)"
  >
    <input
      v-model="inputValue"
      type="text"
      class="form-control widget-ip"
      data-table-editor-target="true"
      v-bind="tableCellRootAttrs"
      :disabled="widgetConfig.readonly"
      :tabindex="widgetConfig.readonly ? -1 : null"
      :maxlength="maxLength"
      :placeholder="showPlaceholder ? widgetConfig.placeholder : ''"
      @input="onInputHandler"
      @keydown="onKeyDown"
      @blur="handleBlur"
      @focus="onFocus"
    >
    <template #supporting>
      <span v-if="displayError" class="md3-error" v-text="displayError"></span>
      <span v-else v-text="widgetConfig.sup_text"></span>
    </template>
  </md3-field>
</template>

<script>
import { IP_CIDR_TEMPLATE, createIpLikeWidgetOptions, validateIPv4Cidr } from './ip_like_shared.js';

export default {
  name: 'IpMaskWidget',
  ...createIpLikeWidgetOptions(IP_CIDR_TEMPLATE, validateIPv4Cidr, true)
};
</script>
