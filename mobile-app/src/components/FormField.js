import { forwardRef, useContext, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { KeyboardScrollContext } from './ScreenShell';
import { useTheme } from '../context/ThemeContext';
import { getResponsiveMetrics, scaleStyleDefinitions } from '../theme';

const FormField = forwardRef(function FormField({
  label,
  value,
  onChangeText,
  icon = null,
  trailingIcon = null,
  onPressTrailingIcon,
  trailingAccessibilityLabel,
  placeholder,
  keyboardType = 'default',
  multiline = false,
  editable = true,
  secureTextEntry = false,
  autoCapitalize = 'sentences',
  returnKeyType = 'done',
  onSubmitEditing,
  blurOnSubmit,
  submitBehavior,
  onFocus,
  onBlur,
  showLockedIndicator = true,
  error = false,
  errorText = '',
}, ref) {
  const { palette, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const metrics = useMemo(() => getResponsiveMetrics(width), [width]);
  const styles = useMemo(() => createStyles(palette, isDark, metrics), [palette, isDark, metrics]);
  const resolvedBlurOnSubmit = blurOnSubmit ?? (returnKeyType === 'next' ? false : undefined);
  const [focused, setFocused] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef(null);
  const { scrollToField } = useContext(KeyboardScrollContext);

  useImperativeHandle(ref, () => inputRef.current);

  function handleFocus(event) {
    if (editable) {
      setFocused(true);
      Animated.spring(focusAnim, {
        toValue: 1,
        friction: 7,
        tension: 140,
        useNativeDriver: true,
      }).start();
      scrollToField(inputRef.current, multiline ? 150 : 120);
    }

    onFocus?.(event);
  }

  function handleBlur(event) {
    setFocused(false);
    Animated.spring(focusAnim, {
      toValue: 0,
      friction: 7,
      tension: 140,
      useNativeDriver: true,
    }).start();

    onBlur?.(event);
  }

  const animatedWrapStyle = {
    transform: [
      {
        scale: focusAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.015],
        }),
      },
      {
        translateY: focusAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -2],
        }),
      },
    ],
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        {!editable && showLockedIndicator ? (
          <Ionicons name="lock-closed-outline" size={15} color={palette.ink500} />
        ) : null}
        <Text
          style={[
            styles.label,
            focused ? styles.labelFocused : null,
            !editable ? styles.labelDisabled : null,
            error ? styles.labelError : null,
          ]}
        >
          {label}
        </Text>
      </View>
      <Animated.View
        style={[
          styles.inputWrap,
          animatedWrapStyle,
          focused ? styles.inputWrapFocused : null,
          !editable ? styles.inputWrapDisabled : null,
          error ? styles.inputWrapError : null,
        ]}
      >
        <View style={styles.inputRow}>
          {icon ? <View style={[styles.iconWrap, focused ? styles.iconWrapFocused : null]}>{icon}</View> : null}
          <TextInput
            ref={inputRef}
            editable={editable}
            multiline={multiline}
            onChangeText={onChangeText}
            onSubmitEditing={onSubmitEditing}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder || label}
            placeholderTextColor={palette.ink500}
            style={[
              styles.input,
              icon ? styles.inputWithIcon : null,
              trailingIcon ? styles.inputWithTrailingIcon : null,
              multiline ? styles.multiline : null,
              !editable ? styles.disabled : null,
            ]}
            value={value}
            keyboardType={keyboardType}
            secureTextEntry={secureTextEntry}
            autoCapitalize={autoCapitalize}
            returnKeyType={returnKeyType}
            blurOnSubmit={resolvedBlurOnSubmit}
            submitBehavior={submitBehavior}
          />
          {trailingIcon ? (
            <Pressable
              onPress={onPressTrailingIcon}
              accessibilityRole="button"
              accessibilityLabel={trailingAccessibilityLabel}
              hitSlop={8}
              style={({ pressed }) => [
                styles.trailingIconButton,
                pressed ? styles.trailingIconButtonPressed : null,
              ]}
            >
              {trailingIcon}
            </Pressable>
          ) : null}
        </View>
      </Animated.View>
      {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
    </View>
  );
});

export default FormField;

function createStyles(palette, isDark, metrics) {
  return StyleSheet.create(scaleStyleDefinitions({
    wrapper: {
      gap: 7,
    },
    label: {
      color: palette.ink900,
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    labelFocused: {
      color: palette.teal600,
    },
    labelDisabled: {
      color: palette.ink500,
    },
    labelError: {
      color: palette.errorText,
    },
    inputWrap: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDark ? '#2B465F' : '#BFD2E4',
      backgroundColor: isDark ? '#0B1724' : '#F5FAFF',
      shadowColor: '#0F172A',
      shadowOpacity: isDark ? 0.12 : 0.05,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 2,
    },
    inputWrapFocused: {
      borderColor: palette.teal500,
      backgroundColor: isDark ? '#0F2232' : '#FFFFFF',
      shadowOpacity: isDark ? 0.2 : 0.1,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
    inputWrapDisabled: {
      borderColor: isDark ? '#344B63' : '#C8D8E8',
      borderStyle: 'solid',
      borderWidth: 1,
      backgroundColor: isDark ? '#101C28' : '#EEF5FC',
    },
    inputWrapError: {
      borderColor: palette.errorText,
      borderStyle: 'solid',
      borderWidth: 1.5,
      backgroundColor: palette.errorBg,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconWrap: {
      width: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconWrapFocused: {
      transform: [{ scale: 1.05 }],
    },
    input: {
      minHeight: 56,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      color: palette.ink900,
      fontSize: 15,
      fontWeight: '800',
      flex: 1,
    },
    inputWithIcon: {
      paddingLeft: 0,
    },
    inputWithTrailingIcon: {
      paddingRight: 0,
    },
    trailingIconButton: {
      minWidth: 48,
      minHeight: 56,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
    },
    trailingIconButtonPressed: {
      opacity: 0.65,
    },
    multiline: {
      minHeight: 118,
      textAlignVertical: 'top',
    },
    disabled: {
      backgroundColor: isDark ? '#111820' : '#E5EBF2',
      color: palette.ink500,
    },
    errorText: {
      color: palette.errorText,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
  }, metrics));
}
