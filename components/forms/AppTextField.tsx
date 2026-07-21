import { forwardRef, useMemo } from 'react'
import {
  Platform,
  TextInput as RNTextInput,
  View,
  type TextInputProps as RNTextInputProps,
  type TextInput as RNTextInputType,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native'

import { useAppUi } from '~/lib/theme/useAppUi'

export type AppTextFieldProps = {
  value?: string
  onChangeText?: (text: string) => void
  onBlur?: RNTextInputProps['onBlur']
  onFocus?: RNTextInputProps['onFocus']
  onEndEditing?: RNTextInputProps['onEndEditing']
  placeholder?: string
  editable?: boolean
  disabled?: boolean
  invalid?: boolean
  /** email | tel | default | … */
  autoComplete?: RNTextInputProps['autoComplete']
  textContentType?: RNTextInputProps['textContentType']
  keyboardType?: RNTextInputProps['keyboardType']
  inputMode?: RNTextInputProps['inputMode']
  autoCapitalize?: RNTextInputProps['autoCapitalize']
  autoCorrect?: boolean
  secureTextEntry?: boolean
  returnKeyType?: RNTextInputProps['returnKeyType']
  enterKeyHint?: RNTextInputProps['enterKeyHint']
  accessibilityLabel?: string
  maxLength?: number
  /** Borderless field for use inside a decorated shell. */
  embedded?: boolean
  multiline?: boolean
  numberOfLines?: number
  style?: StyleProp<TextStyle>
  containerStyle?: StyleProp<ViewStyle>
  autoFocus?: boolean
  showSoftInputOnFocus?: boolean
  importantForAutofill?: RNTextInputProps['importantForAutofill']
}

/**
 * Cross-platform text field built on RN TextInput (not Tamagui Input).
 * Avoids focus/typing/paste breakage inside decorated shells on Android/iOS.
 */
export const AppTextField = forwardRef<RNTextInputType, AppTextFieldProps>(
  function AppTextField(
    {
      value,
      onChangeText,
      onBlur,
      onFocus,
      onEndEditing,
      placeholder,
      editable,
      disabled = false,
      invalid = false,
      autoComplete,
      textContentType,
      keyboardType,
      inputMode,
      autoCapitalize = 'none',
      autoCorrect = false,
      secureTextEntry,
      returnKeyType = 'done',
      enterKeyHint = 'done',
      accessibilityLabel,
      maxLength,
      embedded = false,
      multiline = false,
      numberOfLines,
      style,
      containerStyle,
      autoFocus,
      showSoftInputOnFocus = true,
      importantForAutofill,
    },
    ref,
  ) {
    const ui = useAppUi()
    const isEditable = editable ?? !disabled

    const container: ViewStyle = useMemo(
      () =>
        embedded
          ? {
              flex: 1,
              minWidth: 0,
              justifyContent: 'center',
            }
          : {
              width: '100%',
              minHeight: 52,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: invalid ? ui.error : ui.borderSubtle,
              backgroundColor: ui.surface,
              paddingHorizontal: 14,
              justifyContent: 'center',
            },
      [embedded, invalid, ui.borderSubtle, ui.error, ui.surface],
    )

    const inputStyle: TextStyle = useMemo(
      () => ({
        width: '100%',
        fontSize: 16,
        fontWeight: '500',
        color: ui.text,
        paddingVertical: Platform.OS === 'ios' ? 14 : 12,
        ...(Platform.OS === 'web'
          ? ({ outlineStyle: 'none', outlineWidth: 0 } as object)
          : null),
        backgroundColor: 'transparent',
        ...(multiline ? { minHeight: 96, textAlignVertical: 'top' as const } : null),
      }),
      [multiline, ui.text],
    )

    return (
      <View style={[container, containerStyle]} collapsable={false} pointerEvents="auto">
        <RNTextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          onFocus={onFocus}
          onEndEditing={(event) => {
            // Android adb / some IMEs update the native buffer without a reliable
            // onChangeText per key — sync from the final native text on end.
            const nativeText = event.nativeEvent.text
            if (typeof nativeText === 'string' && nativeText !== value) {
              onChangeText?.(nativeText)
            }
            onEndEditing?.(event)
          }}
          placeholder={placeholder}
          placeholderTextColor={ui.textMuted}
          editable={isEditable}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          autoComplete={autoComplete}
          textContentType={textContentType}
          keyboardType={keyboardType}
          inputMode={inputMode}
          secureTextEntry={secureTextEntry}
          returnKeyType={returnKeyType}
          enterKeyHint={enterKeyHint}
          accessibilityLabel={accessibilityLabel}
          maxLength={maxLength}
          multiline={multiline}
          numberOfLines={numberOfLines}
          autoFocus={autoFocus}
          showSoftInputOnFocus={showSoftInputOnFocus}
          importantForAutofill={
            importantForAutofill ??
            (autoComplete === 'email' || autoComplete === 'tel' || autoComplete === 'sms-otp'
              ? 'yes'
              : 'auto')
          }
          // Android autofill / keyboard suggestions
          {...(Platform.OS === 'android'
            ? {
                underlineColorAndroid: 'transparent',
                textAlignVertical: multiline ? ('top' as const) : ('center' as const),
              }
            : null)}
          style={[inputStyle, style]}
        />
      </View>
    )
  },
)
